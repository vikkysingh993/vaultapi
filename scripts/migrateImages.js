require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../models');

const migrate = async () => {
  try {
    await db.connectDB(); // Ensure tables exist and connection is established

    const uploadsDir = path.join(__dirname, '..', 'uploads');
    const folders = ['tokens', 'profile'];

    let migratedCount = 0;

    for (const folder of folders) {
      const folderPath = path.join(uploadsDir, folder);
      if (!fs.existsSync(folderPath)) continue;

      const files = fs.readdirSync(folderPath);
      for (const file of files) {
        const filePath = path.join(folderPath, file);
        const stats = fs.statSync(filePath);
        if (!stats.isFile()) continue;

        const buffer = fs.readFileSync(filePath);
        let mimeType = 'image/jpeg';
        if (file.toLowerCase().endsWith('.png')) mimeType = 'image/png';
        if (file.toLowerCase().endsWith('.gif')) mimeType = 'image/gif';
        if (file.toLowerCase().endsWith('.svg')) mimeType = 'image/svg+xml';
        if (file.toLowerCase().endsWith('.webp')) mimeType = 'image/webp';

        // Insert into images table
        const imageRecord = await db.Image.create(buffer, mimeType);
        const newPath = `/api/images/${imageRecord.id}`;

        // Depending on folder, update the DB records
        const oldPath = `/uploads/${folder}/${file}`;
        const oldPathFilename = file; // For coins that only saved filename

        if (folder === 'tokens') {
          // Update tokens table
          await db.pool.query(
            'UPDATE tokens SET logo = $1 WHERE logo = $2',
            [newPath, oldPath]
          );
          
          // Update coins table (some might have just filename, some might have full path)
          await db.pool.query(
            'UPDATE coins SET logo = $1 WHERE logo = $2 OR logo = $3',
            [newPath, oldPath, oldPathFilename]
          );
        } else if (folder === 'profile') {
          // Update users table
          await db.pool.query(
            'UPDATE users SET "profileImage" = $1 WHERE "profileImage" = $2',
            [newPath, oldPath]
          );
        }
        
        console.log(`Migrated ${oldPath} to ${newPath}`);
        migratedCount++;
      }
    }
    
    console.log(`Migration complete! Successfully migrated ${migratedCount} images to DB.`);
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
};

migrate();

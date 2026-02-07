const { sequelize } = require('./config/db');

async function setupPlansTable() {
  try {
    await sequelize.authenticate();
    console.log('Connected to database');

    // Drop existing plans table if it exists
    await sequelize.query('DROP TABLE IF EXISTS plans');
    console.log('Dropped existing plans table');

    // Create new plans table
    await sequelize.query(`
      CREATE TABLE plans (
        id INT AUTO_INCREMENT PRIMARY KEY,
        months INT NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        status ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE'
      )
    `);
    console.log('Created new plans table');

    // Insert sample data
    await sequelize.query(`
      INSERT INTO plans (months, price, status) VALUES
      (3, 99.99, 'ACTIVE'),
      (6, 179.99, 'ACTIVE'),
      (9, 249.99, 'ACTIVE'),
      (12, 299.99, 'ACTIVE')
    `);
    console.log('Inserted sample plans data');

    await sequelize.close();
    console.log('Setup completed successfully!');
  } catch (error) {
    console.error('Setup error:', error);
    process.exit(1);
  }
}

setupPlansTable();

const pool = require('../config/db');

const createImageTable = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS images (
        id BIGSERIAL PRIMARY KEY,
        data BYTEA NOT NULL,
        mime_type VARCHAR(50) NOT NULL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (error) {
    console.error('Error creating images table:', error.message);
  }
};

const Image = {
  create: async (dataBuffer, mimeType) => {
    try {
      const result = await pool.query(
        'INSERT INTO images (data, mime_type) VALUES ($1, $2) RETURNING id',
        [dataBuffer, mimeType]
      );
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  },

  findById: async (id) => {
    try {
      const result = await pool.query('SELECT data, mime_type FROM images WHERE id = $1', [id]);
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  },

  init: createImageTable
};

module.exports = Image;

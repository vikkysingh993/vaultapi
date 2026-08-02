const pool = require('../config/db');

const createSettingTable = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        "tokenFee" DECIMAL(10, 4) NOT NULL DEFAULT 0,
        "processingFee" DECIMAL(10, 4) NOT NULL DEFAULT 0,
        "receiveWallet" VARCHAR(100) NOT NULL DEFAULT '',
        "marketCapMultiplier" DECIMAL(10, 4) DEFAULT 1.0,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (error) {
    console.error('Error creating settings table:', error.message);
  }
};

const Setting = {
  create: async (data) => {
    try {
      const { tokenFee, processingFee, receiveWallet, marketCapMultiplier = 1.0 } = data;
      const result = await pool.query(
        'INSERT INTO settings ("tokenFee", "processingFee", "receiveWallet", "marketCapMultiplier") VALUES ($1, $2, $3, $4) RETURNING *',
        [tokenFee, processingFee, receiveWallet, marketCapMultiplier]
      );
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  },

  findById: async (id) => {
    try {
      const result = await pool.query('SELECT * FROM settings WHERE id = $1', [id]);
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  },

  findAll: async () => {
    try {
      const result = await pool.query('SELECT * FROM settings LIMIT 1');
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  },

  update: async (id, data) => {
    try {
      const keys = Object.keys(data);
      const values = Object.values(data);
      const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(',');
      
      const result = await pool.query(
        `UPDATE settings SET ${setClause}, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $${keys.length + 1} RETURNING *`,
        [...values, id]
      );
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  },

  init: createSettingTable
};

module.exports = Setting;

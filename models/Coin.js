const pool = require('../config/db');

// Create coins table if it doesn't exist
const createCoinTable = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS coins (
        id SERIAL PRIMARY KEY,
        token_name VARCHAR(255) NOT NULL,
        symbol VARCHAR(50) NOT NULL,
        supply VARCHAR(255) NOT NULL,
        chain VARCHAR(100) NOT NULL,
        logo VARCHAR(255),
        contract_address VARCHAR(255) NOT NULL,
        created_by INTEGER,
        status INTEGER DEFAULT 1,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (error) {
    console.error('Error creating coins table:', error.message);
  }
};

const Coin = {
  // Create a new coin
  create: async (coinData) => {
    try {
      const keys = Object.keys(coinData);
      const values = Object.values(coinData);
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
      const columns = keys.map(k => `"${k}"`).join(',');
      
      const result = await pool.query(
        `INSERT INTO coins (${columns}) VALUES (${placeholders}) RETURNING *`,
        values
      );
      
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  },

  // Find coin by ID
  findById: async (id) => {
    try {
      const result = await pool.query('SELECT * FROM coins WHERE id = $1', [id]);
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  },

  // Find all coins
  findAll: async () => {
    try {
      const result = await pool.query('SELECT * FROM coins ORDER BY "createdAt" DESC');
      return result.rows;
    } catch (error) {
      throw error;
    }
  },

  // Update coin
  update: async (id, updateData) => {
    try {
      const keys = Object.keys(updateData);
      const values = Object.values(updateData);
      const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(',');
      
      const result = await pool.query(
        `UPDATE coins SET ${setClause}, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $${keys.length + 1} RETURNING *`,
        [...values, id]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  },

  // Delete coin
  delete: async (id) => {
    try {
      const result = await pool.query('DELETE FROM coins WHERE id = $1 RETURNING *', [id]);
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  },

  // Find coins by creator
  findByCreator: async (creatorId) => {
    try {
      const result = await pool.query('SELECT * FROM coins WHERE created_by = $1', [creatorId]);
      return result.rows;
    } catch (error) {
      throw error;
    }
  },

  // Initialize table
  init: createCoinTable
};

module.exports = Coin;

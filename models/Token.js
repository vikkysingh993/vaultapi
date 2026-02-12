const pool = require('../config/db');

const createTokenTable = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tokens (
        id BIGSERIAL PRIMARY KEY,
        "userId" BIGINT,
        name VARCHAR(100) NOT NULL,
        symbol VARCHAR(20) NOT NULL,
        description VARCHAR(255) NOT NULL,
        supply DECIMAL(36, 18) NOT NULL,
        chain VARCHAR(50) NOT NULL,
        "tokenAddress" VARCHAR(100) NOT NULL UNIQUE,
        "creatorWallet" VARCHAR(100) NOT NULL,
        "feePaid" DECIMAL(18, 8) DEFAULT 0,
        "feeTxHash" VARCHAR(120),
        "liquidityTx" VARCHAR(120),
        "pairAddress" VARCHAR(100),
        "lpLocked" DECIMAL(36, 18),
        "swapTx" VARCHAR(120),
        status VARCHAR(20) DEFAULT 'PENDING',
        "liquidityResponse" JSONB,
        "swapResponse" JSONB,
        logo VARCHAR(255),
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (error) {
    console.error('Error creating tokens table:', error.message);
  }
};

const Token = {
  create: async (data) => {
    try {
      const keys = Object.keys(data);
      const values = Object.values(data);
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
      const columns = keys.map(k => `"${k}"`).join(',');
      
      const result = await pool.query(
        `INSERT INTO tokens (${columns}) VALUES (${placeholders}) RETURNING *`,
        values
      );
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  },

  findById: async (id) => {
    try {
      const result = await pool.query('SELECT * FROM tokens WHERE id = $1', [id]);
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  },

  findByAddress: async (address, chain) => {
    try {
      const result = await pool.query(
        `SELECT *
        FROM tokens
        WHERE "tokenAddress" = $1
          AND chain = $2`,
        [address, chain]
      );

      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  },


  findAll: async () => {
    try {
      const result = await pool.query('SELECT * FROM tokens ORDER BY "createdAt" DESC Limit 6');
      return result.rows;
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
        `UPDATE tokens SET ${setClause}, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $${keys.length + 1} RETURNING *`,
        [...values, id]
      );
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  },

  delete: async (id) => {
    try {
      const result = await pool.query('DELETE FROM tokens WHERE id = $1 RETURNING *', [id]);
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  },

  init: createTokenTable
};

module.exports = Token;

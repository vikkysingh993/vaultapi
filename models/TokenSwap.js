const pool = require('../config/db');

const createTokenSwapTable = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS token_swaps (
        id BIGSERIAL PRIMARY KEY,
        "userId" BIGINT,
        "walletAddress" VARCHAR(42) NOT NULL,
        "swapType" VARCHAR(10) NOT NULL,
        "tokenIn" VARCHAR(42) NOT NULL,
        "tokenOut" VARCHAR(42) NOT NULL,
        "amountIn" DECIMAL(36, 18) NOT NULL,
        "txHash" VARCHAR(66) NOT NULL UNIQUE,
        "chainId" INTEGER DEFAULT 11155111,
        status VARCHAR(20) DEFAULT 'SUCCESS',
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (error) {
    console.error('Error creating token_swaps table:', error.message);
  }
};

const TokenSwap = {
  create: async (data) => {
    try {
      const keys = Object.keys(data);
      const values = Object.values(data);
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
      const columns = keys.map(k => `"${k}"`).join(',');
      
      const result = await pool.query(
        `INSERT INTO token_swaps (${columns}) VALUES (${placeholders}) RETURNING *`,
        values
      );
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  },

  findById: async (id) => {
    try {
      const result = await pool.query('SELECT * FROM token_swaps WHERE id = $1', [id]);
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  },

  findByWallet: async (wallet) => {
    try {
      const result = await pool.query('SELECT * FROM token_swaps WHERE "walletAddress" = $1 ORDER BY "createdAt" DESC', [wallet]);
      return result.rows;
    } catch (error) {
      throw error;
    }
  },

  findAll: async () => {
    try {
      const result = await pool.query('SELECT * FROM token_swaps ORDER BY "createdAt" DESC');
      return result.rows;
    } catch (error) {
      throw error;
    }
  },

  init: createTokenSwapTable
};

module.exports = TokenSwap;

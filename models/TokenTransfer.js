const pool = require('../config/db');

const createTokenTransferTable = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS token_transfers (
        id BIGSERIAL PRIMARY KEY,
        "userId" BIGINT NOT NULL,
        "stakeId" BIGINT,
        "fromAddress" VARCHAR(42) NOT NULL,
        "toAddress" VARCHAR(42) NOT NULL,
        amount VARCHAR(255) NOT NULL,
        "txHash" VARCHAR(66) UNIQUE,
        status VARCHAR(20) DEFAULT 'PENDING',
        chain VARCHAR(100),
        "startDate" TIMESTAMP,
        "endDate" TIMESTAMP,
        "isClaimed" BOOLEAN DEFAULT false,
        "claimTransferId" BIGINT,
        type VARCHAR(20) DEFAULT 'TRANSFER',
        "claimable_amount" VARCHAR(255),
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (error) {
    console.error('Error creating token_transfers table:', error.message);
  }
};

const TokenTransfer = {
  create: async (data) => {
    try {
      const keys = Object.keys(data);
      const values = Object.values(data);
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
      const columns = keys.map(k => `"${k}"`).join(',');
      
      const result = await pool.query(
        `INSERT INTO token_transfers (${columns}) VALUES (${placeholders}) RETURNING *`,
        values
      );
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  },

  findById: async (id) => {
    try {
      const result = await pool.query('SELECT * FROM token_transfers WHERE id = $1', [id]);
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  },

  findByPlan: async (stakeId) => {
    try {
      const result = await pool.query('SELECT * FROM token_transfers WHERE "stakeId" = $1', [stakeId]);
      return result.rows;
    } catch (error) {
      throw error;
    }
  },

  findByUser: async (userId) => {
    try {
      const result = await pool.query('SELECT * FROM token_transfers WHERE "userId" = $1', [userId]);
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
        `UPDATE token_transfers SET ${setClause}, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $${keys.length + 1} RETURNING *`,
        [...values, id]
      );
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  },

  delete: async (id) => {
    try {
      const result = await pool.query('DELETE FROM token_transfers WHERE id = $1 RETURNING *', [id]);
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  },

  init: createTokenTransferTable
};

module.exports = TokenTransfer;
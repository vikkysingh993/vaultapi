const pool = require('../config/db');

const createFaqTable = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS faqs (
        id SERIAL PRIMARY KEY,
        question VARCHAR(255) NOT NULL,
        answer TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'ACTIVE',
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (error) {
    console.error('Error creating faqs table:', error.message);
  }
};

const Faq = {
  create: async (data) => {
    try {
      const { question, answer, status = 'ACTIVE' } = data;
      const result = await pool.query(
        'INSERT INTO faqs (question, answer, status) VALUES ($1, $2, $3) RETURNING *',
        [question, answer, status]
      );
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  },

  findById: async (id) => {
    try {
      const result = await pool.query('SELECT * FROM faqs WHERE id = $1', [id]);
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  },

  findAll: async () => {
    try {
      const result = await pool.query("SELECT * FROM faqs WHERE status = 'ACTIVE'");
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
        `UPDATE faqs SET ${setClause}, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $${keys.length + 1} RETURNING *`,
        [...values, id]
      );
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  },

  delete: async (id) => {
    try {
      const result = await pool.query('DELETE FROM faqs WHERE id = $1 RETURNING *', [id]);
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  },

  init: createFaqTable
};

module.exports = Faq;

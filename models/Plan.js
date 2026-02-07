const pool = require('../config/db');

const createPlanTable = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS plans (
        id SERIAL PRIMARY KEY,
        months INTEGER NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        status VARCHAR(20) DEFAULT 'ACTIVE',
        apy DECIMAL(5, 2) NOT NULL
      );
    `);
  } catch (error) {
    console.error('Error creating plans table:', error.message);
  }
};

const Plan = {
  create: async (data) => {
    try {
      const { months, price, status = 'ACTIVE', apy } = data;
      const result = await pool.query(
        'INSERT INTO plans (months, price, status, apy) VALUES ($1, $2, $3, $4) RETURNING *',
        [months, price, status, apy]
      );
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  },

  findById: async (id) => {
    try {
      const result = await pool.query('SELECT * FROM plans WHERE id = $1', [id]);
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  },

  findAll: async () => {
    try {
      const result = await pool.query('SELECT * FROM plans');
      return result.rows;
    } catch (error) {
      throw error;
    }
  },

  update: async (id, data) => {
    try {
      const keys = Object.keys(data);
      const values = Object.values(data);
      const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(',');
      
      const result = await pool.query(
        `UPDATE plans SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`,
        [...values, id]
      );
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  },

  delete: async (id) => {
    try {
      const result = await pool.query('DELETE FROM plans WHERE id = $1 RETURNING *', [id]);
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  },

  init: createPlanTable
};

module.exports = Plan;

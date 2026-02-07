const bcrypt = require('bcryptjs');
const pool = require('../config/db');

// Create users table if it doesn't exist
const createUserTable = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255),
        email VARCHAR(255) UNIQUE,
        password VARCHAR(255),
        "walletAddress" VARCHAR(255) UNIQUE,
        "chainId" INTEGER,
        "chainName" VARCHAR(255),
        "walletType" VARCHAR(255),
        "occTokenBalance" BIGINT DEFAULT 0,
        role INTEGER DEFAULT 0,
        "currentToken" TEXT,
        "tokenIssuedAt" TIMESTAMP,
        "tokenExpiresAt" TIMESTAMP,
        "isTokenActive" BOOLEAN DEFAULT false,
        "profileImage" VARCHAR(255),
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (error) {
    console.error('Error creating users table:', error.message);
  }
};

const User = {
  // Create a new user
  create: async (userData) => {
    try {
      if (userData.password) {
        const salt = await bcrypt.genSalt(10);
        userData.password = await bcrypt.hash(userData.password, salt);
      }
      
      const keys = Object.keys(userData);
      const values = Object.values(userData);
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
      const columns = keys.map(k => `"${k}"`).join(',');
      
      const result = await pool.query(
        `INSERT INTO users (${columns}) VALUES (${placeholders}) RETURNING *`,
        values
      );
      
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  },

  // Find user by ID
  findById: async (id) => {
    try {
      const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  },

  // Find user by email
  findByEmail: async (email) => {
    try {
      const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  },

  // Find user by wallet address
  findByWallet: async (walletAddress) => {
    try {
      const result = await pool.query('SELECT * FROM users WHERE "walletAddress" = $1', [walletAddress]);
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  },

  // Find user by name (username login ke liye)
  findByName: async (name) => {
    try {
      const result = await pool.query(
        'SELECT * FROM users WHERE name = $1',
        [name]
      );
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  },

  // Update user
  update: async (id, updateData) => {
    try {
      const keys = Object.keys(updateData);
      const values = Object.values(updateData);
      const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(',');
      
      const result = await pool.query(
        `UPDATE users SET ${setClause}, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $${keys.length + 1} RETURNING *`,
        [...values, id]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  },

  // Delete user
  delete: async (id) => {
    try {
      const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING *', [id]);
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  },

  // Find all users
  findAll: async () => {
    try {
      const result = await pool.query('SELECT * FROM users');
      return result.rows;
    } catch (error) {
      throw error;
    }
  },

  // Match password
  matchPassword: async (enteredPassword, hashedPassword) => {
    return await bcrypt.compare(enteredPassword, hashedPassword);
  },

  // Initialize table
  init: createUserTable
};

module.exports = User;

const pool = require('../config/db');

// Import all models
const User = require('./User');
const Coin = require('./Coin');
const Plan = require('./Plan');
const Token = require('./Token');
const TokenTransfer = require('./TokenTransfer');
const StaticPage = require('./StaticPage');
const Setting = require('./Setting');
const TokenSwap = require('./TokenSwap');
const Faq = require('./Faq');

// Initialize all tables on startup
const initializeTables = async () => {
  try {
    await User.init();
    await Coin.init();
    await Plan.init();
    await Token.init();
    await TokenTransfer.init();
    await StaticPage.init();
    await Setting.init();
    await TokenSwap.init();
    await Faq.init();
    console.log('✅ All tables initialized');
  } catch (error) {
    console.error('❌ Error initializing tables:', error.message);
  }
};

// Connect to database
const connectDB = async () => {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('✅ PostgreSQL connected');
    await initializeTables();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    throw error;
  }
};

module.exports = {
  pool,
  connectDB,
  User,
  Coin,
  Plan,
  Token,
  TokenTransfer,
  StaticPage,
  Setting,
  TokenSwap,
  Faq
};

const { Pool } = require("pg");

const dbConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: String(process.env.DB_PASSWORD),
  database: process.env.DB_NAME,
};

console.log('DB Config:', {
  host: dbConfig.host,
  port: dbConfig.port,
  user: dbConfig.user,
  password: dbConfig.password ? '***' : 'undefined',
  database: dbConfig.database
});

const pool = new Pool(dbConfig);

pool.on("connect", () => {
  console.log("✅ PostgreSQL connected");
});

module.exports = pool;

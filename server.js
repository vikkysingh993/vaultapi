const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const rateLimit = require("express-rate-limit");


// Load env vars FIRST before requiring models
dotenv.config();

const { connectDB } = require('./models');
const authRoutes = require('./routes/authRoutes');
const coinRoutes = require("./routes/coinRoutes");
const plansRoutes = require('./routes/plansRoutes');
const walletRoutes = require('./routes/walletRoutes');
const tokenFlowRoutes = require("./routes/tokenFlowRoute");
const userRoutes = require("./routes/userRoutes");
const staticPageRoutes = require("./routes/staticPageRoutes");
const publicRoutes = require("./routes/publicRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const adminSettingRoutes = require("./routes/adminSettingRoutes");  
const swapRoutes = require("./routes/swapRoutes");
const faqRoutes =  require("./routes/faqRoutes");

// Connect to database
connectDB();

const app = express();

// Body parser
app.use(express.json());


// Enable CORS
app.use(cors());

// 🔒 GLOBAL RATE LIMIT (API protection)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per IP
  message: {
    success: false,
    message: "Too many requests, please try again later."
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api", apiLimiter);


// Mount routers
app.use('/api/auth', authRoutes);
// app.use("/api/auth", rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 20
// }));
app.use('/api/plans', plansRoutes);
app.use('/api/coins', coinRoutes);
app.use('/api/wallet', walletRoutes);
app.use("/api/token-flow", tokenFlowRoutes);
app.use("/api/admin", userRoutes);

app.use("/api/admin/pages", staticPageRoutes);

app.use("/api", publicRoutes);
app.use("/api/admin", dashboardRoutes);
app.use("/api/admin", adminSettingRoutes);
app.use("/api/swaps", swapRoutes);
app.use("/api/admin", faqRoutes);
app.use("/uploads", express.static("uploads"));

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  // Database will be connected via connectDB() above
  
  app.listen(PORT, () =>
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`)
  );
};

startServer();

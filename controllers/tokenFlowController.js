
const db = require('../models');
const { Op, fn, col, literal } = require("sequelize");
const Token = db.Token;
const TokenSwap = db.TokenSwap;

// Import chain-specific dex services
const dexServiceEth = require("../services/dexServiceEth");
const dexServicePol = require("../services/dexServicePol");
const dexServiceSonic = require("../services/dexServiceSonic");
const dexServiceBase = require("../services/dexServiceBase");

// Helper function to get dex service based on chain
// const getDexService = (chain) => {
//   const chainMap = {
//     'ethereum': dexServiceEth,
//     'polygon': dexServicePol,
//     'sonic': dexServiceSonic,
//     'base': dexServiceBase,
//   };
  
//   const service = chainMap[chain?.toLowerCase()];
//   if (!service) {
//     throw new Error(`Unsupported chain: ${chain}`);
//   }
//   return service;
// };

function getDexService(chain) {
  const normalized = String(chain).toLowerCase().trim();
  console.log("DEX CHAIN RAW:", chain);
  console.log("DEX CHAIN NORMALIZED:", normalized);

  switch (normalized) {
    case "ethereum":
    case "eth":
    case "sepolia":
      return dexServiceEth;

    case "polygon":
    case "matic":
      return dexServicePol;

    case "sonic":
      return dexServiceSonic;

    case "base":
      return dexServiceBase;

    default:
      throw new Error(`Unsupported chain at runtime: "${normalized}"`);
  }
}



// Helper function to get USDT token address based on chain
function getUSDTAddress(chain) {
  switch (chain) {
    case "polygon":
      return process.env.USDT_TOKEN_ADDRESS_POL;

    case "ethereum":
    case "sepolia":
      return process.env.USDT_TOKEN_ADDRESS_ETH;

    case "sonic":
      return process.env.VITE_OCC_TOKEN_ADDRESS;
    case "base":
      return process.env.USDT_TOKEN_ADDRESS_BASE;


    default:
      throw new Error(`USDT not configured for chain: ${chain}`);
  }
}

// const getUSDTAddress = (chain) => {
//   const usdtMap = {
//     'ethereum': process.env.USDT_TOKEN_ADDRESS_ETH || '0xdAC17F958D2ee523a2206206994597C13D831ec7',
//     'polygon': process.env.USDT_TOKEN_ADDRESS_POL || '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
//     'sonic': process.env.USDT_TOKEN_ADDRESS_SONIC || '0xa4AB1A20c710cc956B72fe4C57b65613d1Bb8727',
//     'base': process.env.USDT_TOKEN_ADDRESS_BASE || '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
//   };
  
//   const address = usdtMap[chain?.toLowerCase()];
//   if (!address) {
//     throw new Error(`USDT address not configured for chain: ${chain}`);
//   }
//   return address;
// };

exports.createTokenFlow = async (req, res) => {
  try {
    const {
      name,
      symbol,
      supply,
      description,
      chain,
      tokenAddress,
      creatorWallet,
      feePaid,
      feeTxHash,
    } = req.body;
    console.log('req body' , req.body);
    // ✅ STEP 1: DUPLICATE CHECK (CORRECT FUNCTION)
    const existingToken = await Token.findByAddress(tokenAddress, chain);

    if (existingToken) {
      return res.status(409).json({
        success: false,
        error: "Token already exists",
        token: existingToken,
      });
    }
    // Validate chain
    if (!chain) {
      return res.status(400).json({
        success: false,
        error: 'Chain is required'
      });
    }

    // 👇 IMAGE PATH
    let logoPath = null;
    if (req.file) {
      logoPath = `/uploads/tokens/${req.file.filename}`;
    }
    console.log("log chain:", chain);
    const token = await Token.create({
      userId: req.user?.id || null,
      name,
      symbol,
      supply,
      description,
      chain,
      tokenAddress,
      creatorWallet,
      feePaid,
      feeTxHash,
      logo: logoPath, // 👈 DB me save
    });

    // Get the correct dex service based on chain
    const normalizedChain = String(chain).toLowerCase().trim();
    console.log("SELECTING DEX SERVICE FOR CHAIN:", normalizedChain);
    const dexService = getDexService(normalizedChain);
    const usdtAddress = getUSDTAddress(normalizedChain);


    console.log('dexService selected:', dexService === dexServiceEth ? 'ETH' : dexService === dexServicePol ? 'POLYGON' : dexService === dexServiceSonic ? 'SONIC' : 'BASE');
    
    const tokenb = supply*50/100; // 50% of total supply
    console.log("Set liquidity perameter:", usdtAddress, tokenAddress, supply, tokenb);
    const liquidity = await dexService.autoLiquidityAndLock(
      usdtAddress, // USDT address for this chain
      req.body.tokenAddress,
      3,3
      // supply,
      // tokenb.toString()
    );
    await Token.update(token.id, {
      liquidityResponse: liquidity,
      status: "COMPLETED",
    });


    res.json({ success: true, token });

  } catch (e) {
    console.error('CREATE TOKEN FLOW ERROR:', e);
    
    // Send detailed DEX error to frontend popup
    console.error("DEX ERROR:", e);

    return res.status(400).json({
      error: "LIQUIDITY_FAILED",
      code: e.code || "DEX_ERROR",
    });

  }
};
// 🔹 GET ALL LAUNCHED TOKENS
exports.getAllTokens = async (req, res) => {
  try {
    const tokens = await Token.findAll({
      attributes: [
        "id",
        "name",
        "symbol",
        "supply",
        "chain",
        "tokenAddress",
        "creatorWallet",
        "feePaid",
        "pairAddress",
        "lpLocked",
        "status",
        "createdAt",
        "liquidityResponse",
      ],
      order: [["id", "DESC"]],
    });

    return res.json({
      success: true,
      total: tokens.length,
      data: tokens,
    });
  } catch (error) {
    console.error("Get tokens error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch tokens",
    });
  }
};


exports.getLaunchpadTokens = async (req, res) => {
  try {
    const { type = "all" } = req.query;

    const now = new Date();
    const before24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    let where = {};
    let include = [];

    // 🔹 NEW COINS (last 24h)
    if (type === "new") {
      where.createdAt = { [Op.gte]: before24h };
    }

    // 🔹 OLD COINS (older than 24h)
    if (type === "old") {
      where.createdAt = { [Op.lt]: before24h };
    }

    // 🔹 LAST TRADE (joined with swaps)
    if (type === "trade") {
      include.push({
        model: TokenSwap,
        attributes: [],
        required: true, // INNER JOIN
      });
    }

    const tokens = await Token.findAll({
      where,
      include,
      attributes: [
        "id",
        "name",
        "symbol",
        "description",
        "logo",
        "tokenAddress",
        "createdAt",
        "liquidityResponse",
      ],
      order: [["createdAt", "DESC"]],
      limit: 20,
      distinct: true,
    });

    res.json({
      success: true,
      data: tokens,
    });
  } catch (err) {
    console.error("LAUNCHPAD TOKENS ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch tokens",
    });
  }
};


exports.getTokenByAddress = async (req, res) => {
  try {
    const { address } = req.params;

    const token = await Token.findByAddress(address);

    if (!token) {
      return res.status(404).json({
        success: false,
        message: "Token not found",
      });
    }

    res.json({
      success: true,
      data: token,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

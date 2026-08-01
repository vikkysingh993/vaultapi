const db = require('../models');
const Token = db.Token;
const { ethers } = require("ethers");

const dexServiceEth = require("../services/dexServiceEth");
const dexServicePol = require("../services/dexServicePol");
const dexServiceSonic = require("../services/dexServiceSonic");
const dexServiceBase = require("../services/dexServiceBase");

const ERC20_TRANSFER_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)"
];

const RPC_MAP = {
  ethereum: process.env.RPC_URL_ETH,
  eth:      process.env.RPC_URL_ETH,
  sepolia:  process.env.RPC_URL_ETH,
  polygon:  process.env.RPC_URL_POL,
  matic:    process.env.RPC_URL_POL,
  sonic:    process.env.RPC_URL_SONIC,
  base:     process.env.RPC_URL_BASE,
};

async function transferTokenOnChain(chain, tokenAddress, toAddress, amount) {
  const rpc = RPC_MAP[chain];
  if (!rpc) throw new Error(`No RPC configured for chain: ${chain}`);
  const provider = new ethers.JsonRpcProvider(rpc);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const token = new ethers.Contract(tokenAddress, ERC20_TRANSFER_ABI, wallet);
  const decimals = await token.decimals();
  const tx = await token.transfer(toAddress, ethers.parseUnits(amount.toString(), decimals));
  const receipt = await tx.wait();
  return receipt.hash;
}

function getDexService(chain) {
  switch (chain) {
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
      throw new Error(`Unsupported chain: "${chain}"`);
  }
}

function getUSDTAddress(chain) {
  switch (chain) {
    case "ethereum":
    case "eth":
    case "sepolia":
      return process.env.USDT_TOKEN_ADDRESS_ETH;
    case "polygon":
    case "matic":
      return process.env.USDT_TOKEN_ADDRESS_POL;
    case "sonic":
      return process.env.OCC_TOKEN_ADDRESS_SONIC;
    case "base":
      return process.env.USDT_TOKEN_ADDRESS_BASE;
    default:
      throw new Error(`USDT not configured for chain: ${chain}`);
  }
}

exports.createTokenFlow = async (req, res) => {
  try {
    const {
      name, symbol, supply, description, tagline, projectCategory,
      chain, tokenAddress, creatorWallet, feePaid, feeTxHash, feeType,
      website, twitter, telegram, discord
    } = req.body;

    console.log("req body", req.body);

    if (!chain) {
      return res.status(400).json({ success: false, error: "Chain is required" });
    }

    const normalizedChain = String(chain).toLowerCase().trim();

    // Duplicate check
    const existingToken = await Token.findByAddress(tokenAddress, normalizedChain);
    if (existingToken) {
      return res.status(409).json({ success: false, error: "Token already exists", token: existingToken });
    }

    const logoPath = req.file ? `/uploads/tokens/${req.file.filename}` : null;

    // Save token record immediately so it exists even if later steps fail
    const token = await Token.create({
      userId: req.user?.id || null,
      name, symbol, supply, description, tagline, projectCategory,
      chain: normalizedChain, tokenAddress, creatorWallet,
      feePaid, feeTxHash, logo: logoPath,
      website, twitter, telegram, discord
    });

    const DEV_WALLET     = process.env.DEV_WALLET;
    const BURN_WALLET    = process.env.BURN_WALLET;
    const TREGIDY_WALLET = process.env.TREGIDY_WALLET;

    if (!DEV_WALLET || !BURN_WALLET || !TREGIDY_WALLET) {
      return res.status(500).json({ success: false, error: "Wallet env vars not configured" });
    }

    const dexService  = getDexService(normalizedChain);
    const usdtAddress = getUSDTAddress(normalizedChain);

    // Token distribution split
    const liquidityTokenAmount = (Number(supply) * 50) / 100; // 50% → liquidity pool
    const devAmount            = (Number(supply) * 20) / 100; // 20% → dev wallet
    const burnAmount           = (Number(supply) * 30) / 100; // 30% → burn wallet
    const usdtLiquidityAmount  = Number(feePaid) || 0;

    if (feeType === "FREE" || usdtLiquidityAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: "LIQUIDITY_FEE_REQUIRED",
        userMessage: "Liquidity fee is required before token distribution. Please retry the launch and approve the fee transfer."
      });
    }

    console.log("Token distribution:", { liquidityTokenAmount, devAmount, burnAmount, usdtLiquidityAmount });

    // ===========================================================
    // STEP 1: Liquidity + LP Lock
    //   a) approve(USDT/OCC → router)  — done inside autoLiquidityAndLock
    //   b) addLiquidity(fee token + 50% new token)
    //   c) approve(LP → lock contract)
    //   d) createLock(LP tokens)
    // ===========================================================
    // The user already transferred the fee to BACKEND_WALLET on the frontend.
    // The backend wallet therefore holds the USDT/OCC ready for liquidity.
    const liquidity = await dexService.autoLiquidityAndLock(
      usdtAddress,          // tokenA: fee token (USDT or OCC)
      tokenAddress,         // tokenB: newly deployed token
      usdtLiquidityAmount.toString(), // amountA: fee paid
      liquidityTokenAmount.toString(),// amountB: 50% of supply
      TREGIDY_WALLET        // LP recipient after lock
    );

    if (!liquidity.success) {
      return res.status(400).json({ errorType: liquidity.errorType, userMessage: liquidity.userMessage });
    }
    console.log("DEX LIQUIDITY RESULT:", liquidity);

    // ===========================================================
    // STEP 2: Token distribution  (runs AFTER liquidity is locked)
    //   e) transfer(20% → DEV_WALLET)
    //   f) transfer(30% → BURN_WALLET)
    // ===========================================================

    // 20% → Developer wallet
    const devTxHash = await transferTokenOnChain(normalizedChain, tokenAddress, DEV_WALLET, devAmount);
    console.log("DEV transfer tx:", devTxHash);

    // 30% → Burn wallet
    const burnTxHash = await transferTokenOnChain(normalizedChain, tokenAddress, BURN_WALLET, burnAmount);
    console.log("BURN transfer tx:", burnTxHash);

    // ===========================================================
    // STEP 3: Update DB record with full result
    // ===========================================================
    await Token.update(token.id, {
      liquidityResponse: {
        ...liquidity,
        devTxHash,
        burnTxHash,
        tregidyWallet: TREGIDY_WALLET,
        devWallet: DEV_WALLET,
        burnWallet: BURN_WALLET,
        distribution: { liquidity: "50%", dev: "20%", burn: "30%" }
      },
      status: "COMPLETED",
      lpLocked: liquidity.lockTx != null ? 1 : 0,
    });

    res.json({
      success: true,
      token,
      distribution: { liquidityTokenAmount, devAmount, burnAmount, usdtLiquidityAmount, devTxHash, burnTxHash }
    });

  } catch (e) {
    console.error("CREATE TOKEN FLOW ERROR:", e);
    return res.status(400).json({
      error: "LIQUIDITY_FAILED",
      code: e.code || "DEX_ERROR",
      userMessage: e.message
    });
  }
};

exports.getAllTokens = async (req, res) => {
  try {
    const result = await db.pool.query(
      `SELECT id, name, symbol, supply, chain, "tokenAddress", "creatorWallet",
              "feePaid", "pairAddress", "lpLocked", status, "createdAt", "liquidityResponse"
       FROM tokens ORDER BY id DESC`
    );
    return res.json({ success: true, total: result.rows.length, data: result.rows });
  } catch (error) {
    console.error("Get tokens error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch tokens" });
  }
};

exports.getLaunchpadTokens = async (req, res) => {
  try {
    const { type = "all", search = "", walletAddress = "" } = req.query;
    const trimmedSearch = String(search || "").trim();

    // Fetch global market cap multiplier
    let multiplier = 1.0;
    try {
      const setRes = await db.pool.query('SELECT "marketCapMultiplier" FROM settings LIMIT 1');
      if (setRes.rows[0] && setRes.rows[0].marketCapMultiplier) {
        multiplier = parseFloat(setRes.rows[0].marketCapMultiplier);
      }
    } catch (e) { console.error(e); }

    const formatTokens = (rows) => rows.map(t => {
      let marketCap = "0";
      if (t.liquidityResponse && t.liquidityResponse.lpAmount) {
        const lp = parseFloat(t.liquidityResponse.lpAmount) / 1e18;
        const supply = parseFloat(t.supply || 0);
        marketCap = (lp * supply * multiplier).toFixed(2);
      }
      return { ...t, marketCap };
    });

    // --- Trending: coins with actual swap (buy/sell) activity in the last 7 days ---
    if (type === "trending") {
      const trendingQuery = `
        SELECT t.id, t.name, t.symbol, t.description, t.tagline, t.logo,
               t."tokenAddress", t."createdAt", t."liquidityResponse", t.supply,
               MAX(ts."createdAt") AS "lastSwapAt"
        FROM tokens t
        INNER JOIN token_swaps ts
          ON ts."tokenIn" = t."tokenAddress"
          OR ts."tokenOut" = t."tokenAddress"
        WHERE ts."createdAt" >= NOW() - INTERVAL '7 days'
        GROUP BY t.id
        ORDER BY "lastSwapAt" DESC
        LIMIT 10
      `;
      const result = await db.pool.query(trendingQuery);
      return res.json({ success: true, data: formatTokens(result.rows) });
    }

    // --- Last trade: coins the user recently traded ---
    if (type === "trade") {
      const wallet = String(walletAddress || "").trim();
      if (!wallet) {
        return res.json({ success: true, data: [] });
      }
      const tradeQuery = `
        SELECT DISTINCT ON (t.id)
               t.id, t.name, t.symbol, t.description, t.tagline, t.logo,
               t."tokenAddress", t."createdAt", t."liquidityResponse", t.supply,
               ts."createdAt" AS "lastTradeAt"
        FROM tokens t
        INNER JOIN token_swaps ts
          ON (ts."tokenIn" = t."tokenAddress" OR ts."tokenOut" = t."tokenAddress")
        WHERE ts."walletAddress" = $1
        ORDER BY t.id, ts."createdAt" DESC
      `;
      const raw = await db.pool.query(tradeQuery, [wallet]);
      // Sort by lastTradeAt DESC and limit 20
      const sorted = raw.rows
        .sort((a, b) => new Date(b.lastTradeAt) - new Date(a.lastTradeAt))
        .slice(0, 20);
      return res.json({ success: true, data: formatTokens(sorted) });
    }

    // --- Standard types: all, new, old, 6 ---
    const params = [];
    const conditions = [];

    if (trimmedSearch) {
      params.push(`%${trimmedSearch}%`);
      const i = params.length;
      conditions.push(`(name ILIKE $${i} OR symbol ILIKE $${i} OR description ILIKE $${i})`);
    }

    let orderBy = '"createdAt" DESC';
    let limitClause = '';

    if (type === "new") {
      orderBy = '"createdAt" DESC';
      limitClause = 'LIMIT 20';
    } else if (type === "old") {
      orderBy = '"createdAt" ASC';
      limitClause = 'LIMIT 20';
    } else if (type === "6") {
      limitClause = 'LIMIT 6';
    }
    // type === "all" => no limit, DESC order (defaults)

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await db.pool.query(
      `SELECT id, name, symbol, description, tagline, logo, "tokenAddress", "createdAt", "liquidityResponse", supply
       FROM tokens ${where} ORDER BY ${orderBy} ${limitClause}`,
      params
    );

    res.json({ success: true, data: formatTokens(result.rows) });
  } catch (err) {
    console.error("LAUNCHPAD TOKENS ERROR:", err);
    res.status(500).json({ success: false, message: "Failed to fetch tokens" });
  }
};

exports.getTokenByAddress = async (req, res) => {
  try {
    const { address } = req.params;
    const result = await db.pool.query(
      `SELECT * FROM tokens WHERE "tokenAddress" = $1 LIMIT 1`,
      [address]
    );
    let token = result.rows[0];
    if (!token) {
      return res.status(404).json({ success: false, message: "Token not found" });
    }

    // Calculate Market Cap
    let multiplier = 1.0;
    try {
      const setRes = await db.pool.query('SELECT "marketCapMultiplier" FROM settings LIMIT 1');
      if (setRes.rows[0] && setRes.rows[0].marketCapMultiplier) {
        multiplier = parseFloat(setRes.rows[0].marketCapMultiplier);
      }
    } catch (e) { console.error(e); }

    let marketCap = "0";
    if (token.liquidityResponse && token.liquidityResponse.lpAmount) {
      const lp = parseFloat(token.liquidityResponse.lpAmount) / 1e18;
      const supply = parseFloat(token.supply || 0);
      marketCap = (lp * supply * multiplier).toFixed(2);
    }
    
    token = { ...token, marketCap };

    res.json({ success: true, data: token });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

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

    // liquidityTokenAmount = 50% of total supply (new token side)
    // usdtLiquidityAmount  = fee the user paid in USDT/OCC (that's what backend wallet holds)
    const liquidityTokenAmount = (Number(supply) * 50) / 100;
    const devAmount            = (Number(supply) * 20) / 100;
    const burnAmount           = (Number(supply) * 30) / 100;
    const usdtLiquidityAmount  = Number(feePaid) || 0;
    const isFree               = feeType === "FREE" || usdtLiquidityAmount === 0;

    console.log("Token distribution:", { liquidityTokenAmount, devAmount, burnAmount, usdtLiquidityAmount, isFree });

    // 1️⃣ 50% token + feePaid OCC/USDT → Liquidity + LP Lock (skip if free deployment)
    let liquidity = { success: true, skipped: true, lockTx: null };

    if (!isFree) {
      liquidity = await dexService.autoLiquidityAndLock(
        usdtAddress,
        tokenAddress,
        usdtLiquidityAmount.toString(),
        liquidityTokenAmount.toString(),
        TREGIDY_WALLET
      );

      if (!liquidity.success) {
        return res.status(400).json({ errorType: liquidity.errorType, userMessage: liquidity.userMessage });
      }
      console.log("DEX LIQUIDITY RESULT:", liquidity);
    } else {
      console.log("⚡ FREE deployment — skipping liquidity, distributing all tokens directly");
    }

    // 2️⃣ 20% → Developer wallet
    const devTxHash = await transferTokenOnChain(normalizedChain, tokenAddress, DEV_WALLET, devAmount);
    console.log("DEV transfer tx:", devTxHash);

    // 3️⃣ 30% → Burn wallet
    const burnTxHash = await transferTokenOnChain(normalizedChain, tokenAddress, BURN_WALLET, burnAmount);
    console.log("BURN transfer tx:", burnTxHash);

    // 4️⃣ FREE only: send the 50% liquidity portion to TREGIDY_WALLET instead
    let tregidyTxHash = null;
    if (isFree) {
      tregidyTxHash = await transferTokenOnChain(normalizedChain, tokenAddress, TREGIDY_WALLET, liquidityTokenAmount);
      console.log("TREGIDY transfer tx (free):", tregidyTxHash);
    }

    await Token.update(token.id, {
      liquidityResponse: {
        ...liquidity,
        devTxHash,
        burnTxHash,
        tregidyTxHash,
        tregidyWallet: TREGIDY_WALLET,
        devWallet: DEV_WALLET,
        burnWallet: BURN_WALLET,
        distribution: { liquidity: isFree ? "0% (free)" : "50%", dev: "20%", burn: "30%" }
      },
      status: "COMPLETED",
      lpLocked: liquidity.lockTx != null ? 1 : 0,
    });

    res.json({
      success: true,
      token,
      distribution: { liquidityTokenAmount, devAmount, burnAmount, usdtLiquidityAmount, devTxHash, burnTxHash, tregidyTxHash }
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
    const { type = "all", search = "" } = req.query;
    const trimmedSearch = String(search || "").trim();
    const limit = type === "6" ? 6 : 20;

    const params = [];
    const conditions = [];

    if (trimmedSearch) {
      params.push(`%${trimmedSearch}%`);
      const i = params.length;
      conditions.push(`(name ILIKE $${i} OR symbol ILIKE $${i} OR description ILIKE $${i})`);
    }

    if (type === "new") {
      params.push(new Date(Date.now() - 24 * 60 * 60 * 1000));
      conditions.push(`"createdAt" >= $${params.length}`);
    } else if (type === "old") {
      params.push(new Date(Date.now() - 24 * 60 * 60 * 1000));
      conditions.push(`"createdAt" < $${params.length}`);
    } else if (type === "trade") {
      conditions.push(`EXISTS (SELECT 1 FROM token_swaps ts WHERE ts."tokenAddress" = tokens."tokenAddress")`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    params.push(limit);

    const result = await db.pool.query(
      `SELECT id, name, symbol, description, logo, "tokenAddress", "createdAt", "liquidityResponse"
       FROM tokens ${where} ORDER BY "createdAt" DESC LIMIT $${params.length}`,
      params
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("LAUNCHPAD TOKENS ERROR:", err);
    res.status(500).json({ success: false, message: "Failed to fetch tokens" });
  }
};

exports.getTokenByAddress = async (req, res) => {
  try {
    const { address } = req.params;
    const token = await Token.findByAddress(address);
    if (!token) {
      return res.status(404).json({ success: false, message: "Token not found" });
    }
    res.json({ success: true, data: token });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

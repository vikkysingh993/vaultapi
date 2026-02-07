const Coin = require("../models/Coin");
const User = require("../models/User");

const MINIMUM_OCC_FOR_FREE_LAUNCH = 1; // 1000 OCC tokens
const STANDARD_LAUNCH_FEE = 0.1; // Standard fee in SOL or equivalent

exports.createCoin = async (req, res) => {
  try {
    const {
      token_name,
      symbol,
      supply,
      chain,
      contract_address,
      created_by
    } = req.body;

    if (!token_name || !symbol || !supply || !chain || !contract_address) {
      return res.json({ success: false, message: "Missing required fields" });
    }

    // Check if user qualifies for free launch
    let feeRequired = true;
    let feeAmount = STANDARD_LAUNCH_FEE;
    let userOccBalance = 0;

    if (created_by) {
      try {
        const user = await User.findByPk(created_by);
        if (user && user.occTokenBalance) {
          userOccBalance = parseInt(user.occTokenBalance, 10);
          
          if (userOccBalance >= MINIMUM_OCC_FOR_FREE_LAUNCH) {
            feeRequired = false;
            feeAmount = 0;
            console.log(`✅ User ${created_by} is eligible for free launch! OCC Balance: ${userOccBalance}`);
          } else {
            console.log(`⚠️ User ${created_by} requires fee. OCC Balance: ${userOccBalance} (needs ${MINIMUM_OCC_FOR_FREE_LAUNCH})`);
          }
        }
      } catch (err) {
        console.error("❌ Error checking user OCC balance:", err);
        // Continue with fee if we can't check balance
      }
    }

    const logo = req.file ? req.file.filename : null;

    const coin = await Coin.create({
      token_name,
      symbol,
      supply,
      chain,
      logo,
      contract_address,
      created_by,
      status: 1
    });

    return res.json({
      success: true,
      message: "Coin created successfully",
      coin,
      launchFee: {
        required: feeRequired,
        amount: feeAmount,
        userOccBalance: userOccBalance,
        minimumForFree: MINIMUM_OCC_FOR_FREE_LAUNCH,
      }
    });

  } catch (err) {
    console.log(err);
    return res.json({ success: false, message: "Server error" });
  }
};

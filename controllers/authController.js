const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
// const db = require('../models'); // Assuming 'models' directory exports the db object
// const { get } = require('mongoose');
// const User = db.User;

const User = require('../models/User'); // pg-based User



// @desc    Connect Wallet
// @route   POST /api/auth/connect-wallet
// @access  Public
const connectWallet = async (req, res) => {
  const { walletAddress, chainId, chainName, walletType, occTokenBalance } = req.body;

  try {
    if (!walletAddress) {
      return res.status(400).json({ message: "Wallet address required" });
    }

    let user = await User.findByWallet(walletAddress);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 1000);

    if (user) {
      const token = generateToken(user.id, user.role);

      user = await User.update(user.id, {
        occTokenBalance: occTokenBalance ?? user.occTokenBalance,
        chainId,
        chainName,
        walletType,
        currentToken: token,
        tokenIssuedAt: now,
        tokenExpiresAt: expiresAt,
        isTokenActive: true,
      });

      return res.json({
        success: true,
        data: user,
        token,
        isNewUser: false,
      });
    }

    // NEW USER
    const tempToken = generateToken(null, 0);

    user = await User.create({
      name: `User-${walletAddress.slice(0, 6)}`,
      password: `wallet_${walletAddress}`,
      walletAddress,
      chainId,
      chainName,
      walletType,
      occTokenBalance: occTokenBalance || 0,
      role: 0,
      currentToken: tempToken,
      tokenIssuedAt: now,
      tokenExpiresAt: expiresAt,
      isTokenActive: true,
    });

    const finalToken = generateToken(user.id, user.role);

    await User.update(user.id, {
      currentToken: finalToken,
    });

    return res.status(201).json({
      success: true,
      data: user,
      token: finalToken,
      isNewUser: true,
    });

  } catch (err) {
    console.error("❌ Wallet error:", err);
    res.status(500).json({ message: err.message });
  }
};

// @desc    Disconnect Wallet
// @route   POST /api/auth/disconnect-wallet
// @access  Public
// req.user JWT middleware se aa raha hai
const disconnectWallet = async (req, res) => {
  try {
    console.log('âŒ Disconnecting wallet for user ID:', req.user);
    const userId = req.user.id;
    await User.update(userId, {
      isTokenActive: false,
        currentToken: null,
    });

    return res.json({
      success: true,
      message: "Wallet disconnected",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }

};


// @desc    Wallet Login with 30s token (Mobile App)
// @route   POST /api/auth/wallet-login
// @access  Public
// const walletLogin = async (req, res) => {
//   const { walletAddresses } = req.body;

//   try {
//     // Validate wallet addresses - accept both JSON string and array
//     if (!walletAddresses) {
//       return res.status(400).json({ 
//         success: false,
//         message: 'walletAddresses is required',
//         code: 'INVALID_WALLET'
//       });
//     }

//     // Parse JSON string to array (if it's a string)
//     let addressesArray;
//     if (typeof walletAddresses === 'string') {
//       try {
//         addressesArray = JSON.parse(walletAddresses);
//       } catch (e) {
//         return res.status(400).json({
//           success: false,
//           message: 'walletAddresses must be a valid JSON',
//           code: 'INVALID_JSON'
//         });
//       }
//     } else if (Array.isArray(walletAddresses)) {
//       addressesArray = walletAddresses;
//     } else {
//       return res.status(400).json({
//         success: false,
//         message: 'walletAddresses must be array or JSON string',
//         code: 'INVALID_FORMAT'
//       });
//     }

//     if (addressesArray.length === 0) {
//       return res.status(400).json({ 
//         success: false,
//         message: 'walletAddresses cannot be empty',
//         code: 'EMPTY_ARRAY'
//       });
//     }

//     // Normalize all wallet addresses
//     const normalizedAddresses = addressesArray.map(addr => 
//       addr.trim().toLowerCase()
//     );

//     // Validate addresses from supported chains
//     // Supported formats:
//     // - Ethereum/EVM (Sepolia, Polygon Amoy, Base Sepolia, Sonic): 0x + 40 hex chars
//     // - Solana: 44 character alphanumeric string
//     const validAddresses = normalizedAddresses.filter(addr => {
//       if (typeof addr !== 'string' || addr.length === 0) return false;
      
//       // Ethereum/EVM format: 0x + 40 hex
//       if (/^0x[a-fA-F0-9]{40}$/.test(addr)) return true;
      
//       // Solana format: 44 chars alphanumeric
//       if (/^[1-9A-HJ-NP-Z]{44}$/.test(addr)) return true;
      
//       // Generic format acceptance
//       return addr.length > 0;
//     });

//     if (validAddresses.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: 'No valid addresses found. Supported chains: Sepolia, Polygon Amoy, Base Sepolia, Sonic Testnet',
//         code: 'NO_VALID_ADDRESSES'
//       });
//     }

//     console.log('✅ Validated addresses from chains:', validAddresses);

//     // Check if any wallet address already exists
//     let user = null;
    
//     // Fetch all users and check if any wallet matches
//     const allUsers = await User.findAll();
    
//     for (const existingUser of allUsers) {
//       let existingAddresses = [];
      
//       try {
//         if (typeof existingUser.walletAddress === 'string') {
//           existingAddresses = JSON.parse(existingUser.walletAddress);
//           if (!Array.isArray(existingAddresses)) {
//             existingAddresses = [existingUser.walletAddress];
//           }
//         } else {
//           existingAddresses = [existingUser.walletAddress];
//         }
//       } catch (e) {
//         existingAddresses = [existingUser.walletAddress];
//       }

//       // Check if any incoming address matches (case-insensitive)
//       const hasMatch = validAddresses.some(addr => 
//         existingAddresses.some(existAddr => 
//           String(existAddr).toLowerCase() === String(addr).toLowerCase()
//         )
//       );

//       if (hasMatch) {
//         user = existingUser;
//         console.log('✅ Existing user found with wallet(s):', validAddresses);
//         break;
//       }
//     }

//     if (!user) {
//       // Create new user with wallets stored as JSON string
//       const primaryAddress = validAddresses[0];
//       console.log('🆕 Creating new wallet user with addresses:', validAddresses);
      
//       user = await User.create({
//         name: `User-${primaryAddress.substring(0, 6)}`,
//         email: null,
//         password: `wallet_${primaryAddress}_${Date.now()}`,
//         walletAddress: JSON.stringify(validAddresses), // Store as JSON string
//         role: 0,
//       });
//       console.log('✅ New user created:', user.id);
//     } else {
//       // Update user with all wallet addresses
//       let existingAddresses = [];
      
//       // Safely parse existing addresses
//       try {
//         if (typeof user.walletAddress === 'string') {
//           // Check if it's valid JSON
//           existingAddresses = JSON.parse(user.walletAddress);
//           if (!Array.isArray(existingAddresses)) {
//             existingAddresses = [user.walletAddress]; // Fallback to string as array
//           }
//         } else {
//           existingAddresses = [user.walletAddress];
//         }
//       } catch (e) {
//         console.log('⚠️ Could not parse existing addresses, treating as single:', user.walletAddress);
//         existingAddresses = [user.walletAddress];
//       }
      
//       const allAddresses = [...new Set([...existingAddresses, ...validAddresses])]; // Remove duplicates
//       user.walletAddress = JSON.stringify(allAddresses);
//       await user.save();
//       console.log('📝 User updated with all addresses:', allAddresses);
//     }

//     // Generate token with expiry for wallet login (24 hours for testing)
//     const token = generateToken(user.id, user.role, '24h');

//     res.status(200).json({
//       success: true,
//       data: {
//         userId: user.id,
//         walletAddresses: user.walletAddress, // Return as JSON string
//         userName: user.name,
//         role: user.role,
//         token: token,
//         expiresIn: 86400, // 24 hours in seconds
//         tokenType: 'Bearer',
//       },
//       message: 'Login successful'
//     });
//   } catch (error) {
//     console.error('❌ Wallet login error:', error);
//     res.status(500).json({ 
//       success: false,
//       message: 'Server error during wallet login',
//       error: error.message,
//       code: 'SERVER_ERROR'
//     });
//   }
// };

const authLogin = async (req, res) => {
  const { username, password } = req.body;

  try {
    // 1️⃣ Validation
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password required',
      });
    }

    const normalizedUsername = username.trim().toLowerCase();

    // 2️⃣ Find user
    let user = await User.findByName(normalizedUsername);
    console.log('🔍 Searching for user with username:', normalizedUsername);
      console.log('👤 User found:', !!user, user ? { id: user.id, name: user.name } : 'null') ;

    // 3️⃣ Auto Signup
    if (!user) {
      user = await User.create({
        name: normalizedUsername,
        password: password, // ❌ hash yaha mat karo
        role: 0,
        // walletAddress: JSON.stringify([]),
      });

      console.log('🆕 User auto-registered:', normalizedUsername);
    }
    // 4️⃣ Login
    else {
      if (!user.password) {
        return res.status(401).json({
          success: false,
          message: 'Password login not enabled',
        });
      }

      const isMatch = await User.matchPassword(password, user.password);


      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials',
        });
      }
    }

    // 5️⃣ Generate token
    const token = generateToken(user.id, user.role, '24h');

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        userId: user.id,
        username: user.name,
        role: user.role,
        token,
        tokenType: 'Bearer',
      },
    });

  } catch (error) {
    console.error('❌ Auth Login Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};
const adminLogin = async (req, res) => {
  try {
    console.log(`📱 Admin login attempt:`, req.body);
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email & password required" });
    }

    // DEBUG: Email check
    console.log('🔍 Searching for user with email:', email);
    
    const user = await User.findByEmail(email);
    console.log('👤 User found:', !!user, user ? { id: user.id, email: user.email } : 'null');

    if (!user) {
      console.log('❌ User not found');
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // DEBUG: Password check
    console.log('🔑 Plain password:', password.substring(0, 3) + '...');
    console.log('🔐 DB hash:', user.password.substring(0, 20) + '...');
    
    const isMatch = await bcrypt.compare(password, user.password);
    console.log('✅ Password match:', isMatch);

    if (!isMatch) {
      console.log('❌ Password mismatch');
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
      },
    });

  } catch (error) {
    console.error('💥 Login error:', error);
    res.status(500).json({ message: "Server error" });
  }
};

const getProfile = async (req, res) => {
  try {
    const user = req.user;

    res.json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        profileImage: user.profileImage || null,
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

/**
 * UPDATE PROFILE + IMAGE
 */
const updateProfile = async (req, res) => {
  const { name, email } = req.body;

  const data = { name, email };

  if (req.file) {
    data.profileImage = `/uploads/profile/${req.file.filename}`;
  }

  await User.update(req.user.id, data);


  res.json({ success: true });
};

/**
 * CHANGE PASSWORD
 */
const changePassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const user = await User.findById(req.user.id);

  const match = await bcrypt.compare(oldPassword, user.password);
  if (!match) {
    return res.status(400).json({ message: "Old password incorrect" });
  }
  const hashed = await bcrypt.hash(newPassword, 10);

  await User.update(req.user.id, {
    password: hashed,
  });

  res.json({ success: true });
};

const generateToken = (id, role, expiresIn = '24h') => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn,
  });
};
module.exports = { connectWallet, disconnectWallet, authLogin, adminLogin, getProfile, updateProfile, changePassword };

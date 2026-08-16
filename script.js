const fs = require('fs');
const path = 'd:/Work/Vault/vaultapi/controllers/tokenFlowController.js';
let content = fs.readFileSync(path, 'utf8');

const regex1 = /let multiplier = 1\.0;\s*try \{\s*const setRes = await db\.pool\.query\('SELECT "marketCapMultiplier" FROM settings LIMIT 1'\);\s*if \(setRes\.rows\[0\] && setRes\.rows\[0\]\.marketCapMultiplier\) \{\s*multiplier = parseFloat\(setRes\.rows\[0\]\.marketCapMultiplier\);\s*\}\s*\} catch \(e\) \{ console\.error\(e\); \}/g;

const replacement1 = 
    let multiplier = 1.0;
    let occyPrice = 1.0;
    try {
      const setRes = await db.pool.query('SELECT "marketCapMultiplier", "occyPrice" FROM settings LIMIT 1');
      if (setRes.rows[0]) {
        if (setRes.rows[0].marketCapMultiplier) multiplier = parseFloat(setRes.rows[0].marketCapMultiplier);
        if (setRes.rows[0].occyPrice) occyPrice = parseFloat(setRes.rows[0].occyPrice);
      }
    } catch (e) { console.error(e); }
.trim();

content = content.replace(regex1, replacement1);

const regex2 = /let marketCap = "0";\s*if \((?:t|token)\.liquidityResponse && (?:t|token)\.liquidityResponse\.lpLocked\) \{\s*const lp = parseFloat\((?:t|token)\.liquidityResponse\.lpLocked\) \/ 1e18;\s*const supply = parseFloat\((?:t|token)\.supply \|\| 0\);\s*marketCap = \(lp \* supply \* multiplier\)\.toFixed\(2\);\s*\}/g;

content = content.replace(regex2, (match) => {
  const isT = match.includes('t.liquidityResponse');
  const varName = isT ? 't' : 'token';
  return 
      let marketCap = "0";
      if (.liquidityResponse && .liquidityResponse.lpLocked) {
        const supply = parseFloat(.supply || 0);
        let mCap = multiplier * supply;
        if (.chain === 'sonic') {
          mCap = mCap * occyPrice;
        }
        marketCap = mCap.toFixed(2);
      }
  .trim();
});

fs.writeFileSync(path, content);
console.log('Done');

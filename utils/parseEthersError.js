export function parseEthersError(err) {
  // ethers v6 CALL_EXCEPTION
  if (err.code === "CALL_EXCEPTION") {
    if (err.action === "estimateGas") {
      return {
        status: 422,
        message: "Liquidity transaction reverted. Check token balance, approval or router compatibility"
      };
    }
    return {
      status: 422,
      message: "Smart contract execution failed"
    };
  }

  if (err.code === "INSUFFICIENT_FUNDS") {
    return {
      status: 400,
      message: "Backend wallet has insufficient gas"
    };
  }

  if (err.code === "UNPREDICTABLE_GAS_LIMIT") {
    return {
      status: 422,
      message: "Gas estimation failed. Contract will likely revert"
    };
  }

  if (err.reason) {
    return {
      status: 400,
      message: err.reason
    };
  }

  if (err.message?.includes("ERC20")) {
    return {
      status: 400,
      message: err.message
    };
  }

  return {
    status: 500,
    message: "Blockchain transaction failed"
  };
}

import { Wallet, xrpToDrops, dropsToXrp } from 'xrpl';
import { getClient } from './xrplClient';
import { getUser, setUser, ammConfig } from '../store';

export async function depositToAmm(address: string, seed: string, amountXrp: string) {
  const client = await getClient();
  const wallet = Wallet.fromSeed(seed);
  const user = getUser(address);
  if (!user) throw new Error('User not found. Create wallet first.');

  const depositTx: any = {
    TransactionType: 'AMMDeposit',
    Account: address,  // Customer's address (signer may be regular key)
    Asset: { currency: ammConfig.tokenCurrency, issuer: ammConfig.issuerAddress },
    Asset2: { currency: 'XRP' },
    Amount: xrpToDrops(amountXrp), // XRP to deposit (single-asset)
    Flags: 0x00080000, // tfSingleAsset
  };

  const prepared = await client.autofill(depositTx);
  const signed = wallet.sign(prepared);
  const result = await client.submitAndWait(signed.tx_blob);
  console.log('AMMDeposit result:', (result.result as any).meta?.TransactionResult);

  // Get updated LP token balance
  const lpBalance = await getLpTokenBalance(address);

  user.originalDepositXrp += parseFloat(amountXrp);
  user.lpTokenBalance = lpBalance;
  user.transactions.push({
    type: 'deposit',
    amount: parseFloat(amountXrp),
    txHash: result.result.hash,
    timestamp: new Date().toISOString(),
  });
  setUser(address, user);

  return {
    success: true,
    lpTokensReceived: lpBalance.toFixed(6),
    txHash: result.result.hash,
  };
}

export async function withdrawFromAmm(address: string, seed: string, amountXrp: number) {
  const client = await getClient();
  const wallet = Wallet.fromSeed(seed);

  const withdrawTx: any = {
    TransactionType: 'AMMWithdraw',
    Account: address,  // Customer's address (signer may be regular key)
    Asset: { currency: ammConfig.tokenCurrency, issuer: ammConfig.issuerAddress },
    Asset2: { currency: 'XRP' },
    Amount: xrpToDrops(amountXrp.toString()), // XRP to withdraw (single-asset)
    Flags: 0x00080000, // tfSingleAsset
  };

  const prepared = await client.autofill(withdrawTx);
  const signed = wallet.sign(prepared);
  const result = await client.submitAndWait(signed.tx_blob);

  // Update LP token balance
  const user = getUser(address);
  if (user) {
    user.lpTokenBalance = await getLpTokenBalance(address);
    user.transactions.push({
      type: 'withdraw',
      amount: amountXrp,
      txHash: result.result.hash,
      timestamp: new Date().toISOString(),
    });
    setUser(address, user);
  }

  return { txHash: result.result.hash };
}

export async function getLpTokenBalance(address: string): Promise<number> {
  const client = await getClient();

  try {
    const lines = await client.request({
      command: 'account_lines',
      account: address,
    });

    // LP tokens are issued by the AMM account
    const lpLine = (lines.result as any).lines.find(
      (line: any) => line.account === ammConfig.ammAccountAddress
    );

    return lpLine ? parseFloat(lpLine.balance) : 0;
  } catch {
    return 0;
  }
}

export async function getAmmPositionXrpValue(address: string): Promise<number> {
  const client = await getClient();

  try {
    const ammInfo = await client.request({
      command: 'amm_info',
      asset: { currency: ammConfig.tokenCurrency, issuer: ammConfig.issuerAddress },
      asset2: { currency: 'XRP' },
    } as any);

    const amm = (ammInfo.result as any).amm;
    const totalLpTokens = parseFloat(amm.lp_token.value);

    // Pool XRP — could be drops string or amount object
    let poolXrp: number;
    if (typeof amm.amount2 === 'string') {
      poolXrp = Number(amm.amount2) / 1_000_000; // drops to XRP
    } else {
      poolXrp = parseFloat(amm.amount2.value);
    }
    let poolToken: number;
    if (typeof amm.amount === 'string') {
      poolToken = Number(amm.amount) / 1_000_000;
    } else {
      poolToken = parseFloat(amm.amount.value);
    }

    const userLpTokens = await getLpTokenBalance(address);
    if (totalLpTokens === 0 || userLpTokens === 0) return 0;

    const userShare = userLpTokens / totalLpTokens;
    const userXrp = poolXrp * userShare;
    const userTokens = poolToken * userShare;
    const tokenXrpPrice = poolXrp / poolToken;
    const totalXrpValue = userXrp + (userTokens * tokenXrpPrice);

    return totalXrpValue;
  } catch (err) {
    console.error('Error getting AMM position value:', err);
    return 0;
  }
}

import { Wallet, xrpToDrops } from 'xrpl';
import { getClient } from './xrplClient';
import { getUser, setUser, ammConfig } from '../store';
import { UserState } from '../types';
import { getAmmPositionXrpValue } from './ammService';

export async function createWallet() {
  const client = await getClient();
  const { wallet, balance } = await client.fundWallet();

  // Set up trust line for TYD token so user can interact with the AMM
  if (ammConfig.issuerAddress) {
    const trustSetTx = {
      TransactionType: 'TrustSet' as const,
      Account: wallet.address,
      LimitAmount: {
        currency: ammConfig.tokenCurrency,
        issuer: ammConfig.issuerAddress,
        value: '1000000',
      },
    };
    const prepared = await client.autofill(trustSetTx);
    const signed = wallet.sign(prepared);
    await client.submitAndWait(signed.tx_blob);
  }

  const userState: UserState = {
    address: wallet.address,
    seed: wallet.seed!,
    originalDepositXrp: 0,
    lpTokenBalance: 0,
    goals: [],
    transactions: [],
  };
  setUser(wallet.address, userState);

  return {
    address: wallet.address,
    seed: wallet.seed,
    balance: balance.toString(),
  };
}

export async function getWalletStatus(address: string) {
  const client = await getClient();
  const user = getUser(address);

  // Get XRP balance
  let xrpBalance: any = '0';
  try {
    xrpBalance = await client.getXrpBalance(address);
  } catch {
    // Account may not exist yet
  }

  // Calculate AMM position value
  let ammXrpValue = 0;
  if (user && user.lpTokenBalance > 0) {
    ammXrpValue = await getAmmPositionXrpValue(address);
  }

  const goals = user?.goals || [];
  const lockedAmount = goals
    .filter(g => g.status === 'locked')
    .reduce((sum, g) => sum + g.targetAmount, 0);

  const totalValue = ammXrpValue;
  const spendingBalance = Math.max(0, totalValue - lockedAmount);
  const yieldEarned = user ? Math.max(0, totalValue - user.originalDepositXrp) : 0;
  const yieldPercentage = user && user.originalDepositXrp > 0
    ? ((yieldEarned / user.originalDepositXrp) * 100).toFixed(4)
    : '0';

  return {
    address,
    xrpBalance,
    ammPosition: {
      lpTokenBalance: user?.lpTokenBalance || 0,
      xrpValue: ammXrpValue.toFixed(6),
    },
    goals: goals.map(g => ({
      id: g.id,
      name: g.name,
      targetAmount: g.targetAmount,
      finishAfter: g.finishAfter,
      status: g.status,
      createdAt: g.createdAt,
    })),
    spendingBalance: spendingBalance.toFixed(6),
    lockedAmount: lockedAmount.toFixed(6),
    totalYieldEarned: yieldEarned.toFixed(6),
    yieldPercentage,
  };
}

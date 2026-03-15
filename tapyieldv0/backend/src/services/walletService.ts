import { Wallet, xrpToDrops } from 'xrpl';
import { getClient } from './xrplClient';
import {
  getUser, setUser, ensureUser, ammConfig,
  setCard, deleteCard, findCardByAddress,
  setPendingRegularKey, getPendingRegularKey, deletePendingRegularKey,
} from '../store';
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

// Step 1 of card registration: generate a regular key pair.
// Returns the regularKeyAddress so Alex's Xaman service can build
// a SetRegularKey payload for the user to sign in their own wallet.
// The regular key seed is stored temporarily on the server — never exposed.
export async function setupRegularKey(address: string) {
  const regularKeyWallet = Wallet.generate();

  // Store the seed temporarily until card registration completes
  setPendingRegularKey(address, regularKeyWallet.seed!);

  return {
    regularKeyAddress: regularKeyWallet.classicAddress,
  };
}

// Step 2 of card registration: after the user has signed the SetRegularKey tx
// in Xaman AND tapped their NFC card, map the hardware UID to their wallet.
export function registerCard(uid: string, address: string, name?: string) {
  const pending = getPendingRegularKey(address);
  if (!pending) throw new Error('No pending regular key for this address. Call /wallet/setup-regular-key first.');

  // Store card mapping: NFC hardware UID → wallet + regular key
  setCard(uid, {
    uid,
    address,
    regularKeySeed: pending.seed,
    name: name || 'Customer',
  });

  // Also store in user state
  const user = getUser(address);
  if (user) {
    const regularKeyWallet = Wallet.fromSeed(pending.seed);
    user.regularKeySeed = pending.seed;
    user.regularKeyAddress = regularKeyWallet.classicAddress;
    setUser(address, user);
  }

  // Clean up temporary storage
  deletePendingRegularKey(address);

  return { registered: true, uid };
}

// Revoke a card: disables regular key on-chain + deletes UID mapping.
// Requires master seed (user signs via Xaman in production, but this
// endpoint also supports direct signing for testing/demo).
export async function revokeCard(address: string, seed: string) {
  const client = await getClient();
  const masterWallet = Wallet.fromSeed(seed);
  const user = getUser(address);
  if (!user) throw new Error('User not found.');

  // Submit SetRegularKey with no RegularKey field to revoke
  const revokeRegKeyTx: any = {
    TransactionType: 'SetRegularKey',
    Account: masterWallet.address,
  };

  const prepared = await client.autofill(revokeRegKeyTx);
  const signed = masterWallet.sign(prepared);
  const result = await client.submitAndWait(signed.tx_blob);

  // Delete card mapping from registry
  const card = findCardByAddress(address);
  if (card) deleteCard(card.uid);

  // Clear from user state
  user.regularKeySeed = undefined;
  user.regularKeyAddress = undefined;
  setUser(address, user);

  return {
    revoked: true,
    txHash: result.result.hash,
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

  // Calculate AMM position value — always check on-chain in case server restarted
  let ammXrpValue = 0;
  try {
    ammXrpValue = await getAmmPositionXrpValue(address);
  } catch {
    // No AMM position
  }

  // Rehydrate LP token balance if we have an AMM position but user record is stale
  if (user && ammXrpValue > 0 && user.lpTokenBalance === 0) {
    const { getLpTokenBalance } = await import('./ammService');
    user.lpTokenBalance = await getLpTokenBalance(address);
    if (user.lpTokenBalance > 0 && user.originalDepositXrp === 0) {
      // Estimate original deposit as current value (no yield tracking after restart, but no errors)
      user.originalDepositXrp = ammXrpValue;
    }
    setUser(address, user);
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
    transactions: (user?.transactions || []).slice().reverse(),
    spendingBalance: spendingBalance.toFixed(6),
    lockedAmount: lockedAmount.toFixed(6),
    totalYieldEarned: yieldEarned.toFixed(6),
    yieldPercentage,
  };
}

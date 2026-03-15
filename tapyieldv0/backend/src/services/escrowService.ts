import { Wallet, xrpToDrops, isoTimeToRippleTime } from 'xrpl';
import { getClient } from './xrplClient';
import { getUser, setUser, ensureUser } from '../store';
import { Goal } from '../types';
import { getAmmPositionXrpValue } from './ammService';

export async function createGoal(
  address: string,
  seed: string,
  name: string,
  amount: number,
  unlockDate: string
) {
  const client = await getClient();
  const wallet = Wallet.fromSeed(seed);
  const user = ensureUser(address, seed);

  // Check spending balance
  const ammValue = await getAmmPositionXrpValue(address);
  const lockedAmount = user.goals
    .filter(g => g.status === 'locked')
    .reduce((sum, g) => sum + g.targetAmount, 0);
  const spendingBalance = ammValue - lockedAmount;

  if (amount > spendingBalance) {
    throw new Error(`Insufficient spending balance. Available: ${spendingBalance.toFixed(2)} XRP`);
  }

  // Create symbolic escrow on-chain (1 XRP self-escrow)
  const finishAfter = isoTimeToRippleTime(unlockDate);

  const escrowTx = {
    TransactionType: 'EscrowCreate' as const,
    Account: wallet.address,
    Destination: wallet.address, // self-escrow
    Amount: xrpToDrops('1'), // symbolic 1 XRP
    FinishAfter: finishAfter,
  };

  const prepared = await client.autofill(escrowTx);
  const signed = wallet.sign(prepared);
  const result = await client.submitAndWait(signed.tx_blob);

  const escrowSequence = (prepared as any).Sequence!;
  const goalId = `goal_${Date.now()}`;

  const goal: Goal = {
    id: goalId,
    name,
    targetAmount: amount,
    escrowSequence,
    finishAfter: unlockDate,
    status: 'locked',
    createdAt: new Date().toISOString(),
  };

  user.goals.push(goal);
  user.transactions.push({
    type: 'escrow_create',
    amount: amount,
    txHash: result.result.hash,
    timestamp: new Date().toISOString(),
  });
  setUser(address, user);

  return {
    goalId,
    escrowSequence,
    escrowTxHash: result.result.hash,
    lockedAmount: amount,
    unlockDate,
  };
}

export async function releaseGoal(address: string, seed: string, goalId: string) {
  const client = await getClient();
  const wallet = Wallet.fromSeed(seed);
  const user = ensureUser(address, seed);

  const goal = user.goals.find(g => g.id === goalId);
  if (!goal) throw new Error('Goal not found.');
  if (goal.status === 'released') throw new Error('Goal already released.');

  // Check if escrow has matured
  const now = new Date();
  const unlockDate = new Date(goal.finishAfter);
  if (now < unlockDate) {
    throw new Error(`Goal not yet matured. Unlocks at ${goal.finishAfter}`);
  }

  // Finish the symbolic escrow on-chain
  const escrowFinishTx = {
    TransactionType: 'EscrowFinish' as const,
    Account: wallet.address,
    Owner: wallet.address,
    OfferSequence: goal.escrowSequence,
  };

  const prepared = await client.autofill(escrowFinishTx);
  const signed = wallet.sign(prepared);
  const result = await client.submitAndWait(signed.tx_blob);

  goal.status = 'released';
  user.transactions.push({
    type: 'escrow_finish',
    amount: goal.targetAmount,
    txHash: result.result.hash,
    timestamp: new Date().toISOString(),
  });
  setUser(address, user);

  // Calculate new spending balance
  const ammValue = await getAmmPositionXrpValue(address);
  const lockedAmount = user.goals
    .filter(g => g.status === 'locked')
    .reduce((sum, g) => sum + g.targetAmount, 0);
  const newSpendingBalance = ammValue - lockedAmount;

  return {
    success: true,
    releasedAmount: goal.targetAmount,
    escrowFinishTxHash: result.result.hash,
    newSpendingBalance: newSpendingBalance.toFixed(6),
  };
}

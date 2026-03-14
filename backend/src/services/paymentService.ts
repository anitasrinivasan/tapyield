import { Wallet, xrpToDrops } from 'xrpl';
import { getClient } from './xrplClient';
import { getUser, setUser } from '../store';
import { getAmmPositionXrpValue, withdrawFromAmm } from './ammService';

export async function makePayment(
  address: string,
  seed: string,
  merchantAddress: string,
  amountXrp: number
) {
  const client = await getClient();
  const wallet = Wallet.fromSeed(seed);
  const user = getUser(address);
  if (!user) throw new Error('User not found.');

  // Check spending balance
  const ammValue = await getAmmPositionXrpValue(address);
  const lockedAmount = user.goals
    .filter(g => g.status === 'locked')
    .reduce((sum, g) => sum + g.targetAmount, 0);
  const spendingBalance = ammValue - lockedAmount;

  if (amountXrp > spendingBalance) {
    throw new Error(`Insufficient spending balance. Available: ${spendingBalance.toFixed(2)} XRP`);
  }

  // Step 1: Withdraw XRP from AMM
  await withdrawFromAmm(address, seed, amountXrp);

  // Step 2: Send XRP payment to merchant
  const paymentTx = {
    TransactionType: 'Payment' as const,
    Account: wallet.address,
    Destination: merchantAddress,
    Amount: xrpToDrops(amountXrp.toString()),
  };

  const prepared = await client.autofill(paymentTx);
  const signed = wallet.sign(prepared);
  const result = await client.submitAndWait(signed.tx_blob);

  user.transactions.push({
    type: 'payment',
    amount: amountXrp,
    txHash: result.result.hash,
    timestamp: new Date().toISOString(),
  });
  setUser(address, user);

  // Calculate remaining spending balance
  const newAmmValue = await getAmmPositionXrpValue(address);
  const newSpendingBalance = newAmmValue - lockedAmount;

  return {
    success: true,
    txHash: result.result.hash,
    amountSent: amountXrp,
    remainingSpendingBalance: newSpendingBalance.toFixed(6),
  };
}

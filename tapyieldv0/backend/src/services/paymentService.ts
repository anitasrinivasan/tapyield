import { Wallet, xrpToDrops } from 'xrpl';
import { getClient } from './xrplClient';
import { getUser, setUser } from '../store';
import { getAmmPositionXrpValue, withdrawFromAmm, depositToAmm } from './ammService';

export async function makePayment(
  address: string,
  seed: string,
  merchantAddress: string,
  amountXrp: number,
  merchantName?: string
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
  let result;
  try {
    const paymentTx = {
      TransactionType: 'Payment' as const,
      Account: address,  // Customer's address (signer may be regular key)
      Destination: merchantAddress,
      Amount: xrpToDrops(amountXrp.toString()),
    };

    const prepared = await client.autofill(paymentTx);
    const signed = wallet.sign(prepared);
    result = await client.submitAndWait(signed.tx_blob);
  } catch (paymentErr) {
    // Payment failed after AMM withdrawal — re-deposit to avoid fund loss
    console.error('Payment failed, re-depositing to AMM:', paymentErr);
    try {
      await depositToAmm(address, seed, amountXrp.toString());
    } catch (reDepositErr) {
      console.error('Re-deposit also failed:', reDepositErr);
    }
    throw paymentErr;
  }

  user.transactions.push({
    type: 'payment',
    amount: amountXrp,
    txHash: result.result.hash,
    timestamp: new Date().toISOString(),
    merchantName,
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

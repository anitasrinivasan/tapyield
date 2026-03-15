import { Router } from 'express';
import { createWallet } from '../services/walletService';
import { depositToAmm, getLpTokenBalance, getAmmPositionXrpValue } from '../services/ammService';
import { createGoal } from '../services/escrowService';
import { getUser, setUser, ensureUser, setCard, setPendingRegularKey } from '../store';
import { Wallet } from 'xrpl';

const router = Router();

/**
 * POST /demo/seed
 *
 * Creates a fully-populated demo wallet with:
 * - Funded XRPL testnet wallet
 * - Deposit into AMM pool
 * - 2 savings goals (escrow)
 * - A registered NFC card
 *
 * Returns everything the mobile app needs to start.
 */
router.post('/seed', async (req, res) => {
  try {
    console.log('🎬 Demo seed: creating wallet...');
    const wallet = await createWallet();
    const { address, seed } = wallet;

    // Deposit 40 XRP into AMM pool (~$100 at $2.50/XRP)
    console.log('🎬 Demo seed: depositing 40 XRP...');
    const deposit = await depositToAmm(address, seed!, '40');

    // Create Goal 1: "Vacation Fund" — 8 XRP (~$20), locks for 7 days
    console.log('🎬 Demo seed: creating goal 1...');
    const goal1Unlock = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const goal1 = await createGoal(address, seed!, 'Vacation Fund', 8, goal1Unlock);

    // Create Goal 2: "New Laptop" — 20 XRP (~$50), locks for 30 days
    console.log('🎬 Demo seed: creating goal 2...');
    const goal2Unlock = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const goal2 = await createGoal(address, seed!, 'New Laptop', 20, goal2Unlock);

    // Register a demo NFC card
    console.log('🎬 Demo seed: registering demo card...');
    const regularKeyWallet = Wallet.generate();
    setPendingRegularKey(address, regularKeyWallet.seed!);

    const demoCardUid = 'DEMO-CARD-001';
    setCard(demoCardUid, {
      uid: demoCardUid,
      address,
      regularKeySeed: regularKeyWallet.seed!,
      name: 'Demo User',
    });

    const user = getUser(address);
    if (user) {
      user.regularKeySeed = regularKeyWallet.seed!;
      user.regularKeyAddress = regularKeyWallet.classicAddress;
      setUser(address, user);
    }

    console.log('🎬 Demo seed: complete!');

    res.json({
      address,
      seed,
      balance: wallet.balance,
      demo: {
        depositTxHash: deposit.txHash,
        goal1Id: goal1.goalId,
        goal1TxHash: goal1.escrowTxHash,
        goal2Id: goal2.goalId,
        goal2TxHash: goal2.escrowTxHash,
        cardUid: demoCardUid,
      },
    });
  } catch (err: any) {
    console.error('Demo seed error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /demo/hydrate
 *
 * Restores in-memory state for an EXISTING funded wallet after a server restart.
 * Does NOT make any XRPL transactions — just reads on-chain data and creates
 * demo goal/transaction records so the app looks populated.
 *
 * Body: { address, seed }
 */
router.post('/hydrate', async (req, res) => {
  try {
    const { address, seed } = req.body;
    if (!address || !seed) {
      return res.status(400).json({ error: 'address and seed required' });
    }

    // Create or get user entry
    const user = ensureUser(address, seed);

    // Read actual AMM position from on-chain
    let ammXrpValue = 0;
    try {
      ammXrpValue = await getAmmPositionXrpValue(address);
    } catch { /* no position */ }

    const lpBalance = await getLpTokenBalance(address);
    user.lpTokenBalance = lpBalance;

    // If they have an AMM position, set originalDeposit so spending balance works
    if (ammXrpValue > 0 && user.originalDepositXrp === 0) {
      user.originalDepositXrp = ammXrpValue;
    }

    // Only add demo goals/transactions if user has none (don't duplicate on repeat calls)
    if (user.goals.length === 0 && ammXrpValue > 0) {
      const now = new Date();

      // Demo Goal 1: Vacation Fund — 8 XRP, 7 days
      user.goals.push({
        id: `goal_vacation_${Date.now()}`,
        name: 'Vacation Fund',
        targetAmount: 8,
        escrowSequence: 0, // symbolic — no on-chain escrow for hydrated goals
        finishAfter: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'locked',
        createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
      });

      // Demo Goal 2: New Laptop — 20 XRP, 30 days
      user.goals.push({
        id: `goal_laptop_${Date.now()}`,
        name: 'New Laptop',
        targetAmount: 20,
        escrowSequence: 0,
        finishAfter: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'locked',
        createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
      });
    }

    if (user.transactions.length === 0 && ammXrpValue > 0) {
      const now = new Date();

      // Demo transactions to show in activity
      user.transactions.push({
        type: 'deposit',
        amount: ammXrpValue, // show the actual deposited amount
        txHash: '',
        timestamp: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString(), // 4 days ago
      });

      user.transactions.push({
        type: 'escrow_create',
        amount: 8,
        txHash: '',
        timestamp: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      });

      user.transactions.push({
        type: 'escrow_create',
        amount: 20,
        txHash: '',
        timestamp: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }

    // Register demo NFC card
    const regularKeyWallet = Wallet.generate();
    const demoCardUid = 'DEMO-CARD-001';
    setCard(demoCardUid, {
      uid: demoCardUid,
      address,
      regularKeySeed: regularKeyWallet.seed!,
      name: 'Demo User',
    });
    user.regularKeySeed = regularKeyWallet.seed!;
    user.regularKeyAddress = regularKeyWallet.classicAddress;

    setUser(address, user);

    console.log(`🎬 Demo hydrate complete for ${address} — AMM: ${ammXrpValue.toFixed(2)} XRP, Goals: ${user.goals.length}, Txs: ${user.transactions.length}`);

    res.json({
      success: true,
      ammPosition: ammXrpValue.toFixed(6),
      goals: user.goals.length,
      transactions: user.transactions.length,
    });
  } catch (err: any) {
    console.error('Demo hydrate error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

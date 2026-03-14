import { Router, Request, Response } from 'express';
import { registerCard } from '../services/walletService';

const router = Router();

// Step 2 of card registration: after Xaman signing + NFC tap,
// map the hardware UID to the customer's wallet.
// Called by the register-card screen after:
//   1. setupRegularKey generated the key pair
//   2. User signed SetRegularKey in Xaman
//   3. User tapped their NFC card (UID was read)
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { uid, address, name, ctr } = req.body;
    if (!uid || !address) {
      res.status(400).json({ error: 'uid and address required' });
      return;
    }
    // ctr is the NFC counter value read at registration time — becomes the baseline
    const result = registerCard(uid, address, name, Number(ctr) || 0);
    res.json(result);
  } catch (err: any) {
    console.error('Card register error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

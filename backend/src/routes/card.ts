import { Router, Request, Response } from 'express';
import { registerCard } from '../services/walletService';
import { getCard } from '../store';

const router = Router();

// Step 2 of card registration: after Xaman signing + NFC tap,
// map the hardware UID to the customer's wallet.
// Called by the register-card screen after:
//   1. setupRegularKey generated the key pair
//   2. User signed SetRegularKey in Xaman
//   3. User tapped their NFC card (UID was read)
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { uid, address, name } = req.body;
    if (!uid || !address) {
      res.status(400).json({ error: 'uid and address required' });
      return;
    }
    const result = registerCard(uid, address, name);
    res.json(result);
  } catch (err: any) {
    console.error('Card register error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Safe name-only lookup — shows customer name on NFC tap without exposing secrets.
router.get('/:uid/name', (req: Request, res: Response) => {
  const card = getCard(req.params.uid);
  if (!card) {
    res.status(404).json({ error: 'Card not found' });
    return;
  }
  res.json({ name: card.name });
});

export default router;

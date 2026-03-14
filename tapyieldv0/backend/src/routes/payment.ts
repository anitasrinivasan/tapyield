import { Router, Request, Response } from 'express';
import { makePayment } from '../services/paymentService';
import { getCard } from '../store';

const router = Router();

// Card-based payment: NFC hardware UID resolves to customer wallet on the backend.
// The regular key seed never leaves the server.
router.post('/tap', async (req: Request, res: Response) => {
  try {
    const { cardUid, merchantAddress, amountXrp, merchantName } = req.body;
    if (!cardUid || !merchantAddress || !amountXrp) {
      res.status(400).json({ error: 'cardUid, merchantAddress, and amountXrp required' });
      return;
    }

    // Look up customer wallet from NFC hardware UID
    const card = getCard(cardUid);
    if (!card) {
      res.status(404).json({ error: 'Card not found or has been revoked' });
      return;
    }

    const result = await makePayment(card.address, card.regularKeySeed, merchantAddress, parseFloat(amountXrp), merchantName);
    res.json({ ...result, customerName: card.name });
  } catch (err: any) {
    console.error('Payment error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

import { Router, Request, Response } from 'express';
import { makePayment } from '../services/paymentService';
import { getCard } from '../store';

const router = Router();

// Card-based payment: NFC card UUID resolves to customer wallet on the backend
router.post('/tap', async (req: Request, res: Response) => {
  try {
    const { cardId, merchantAddress, amountXrp } = req.body;
    if (!cardId || !merchantAddress || !amountXrp) {
      res.status(400).json({ error: 'cardId, merchantAddress, and amountXrp required' });
      return;
    }

    // Look up customer wallet from card UUID
    const card = getCard(cardId);
    if (!card) {
      res.status(404).json({ error: 'Card not found or has been revoked' });
      return;
    }

    const result = await makePayment(card.address, card.regularKeySeed, merchantAddress, parseFloat(amountXrp));
    res.json({ ...result, customerName: card.name });
  } catch (err: any) {
    console.error('Payment error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

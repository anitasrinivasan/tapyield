import { Router, Request, Response } from 'express';
import { makePayment } from '../services/paymentService';
import { getCard, updateCardCtr } from '../store';

const router = Router();

// Card-based payment: NFC hardware UID + tap counter resolve to customer wallet.
// The regular key seed never leaves the server. ctr provides anti-replay protection.
router.post('/tap', async (req: Request, res: Response) => {
  try {
    const { cardUid, ctr, merchantAddress, amountXrp } = req.body;
    if (!cardUid || ctr === undefined || !merchantAddress || !amountXrp) {
      res.status(400).json({ error: 'cardUid, ctr, merchantAddress, and amountXrp required' });
      return;
    }

    const card = getCard(cardUid);
    if (!card) {
      res.status(404).json({ error: 'Card not found or has been revoked' });
      return;
    }

    const incomingCtr = Number(ctr);
    if (isNaN(incomingCtr)) {
      res.status(400).json({ error: 'ctr must be a number' });
      return;
    }

    // Anti-replay: NTAG216 counter must be strictly greater than last seen value
    if (incomingCtr <= card.current_ctr) {
      res.status(400).json({
        error: 'Replay detected: NFC counter has not advanced',
        stored_ctr: card.current_ctr,
        incoming_ctr: incomingCtr,
      });
      return;
    }

    // Optimistic counter update before payment — blocks concurrent replay attempts
    updateCardCtr(cardUid, incomingCtr);

    try {
      const result = await makePayment(card.address, card.regularKeySeed, merchantAddress, parseFloat(amountXrp));
      res.json({ ...result, customerName: card.name });
    } catch (payErr: any) {
      // Roll back counter on transient XRPL failure so merchant can retry
      updateCardCtr(cardUid, card.current_ctr);
      throw payErr;
    }
  } catch (err: any) {
    console.error('Payment error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

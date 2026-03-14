import { Router, Request, Response } from 'express';
import { makePayment } from '../services/paymentService';

const router = Router();

router.post('/tap', async (req: Request, res: Response) => {
  try {
    const { address, seed, merchantAddress, amountXrp } = req.body;
    if (!address || !seed || !merchantAddress || !amountXrp) {
      res.status(400).json({ error: 'address, seed, merchantAddress, and amountXrp required' });
      return;
    }
    const result = await makePayment(address, seed, merchantAddress, parseFloat(amountXrp));
    res.json(result);
  } catch (err: any) {
    console.error('Payment error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

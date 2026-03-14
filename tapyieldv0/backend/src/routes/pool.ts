import { Router, Request, Response } from 'express';
import { depositToAmm } from '../services/ammService';

const router = Router();

router.post('/deposit', async (req: Request, res: Response) => {
  try {
    const { address, seed, amountXrp } = req.body;
    if (!address || !seed || !amountXrp) {
      res.status(400).json({ error: 'address, seed, and amountXrp required' });
      return;
    }
    const result = await depositToAmm(address, seed, amountXrp);
    res.json(result);
  } catch (err: any) {
    console.error('Pool deposit error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

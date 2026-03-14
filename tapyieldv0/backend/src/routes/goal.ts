import { Router, Request, Response } from 'express';
import { createGoal, releaseGoal } from '../services/escrowService';

const router = Router();

router.post('/create', async (req: Request, res: Response) => {
  try {
    const { address, seed, name, amount, unlockDate } = req.body;
    if (!address || !seed || !name || !amount || !unlockDate) {
      res.status(400).json({ error: 'address, seed, name, amount, and unlockDate required' });
      return;
    }
    const result = await createGoal(address, seed, name, parseFloat(amount), unlockDate);
    res.json(result);
  } catch (err: any) {
    console.error('Goal create error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/release', async (req: Request, res: Response) => {
  try {
    const { address, seed, goalId } = req.body;
    if (!address || !seed || !goalId) {
      res.status(400).json({ error: 'address, seed, and goalId required' });
      return;
    }
    const result = await releaseGoal(address, seed, goalId);
    res.json(result);
  } catch (err: any) {
    console.error('Goal release error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

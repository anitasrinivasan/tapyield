import { Router, Request, Response } from 'express';
import { createWallet, getWalletStatus, registerCard, revokeCard } from '../services/walletService';

const router = Router();

router.post('/create', async (_req: Request, res: Response) => {
  try {
    const result = await createWallet();
    res.json(result);
  } catch (err: any) {
    console.error('Wallet create error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/status', async (req: Request, res: Response) => {
  try {
    const address = req.query.address as string;
    if (!address) {
      res.status(400).json({ error: 'address query param required' });
      return;
    }
    const result = await getWalletStatus(address);
    res.json(result);
  } catch (err: any) {
    console.error('Wallet status error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/register-card', async (req: Request, res: Response) => {
  try {
    const { address, seed } = req.body;
    if (!address || !seed) {
      res.status(400).json({ error: 'address and seed required' });
      return;
    }
    const result = await registerCard(address, seed);
    res.json(result);
  } catch (err: any) {
    console.error('Register card error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/revoke-card', async (req: Request, res: Response) => {
  try {
    const { address, seed } = req.body;
    if (!address || !seed) {
      res.status(400).json({ error: 'address and seed required' });
      return;
    }
    const result = await revokeCard(address, seed);
    res.json(result);
  } catch (err: any) {
    console.error('Revoke card error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

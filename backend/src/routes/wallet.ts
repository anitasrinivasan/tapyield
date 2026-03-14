import { Router, Request, Response } from 'express';
import { createWallet, getWalletStatus, setupRegularKey, submitRegularKey, revokeCard } from '../services/walletService';

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

// Step 1 of card registration: generate regular key pair.
// Returns regularKeyAddress for Xaman to build SetRegularKey payload.
router.post('/setup-regular-key', async (req: Request, res: Response) => {
  try {
    const { address } = req.body;
    if (!address) {
      res.status(400).json({ error: 'address required' });
      return;
    }
    const result = await setupRegularKey(address);
    res.json(result);
  } catch (err: any) {
    console.error('Setup regular key error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Demo/testing fallback for SetRegularKey when Xaman is not available.
// In production, the user signs the SetRegularKey tx via /xaman/payload instead.
router.post('/submit-regular-key', async (req: Request, res: Response) => {
  try {
    const { address, seed } = req.body;
    if (!address || !seed) {
      res.status(400).json({ error: 'address and seed required' });
      return;
    }
    const result = await submitRegularKey(address, seed);
    res.json(result);
  } catch (err: any) {
    console.error('Submit regular key error:', err);
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

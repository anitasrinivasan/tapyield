import { Router, Request, Response } from 'express';
import { Xumm } from 'xumm';

const router = Router();

function getXumm() {
  const key = process.env.XUMM_API_KEY;
  const secret = process.env.XUMM_API_SECRET;
  if (!key || !secret) throw new Error('XUMM_API_KEY and XUMM_API_SECRET not configured in .env');
  return new Xumm(key, secret);
}

// Create a Xaman sign-in payload (to get wallet address) or a SetRegularKey payload.
// Keeping Xaman API calls server-side means the API key is never exposed to the mobile app.
router.post('/payload', async (req: Request, res: Response) => {
  try {
    const { type, userAddress, regularKeyAddress } = req.body;
    const xumm = getXumm();

    let txjson: any;
    if (type === 'signin') {
      txjson = { TransactionType: 'SignIn' };
    } else if (type === 'setRegularKey') {
      if (!userAddress || !regularKeyAddress) {
        res.status(400).json({ error: 'userAddress and regularKeyAddress required for setRegularKey' });
        return;
      }
      txjson = {
        TransactionType: 'SetRegularKey',
        Account: userAddress,
        RegularKey: regularKeyAddress,
      };
    } else {
      res.status(400).json({ error: 'type must be "signin" or "setRegularKey"' });
      return;
    }

    const payload = await xumm.payload?.create({ txjson });
    if (!payload) throw new Error('Xaman returned empty payload');

    res.json({
      payloadId: payload.uuid,
      qrUrl: payload.refs.qr_png,
      deepLink: payload.next.always,
    });
  } catch (err: any) {
    console.error('Xaman create payload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Poll a Xaman payload — called repeatedly by the mobile app until resolved.
router.get('/payload/:id', async (req: Request, res: Response) => {
  try {
    const xumm = getXumm();
    const result = await xumm.payload?.get(req.params.id);
    if (!result) {
      res.status(404).json({ error: 'Payload not found' });
      return;
    }

    res.json({
      resolved: result.meta.resolved,
      signed: result.meta.signed,
      walletAddress: result.response?.account ?? null,
    });
  } catch (err: any) {
    console.error('Xaman poll error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

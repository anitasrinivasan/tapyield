import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

const XAMAN_API = 'https://xumm.app/api/v1';

function getXamanHeaders() {
  const apiKey = process.env.XAMAN_API_KEY;
  const apiSecret = process.env.XAMAN_API_SECRET;
  if (!apiKey || !apiSecret) {
    throw new Error('XAMAN_API_KEY and XAMAN_API_SECRET must be set in .env');
  }
  return {
    'Content-Type': 'application/json',
    'X-API-Key': apiKey,
    'X-API-Secret': apiSecret,
  };
}

// Create a Xaman sign-in payload (SignIn request)
router.post('/signin', async (_req: Request, res: Response) => {
  try {
    const { data } = await axios.post(`${XAMAN_API}/platform/payload`, {
      txjson: { TransactionType: 'SignIn' },
    }, { headers: getXamanHeaders() });

    res.json({
      uuid: data.uuid,
      qrUrl: data.refs?.qr_png,
      deepLink: data.next?.always,
      websocket: data.refs?.websocket_status,
    });
  } catch (err: any) {
    console.error('Xaman signin error:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.error || err.message });
  }
});

// Create a SetRegularKey payload for Xaman signing
router.post('/set-regular-key', async (req: Request, res: Response) => {
  try {
    const { account, regularKeyAddress } = req.body;
    if (!account || !regularKeyAddress) {
      res.status(400).json({ error: 'account and regularKeyAddress required' });
      return;
    }

    const { data } = await axios.post(`${XAMAN_API}/platform/payload`, {
      txjson: {
        TransactionType: 'SetRegularKey',
        Account: account,
        RegularKey: regularKeyAddress,
      },
    }, { headers: getXamanHeaders() });

    res.json({
      uuid: data.uuid,
      qrUrl: data.refs?.qr_png,
      deepLink: data.next?.always,
      websocket: data.refs?.websocket_status,
    });
  } catch (err: any) {
    console.error('Xaman SetRegularKey error:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.error || err.message });
  }
});

// Check payload status (poll for user signature)
router.get('/payload/:uuid', async (req: Request, res: Response) => {
  try {
    const { data } = await axios.get(
      `${XAMAN_API}/platform/payload/${req.params.uuid}`,
      { headers: getXamanHeaders() }
    );

    res.json({
      resolved: data.meta?.resolved,
      signed: data.meta?.signed,
      txHash: data.response?.txid,
      account: data.response?.account,
    });
  } catch (err: any) {
    console.error('Xaman payload check error:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.error || err.message });
  }
});

export default router;

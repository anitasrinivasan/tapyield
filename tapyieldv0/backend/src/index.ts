import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import walletRouter from './routes/wallet';
import poolRouter from './routes/pool';
import goalRouter from './routes/goal';
import paymentRouter from './routes/payment';
import cardRouter from './routes/card';
import xamanRouter from './routes/xaman';
import demoRouter from './routes/demo';
import { getClient, disconnectClient } from './services/xrplClient';
import { setAmmConfig } from './store';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/wallet', walletRouter);
app.use('/pool', poolRouter);
app.use('/goal', goalRouter);
app.use('/payment', paymentRouter);
app.use('/card', cardRouter);
app.use('/xaman', xamanRouter);
app.use('/demo', demoRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', network: 'xrpl-testnet' });
});

async function start() {
  // Load AMM config from environment
  const issuerAddress = process.env.ISSUER_ADDRESS;
  const issuerSeed = process.env.ISSUER_SEED;
  const ammAccountAddress = process.env.AMM_ACCOUNT;

  if (issuerAddress && issuerSeed && ammAccountAddress) {
    setAmmConfig({
      issuerAddress,
      issuerSeed,
      ammAccountAddress,
      tokenCurrency: process.env.TOKEN_CURRENCY || 'TYD',
    });
    console.log('AMM config loaded from environment');
  } else {
    console.warn('AMM config not set. Run setup-amm.ts first and set env vars.');
  }

  // Connect to XRPL testnet
  try {
    await getClient();
    console.log('Connected to XRPL testnet');
  } catch (err) {
    console.error('Failed to connect to XRPL:', err);
  }

  app.listen(PORT, () => {
    console.log(`TapYield API running on http://localhost:${PORT}`);
  });
}

// Graceful shutdown
process.on('SIGINT', async () => {
  await disconnectClient();
  process.exit(0);
});

start();

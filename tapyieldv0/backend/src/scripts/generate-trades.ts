/**
 * Generates trades in the AMM pool to create visible yield.
 * Run: cd backend && npm run generate-trades
 *
 * Requires env vars from setup-amm.ts to be set.
 */
import 'dotenv/config';
import { Client, Wallet, xrpToDrops } from 'xrpl';

const TESTNET_URL = 'wss://s.altnet.rippletest.net:51233';
const TRADE_INTERVAL_MS = 15000; // Trade every 15 seconds
const TRADE_AMOUNT_XRP = '5'; // 5 XRP per trade

async function main() {
  const issuerAddress = process.env.ISSUER_ADDRESS;
  const tokenCurrency = process.env.TOKEN_CURRENCY || 'TYD';

  if (!issuerAddress) {
    console.error('ISSUER_ADDRESS not set. Run setup-amm.ts first.');
    process.exit(1);
  }

  const client = new Client(TESTNET_URL);
  await client.connect();
  console.log('Connected to XRPL testnet');

  // Fund two trader wallets
  console.log('Funding trader wallets...');
  const { wallet: traderA } = await client.fundWallet();
  const { wallet: traderB } = await client.fundWallet();
  console.log(`Trader A: ${traderA.address}`);
  console.log(`Trader B: ${traderB.address}`);

  // Set up trust lines for TYD
  for (const trader of [traderA, traderB]) {
    const trustTx: any = {
      TransactionType: 'TrustSet',
      Account: trader.address,
      LimitAmount: {
        currency: tokenCurrency,
        issuer: issuerAddress,
        value: '1000000',
      },
    };
    const prepared = await client.autofill(trustTx);
    const signed = trader.sign(prepared);
    await client.submitAndWait(signed.tx_blob);
  }
  console.log('Trust lines created');

  // Send TYD from issuer to traders (use issuer seed)
  const issuerSeed = process.env.ISSUER_SEED;
  if (issuerSeed) {
    const issuerWallet = Wallet.fromSeed(issuerSeed);
    for (const trader of [traderA, traderB]) {
      const payTx: any = {
        TransactionType: 'Payment',
        Account: issuerWallet.address,
        Destination: trader.address,
        Amount: {
          currency: tokenCurrency,
          issuer: issuerAddress,
          value: '500',
        },
      };
      const prepared = await client.autofill(payTx);
      const signed = issuerWallet.sign(prepared);
      await client.submitAndWait(signed.tx_blob);
    }
    console.log('TYD distributed to traders');
  }

  console.log(`\nStarting trade generation (every ${TRADE_INTERVAL_MS / 1000}s)...`);
  console.log('Press Ctrl+C to stop.\n');

  let tradeCount = 0;

  const doTrade = async () => {
    try {
      tradeCount++;
      const isXrpToToken = tradeCount % 2 === 1;
      const trader = isXrpToToken ? traderA : traderB;

      if (isXrpToToken) {
        // Swap XRP for TYD (via AMM)
        const offerTx: any = {
          TransactionType: 'OfferCreate',
          Account: trader.address,
          TakerPays: {
            currency: tokenCurrency,
            issuer: issuerAddress,
            value: TRADE_AMOUNT_XRP,
          },
          TakerGets: xrpToDrops(TRADE_AMOUNT_XRP),
        };
        const prepared = await client.autofill(offerTx);
        const signed = trader.sign(prepared);
        await client.submitAndWait(signed.tx_blob);
        console.log(`Trade #${tradeCount}: ${TRADE_AMOUNT_XRP} XRP -> TYD`);
      } else {
        // Swap TYD for XRP
        const offerTx: any = {
          TransactionType: 'OfferCreate',
          Account: trader.address,
          TakerPays: xrpToDrops(TRADE_AMOUNT_XRP),
          TakerGets: {
            currency: tokenCurrency,
            issuer: issuerAddress,
            value: TRADE_AMOUNT_XRP,
          },
        };
        const prepared = await client.autofill(offerTx);
        const signed = trader.sign(prepared);
        await client.submitAndWait(signed.tx_blob);
        console.log(`Trade #${tradeCount}: ${TRADE_AMOUNT_XRP} TYD -> XRP`);
      }
    } catch (err: any) {
      console.error(`Trade #${tradeCount} failed:`, err.message);
    }
  };

  // Run first trade immediately, then on interval
  await doTrade();
  setInterval(doTrade, TRADE_INTERVAL_MS);
}

main().catch(err => {
  console.error('Trade generator failed:', err);
  process.exit(1);
});

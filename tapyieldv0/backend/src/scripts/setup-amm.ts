/**
 * One-time setup script: creates issuer wallet, issues TYD token, creates AMM pool.
 * Run: cd backend && npm run setup-amm
 *
 * Save the output env vars to use with the backend server.
 */
import { Client, Wallet, xrpToDrops } from 'xrpl';

const TESTNET_URL = 'wss://s.altnet.rippletest.net:51233';
const TOKEN_CURRENCY = 'TYD';
const INITIAL_XRP = '50';
const INITIAL_TYD = '50';
const TRADING_FEE = 500; // 0.5%

async function submitTx(client: Client, tx: any, wallet: Wallet) {
  const prepared = await client.autofill(tx);
  const signed = wallet.sign(prepared);
  return client.submitAndWait(signed.tx_blob);
}

async function main() {
  const client = new Client(TESTNET_URL);
  await client.connect();
  console.log('Connected to XRPL testnet\n');

  // 1. Fund wallets
  console.log('1. Funding issuer wallet...');
  const { wallet: issuerWallet } = await client.fundWallet();
  console.log(`   Issuer: ${issuerWallet.address}`);

  console.log('\n2. Funding pool creator wallet...');
  const { wallet: creatorWallet } = await client.fundWallet();
  console.log(`   Creator: ${creatorWallet.address}`);

  // 3. Enable DefaultRipple on issuer
  console.log('\n3. Enabling DefaultRipple on issuer...');
  await submitTx(client, {
    TransactionType: 'AccountSet',
    Account: issuerWallet.address,
    SetFlag: 8,
  }, issuerWallet);
  console.log('   Done');

  // 4. Trust line
  console.log('\n4. Creating trust line for TYD...');
  await submitTx(client, {
    TransactionType: 'TrustSet',
    Account: creatorWallet.address,
    LimitAmount: {
      currency: TOKEN_CURRENCY,
      issuer: issuerWallet.address,
      value: '10000000',
    },
  }, creatorWallet);
  console.log('   Done');

  // 5. Issue TYD
  console.log('\n5. Issuing 10,000 TYD...');
  await submitTx(client, {
    TransactionType: 'Payment',
    Account: issuerWallet.address,
    Destination: creatorWallet.address,
    Amount: {
      currency: TOKEN_CURRENCY,
      issuer: issuerWallet.address,
      value: '10000',
    },
  }, issuerWallet);
  console.log('   Done');

  // 6. Create AMM pool
  console.log('\n6. Creating AMM pool (XRP/TYD)...');
  const ammCreateTx: any = {
    TransactionType: 'AMMCreate',
    Account: creatorWallet.address,
    Amount: {
      currency: TOKEN_CURRENCY,
      issuer: issuerWallet.address,
      value: INITIAL_TYD,
    },
    Amount2: xrpToDrops(INITIAL_XRP),
    TradingFee: TRADING_FEE,
  };

  // AMMCreate needs special fee (owner reserve increment)
  const prepared = await client.autofill(ammCreateTx);
  const serverInfo = await client.request({ command: 'server_info' });
  const reserveIncXrp = (serverInfo.result.info.validated_ledger as any)?.reserve_inc_xrp;
  if (reserveIncXrp) {
    (prepared as any).Fee = xrpToDrops(reserveIncXrp.toString());
  }
  const signed = creatorWallet.sign(prepared);
  const ammResult = await client.submitAndWait(signed.tx_blob);
  console.log('   AMM pool created! Tx:', ammResult.result.hash);
  console.log('   Result:', (ammResult.result as any).meta?.TransactionResult || 'unknown');

  // 7. Extract AMM account from tx metadata
  console.log('\n7. Extracting AMM info from transaction...');
  const meta = (ammResult.result as any).meta;
  let ammAccount = '';

  // Find the AMM account from AffectedNodes — look for created AccountRoot
  if (meta?.AffectedNodes) {
    for (const node of meta.AffectedNodes) {
      const created = node.CreatedNode;
      if (created?.LedgerEntryType === 'AMM') {
        ammAccount = created.NewFields?.Account || '';
        console.log(`   AMM Account: ${ammAccount}`);
        const lpToken = created.NewFields?.LPTokenBalance;
        if (lpToken) {
          console.log(`   LP Token: ${lpToken.currency} = ${lpToken.value}`);
        }
      }
    }
  }

  if (!ammAccount) {
    // Fallback: try amm_info with retry
    console.log('   AMM account not found in metadata, trying amm_info...');
    for (let i = 0; i < 3; i++) {
      try {
        await new Promise(resolve => setTimeout(resolve, 5000));
        const ammInfo = await client.request({
          command: 'amm_info',
          asset: { currency: TOKEN_CURRENCY, issuer: issuerWallet.address },
          asset2: { currency: 'XRP' },
        } as any);
        const amm = (ammInfo.result as any).amm;
        ammAccount = amm.account;
        console.log(`   AMM Account: ${ammAccount}`);
        break;
      } catch (e) {
        console.log(`   Retry ${i + 1}/3...`);
      }
    }
  }

  console.log('\n========================================');
  console.log('SET THESE ENVIRONMENT VARIABLES:');
  console.log('========================================');
  console.log(`export ISSUER_ADDRESS="${issuerWallet.address}"`);
  console.log(`export ISSUER_SEED="${issuerWallet.seed}"`);
  console.log(`export AMM_ACCOUNT="${ammAccount}"`);
  console.log(`export TOKEN_CURRENCY="${TOKEN_CURRENCY}"`);
  console.log(`export CREATOR_ADDRESS="${creatorWallet.address}"`);
  console.log(`export CREATOR_SEED="${creatorWallet.seed}"`);
  console.log('========================================\n');

  await client.disconnect();
  console.log('Done! AMM pool is live on testnet.');
}

main().catch(err => {
  console.error('Setup failed:', err);
  process.exit(1);
});

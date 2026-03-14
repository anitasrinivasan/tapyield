# TapYield

Goal-based savings + tap-to-pay on the XRP Ledger.

Save toward goals, earn yield on every dollar (even locked funds), and pay merchants instantly by tapping your card.

## How It Works

**Save** — Deposit funds into a yield-generating liquidity pool. All your money earns trading fees automatically.

**Set Goals** — Lock a portion of your balance behind a time-based savings goal. You can't spend it until the date you chose, but it keeps earning yield while locked.

**Pay** — Tap your NFC card at a merchant's phone. Payment settles instantly on-chain.

### Under the Hood

- Funds are deposited into an **XRPL AMM pool** (XRP/TYD), earning yield from trading fees
- Savings goals use **XRPL Escrow** as on-chain proof of commitment — a symbolic 1 XRP self-escrow with a time lock
- The locked amount is tracked by the API, which enforces spending limits while keeping all funds in the pool earning yield
- Payments withdraw from the AMM and send XRP directly to the merchant's wallet

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│  Mobile App  │────▶│  Express API │────▶│  XRPL Testnet    │
│  (Expo/RN)   │◀────│  (Node.js)   │◀────│  (Blockchain)    │
└──────────────┘     └──────────────┘     └──────────────────┘
```

## Project Structure

```
├── backend/
│   └── src/
│       ├── index.ts                # Express server
│       ├── routes/                 # API endpoints
│       │   ├── wallet.ts           # POST /wallet/create, GET /wallet/status
│       │   ├── pool.ts             # POST /pool/deposit
│       │   ├── goal.ts             # POST /goal/create, POST /goal/release
│       │   └── payment.ts          # POST /payment/tap
│       ├── services/               # XRPL blockchain logic
│       │   ├── walletService.ts    # Wallet creation, balances, trust lines
│       │   ├── ammService.ts       # AMM deposit, withdraw, yield calculation
│       │   ├── escrowService.ts    # Symbolic escrow create + finish
│       │   └── paymentService.ts   # AMM withdraw + payment to merchant
│       ├── store.ts                # In-memory state
│       └── scripts/
│           ├── setup-amm.ts        # One-time: create token + AMM pool
│           └── generate-trades.ts  # Simulate trades for yield
├── mobile/
│   ├── app/
│   │   ├── index.tsx               # Welcome / create wallet
│   │   ├── dashboard.tsx           # Balances, yield, goals
│   │   ├── deposit.tsx             # Add funds to yield pool
│   │   ├── goal/create.tsx         # Create savings goal
│   │   └── pay.tsx                 # Accept payment (merchant-facing)
│   └── services/
│       └── api.ts                  # API client
```

## Setup

### Backend

```bash
cd backend
npm install
```

Create a `.env` file (run the AMM setup script first to get these values):

```
ISSUER_ADDRESS=rXXX...
ISSUER_SEED=sEdXXX...
AMM_ACCOUNT=rXXX...
TOKEN_CURRENCY=TYD
CREATOR_ADDRESS=rXXX...
CREATOR_SEED=sEdXXX...
PORT=3000
```

One-time AMM pool setup:

```bash
npm run setup-amm
```

Start the server:

```bash
npm run dev
```

Generate trades for yield (run in a separate terminal):

```bash
npm run generate-trades
```

### Mobile

```bash
cd mobile
npm install
npx expo start
```

Open in Expo Go (iOS/Android) or press `w` for web.

**Note:** For NFC support, you need a development build (`npx expo prebuild && npx expo run:ios`).

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/wallet/create` | Create and fund a new XRPL wallet |
| GET | `/wallet/status?address=rXXX` | Get balances, AMM position, goals, yield |
| POST | `/pool/deposit` | Deposit XRP into AMM pool |
| POST | `/goal/create` | Create a time-locked savings goal |
| POST | `/goal/release` | Release a matured goal |
| POST | `/payment/tap` | Process a tap-to-pay payment |

## Team

Built at a hackathon.

## Tech Stack

- **Blockchain**: XRP Ledger (testnet) — AMM, Escrow, Payments
- **Backend**: Node.js, Express, TypeScript, xrpl.js
- **Mobile**: React Native, Expo, TypeScript
- **NFC**: react-native-nfc-manager

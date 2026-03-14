# NFC Integration Spec for Alex

## Overview

You're building the NFC card reading for TapYield's tap-to-pay flow. The **merchant** has the mobile app (Expo/React Native). The **customer** has an NFC card. When the customer taps their card on the merchant's phone, the app reads the customer's wallet info and processes the payment.

---

## Your Scope

1. **Write data to NFC cards** — register a customer's wallet onto a physical NFC tag
2. **Read NFC cards** — when a customer taps, read their wallet info from the tag
3. **Integrate with pay.tsx** — call the callback function that triggers the payment

You do NOT need to touch the backend or the payment logic. That's all built and working.

---

## What Goes on the NFC Card

Each customer's NFC tag must contain:

```json
{
  "address": "rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "seed": "sEdXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "name": "Alice"
}
```

| Field     | What it is                              | Example                              |
|-----------|-----------------------------------------|--------------------------------------|
| `address` | XRPL wallet address (starts with `r`)   | `rX9tdTy928kimfXESL7X4nMN4kBhrNSdq`  |
| `seed`    | XRPL wallet secret (starts with `sEd`)  | `sEdSgUFpXJsZwno1f9Wc69ZWLnfWG3M`    |
| `name`    | Display name (optional, for UI)         | `Alice`                              |

**Format:** Write this as a JSON string in an NDEF Text record on the NFC tag.

**Where do these values come from?** When a customer creates a wallet in the app (the "Create Wallet" screen), the API returns `{ address, seed, balance }`. The address and seed are what you write to the card. For the demo, you can also use the pre-funded wallets from testing.

---

## How to Integrate with the App

### The callback you need to call

In `mobile/app/pay.tsx`, there's a function exposed on `globalThis`:

```typescript
// Already defined in pay.tsx — you just call it
(globalThis as any).__tapyield_onCardRead(address, seed, name?)
```

**Parameters:**
- `address` (string, required) — customer's XRPL wallet address
- `seed` (string, required) — customer's XRPL wallet secret
- `name` (string, optional) — customer display name, defaults to "Customer"

When you call this, the UI updates to show "Card Detected" with the customer's info, and the "Charge" button becomes active.

### Where to add your NFC code

Option A (simplest): Add NFC reading directly in `mobile/app/pay.tsx` — replace the `handleCardTap` function.

Option B: Create a separate component (e.g., `mobile/components/NfcReader.tsx`) and import it into `pay.tsx`.

### What handleCardTap currently does (placeholder you replace)

```typescript
// In pay.tsx, line ~60 — replace this:
const handleCardTap = () => {
  Alert.alert(
    'Ready to Scan',
    'Ask the customer to tap their TapYield card...',
  );
};
```

Replace it with your NFC scan logic that:
1. Starts NFC scanning
2. Reads the NDEF text record from the tag
3. Parses the JSON
4. Calls `onCardRead(parsed.address, parsed.seed, parsed.name)`

### Example replacement

```typescript
import NfcManager, { NfcTech, Ndef } from 'react-native-nfc-manager';

const handleCardTap = async () => {
  try {
    await NfcManager.requestTechnology(NfcTech.Ndef);
    const tag = await NfcManager.getTag();

    if (tag?.ndefMessage?.[0]) {
      const payload = Ndef.text.decodePayload(
        new Uint8Array(tag.ndefMessage[0].payload)
      );
      const parsed = JSON.parse(payload);
      onCardRead(parsed.address, parsed.seed, parsed.name);
    }
  } catch (err) {
    console.warn('NFC read failed:', err);
    Alert.alert('Scan Failed', 'Could not read card. Try again.');
  } finally {
    NfcManager.cancelTechnologyRequest();
  }
};
```

---

## NFC Card Registration (Writing to Cards)

You'll need a separate screen or utility to write customer wallet data to NFC tags. This could be:
- A standalone script
- A hidden screen in the app (e.g., `mobile/app/register-card.tsx`)
- A separate app

### What to write

```typescript
const cardData = JSON.stringify({
  address: "rXXX...",
  seed: "sEdXXX...",
  name: "Alice",
});
// Write as NDEF Text record to the NFC tag
```

### For the demo

Pre-register 1-2 NFC cards with test wallets. You can use wallets created by the app, or create them via curl:

```bash
curl -X POST http://localhost:3000/wallet/create
# Returns: { "address": "rXXX...", "seed": "sEdXXX...", "balance": "100" }
```

**Important:** After creating the wallet, it needs funds deposited into the AMM pool before it can be charged. Deposit via:

```bash
curl -X POST http://localhost:3000/pool/deposit \
  -H "Content-Type: application/json" \
  -d '{"address": "rXXX...", "seed": "sEdXXX...", "amountXrp": "50"}'
```

This gives the customer 50 XRP (~$125) of spending balance.

---

## Dependencies

Install `react-native-nfc-manager` in the mobile project:

```bash
cd mobile
npm install react-native-nfc-manager
```

Note: NFC does NOT work in Expo Go. You'll need a development build:

```bash
npx expo prebuild
npx expo run:ios    # or run:android
```

If you hit issues with Expo prebuild, let me know — we may need to add the NFC plugin to `app.json`.

---

## Payment Flow End-to-End

Here's what happens when it all works together:

```
1. Merchant opens app → taps "Charge" on dashboard
2. Merchant enters amount (e.g., "10" = $25.00)
3. Customer taps their NFC card on merchant's phone
4. Your NFC code reads { address, seed, name } from card
5. Your code calls: onCardRead(address, seed, name)
6. UI shows "Card Detected — Alice — rX9td...NSdq"
7. Merchant taps "Charge $25.00"
8. Backend does:
   a. Withdraws 10 XRP from customer's AMM pool
   b. Sends 10 XRP payment to merchant's wallet
9. "Payment Received!" alert with explorer link
```

---

## Files You'll Touch

| File | What to do |
|------|-----------|
| `mobile/app/pay.tsx` | Replace `handleCardTap` with real NFC scan |
| `mobile/app/register-card.tsx` | (New) Screen to write wallet data to NFC tags |
| `mobile/app.json` | May need NFC plugin config |
| `mobile/package.json` | Add `react-native-nfc-manager` |

---

## Testing Without NFC

The manual entry fallback is already built into `pay.tsx`. If NFC isn't working on stage, the merchant can paste the customer's address and seed manually. The payment flow is identical either way.

---

## Questions?

- Backend is running on `localhost:3000`
- The payment API (`POST /payment/tap`) is tested and working
- Wallet creation, deposit, and balance checking all work
- Ask me if you need test wallet addresses or seeds

import axios from 'axios';

// Railway deployment — accessible from any device
const API_BASE = 'https://tapyield-backend-production.up.railway.app';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000, // XRPL calls can be slow
});

export function getApiBase(): string {
  return (api.defaults.baseURL as string) || API_BASE;
}

export interface WalletCreateResponse {
  address: string;
  seed: string;
  balance: string;
}

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  finishAfter: string;
  status: 'locked' | 'released';
  createdAt: string;
}

export interface WalletStatusResponse {
  address: string;
  xrpBalance: string;
  ammPosition: {
    lpTokenBalance: number;
    xrpValue: string;
  };
  goals: Goal[];
  spendingBalance: string;
  lockedAmount: string;
  totalYieldEarned: string;
  yieldPercentage: string;
}

export async function createWallet(): Promise<WalletCreateResponse> {
  const { data } = await api.post('/wallet/create');
  return data;
}

export async function getWalletStatus(address: string): Promise<WalletStatusResponse> {
  const { data } = await api.get('/wallet/status', { params: { address } });
  return data;
}

export async function depositToPool(address: string, seed: string, amountXrp: string) {
  const { data } = await api.post('/pool/deposit', { address, seed, amountXrp });
  return data;
}

export async function createGoal(
  address: string,
  seed: string,
  name: string,
  amount: string,
  unlockDate: string
) {
  const { data } = await api.post('/goal/create', {
    address, seed, name, amount, unlockDate,
  });
  return data;
}

export async function releaseGoal(address: string, seed: string, goalId: string) {
  const { data } = await api.post('/goal/release', { address, seed, goalId });
  return data;
}

// --- Card registration ---

// Step 1: generate regular key pair on backend, returns regularKeyAddress for Xaman payload
export async function setupRegularKey(address: string): Promise<{ regularKeyAddress: string }> {
  const { data } = await api.post('/wallet/setup-regular-key', { address });
  return data;
}

// Step 1b (demo fallback): submit SetRegularKey on-chain directly using master seed
// Use this when Xaman is not available (e.g. pre-demo setup via curl wallets)
export async function submitRegularKey(address: string, seed: string): Promise<{ txHash: string }> {
  const { data } = await api.post('/wallet/submit-regular-key', { address, seed });
  return data;
}

// Step 2: map NFC hardware UID to the customer's wallet (after SetRegularKey confirmed)
export async function registerNfcCard(
  uid: string,
  address: string,
  name: string,
  ctr: number,
): Promise<{ registered: boolean; uid: string }> {
  const { data } = await api.post('/card/register', { uid, address, name, ctr });
  return data;
}

// --- Payment ---

export async function tapPayment(
  cardUid: string,
  ctr: number,
  merchantAddress: string,
  amountXrp: string,
) {
  const { data } = await api.post('/payment/tap', {
    cardUid, ctr, merchantAddress, amountXrp,
  });
  return data as { txHash: string; customerName: string; remainingSpendingBalance: string };
}

// --- Xaman (proxied through backend to keep API key server-side) ---

export async function createXamanPayload(
  type: 'signin' | 'setRegularKey',
  opts?: { userAddress?: string; regularKeyAddress?: string },
): Promise<{ payloadId: string; qrUrl: string; deepLink: string }> {
  const { data } = await api.post('/xaman/payload', { type, ...opts });
  return data;
}

export async function pollXamanPayload(payloadId: string): Promise<{
  resolved: boolean;
  signed: boolean;
  walletAddress: string | null;
}> {
  const { data } = await api.get(`/xaman/payload/${payloadId}`);
  return data;
}

export async function registerCard(uid: string, address: string, name: string) {
  const { data } = await api.post('/card/register', { uid, address, name });
  return data;
}

export async function getCardName(uid: string): Promise<string> {
  const { data } = await api.get(`/card/${uid}/name`);
  return data.name;
}

export async function xamanSignIn() {
  const { data } = await api.post('/xaman/signin');
  return data;
}

export async function xamanSetRegularKey(account: string, regularKeyAddress: string) {
  const { data } = await api.post('/xaman/set-regular-key', { account, regularKeyAddress });
  return data;
}

export async function xamanGetPayloadStatus(uuid: string) {
  const { data } = await api.get(`/xaman/payload/${uuid}`);
  return data;
}

export function setApiBase(url: string) {
  api.defaults.baseURL = url;
}

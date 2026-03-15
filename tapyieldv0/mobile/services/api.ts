import axios from 'axios';

// Railway deployment — accessible from any device
const API_BASE = 'https://tapyield-backend-production.up.railway.app';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000, // XRPL calls can be slow
});

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

export interface Transaction {
  type: 'deposit' | 'withdraw' | 'payment' | 'escrow_create' | 'escrow_finish';
  amount: number;
  txHash: string;
  timestamp: string;
  merchantName?: string;
}

export interface WalletStatusResponse {
  address: string;
  xrpBalance: string;
  ammPosition: {
    lpTokenBalance: number;
    xrpValue: string;
  };
  goals: Goal[];
  transactions: Transaction[];
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

export async function tapPayment(
  cardUid: string,
  merchantAddress: string,
  amountXrp: string,
  merchantName?: string
) {
  const { data } = await api.post('/payment/tap', {
    cardUid, merchantAddress, amountXrp, merchantName,
  });
  return data;
}

export async function setupRegularKey(address: string) {
  const { data } = await api.post('/wallet/setup-regular-key', { address });
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

export async function seedDemo(): Promise<WalletCreateResponse & { demo: any }> {
  // Seed makes ~5 sequential XRPL transactions, needs a longer timeout
  const { data } = await api.post('/demo/seed', {}, { timeout: 120000 });
  return data;
}

export function setApiBase(url: string) {
  api.defaults.baseURL = url;
}

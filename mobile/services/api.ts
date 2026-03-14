import axios from 'axios';

// Change this to your ngrok URL or local IP when testing on device
const API_BASE = 'http://localhost:3000';

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

export async function tapPayment(
  cardUid: string,
  merchantAddress: string,
  amountXrp: string
) {
  const { data } = await api.post('/payment/tap', {
    cardUid, merchantAddress, amountXrp,
  });
  return data;
}

export function setApiBase(url: string) {
  api.defaults.baseURL = url;
}

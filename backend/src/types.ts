export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  escrowSequence: number;
  finishAfter: string; // ISO date string
  status: 'locked' | 'released';
  createdAt: string;
}

export interface Transaction {
  type: 'deposit' | 'withdraw' | 'payment' | 'escrow_create' | 'escrow_finish';
  amount: number;
  txHash: string;
  timestamp: string;
}

export interface UserState {
  address: string;
  seed: string;
  regularKeySeed?: string;   // Regular key for NFC card (revocable)
  regularKeyAddress?: string; // Regular key public address
  originalDepositXrp: number;
  lpTokenBalance: number;
  goals: Goal[];
  transactions: Transaction[];
}

export interface AmmConfig {
  issuerAddress: string;
  issuerSeed: string;
  ammAccountAddress: string;
  tokenCurrency: string;
}

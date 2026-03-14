import { UserState, AmmConfig } from './types';

const users = new Map<string, UserState>();

export const getUser = (address: string): UserState | undefined => users.get(address);

export const setUser = (address: string, state: UserState): void => {
  users.set(address, state);
};

// Card registry — maps NFC hardware UID to customer wallet info
// The UID is read-only on the NFC tag — nothing is written to the card
export interface CardEntry {
  uid: string;         // NFC hardware UID (read from tag)
  address: string;     // Customer's XRPL wallet address
  regularKeySeed: string; // Regular key seed (never leaves the server)
  name: string;
}

const cards = new Map<string, CardEntry>();

export const getCard = (uid: string): CardEntry | undefined => cards.get(uid);

export const setCard = (uid: string, entry: CardEntry): void => {
  cards.set(uid, entry);
};

export const deleteCard = (uid: string): boolean => cards.delete(uid);

// Find card by address (for revocation)
export const findCardByAddress = (address: string): CardEntry | undefined => {
  for (const entry of cards.values()) {
    if (entry.address === address) return entry;
  }
  return undefined;
};

// Pending regular keys — temporary storage between setup-regular-key and card/register
// Maps address → regularKeySeed while waiting for Xaman signing + NFC tap
const pendingRegularKeys = new Map<string, { seed: string; address: string }>();

export const setPendingRegularKey = (address: string, seed: string): void => {
  pendingRegularKeys.set(address, { seed, address });
};

export const getPendingRegularKey = (address: string) => pendingRegularKeys.get(address);

export const deletePendingRegularKey = (address: string): boolean => pendingRegularKeys.delete(address);

// AMM config — set after running setup-amm.ts
export let ammConfig: AmmConfig = {
  issuerAddress: '',
  issuerSeed: '',
  ammAccountAddress: '',
  tokenCurrency: 'TYD',
};

export const setAmmConfig = (config: AmmConfig): void => {
  ammConfig = config;
};

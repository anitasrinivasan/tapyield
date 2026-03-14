import { UserState, AmmConfig } from './types';

const users = new Map<string, UserState>();

export const getUser = (address: string): UserState | undefined => users.get(address);

export const setUser = (address: string, state: UserState): void => {
  users.set(address, state);
};

// Card registry — maps UUID to customer wallet info
export interface CardEntry {
  cardId: string;
  address: string;
  regularKeySeed: string;
  name: string;
}

const cards = new Map<string, CardEntry>();

export const getCard = (cardId: string): CardEntry | undefined => cards.get(cardId);

export const setCard = (cardId: string, entry: CardEntry): void => {
  cards.set(cardId, entry);
};

export const deleteCard = (cardId: string): boolean => cards.delete(cardId);

// Find card by address (for revocation)
export const findCardByAddress = (address: string): CardEntry | undefined => {
  for (const entry of cards.values()) {
    if (entry.address === address) return entry;
  }
  return undefined;
};

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

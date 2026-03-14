import { UserState, AmmConfig } from './types';

const users = new Map<string, UserState>();

export const getUser = (address: string): UserState | undefined => users.get(address);

export const setUser = (address: string, state: UserState): void => {
  users.set(address, state);
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

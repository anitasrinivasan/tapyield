import { Client } from 'xrpl';

const TESTNET_URL = 'wss://s.altnet.rippletest.net:51233';

let client: Client | null = null;

export async function getClient(): Promise<Client> {
  if (!client || !client.isConnected()) {
    client = new Client(TESTNET_URL);
    await client.connect();
  }
  return client;
}

export async function disconnectClient(): Promise<void> {
  if (client && client.isConnected()) {
    await client.disconnect();
    client = null;
  }
}

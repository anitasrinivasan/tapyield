import NfcManager, { NfcTech, Ndef } from 'react-native-nfc-manager';

export async function initNfc(): Promise<void> {
  await NfcManager.start();
}

export interface NfcCardData {
  uid: string;  // identifier from URL ?uid= param
  ctr: number;  // counter from URL ?ctr= param
}

// Read an NDEF URL record from the card and extract uid + ctr query params.
// Card must be programmed with a URL like:
//   http://<backend>/pay?uid=<identifier>&ctr=<counter>
export async function readNfcCard(): Promise<NfcCardData> {
  await NfcManager.requestTechnology(NfcTech.Ndef);
  try {
    const tag = await NfcManager.getTag();
    const record = tag?.ndefMessage?.[0];
    if (!record) throw new Error('No NDEF record found on card');

    const url = Ndef.uri.decodePayload(new Uint8Array(record.payload as number[]));
    if (!url) throw new Error('Could not decode URL from card');

    const params = new URL(url).searchParams;
    const uid = params.get('uid');
    const ctr = parseInt(params.get('ctr') ?? '0', 10);

    if (!uid) throw new Error('Card URL is missing the ?uid= parameter');

    return { uid, ctr };
  } finally {
    NfcManager.cancelTechnologyRequest();
  }
}

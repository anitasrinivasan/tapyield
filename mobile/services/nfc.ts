import NfcManager, { NfcTech } from 'react-native-nfc-manager';

// Call once at app startup (e.g. in _layout.tsx)
export async function initNfc(): Promise<void> {
  await NfcManager.start();
}

export interface NfcCardData {
  uid: string;  // NTAG216 hardware UID as uppercase hex, e.g. "04A3BC12D567E0"
  ctr: number;  // NTAG216 NFC counter (24-bit, increments each power cycle)
}

// Read the NTAG216 hardware UID and tap counter.
// Uses NfcA (ISO 14443-3A) to access the hardware UID and send the READ_CNT command.
export async function readNfcCard(): Promise<NfcCardData> {
  await NfcManager.requestTechnology(NfcTech.NfcA);
  try {
    const tag = await NfcManager.getTag();
    if (!tag?.id) throw new Error('Could not read card UID');

    const uid = (tag.id as number[])
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();

    // READ_CNT command: 0x39 = command, 0x02 = NFC counter address on NTAG21x
    // Response is 3 bytes little-endian counter + 1 byte ACK
    let ctr = 0;
    try {
      const response = await NfcManager.nfcAHandler.transceive([0x39, 0x02]);
      if (response.length >= 3) {
        ctr = response[0] | (response[1] << 8) | (response[2] << 16);
      }
    } catch {
      // Counter read unsupported on this device or card variant — use 0
      ctr = 0;
    }

    return { uid, ctr };
  } finally {
    NfcManager.cancelTechnologyRequest();
  }
}

"use client";
import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  StyleSheet, SafeAreaView, Alert, Image, ScrollView, Linking,
} from 'react-native';
import {
  setupRegularKey, submitRegularKey, registerNfcCard,
  createXamanPayload, pollXamanPayload,
} from '../services/api';
import { readNfcCard } from '../services/nfc';

type Stage =
  | 'idle'           // Enter address + name, choose mode
  | 'setting_up'     // Calling setup-regular-key
  | 'awaiting_xaman' // Showing Xaman QR, polling
  | 'submitting_key' // Demo mode: submitting SetRegularKey on-chain
  | 'tap_card'       // Prompt NFC tap
  | 'scanning'       // Reading NFC tag
  | 'registering'    // POST /card/register
  | 'success'
  | 'error';

type Mode = 'xaman' | 'demo';

export default function RegisterCard() {
  const [stage, setStage] = useState<Stage>('idle');
  const [mode, setMode] = useState<Mode>('xaman');
  const [address, setAddress] = useState('');
  const [seed, setSeed] = useState('');
  const [name, setName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const [deepLink, setDeepLink] = useState('');
  const [registeredUid, setRegisteredUid] = useState('');

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const regularKeyAddressRef = useRef('');
  const payloadIdRef = useRef('');
  const nfcDataRef = useRef<{ uid: string; ctr: number } | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function fail(msg: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    setErrorMsg(msg);
    setStage('error');
  }

  async function handleStart() {
    if (!address.trim()) { Alert.alert('Error', 'Enter a wallet address'); return; }
    if (mode === 'demo' && !seed.trim()) { Alert.alert('Error', 'Enter the wallet seed for demo mode'); return; }

    setStage('setting_up');
    try {
      const { regularKeyAddress } = await setupRegularKey(address.trim());
      regularKeyAddressRef.current = regularKeyAddress;

      if (mode === 'xaman') {
        const payload = await createXamanPayload('setRegularKey', {
          userAddress: address.trim(),
          regularKeyAddress,
        });
        payloadIdRef.current = payload.payloadId;
        setQrUrl(payload.qrUrl);
        setDeepLink(payload.deepLink);
        setStage('awaiting_xaman');

        // Poll every 2s until user signs in Xaman
        pollRef.current = setInterval(async () => {
          try {
            const result = await pollXamanPayload(payload.payloadId);
            if (result.resolved) {
              clearInterval(pollRef.current!);
              if (!result.signed) { fail('Xaman signing was rejected.'); return; }
              setStage('tap_card');
            }
          } catch (e: any) {
            fail(e?.message || 'Xaman polling failed');
          }
        }, 2000);
      } else {
        // Demo mode: submit SetRegularKey directly using master seed
        setStage('submitting_key');
        await submitRegularKey(address.trim(), seed.trim());
        setStage('tap_card');
      }
    } catch (e: any) {
      fail(e?.response?.data?.error || e?.message || 'Setup failed');
    }
  }

  async function handleNfcTap() {
    setStage('scanning');
    try {
      const { uid, ctr } = await readNfcCard();
      nfcDataRef.current = { uid, ctr };
      setStage('registering');
      const result = await registerNfcCard(uid, address.trim(), name.trim() || 'Customer', ctr);
      setRegisteredUid(result.uid);
      setStage('success');
    } catch (e: any) {
      fail(e?.response?.data?.error || e?.message || 'Registration failed');
    }
  }

  function reset() {
    if (pollRef.current) clearInterval(pollRef.current);
    setStage('idle');
    setErrorMsg('');
    setQrUrl('');
    setDeepLink('');
    setRegisteredUid('');
    nfcDataRef.current = null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Register NFC Card</Text>
        <Text style={styles.subtitle}>Link an NTAG216 card to a customer wallet</Text>

        {/* ── SUCCESS ── */}
        {stage === 'success' && (
          <View style={styles.successBox}>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={styles.successTitle}>Card Registered</Text>
            <Text style={styles.mono}>UID: {registeredUid}</Text>
            <Text style={styles.mono}>{address.slice(0, 12)}…{address.slice(-6)}</Text>
            <TouchableOpacity style={styles.btn} onPress={reset}>
              <Text style={styles.btnText}>Register Another</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── ERROR ── */}
        {stage === 'error' && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
            <TouchableOpacity style={styles.btn} onPress={reset}>
              <Text style={styles.btnText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── IDLE: form ── */}
        {stage === 'idle' && (
          <>
            <Text style={styles.label}>Customer Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Alice"
              placeholderTextColor="#4a5568"
              value={name}
              onChangeText={setName}
            />

            <Text style={styles.label}>Wallet Address</Text>
            <TextInput
              style={styles.input}
              placeholder="rXXXXXXXXXXXXXXXXXXXXXXXXXXX"
              placeholderTextColor="#4a5568"
              value={address}
              onChangeText={setAddress}
              autoCapitalize="none"
            />

            <Text style={styles.label}>Mode</Text>
            <View style={styles.modeRow}>
              <TouchableOpacity
                style={[styles.modeBtn, mode === 'xaman' && styles.modeBtnActive]}
                onPress={() => setMode('xaman')}
              >
                <Text style={[styles.modeBtnText, mode === 'xaman' && styles.modeBtnTextActive]}>
                  Xaman
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeBtn, mode === 'demo' && styles.modeBtnActive]}
                onPress={() => setMode('demo')}
              >
                <Text style={[styles.modeBtnText, mode === 'demo' && styles.modeBtnTextActive]}>
                  Demo (seed)
                </Text>
              </TouchableOpacity>
            </View>

            {mode === 'demo' && (
              <>
                <Text style={styles.label}>Wallet Seed</Text>
                <TextInput
                  style={styles.input}
                  placeholder="sXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                  placeholderTextColor="#4a5568"
                  value={seed}
                  onChangeText={setSeed}
                  autoCapitalize="none"
                  secureTextEntry
                />
              </>
            )}

            <TouchableOpacity style={styles.primaryBtn} onPress={handleStart}>
              <Text style={styles.primaryBtnText}>
                {mode === 'xaman' ? 'Generate Key & Open Xaman →' : 'Set Up Regular Key →'}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── SETTING UP / SUBMITTING ── */}
        {(stage === 'setting_up' || stage === 'submitting_key') && (
          <View style={styles.centeredBox}>
            <ActivityIndicator color="#111111" size="large" />
            <Text style={styles.statusText}>
              {stage === 'setting_up' ? 'Generating regular key…' : 'Submitting SetRegularKey…'}
            </Text>
          </View>
        )}

        {/* ── AWAITING XAMAN ── */}
        {stage === 'awaiting_xaman' && (
          <View style={styles.centeredBox}>
            <Text style={styles.statusText}>Sign with Xaman</Text>
            <Text style={styles.hint}>Scan this QR in the Xaman app to authorise TapYield</Text>
            {qrUrl ? (
              <Image source={{ uri: qrUrl }} style={styles.qr} resizeMode="contain" />
            ) : (
              <ActivityIndicator color="#111111" size="large" style={{ marginVertical: 32 }} />
            )}
            {deepLink ? (
              <TouchableOpacity onPress={() => Linking.openURL(deepLink)}>
                <Text style={styles.deepLink}>Open in Xaman app →</Text>
              </TouchableOpacity>
            ) : null}
            <ActivityIndicator color="#888888" size="small" style={{ marginTop: 16 }} />
            <Text style={styles.hint}>Waiting for signature…</Text>
          </View>
        )}

        {/* ── TAP CARD ── */}
        {stage === 'tap_card' && (
          <View style={styles.centeredBox}>
            <Text style={styles.statusText}>Tap NFC Card</Text>
            <Text style={styles.hint}>Hold the NTAG216 card against the back of the phone</Text>
            <TouchableOpacity style={styles.nfcArea} onPress={handleNfcTap}>
              <Text style={styles.nfcIcon}>📶</Text>
              <Text style={styles.nfcLabel}>Tap to Scan Card</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── SCANNING / REGISTERING ── */}
        {(stage === 'scanning' || stage === 'registering') && (
          <View style={styles.centeredBox}>
            <ActivityIndicator color="#111111" size="large" />
            <Text style={styles.statusText}>
              {stage === 'scanning' ? 'Reading card…' : 'Registering…'}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EBEBEB' },
  content: { padding: 24, paddingBottom: 48 },
  title: { color: '#111111', fontSize: 26, fontWeight: '800', marginBottom: 6 },
  subtitle: { color: '#666666', fontSize: 13, marginBottom: 28 },

  label: { color: '#111111', fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 16 },
  input: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14,
    color: '#111111', fontSize: 14,
  },

  modeRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modeBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 14,
    borderWidth: 2, borderColor: '#DDDDDD', alignItems: 'center',
    backgroundColor: '#F0F0F0',
  },
  modeBtnActive: { borderColor: '#111111', backgroundColor: '#FFFFFF' },
  modeBtnText: { color: '#888888', fontSize: 14, fontWeight: '600' },
  modeBtnTextActive: { color: '#111111' },

  primaryBtn: {
    backgroundColor: '#111111', borderRadius: 40, padding: 18,
    alignItems: 'center', marginTop: 28,
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  btn: {
    backgroundColor: '#F0F0F0', borderRadius: 40, padding: 14,
    alignItems: 'center', marginTop: 16,
  },
  btnText: { color: '#111111', fontSize: 15, fontWeight: '600' },

  centeredBox: { alignItems: 'center', paddingTop: 32, gap: 12 },
  statusText: { color: '#111111', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  hint: { color: '#666666', fontSize: 13, textAlign: 'center', maxWidth: 280 },

  qr: { width: 240, height: 240, marginVertical: 16, borderRadius: 12 },
  deepLink: { color: '#111111', fontSize: 14, fontWeight: '600', marginTop: 8, textDecorationLine: 'underline' },

  nfcArea: {
    marginTop: 24, backgroundColor: '#FFFFFF', borderRadius: 20,
    borderWidth: 2, borderColor: '#DDDDDD', padding: 40, alignItems: 'center', gap: 12,
  },
  nfcIcon: { fontSize: 48 },
  nfcLabel: { color: '#111111', fontSize: 16, fontWeight: '700' },

  successBox: { alignItems: 'center', paddingTop: 32, gap: 10 },
  successIcon: { fontSize: 56, color: '#111111' },
  successTitle: { color: '#111111', fontSize: 22, fontWeight: '800' },
  mono: { color: '#666666', fontSize: 12, fontFamily: 'monospace' },

  errorBox: {
    backgroundColor: '#FFF0F0', borderRadius: 16, padding: 16,
    marginTop: 24, alignItems: 'center', gap: 12,
  },
  errorText: { color: '#CC0000', fontSize: 14, textAlign: 'center' },
});

import { useState } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  StyleSheet, SafeAreaView, Alert,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setupRegularKey, registerCard } from '../services/api';

type Step = 'xaman' | 'regular-key' | 'nfc' | 'done';

export default function RegisterCard() {
  const [step, setStep] = useState<Step>('xaman');
  const [loading, setLoading] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [regularKeyAddress, setRegularKeyAddress] = useState('');

  // Step 1: Sign in with Xaman — Alex implements this
  const handleXamanSignIn = () => {
    // TODO: Alex — Xaman QR / deep link sign-in
    // After sign-in, call: setWalletAddress(address) then setStep('regular-key')
    Alert.alert(
      'Xaman Sign-In',
      'Alex: Replace this with Xaman QR sign-in.\n\nFor demo: using wallet from AsyncStorage.',
      [
        {
          text: 'Use Demo Wallet',
          onPress: async () => {
            const stored = await AsyncStorage.getItem('wallet');
            if (stored) {
              const w = JSON.parse(stored);
              setWalletAddress(w.address);
              setStep('regular-key');
            } else {
              Alert.alert('Error', 'No wallet found. Create one first.');
            }
          },
        },
      ]
    );
  };

  // Step 2: Set up regular key on backend + sign with Xaman
  const handleSetupRegularKey = async () => {
    if (!walletAddress) return;
    setLoading(true);
    try {
      const result = await setupRegularKey(walletAddress);
      setRegularKeyAddress(result.regularKeyAddress);

      // TODO: Alex — Create Xaman payload for SetRegularKey tx:
      // { TransactionType: "SetRegularKey", Account: walletAddress, RegularKey: result.regularKeyAddress }
      // User approves in Xaman → then proceed to NFC step

      Alert.alert(
        'Regular Key Created',
        `Alex: Sign SetRegularKey in Xaman with:\nRegularKey: ${result.regularKeyAddress.slice(0, 12)}...`,
        [{ text: 'Continue (Demo)', onPress: () => setStep('nfc') }]
      );
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Tap NFC card — Alex implements this
  const handleNfcTap = () => {
    // TODO: Alex — Read NFC hardware UID via NfcManager
    // After reading: call registerCardOnBackend(tag.id)
    Alert.alert(
      'Tap NFC Card',
      'Alex: Replace this with NfcManager.getTag().id\n\nFor demo: simulating card tap.',
      [
        {
          text: 'Simulate Tap',
          onPress: () => registerCardOnBackend('DEMO-UID-' + Date.now()),
        },
      ]
    );
  };

  const registerCardOnBackend = async (uid: string) => {
    setLoading(true);
    try {
      await registerCard(uid, walletAddress, 'Customer');
      setStep('done');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  // Expose for Alex's NFC integration
  (globalThis as any).__tapyield_registerCard = registerCardOnBackend;

  const stepConfig = {
    'xaman': { number: 1, title: 'Sign in with Xaman', description: 'Connect your XRPL wallet', action: handleXamanSignIn, buttonText: 'Sign In with Xaman' },
    'regular-key': { number: 2, title: 'Authorize Card Payments', description: 'Set up a regular key so your card can make payments without exposing your master key', action: handleSetupRegularKey, buttonText: 'Authorize' },
    'nfc': { number: 3, title: 'Tap Your NFC Card', description: 'Hold your TapYield card against the phone', action: handleNfcTap, buttonText: 'Ready to Tap' },
    'done': { number: 4, title: 'Card Registered!', description: 'Your card is ready to use for tap-to-pay', action: () => router.back(), buttonText: 'Done' },
  };

  const current = stepConfig[step];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Register NFC Card</Text>
        <Text style={styles.subtitle}>Link your card for tap-to-pay</Text>

        {/* Progress Steps */}
        <View style={styles.steps}>
          {(['xaman', 'regular-key', 'nfc', 'done'] as Step[]).map((s, i) => {
            const config = stepConfig[s];
            const isActive = s === step;
            const isDone = config.number < current.number;
            return (
              <View key={s} style={styles.stepRow}>
                <View style={[
                  styles.stepCircle,
                  isDone && styles.stepDone,
                  isActive && styles.stepActive,
                ]}>
                  <Text style={[
                    styles.stepNumber,
                    (isDone || isActive) && styles.stepNumberActive,
                  ]}>
                    {isDone ? '✓' : config.number}
                  </Text>
                </View>
                <View style={styles.stepInfo}>
                  <Text style={[
                    styles.stepTitle,
                    isActive && styles.stepTitleActive,
                    isDone && styles.stepTitleDone,
                  ]}>
                    {config.title}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Current Step */}
        <View style={styles.currentStep}>
          <Text style={styles.currentTitle}>{current.title}</Text>
          <Text style={styles.currentDesc}>{current.description}</Text>

          {walletAddress && step !== 'xaman' && (
            <Text style={styles.walletInfo}>
              Wallet: {walletAddress.slice(0, 8)}...{walletAddress.slice(-4)}
            </Text>
          )}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={current.action}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#0a0e1a" />
            ) : (
              <Text style={styles.buttonText}>{current.buttonText}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e1a' },
  content: { flex: 1, padding: 24 },
  title: { color: '#fff', fontSize: 28, fontWeight: '800', marginBottom: 8 },
  subtitle: { color: '#8892b0', fontSize: 14, marginBottom: 32 },

  steps: { marginBottom: 32 },
  stepRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  stepCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#1e2740', justifyContent: 'center', alignItems: 'center',
  },
  stepDone: { backgroundColor: '#00e676' },
  stepActive: { backgroundColor: '#00e676', borderWidth: 2, borderColor: '#00e67650' },
  stepNumber: { color: '#4a5568', fontSize: 14, fontWeight: '700' },
  stepNumberActive: { color: '#0a0e1a' },
  stepInfo: { marginLeft: 12 },
  stepTitle: { color: '#4a5568', fontSize: 15, fontWeight: '600' },
  stepTitleActive: { color: '#fff' },
  stepTitleDone: { color: '#00e676' },

  currentStep: {
    backgroundColor: '#141929', borderRadius: 16, padding: 24,
    borderWidth: 1, borderColor: '#1e2740', alignItems: 'center',
  },
  currentTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 8 },
  currentDesc: { color: '#8892b0', fontSize: 14, textAlign: 'center', marginBottom: 20 },
  walletInfo: { color: '#4a5568', fontSize: 12, fontFamily: 'monospace', marginBottom: 16 },

  button: {
    backgroundColor: '#00e676', borderRadius: 12, padding: 16,
    alignItems: 'center', width: '100%',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#0a0e1a', fontSize: 16, fontWeight: '700' },
});

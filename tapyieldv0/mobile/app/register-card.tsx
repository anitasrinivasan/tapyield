import { useState } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  StyleSheet, SafeAreaView, Alert,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setupRegularKey, registerCard } from '../services/api';
import { colors } from './theme';

type Step = 'xaman' | 'regular-key' | 'nfc' | 'done';

export default function RegisterCard() {
  const [step, setStep] = useState<Step>('xaman');
  const [loading, setLoading] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [regularKeyAddress, setRegularKeyAddress] = useState('');

  const handleXamanSignIn = () => {
    Alert.alert(
      'Xaman Sign-In',
      'Alex: Replace this with Xaman QR sign-in.\n\nFor demo: using wallet from AsyncStorage.',
      [{
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
      }]
    );
  };

  const handleSetupRegularKey = async () => {
    if (!walletAddress) return;
    setLoading(true);
    try {
      const result = await setupRegularKey(walletAddress);
      setRegularKeyAddress(result.regularKeyAddress);
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

  const handleNfcTap = () => {
    Alert.alert(
      'Tap NFC Card',
      'Alex: Replace this with NfcManager.getTag().id',
      [{ text: 'Simulate Tap', onPress: () => registerCardOnBackend('DEMO-UID-' + Date.now()) }]
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

        <View style={styles.steps}>
          {(['xaman', 'regular-key', 'nfc', 'done'] as Step[]).map((s) => {
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
                <Text style={[
                  styles.stepTitle,
                  isActive && styles.stepTitleActive,
                  isDone && styles.stepTitleDone,
                ]}>
                  {config.title}
                </Text>
              </View>
            );
          })}
        </View>

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
              <ActivityIndicator color={colors.white} />
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
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, padding: 24 },
  title: { color: colors.text, fontSize: 28, fontWeight: '700', marginBottom: 8 },
  subtitle: { color: colors.textMuted, fontSize: 14, marginBottom: 32 },

  steps: { marginBottom: 32 },
  stepRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 12 },
  stepCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center',
  },
  stepDone: { backgroundColor: colors.accent },
  stepActive: { backgroundColor: colors.accent },
  stepNumber: { color: colors.textMuted, fontSize: 14, fontWeight: '700' },
  stepNumberActive: { color: colors.white },
  stepTitle: { color: colors.textMuted, fontSize: 15, fontWeight: '600' },
  stepTitleActive: { color: colors.text },
  stepTitleDone: { color: colors.accent },

  currentStep: {
    backgroundColor: colors.card, borderRadius: 16, padding: 24,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center',
  },
  currentTitle: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 8 },
  currentDesc: { color: colors.textMuted, fontSize: 14, textAlign: 'center', marginBottom: 20 },
  walletInfo: { color: colors.textMuted, fontSize: 12, fontFamily: 'monospace', marginBottom: 16 },

  button: {
    backgroundColor: colors.accent, borderRadius: 24, padding: 16,
    alignItems: 'center', width: '100%',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '700' },
});

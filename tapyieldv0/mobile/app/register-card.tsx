import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  StyleSheet, SafeAreaView, Alert, Animated, Easing, Image, Linking,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  setupRegularKey, registerCard, xamanSignIn,
  xamanSetRegularKey, xamanGetPayloadStatus,
} from '../services/api';
import { colors } from './theme';

type Step = 'xaman' | 'regular-key' | 'nfc' | 'done';

export default function RegisterCard() {
  const [step, setStep] = useState<Step>('xaman');
  const [loading, setLoading] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [regularKeyAddress, setRegularKeyAddress] = useState('');
  const [xamanQrUrl, setXamanQrUrl] = useState('');
  const [xamanUuid, setXamanUuid] = useState('');
  const [waitingForXaman, setWaitingForXaman] = useState(false);

  // Pulse animation for NFC tap
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (step === 'nfc') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [step]);

  // Poll Xaman payload status
  useEffect(() => {
    if (!xamanUuid || !waitingForXaman) return;
    const interval = setInterval(async () => {
      try {
        const status = await xamanGetPayloadStatus(xamanUuid);
        if (status.resolved) {
          clearInterval(interval);
          setWaitingForXaman(false);
          if (status.signed && status.account) {
            setWalletAddress(status.account);
            setXamanQrUrl('');
            setStep('regular-key');
          } else {
            Alert.alert('Sign-in Declined', 'Please try again.');
          }
        }
      } catch {
        // keep polling
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [xamanUuid, waitingForXaman]);

  const handleXamanSignIn = async () => {
    setLoading(true);
    try {
      const result = await xamanSignIn();
      setXamanUuid(result.uuid);
      setXamanQrUrl(result.qrUrl);
      setWaitingForXaman(true);
      // Try to open Xaman app directly
      if (result.deepLink) {
        Linking.openURL(result.deepLink).catch(() => {
          // Deep link failed — user will scan QR instead
        });
      }
    } catch (err: any) {
      // Xaman not configured — fall back to demo wallet
      console.log('Xaman not available, using demo wallet');
      const stored = await AsyncStorage.getItem('wallet');
      if (stored) {
        const w = JSON.parse(stored);
        setWalletAddress(w.address);
        setStep('regular-key');
      } else {
        Alert.alert('Error', 'No wallet found. Create one first.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUseDemoWallet = async () => {
    const stored = await AsyncStorage.getItem('wallet');
    if (stored) {
      const w = JSON.parse(stored);
      setWalletAddress(w.address);
      setXamanQrUrl('');
      setWaitingForXaman(false);
      setStep('regular-key');
    } else {
      Alert.alert('Error', 'No wallet found. Create one first.');
    }
  };

  const handleSetupRegularKey = async () => {
    if (!walletAddress) return;
    setLoading(true);
    try {
      const result = await setupRegularKey(walletAddress);
      setRegularKeyAddress(result.regularKeyAddress);

      // Try Xaman signing for SetRegularKey
      try {
        const xaman = await xamanSetRegularKey(walletAddress, result.regularKeyAddress);
        setXamanUuid(xaman.uuid);
        setXamanQrUrl(xaman.qrUrl);
        setWaitingForXaman(true);
        if (xaman.deepLink) {
          Linking.openURL(xaman.deepLink).catch(() => {});
        }
        // Poll will handle the transition
      } catch {
        // Xaman not available — auto-advance for demo
        setStep('nfc');
      }
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  // Poll for SetRegularKey signing → advance to NFC step
  useEffect(() => {
    if (!xamanUuid || !waitingForXaman || step !== 'regular-key') return;
    const interval = setInterval(async () => {
      try {
        const status = await xamanGetPayloadStatus(xamanUuid);
        if (status.resolved) {
          clearInterval(interval);
          setWaitingForXaman(false);
          setXamanQrUrl('');
          if (status.signed) {
            setStep('nfc');
          } else {
            Alert.alert('Authorization Declined', 'Please try again.');
          }
        }
      } catch {}
    }, 2000);
    return () => clearInterval(interval);
  }, [xamanUuid, waitingForXaman, step]);

  const handleNfcTap = () => {
    // Simulate NFC card tap for demo
    registerCardOnBackend('TAPYIELD-' + Date.now().toString(36).toUpperCase());
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

  // Expose for external NFC integration
  (globalThis as any).__tapyield_registerCard = registerCardOnBackend;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Register NFC Card</Text>
        <Text style={styles.subtitle}>Link your card for tap-to-pay</Text>

        {/* Step indicators */}
        <View style={styles.steps}>
          {(['xaman', 'regular-key', 'nfc', 'done'] as Step[]).map((s, i) => {
            const stepNames = ['Connect Wallet', 'Authorize', 'Tap Card', 'Done'];
            const stepNumber = i + 1;
            const currentNumber = ['xaman', 'regular-key', 'nfc', 'done'].indexOf(step) + 1;
            const isActive = s === step;
            const isDone = stepNumber < currentNumber;
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
                    {isDone ? '✓' : stepNumber}
                  </Text>
                </View>
                <Text style={[
                  styles.stepTitle,
                  isActive && styles.stepTitleActive,
                  isDone && styles.stepTitleDone,
                ]}>
                  {stepNames[i]}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Current step content */}
        <View style={styles.currentStep}>
          {step === 'xaman' && (
            <>
              {xamanQrUrl ? (
                <>
                  <Text style={styles.currentTitle}>Scan with Xaman</Text>
                  <Text style={styles.currentDesc}>Open Xaman on your phone and scan this QR code</Text>
                  <Image source={{ uri: xamanQrUrl }} style={styles.qrImage} />
                  <TouchableOpacity style={styles.secondaryBtn} onPress={handleUseDemoWallet}>
                    <Text style={styles.secondaryBtnText}>Use Demo Wallet Instead</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.currentTitle}>Connect Wallet</Text>
                  <Text style={styles.currentDesc}>Sign in with Xaman to connect your XRPL wallet</Text>
                  <TouchableOpacity
                    style={[styles.button, loading && styles.buttonDisabled]}
                    onPress={handleXamanSignIn}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color={colors.white} />
                    ) : (
                      <Text style={styles.buttonText}>Sign In with Xaman</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </>
          )}

          {step === 'regular-key' && (
            <>
              {xamanQrUrl ? (
                <>
                  <Text style={styles.currentTitle}>Approve in Xaman</Text>
                  <Text style={styles.currentDesc}>Scan to authorize card payments on your wallet</Text>
                  <Image source={{ uri: xamanQrUrl }} style={styles.qrImage} />
                  <TouchableOpacity style={styles.secondaryBtn} onPress={() => { setXamanQrUrl(''); setWaitingForXaman(false); setStep('nfc'); }}>
                    <Text style={styles.secondaryBtnText}>Skip for Demo</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.currentTitle}>Authorize Card</Text>
                  <Text style={styles.currentDesc}>Set up a regular key so your card can make payments without exposing your master key</Text>
                  {walletAddress && (
                    <Text style={styles.walletInfo}>
                      Wallet: {walletAddress.slice(0, 8)}...{walletAddress.slice(-4)}
                    </Text>
                  )}
                  <TouchableOpacity
                    style={[styles.button, loading && styles.buttonDisabled]}
                    onPress={handleSetupRegularKey}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color={colors.white} />
                    ) : (
                      <Text style={styles.buttonText}>Authorize</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </>
          )}

          {step === 'nfc' && (
            <>
              <Text style={styles.currentTitle}>Tap Your Card</Text>
              <Text style={styles.currentDesc}>Hold your TapYield card against the phone</Text>
              <TouchableOpacity onPress={handleNfcTap} disabled={loading} activeOpacity={0.7}>
                <Animated.View style={[styles.nfcCircle, { transform: [{ scale: pulseAnim }] }]}>
                  {loading ? (
                    <ActivityIndicator size="large" color={colors.white} />
                  ) : (
                    <Text style={styles.nfcIcon}>📱</Text>
                  )}
                </Animated.View>
              </TouchableOpacity>
              <Text style={styles.tapHint}>Tap to simulate card read</Text>
            </>
          )}

          {step === 'done' && (
            <>
              <Text style={styles.checkmark}>✓</Text>
              <Text style={styles.currentTitle}>Card Registered!</Text>
              <Text style={styles.currentDesc}>Your card is ready for tap-to-pay</Text>
              <TouchableOpacity style={styles.button} onPress={() => router.back()}>
                <Text style={styles.buttonText}>Done</Text>
              </TouchableOpacity>
            </>
          )}
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
  currentDesc: { color: colors.textMuted, fontSize: 14, textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  walletInfo: { color: colors.textMuted, fontSize: 12, fontFamily: 'monospace', marginBottom: 16 },

  qrImage: { width: 200, height: 200, marginBottom: 20, borderRadius: 8 },

  button: {
    backgroundColor: colors.accent, borderRadius: 24, padding: 16,
    alignItems: 'center', width: '100%',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '700' },

  secondaryBtn: {
    padding: 12, alignItems: 'center', width: '100%',
  },
  secondaryBtnText: { color: colors.textMuted, fontSize: 14, fontWeight: '500' },

  nfcCircle: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
  },
  nfcIcon: { fontSize: 40 },
  tapHint: { color: colors.textMuted, fontSize: 12, marginTop: 4 },

  checkmark: { fontSize: 48, color: colors.accent, marginBottom: 12 },
});

import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { seedDemo, createWallet, getWalletStatus } from '../services/api';
import { colors } from './theme';

export default function Welcome() {
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [error, setError] = useState('');

  // Auto-navigate if wallet exists AND is still valid on the backend
  useEffect(() => {
    (async () => {
      // Pre-load the demo wallet credentials so the app always has a funded wallet
      const DEMO_WALLET = {
        address: 'rHvScpsRm9Ukt3RkQsm6RENghjvwZGNzm',
        seed: 'sEdVWeHiMuMEmiWjbJKWvsg27V1YeLM',
        balance: '100',
      };

      const stored = await AsyncStorage.getItem('wallet');
      if (stored) {
        const wallet = JSON.parse(stored);
        try {
          await getWalletStatus(wallet.address);
          router.replace('/dashboard');
        } catch {
          // Backend was redeployed — wallet data is gone. Clear and stay on welcome.
          await AsyncStorage.removeItem('wallet');
        }
      } else {
        // No wallet stored — auto-set the demo wallet so "Get Started" is instant
        await AsyncStorage.setItem('wallet', JSON.stringify(DEMO_WALLET));
      }
    })();
  }, []);

  const handleGetStarted = async () => {
    setLoading(true);
    setError('');
    try {
      // The demo wallet is already pre-loaded in AsyncStorage from useEffect
      // Just verify it works and go to dashboard
      const stored = await AsyncStorage.getItem('wallet');
      if (stored) {
        const wallet = JSON.parse(stored);
        setLoadingMsg('Connecting to XRPL...');
        await getWalletStatus(wallet.address);
        router.replace('/dashboard');
        return;
      }

      // Fallback: seed a new demo wallet
      setLoadingMsg('Creating wallet on XRPL...');
      const result = await seedDemo();
      await AsyncStorage.setItem('wallet', JSON.stringify({
        address: result.address,
        seed: result.seed,
        balance: result.balance,
      }));
      router.replace('/dashboard');
    } catch (err: any) {
      console.error('Startup error:', err);
      setError(err.response?.data?.error || err.message || 'Failed to connect');
    } finally {
      setLoading(false);
      setLoadingMsg('');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.logo}>Tap Yield</Text>
        <Text style={styles.tagline}>
          Save smart. Earn yield. Pay instantly.
        </Text>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleGetStarted}
          disabled={loading}
        >
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.white} />
              <Text style={styles.buttonText}>  Setting up...</Text>
            </View>
          ) : (
            <Text style={styles.buttonText}>Get Started</Text>
          )}
        </TouchableOpacity>

        {loading && loadingMsg ? (
          <Text style={styles.loadingHint}>{loadingMsg}</Text>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.footnote}>
          Powered by the XRP Ledger testnet
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  logo: { fontSize: 48, fontWeight: '800', color: colors.text, marginBottom: 12 },
  tagline: { fontSize: 18, color: colors.textMuted, textAlign: 'center', marginBottom: 48 },
  button: {
    backgroundColor: colors.accent, paddingHorizontal: 48, paddingVertical: 16,
    borderRadius: 24, minWidth: 240, alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontSize: 18, fontWeight: '700', color: colors.white },
  loadingRow: { flexDirection: 'row', alignItems: 'center' },
  loadingHint: { color: colors.textMuted, marginTop: 16, fontSize: 14 },
  error: { color: '#D32F2F', marginTop: 16, textAlign: 'center' },
  footnote: { color: colors.textMuted, marginTop: 32, fontSize: 12 },
});

import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createWallet } from '../services/api';
import { colors } from './theme';

export default function Welcome() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Auto-navigate if wallet exists
  useEffect(() => {
    AsyncStorage.getItem('wallet').then((stored) => {
      if (stored) router.replace('/dashboard');
    });
  }, []);

  const handleCreateWallet = async () => {
    setLoading(true);
    setError('');
    try {
      const wallet = await createWallet();
      await AsyncStorage.setItem('wallet', JSON.stringify(wallet));
      router.replace('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to create wallet');
    } finally {
      setLoading(false);
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
          onPress={handleCreateWallet}
          disabled={loading}
        >
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.white} />
              <Text style={styles.buttonText}>  Creating wallet...</Text>
            </View>
          ) : (
            <Text style={styles.buttonText}>Create Wallet</Text>
          )}
        </TouchableOpacity>

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
  error: { color: '#D32F2F', marginTop: 16, textAlign: 'center' },
  footnote: { color: colors.textMuted, marginTop: 32, fontSize: 12 },
});

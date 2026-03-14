import { useState } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createWallet } from '../services/api';

export default function Welcome() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreateWallet = async () => {
    setLoading(true);
    setError('');
    try {
      const wallet = await createWallet();
      // Store wallet info locally
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
        <Text style={styles.logo}>TapYield</Text>
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
              <ActivityIndicator color="#0a0e1a" />
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
  container: { flex: 1, backgroundColor: '#0a0e1a' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  logo: { fontSize: 48, fontWeight: '800', color: '#00e676', marginBottom: 12 },
  tagline: { fontSize: 18, color: '#8892b0', textAlign: 'center', marginBottom: 48 },
  button: {
    backgroundColor: '#00e676', paddingHorizontal: 48, paddingVertical: 16,
    borderRadius: 12, minWidth: 240, alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { fontSize: 18, fontWeight: '700', color: '#0a0e1a' },
  loadingRow: { flexDirection: 'row', alignItems: 'center' },
  error: { color: '#ff5252', marginTop: 16, textAlign: 'center' },
  footnote: { color: '#4a5568', marginTop: 32, fontSize: 12 },
});

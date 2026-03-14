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
          Save smart. Earn yield.{'\n'}Pay instantly.
        </Text>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleCreateWallet}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Get Started</Text>
          )}
        </TouchableOpacity>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.footnote}>Powered by the XRP Ledger</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EBEBEB' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  logo: { fontSize: 48, fontWeight: '800', color: '#111111', marginBottom: 16 },
  tagline: { fontSize: 20, color: '#666666', textAlign: 'center', lineHeight: 28, marginBottom: 48 },
  button: {
    backgroundColor: '#111111', paddingHorizontal: 48, paddingVertical: 18,
    borderRadius: 40, minWidth: 240, alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
  error: { color: '#CC0000', marginTop: 16, textAlign: 'center' },
  footnote: { color: '#999999', marginTop: 40, fontSize: 12 },
});

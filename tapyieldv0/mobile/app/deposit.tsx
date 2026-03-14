import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  StyleSheet, SafeAreaView, Alert, Linking,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { depositToPool } from '../services/api';

const XRP_TO_USD = 2.50;

export default function Deposit() {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const usdEquiv = amount ? `$${(parseFloat(amount) * XRP_TO_USD).toFixed(2)}` : '';

  const handleDeposit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Enter a valid amount');
      return;
    }

    setLoading(true);
    try {
      const stored = await AsyncStorage.getItem('wallet');
      if (!stored) throw new Error('No wallet found');
      const wallet = JSON.parse(stored);

      const result = await depositToPool(wallet.address, wallet.seed, amount);
      const usdAmt = (parseFloat(amount) * XRP_TO_USD).toFixed(2);
      Alert.alert(
        'Deposit Successful!',
        `$${usdAmt} deposited into your yield pool.\nYour funds are now earning yield.`,
        [
          { text: 'View on Explorer', onPress: () => Linking.openURL(`https://testnet.xrpl.org/transactions/${result.txHash}`) },
          { text: 'Done', onPress: () => router.back() },
        ]
      );
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  // Preset amounts in USD → XRP
  const presets = [
    { usd: '$25', xrp: '10' },
    { usd: '$62', xrp: '25' },
    { usd: '$125', xrp: '50' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Add Funds</Text>
        <Text style={styles.subtitle}>
          Your funds start earning yield immediately
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Amount in XRP"
          placeholderTextColor="#4a5568"
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
        />
        {usdEquiv ? (
          <Text style={styles.usdEquiv}>≈ {usdEquiv} USD</Text>
        ) : null}

        <View style={styles.presets}>
          {presets.map(p => (
            <TouchableOpacity
              key={p.xrp}
              style={[styles.presetBtn, amount === p.xrp && styles.presetActive]}
              onPress={() => setAmount(p.xrp)}
            >
              <Text style={[styles.presetUsd, amount === p.xrp && styles.presetTextActive]}>{p.usd}</Text>
              <Text style={styles.presetXrp}>{p.xrp} XRP</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleDeposit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#0a0e1a" />
          ) : (
            <Text style={styles.buttonText}>
              Deposit {usdEquiv || ''}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e1a' },
  content: { flex: 1, padding: 24 },
  title: { color: '#fff', fontSize: 28, fontWeight: '800', marginBottom: 8 },
  subtitle: { color: '#8892b0', fontSize: 14, marginBottom: 32 },
  input: {
    backgroundColor: '#141929', borderRadius: 12, padding: 16,
    color: '#fff', fontSize: 24, fontWeight: '600', fontVariant: ['tabular-nums'],
    borderWidth: 1, borderColor: '#1e2740', textAlign: 'center',
  },
  usdEquiv: { color: '#00e676', fontSize: 16, textAlign: 'center', marginTop: 8, fontWeight: '600' },
  presets: { flexDirection: 'row', gap: 12, marginTop: 20 },
  presetBtn: {
    flex: 1, backgroundColor: '#1e2740', borderRadius: 8, padding: 12, alignItems: 'center',
  },
  presetActive: { backgroundColor: '#00e67620', borderWidth: 1, borderColor: '#00e676' },
  presetUsd: { color: '#ccd6f6', fontWeight: '700', fontSize: 16 },
  presetXrp: { color: '#4a5568', fontSize: 11, marginTop: 2 },
  presetTextActive: { color: '#00e676' },
  button: {
    backgroundColor: '#00e676', borderRadius: 12, padding: 16,
    alignItems: 'center', marginTop: 32,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#0a0e1a', fontSize: 18, fontWeight: '700' },
});

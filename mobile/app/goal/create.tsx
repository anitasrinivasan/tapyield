import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  StyleSheet, SafeAreaView, Alert, Linking,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createGoal } from '../../services/api';

const XRP_TO_USD = 2.50;

export default function CreateGoal() {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [minutes, setMinutes] = useState('3');
  const [loading, setLoading] = useState(false);

  const usdEquiv = amount ? `$${(parseFloat(amount) * XRP_TO_USD).toFixed(2)}` : '';

  const handleCreate = async () => {
    if (!name || !amount || !minutes) {
      Alert.alert('Error', 'Fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const stored = await AsyncStorage.getItem('wallet');
      if (!stored) throw new Error('No wallet found');
      const wallet = JSON.parse(stored);

      // Calculate unlock date from minutes
      const unlockDate = new Date(Date.now() + parseInt(minutes) * 60 * 1000).toISOString();

      const result = await createGoal(wallet.address, wallet.seed, name, amount, unlockDate);
      const usdAmt = (parseFloat(amount) * XRP_TO_USD).toFixed(2);
      Alert.alert(
        'Goal Created!',
        `$${usdAmt} locked until ${new Date(unlockDate).toLocaleTimeString()}\n\nYour funds will keep earning yield while locked.\nSavings goal recorded on-chain.`,
        [
          { text: 'View Escrow', onPress: () => Linking.openURL(`https://testnet.xrpl.org/transactions/${result.escrowTxHash}`) },
          { text: 'Done', onPress: () => router.back() },
        ]
      );
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Create Savings Goal</Text>
        <Text style={styles.subtitle}>
          Set a goal — your funds keep earning yield while locked
        </Text>

        <Text style={styles.label}>Goal Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., Emergency Fund"
          placeholderTextColor="#4a5568"
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>Amount (XRP)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., 20"
          placeholderTextColor="#4a5568"
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
        />
        {usdEquiv ? <Text style={styles.usdEquiv}>≈ {usdEquiv} USD</Text> : null}

        <Text style={styles.label}>Lock Duration (minutes)</Text>
        <View style={styles.presets}>
          {['2', '3', '5', '10'].map(val => (
            <TouchableOpacity
              key={val}
              style={[styles.presetBtn, minutes === val && styles.presetActive]}
              onPress={() => setMinutes(val)}
            >
              <Text style={[styles.presetText, minutes === val && styles.presetTextActive]}>
                {val}m
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.warning}>
          <Text style={styles.warningText}>
            You won't be able to spend these funds for {minutes} minutes.
            They will continue earning yield while locked.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleCreate}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#0a0e1a" />
          ) : (
            <Text style={styles.buttonText}>Lock Funds</Text>
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
  subtitle: { color: '#8892b0', fontSize: 14, marginBottom: 24 },
  label: { color: '#ccd6f6', fontSize: 14, fontWeight: '600', marginBottom: 8, marginTop: 16 },
  input: {
    backgroundColor: '#141929', borderRadius: 12, padding: 16,
    color: '#fff', fontSize: 18, borderWidth: 1, borderColor: '#1e2740',
  },
  presets: { flexDirection: 'row', gap: 12, marginTop: 4 },
  presetBtn: {
    flex: 1, backgroundColor: '#1e2740', borderRadius: 8, padding: 12, alignItems: 'center',
  },
  presetActive: { backgroundColor: '#00e67630', borderWidth: 1, borderColor: '#00e676' },
  presetText: { color: '#ccd6f6', fontWeight: '600' },
  presetTextActive: { color: '#00e676' },
  warning: {
    backgroundColor: '#1e274060', borderRadius: 8, padding: 12, marginTop: 24,
    borderLeftWidth: 3, borderLeftColor: '#ffd740',
  },
  warningText: { color: '#8892b0', fontSize: 13, lineHeight: 18 },
  button: {
    backgroundColor: '#00e676', borderRadius: 12, padding: 16,
    alignItems: 'center', marginTop: 24,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#0a0e1a', fontSize: 18, fontWeight: '700' },
  usdEquiv: { color: '#00e676', fontSize: 14, marginTop: 4, fontWeight: '600' },
});

import { useState } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  StyleSheet, SafeAreaView, Alert, Linking,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { depositToPool } from '../services/api';
import { colors, XRP_TO_USD } from './theme';
import NumberPad from '../components/NumberPad';

export default function Deposit() {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const displayAmount = amount ? `$${amount}` : '$0.00';
  const xrpAmount = amount ? (parseFloat(amount) / XRP_TO_USD).toFixed(2) : '0';

  const handleNumberPad = (key: string) => {
    if (key === '⌫') {
      setAmount((prev) => prev.slice(0, -1));
    } else if (key === '.') {
      if (!amount.includes('.')) setAmount((prev) => prev + '.');
    } else {
      const parts = amount.split('.');
      if (parts[1] && parts[1].length >= 2) return;
      setAmount((prev) => prev + key);
    }
  };

  const handleDeposit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Enter an amount');
      return;
    }

    setLoading(true);
    try {
      const stored = await AsyncStorage.getItem('wallet');
      if (!stored) throw new Error('No wallet found');
      const wallet = JSON.parse(stored);

      const result = await depositToPool(wallet.address, wallet.seed, xrpAmount);
      Alert.alert(
        'Deposit Successful!',
        `${displayAmount} deposited. Your funds are now earning yield.`,
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Add Funds</Text>
        <Text style={styles.subtitle}>Your funds start earning yield immediately</Text>

        <View style={styles.amountSection}>
          <Text style={styles.label}>DEPOSIT AMOUNT</Text>
          <Text style={[styles.amountDisplay, amount ? styles.amountActive : null]}>
            {displayAmount}
          </Text>
          {amount ? <Text style={styles.xrpEquiv}>{xrpAmount} XRP</Text> : null}
        </View>

        <NumberPad onPress={handleNumberPad} />

        <View style={styles.bottomAction}>
          <TouchableOpacity
            style={[styles.primaryBtn, (!amount || parseFloat(amount) <= 0 || loading) && styles.btnDisabled]}
            onPress={handleDeposit}
            disabled={!amount || parseFloat(amount) <= 0 || loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.primaryBtnText}>Deposit {displayAmount}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, paddingTop: 12 },

  title: { fontSize: 28, fontWeight: '700', color: colors.text, paddingHorizontal: 24, marginBottom: 8 },
  subtitle: { color: colors.textMuted, fontSize: 14, paddingHorizontal: 24, marginBottom: 32 },

  amountSection: { paddingHorizontal: 24, marginBottom: 32 },
  label: { color: colors.textMuted, fontSize: 11, letterSpacing: 1, marginBottom: 8 },
  amountDisplay: { fontSize: 48, fontWeight: '300', color: colors.textLight },
  amountActive: { color: colors.text },
  xrpEquiv: { color: colors.textMuted, fontSize: 14, marginTop: 4 },

  bottomAction: { position: 'absolute', bottom: 40, left: 24, right: 24 },
  primaryBtn: { backgroundColor: colors.accent, borderRadius: 24, paddingVertical: 16, alignItems: 'center' },
  btnDisabled: { opacity: 0.3 },
  primaryBtnText: { color: colors.white, fontSize: 16, fontWeight: '600' },
});

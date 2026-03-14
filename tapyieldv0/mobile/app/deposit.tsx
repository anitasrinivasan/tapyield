import { useState } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator, TextInput,
  StyleSheet, SafeAreaView, Alert, Linking, KeyboardAvoidingView,
  TouchableWithoutFeedback, Keyboard, Platform,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { depositToPool } from '../services/api';
import { colors, XRP_TO_USD } from './theme';

export default function Deposit() {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const displayAmount = amount ? `$${amount}` : '$0.00';
  const xrpAmount = amount ? (parseFloat(amount) / XRP_TO_USD).toFixed(2) : '0';

  const handleAmountChange = (text: string) => {
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) return;
    if (parts[1] && parts[1].length > 2) return;
    setAmount(cleaned);
  };

  const handleDeposit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Enter an amount');
      return;
    }

    Keyboard.dismiss();
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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.content}>
            <Text style={styles.title}>Add Funds</Text>
            <Text style={styles.subtitle}>Your funds start earning yield immediately</Text>

            <View style={styles.amountSection}>
              <Text style={styles.label}>DEPOSIT AMOUNT</Text>
              <TextInput
                style={[styles.amountInput, amount ? styles.amountActive : null]}
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={handleAmountChange}
                placeholder="0.00"
                placeholderTextColor={colors.textLight}
                autoFocus
              />
              {amount ? <Text style={styles.xrpEquiv}>{xrpAmount} XRP</Text> : null}
            </View>

            <View style={styles.spacer} />

            <TouchableOpacity
              style={[styles.primaryBtn, (!amount || parseFloat(amount) <= 0 || loading) && styles.btnDisabled]}
              onPress={handleDeposit}
              disabled={!amount || parseFloat(amount) <= 0 || loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.primaryBtnText}>Deposit {amount ? `$${amount}` : ''}</Text>
              )}
            </TouchableOpacity>
            <View style={styles.bottomPad} />
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { flex: 1, paddingTop: 12, paddingHorizontal: 24 },

  title: { fontSize: 28, fontWeight: '700', color: colors.text, marginBottom: 8 },
  subtitle: { color: colors.textMuted, fontSize: 14, marginBottom: 32 },

  amountSection: { marginBottom: 20 },
  label: { color: colors.textMuted, fontSize: 11, letterSpacing: 1, marginBottom: 8 },
  amountInput: { fontSize: 48, fontWeight: '300', color: colors.textLight, padding: 0 },
  amountActive: { color: colors.text },
  xrpEquiv: { color: colors.textMuted, fontSize: 14, marginTop: 4 },

  spacer: { flex: 1 },
  bottomPad: { height: 40 },
  primaryBtn: { backgroundColor: colors.accent, borderRadius: 24, paddingVertical: 16, alignItems: 'center' },
  btnDisabled: { opacity: 0.3 },
  primaryBtnText: { color: colors.white, fontSize: 16, fontWeight: '600' },
});

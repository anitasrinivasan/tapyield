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
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={s.flex}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={s.content}>
            <View style={s.card}>
              <Text style={s.label}>DEPOSIT AMOUNT</Text>
              <TextInput
                style={[s.amountInput, amount ? s.amountActive : null]}
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={handleAmountChange}
                placeholder="0.00"
                placeholderTextColor={colors.textLight}
                autoFocus
              />
              {amount ? <Text style={s.xrpEquiv}>{xrpAmount} XRP</Text> : null}
            </View>

            <View style={s.spacer} />

            <TouchableOpacity
              style={[s.primaryBtn, (!amount || parseFloat(amount) <= 0 || loading) && s.btnDisabled]}
              onPress={handleDeposit}
              disabled={!amount || parseFloat(amount) <= 0 || loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={s.primaryBtnText}>Deposit {amount ? `$${amount}` : ''}</Text>
              )}
            </TouchableOpacity>
            <View style={{ height: 40 }} />
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { flex: 1, paddingTop: 8, paddingHorizontal: 16 },

  card: {
    backgroundColor: colors.card, borderRadius: 16, padding: 20,
  },
  label: {
    fontSize: 11, fontWeight: '600', color: colors.textMuted,
    letterSpacing: 1, marginBottom: 12,
  },
  amountInput: { fontSize: 40, fontWeight: '300', color: colors.textLight, padding: 0 },
  amountActive: { color: colors.text },
  xrpEquiv: { color: colors.textMuted, fontSize: 14, marginTop: 8 },

  spacer: { flex: 1 },
  primaryBtn: {
    backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginHorizontal: 4,
  },
  btnDisabled: { opacity: 0.3 },
  primaryBtnText: { color: colors.white, fontSize: 16, fontWeight: '600' },
});

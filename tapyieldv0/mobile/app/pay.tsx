import { useState } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator, TextInput,
  StyleSheet, SafeAreaView, Alert, Linking,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { tapPayment, getCardName } from '../services/api';
import { colors, XRP_TO_USD } from './theme';
import NumberPad from '../components/NumberPad';

type PayState = 'amount' | 'nfc' | 'processing' | 'success';

export default function Pay() {
  const [state, setState] = useState<PayState>('amount');
  const [amount, setAmount] = useState('');
  const [cardUid, setCardUid] = useState('');
  const [txHash, setTxHash] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [merchantName, setMerchantName] = useState('');

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

  const handleReadyForPayment = () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Enter an amount');
      return;
    }
    setState('nfc');
  };

  // Called by Alex's NFC module when a customer's card is read
  const onCardRead = async (id: string) => {
    setCardUid(id);
    try {
      const name = await getCardName(id);
      setCustomerName(name);
    } catch {
      setCustomerName('Customer');
    }
    processPayment(id);
  };

  // Expose for Alex's NFC integration
  (globalThis as any).__tapyield_onCardRead = onCardRead;

  const processPayment = async (uid: string) => {
    setState('processing');
    try {
      const stored = await AsyncStorage.getItem('wallet');
      if (!stored) throw new Error('No wallet found');
      const merchantWallet = JSON.parse(stored);

      const result = await tapPayment(uid, merchantWallet.address, xrpAmount, merchantName || undefined);
      setTxHash(result.txHash || '');
      if (result.customerName) setCustomerName(result.customerName);
      setState('success');
    } catch (err: any) {
      Alert.alert('Payment Failed', err.response?.data?.error || err.message);
      setState('nfc');
    }
  };

  // Demo: simulate NFC tap
  const simulateNfcTap = () => {
    onCardRead('DEMO-UID-' + Date.now());
  };

  const resetPayment = () => {
    setState('amount');
    setAmount('');
    setCardUid('');
    setTxHash('');
    setCustomerName('');
    setMerchantName('');
  };

  return (
    <SafeAreaView style={styles.container}>
      {state === 'amount' && (
        <View style={styles.content}>
          <TextInput
            style={styles.merchantInput}
            placeholder="Merchant Name"
            placeholderTextColor={colors.textLight}
            value={merchantName}
            onChangeText={setMerchantName}
            autoCapitalize="words"
            returnKeyType="done"
          />
          <View style={styles.amountSection}>
            <Text style={styles.amountLabel}>PAYMENT AMOUNT</Text>
            <Text style={[styles.amountDisplay, amount ? styles.amountActive : null]}>
              {displayAmount}
            </Text>
          </View>
          <NumberPad onPress={handleNumberPad} />
          <View style={styles.bottomAction}>
            <TouchableOpacity
              style={[styles.primaryBtn, (!amount || parseFloat(amount) <= 0) && styles.btnDisabled]}
              onPress={handleReadyForPayment}
              disabled={!amount || parseFloat(amount) <= 0}
            >
              <Text style={styles.primaryBtnText}>Ready for Payment</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {state === 'nfc' && (
        <TouchableOpacity style={styles.centered} onPress={simulateNfcTap} activeOpacity={0.8}>
          <ActivityIndicator size="large" color={colors.textMuted} />
          <Text style={styles.stateLabel}>WAITING FOR NFC</Text>
          <Text style={styles.stateDesc}>Hold customer's card{'\n'}near phone</Text>
        </TouchableOpacity>
      )}

      {state === 'processing' && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.textMuted} />
          <Text style={styles.stateLabel}>LOADING</Text>
          <Text style={styles.stateDesc}>Processing payment{'\n'}on XRPL...</Text>
        </View>
      )}

      {state === 'success' && (
        <View style={styles.centered}>
          <Text style={styles.checkmark}>✓</Text>
          <Text style={styles.successAmount}>{displayAmount}</Text>
          <Text style={styles.successPaid}>paid</Text>
          <View style={styles.txInfo}>
            {txHash ? (
              <>
                <Text style={styles.txLabel}>Transaction ID: ...{txHash.slice(-4)}</Text>
                <TouchableOpacity onPress={() => Linking.openURL(`https://testnet.xrpl.org/transactions/${txHash}`)}>
                  <Text style={styles.txLink}>XRPL explorer: testnet.xrpl.org/</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
          <View style={styles.bottomAction}>
            <TouchableOpacity style={styles.primaryBtn} onPress={resetPayment}>
              <Text style={styles.primaryBtnText}>+ New Payment</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, paddingTop: 20 },

  merchantInput: {
    fontSize: 16, color: colors.text, fontWeight: '500', paddingHorizontal: 24,
    marginBottom: 40, paddingVertical: 8,
  },

  amountSection: { alignItems: 'flex-start', paddingHorizontal: 24, marginBottom: 40 },
  amountLabel: { color: colors.textMuted, fontSize: 11, letterSpacing: 1, marginBottom: 8 },
  amountDisplay: { fontSize: 48, fontWeight: '300', color: colors.textLight },
  amountActive: { color: colors.text },

  bottomAction: { position: 'absolute', bottom: 40, left: 24, right: 24 },
  primaryBtn: { backgroundColor: colors.accent, borderRadius: 24, paddingVertical: 16, alignItems: 'center' },
  btnDisabled: { opacity: 0.3 },
  primaryBtnText: { color: colors.white, fontSize: 16, fontWeight: '600' },

  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  stateLabel: { color: colors.textMuted, fontSize: 11, letterSpacing: 1, marginTop: 24 },
  stateDesc: { color: colors.text, fontSize: 18, textAlign: 'center', marginTop: 12, lineHeight: 26 },

  checkmark: { fontSize: 48, color: colors.text, marginBottom: 16 },
  successAmount: { fontSize: 48, fontWeight: '300', color: colors.text },
  successPaid: { fontSize: 16, color: colors.textMuted, marginTop: 4 },
  txInfo: { marginTop: 32, alignItems: 'center' },
  txLabel: { color: colors.textMuted, fontSize: 13 },
  txLink: { color: colors.text, fontSize: 13, marginTop: 4, textDecorationLine: 'underline' },
});

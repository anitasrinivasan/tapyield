import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator, TextInput,
  StyleSheet, SafeAreaView, Alert, Linking, KeyboardAvoidingView,
  TouchableWithoutFeedback, Keyboard, Platform, Animated, Easing,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { tapPayment, getCardName } from '../services/api';
import { colors, XRP_TO_USD } from './theme';

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

  // Pulse animation for NFC waiting state
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (state === 'nfc') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [state]);

  const handleAmountChange = (text: string) => {
    // Allow only valid decimal input
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) return; // multiple dots
    if (parts[1] && parts[1].length > 2) return; // more than 2 decimal places
    setAmount(cleaned);
  };

  const handleReadyForPayment = () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Enter an amount');
      return;
    }
    Keyboard.dismiss();
    setState('nfc');
  };

  // Called by NFC module when a customer's card is read
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

  // Expose for external NFC integration
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
    onCardRead('TAPYIELD-' + Date.now().toString(36).toUpperCase());
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
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.flex}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.content}>
              <TextInput
                style={styles.merchantInput}
                placeholder="Merchant Name"
                placeholderTextColor={colors.textLight}
                value={merchantName}
                onChangeText={setMerchantName}
                autoCapitalize="words"
                returnKeyType="next"
              />

              <View style={styles.amountSection}>
                <Text style={styles.amountLabel}>PAYMENT AMOUNT</Text>
                <TextInput
                  style={[styles.amountInput, amount ? styles.amountActive : null]}
                  keyboardType="decimal-pad"
                  value={amount}
                  onChangeText={handleAmountChange}
                  placeholder="0.00"
                  placeholderTextColor={colors.textLight}
                />
              </View>

              <View style={styles.spacer} />

              <TouchableOpacity
                style={[styles.primaryBtn, (!amount || parseFloat(amount) <= 0) && styles.btnDisabled]}
                onPress={handleReadyForPayment}
                disabled={!amount || parseFloat(amount) <= 0}
              >
                <Text style={styles.primaryBtnText}>Ready for Payment</Text>
              </TouchableOpacity>
              <View style={styles.bottomPad} />
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      )}

      {state === 'nfc' && (
        <View style={styles.centered}>
          <Text style={styles.nfcAmount}>{displayAmount}</Text>
          <Text style={styles.nfcAmountLabel}>{xrpAmount} XRP</Text>

          <TouchableOpacity onPress={simulateNfcTap} activeOpacity={0.7}>
            <Animated.View style={[styles.nfcCircle, { transform: [{ scale: pulseAnim }] }]}>
              <Text style={styles.nfcIcon}>📱</Text>
            </Animated.View>
          </TouchableOpacity>

          <Text style={styles.stateLabel}>WAITING FOR CARD</Text>
          <Text style={styles.stateDesc}>Hold customer's card near phone</Text>
          <Text style={styles.tapHint}>Tap circle to simulate</Text>

          <View style={styles.spacer} />
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setState('amount')}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <View style={styles.bottomPad} />
        </View>
      )}

      {state === 'processing' && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.textMuted} />
          <Text style={styles.stateLabel}>PROCESSING</Text>
          <Text style={styles.stateDesc}>Sending payment on XRPL...</Text>
        </View>
      )}

      {state === 'success' && (
        <View style={styles.centered}>
          <Text style={styles.checkmark}>✓</Text>
          <Text style={styles.successAmount}>{displayAmount}</Text>
          <Text style={styles.successPaid}>paid</Text>
          {customerName ? <Text style={styles.customerName}>{customerName}</Text> : null}
          <View style={styles.txInfo}>
            {txHash ? (
              <>
                <Text style={styles.txLabel}>Tx: ...{txHash.slice(-8)}</Text>
                <TouchableOpacity onPress={() => Linking.openURL(`https://testnet.xrpl.org/transactions/${txHash}`)}>
                  <Text style={styles.txLink}>View on XRPL Explorer →</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
          <View style={styles.spacer} />
          <TouchableOpacity style={styles.primaryBtn} onPress={resetPayment}>
            <Text style={styles.primaryBtnText}>+ New Payment</Text>
          </TouchableOpacity>
          <View style={styles.bottomPad} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { flex: 1, paddingTop: 20, paddingHorizontal: 24 },

  merchantInput: {
    fontSize: 16, color: colors.text, fontWeight: '500',
    marginBottom: 40, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },

  amountSection: { marginBottom: 20 },
  amountLabel: { color: colors.textMuted, fontSize: 11, letterSpacing: 1, marginBottom: 8 },
  amountInput: { fontSize: 48, fontWeight: '300', color: colors.textLight, padding: 0 },
  amountActive: { color: colors.text },

  spacer: { flex: 1 },
  bottomPad: { height: 40 },
  primaryBtn: { backgroundColor: colors.accent, borderRadius: 24, paddingVertical: 16, alignItems: 'center' },
  btnDisabled: { opacity: 0.3 },
  primaryBtnText: { color: colors.white, fontSize: 16, fontWeight: '600' },

  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },

  nfcAmount: { fontSize: 40, fontWeight: '300', color: colors.text, marginBottom: 4 },
  nfcAmountLabel: { fontSize: 14, color: colors.textMuted, marginBottom: 32 },

  nfcCircle: {
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center',
    marginBottom: 24,
  },
  nfcIcon: { fontSize: 48 },

  stateLabel: { color: colors.textMuted, fontSize: 11, letterSpacing: 1, marginTop: 8 },
  stateDesc: { color: colors.text, fontSize: 18, textAlign: 'center', marginTop: 8, lineHeight: 26 },
  tapHint: { color: colors.textLight, fontSize: 12, marginTop: 8 },

  cancelBtn: { padding: 12 },
  cancelBtnText: { color: colors.textMuted, fontSize: 16, fontWeight: '500' },

  checkmark: { fontSize: 48, color: colors.accent, marginBottom: 16 },
  successAmount: { fontSize: 48, fontWeight: '300', color: colors.text },
  successPaid: { fontSize: 16, color: colors.textMuted, marginTop: 4 },
  customerName: { fontSize: 14, color: colors.textMuted, marginTop: 8 },
  txInfo: { marginTop: 32, alignItems: 'center' },
  txLabel: { color: colors.textMuted, fontSize: 13, fontFamily: 'monospace' },
  txLink: { color: colors.text, fontSize: 14, marginTop: 8, fontWeight: '600' },
});

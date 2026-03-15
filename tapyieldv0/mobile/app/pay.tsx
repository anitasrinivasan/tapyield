import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator, TextInput,
  StyleSheet, SafeAreaView, Alert, Linking, KeyboardAvoidingView,
  TouchableWithoutFeedback, Keyboard, Platform, Animated, Easing,
} from 'react-native';
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

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (state === 'nfc') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.12, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [state]);

  const handleAmountChange = (text: string) => {
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) return;
    if (parts[1] && parts[1].length > 2) return;
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
    <SafeAreaView style={s.container}>
      {state === 'amount' && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={s.flex}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={s.content}>
              <View style={s.card}>
                <TextInput
                  style={s.merchantInput}
                  placeholder="Merchant Name"
                  placeholderTextColor={colors.textLight}
                  value={merchantName}
                  onChangeText={setMerchantName}
                  autoCapitalize="words"
                  returnKeyType="next"
                />

                <Text style={s.label}>PAYMENT AMOUNT</Text>
                <TextInput
                  style={[s.amountInput, amount ? s.amountActive : null]}
                  keyboardType="decimal-pad"
                  value={amount}
                  onChangeText={handleAmountChange}
                  placeholder="0.00"
                  placeholderTextColor={colors.textLight}
                />
              </View>

              <View style={s.spacer} />

              <TouchableOpacity
                style={[s.primaryBtn, (!amount || parseFloat(amount) <= 0) && s.btnDisabled]}
                onPress={handleReadyForPayment}
                disabled={!amount || parseFloat(amount) <= 0}
              >
                <Text style={s.primaryBtnText}>Ready for Payment</Text>
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      )}

      {state === 'nfc' && (
        <View style={s.centered}>
          <View style={s.card}>
            <Text style={s.nfcAmount}>{displayAmount}</Text>
            <Text style={s.nfcSub}>{xrpAmount} XRP</Text>
          </View>

          <TouchableOpacity onPress={simulateNfcTap} activeOpacity={0.7}>
            <Animated.View style={[s.nfcCircle, { transform: [{ scale: pulseAnim }] }]}>
              <Text style={s.nfcIcon}>📱</Text>
            </Animated.View>
          </TouchableOpacity>

          <Text style={s.stateLabel}>WAITING FOR CARD</Text>
          <Text style={s.stateDesc}>Hold customer's card near phone</Text>
          <Text style={s.tapHint}>Tap circle to simulate</Text>

          <View style={s.spacer} />
          <TouchableOpacity style={s.cancelBtn} onPress={() => setState('amount')}>
            <Text style={s.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </View>
      )}

      {state === 'processing' && (
        <View style={s.centered}>
          <ActivityIndicator size="large" color={colors.textMuted} />
          <Text style={s.stateLabel}>PROCESSING</Text>
          <Text style={s.stateDesc}>Sending payment on XRPL...</Text>
        </View>
      )}

      {state === 'success' && (
        <View style={s.centered}>
          <View style={s.card}>
            <Text style={s.successCheck}>✓</Text>
            <Text style={s.successAmount}>{displayAmount}</Text>
            <Text style={s.successSub}>paid{customerName ? ` · ${customerName}` : ''}</Text>

            {txHash ? (
              <TouchableOpacity
                style={s.explorerBtn}
                onPress={() => Linking.openURL(`https://testnet.xrpl.org/transactions/${txHash}`)}
              >
                <Text style={s.explorerText}>View on XRPL Explorer →</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={s.spacer} />

          <TouchableOpacity style={s.primaryBtn} onPress={resetPayment}>
            <Text style={s.primaryBtnText}>+ New Payment</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { flex: 1, paddingTop: 8, paddingHorizontal: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  spacer: { flex: 1 },

  card: {
    backgroundColor: colors.card, borderRadius: 16, padding: 20,
    width: '100%', alignItems: 'center',
  },

  merchantInput: {
    fontSize: 16, color: colors.text, fontWeight: '500', width: '100%',
    paddingBottom: 14, marginBottom: 20,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  label: {
    fontSize: 11, fontWeight: '600', color: colors.textMuted,
    letterSpacing: 1, marginBottom: 12, alignSelf: 'flex-start',
  },
  amountInput: {
    fontSize: 40, fontWeight: '300', color: colors.textLight,
    padding: 0, width: '100%',
  },
  amountActive: { color: colors.text },

  primaryBtn: {
    backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', width: '100%',
  },
  btnDisabled: { opacity: 0.3 },
  primaryBtnText: { color: colors.white, fontSize: 16, fontWeight: '600' },

  // NFC state
  nfcAmount: { fontSize: 32, fontWeight: '700', color: colors.text },
  nfcSub: { fontSize: 14, color: colors.textMuted, marginTop: 4 },

  nfcCircle: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center',
    marginTop: 32, marginBottom: 24,
  },
  nfcIcon: { fontSize: 40 },

  stateLabel: { fontSize: 11, fontWeight: '600', color: colors.textMuted, letterSpacing: 1, marginTop: 8 },
  stateDesc: { fontSize: 16, color: colors.text, marginTop: 8, textAlign: 'center' },
  tapHint: { fontSize: 12, color: colors.textLight, marginTop: 8 },

  cancelBtn: { padding: 12 },
  cancelText: { fontSize: 16, fontWeight: '500', color: colors.textMuted },

  // Success
  successCheck: { fontSize: 40, color: colors.accent, marginBottom: 12 },
  successAmount: { fontSize: 36, fontWeight: '700', color: colors.text },
  successSub: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
  explorerBtn: { marginTop: 20, paddingVertical: 10 },
  explorerText: { fontSize: 14, fontWeight: '600', color: colors.text },
});

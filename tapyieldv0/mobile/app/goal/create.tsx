import { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  StyleSheet, SafeAreaView, Alert, KeyboardAvoidingView,
  TouchableWithoutFeedback, Keyboard, Platform, ScrollView, Linking,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createGoal } from '../../services/api';
import { colors, XRP_TO_USD } from '../theme';

type GoalState = 'input' | 'loading' | 'success';

export default function CreateGoal() {
  const [state, setState] = useState<GoalState>('input');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [days, setDays] = useState('');
  const [resultAmount, setResultAmount] = useState('');
  const [resultName, setResultName] = useState('');
  const [resultDays, setResultDays] = useState(0);
  const [escrowTxHash, setEscrowTxHash] = useState('');

  const amountRef = useRef<TextInput>(null);

  const displayAmount = amount ? `$${amount}` : '$0.00';
  const xrpAmount = amount ? (parseFloat(amount) / XRP_TO_USD).toFixed(2) : '0';

  const handleAmountChange = (text: string) => {
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) return;
    if (parts[1] && parts[1].length > 2) return;
    setAmount(cleaned);
  };

  const handleCreate = async () => {
    if (!name.trim()) { Alert.alert('Enter a goal name'); return; }
    if (!amount || parseFloat(amount) <= 0) { Alert.alert('Enter an amount'); return; }
    if (!days || parseInt(days) <= 0) { Alert.alert('Enter days to lock'); return; }

    Keyboard.dismiss();
    setState('loading');
    try {
      const stored = await AsyncStorage.getItem('wallet');
      if (!stored) throw new Error('No wallet found');
      const wallet = JSON.parse(stored);

      const durationMinutes = parseInt(days);
      const unlockDate = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();

      const result = await createGoal(wallet.address, wallet.seed, name, xrpAmount, unlockDate);
      setEscrowTxHash(result.escrowTxHash || '');
      setResultAmount(displayAmount);
      setResultName(name);
      setResultDays(parseInt(days));
      setState('success');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || err.message);
      setState('input');
    }
  };

  return (
    <SafeAreaView style={s.container}>
      {state === 'input' && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={s.flex}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <ScrollView
              style={s.flex}
              contentContainerStyle={s.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={s.card}>
                <TextInput
                  style={s.nameInput}
                  placeholder="Goal Name"
                  placeholderTextColor={colors.textLight}
                  value={name}
                  onChangeText={setName}
                  returnKeyType="next"
                  onSubmitEditing={() => amountRef.current?.focus()}
                />

                <Text style={s.label}>GOAL AMOUNT</Text>
                <TextInput
                  ref={amountRef}
                  style={[s.amountInput, amount ? s.amountActive : null]}
                  keyboardType="decimal-pad"
                  value={amount}
                  onChangeText={handleAmountChange}
                  placeholder="0.00"
                  placeholderTextColor={colors.textLight}
                />

                <View style={s.daysRow}>
                  <Text style={s.daysText}>Lock for</Text>
                  <TextInput
                    style={s.daysInput}
                    placeholder="0"
                    placeholderTextColor={colors.textLight}
                    keyboardType="number-pad"
                    value={days}
                    onChangeText={setDays}
                    maxLength={3}
                  />
                  <Text style={s.daysText}>days</Text>
                </View>
              </View>

              <View style={s.spacer} />

              <TouchableOpacity
                style={[s.primaryBtn, (!name || !amount || !days) && s.btnDisabled]}
                onPress={handleCreate}
                disabled={!name || !amount || !days}
              >
                <Text style={s.primaryBtnText}>Create Goal</Text>
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      )}

      {state === 'loading' && (
        <View style={s.centered}>
          <ActivityIndicator size="large" color={colors.textMuted} />
          <Text style={s.stateLabel}>CREATING GOAL</Text>
          <Text style={s.stateDesc}>Locking funds on XRPL...</Text>
        </View>
      )}

      {state === 'success' && (
        <View style={s.centered}>
          <View style={s.successCard}>
            <Text style={s.successIcon}>🔒</Text>
            <Text style={s.successAmount}>{resultAmount}</Text>
            <Text style={s.successName}>{resultName}</Text>

            <View style={s.detailRow}>
              <View style={s.detail}>
                <Text style={s.detailValue}>{resultDays}d</Text>
                <Text style={s.detailLabel}>LOCK PERIOD</Text>
              </View>
              <View style={s.detail}>
                <Text style={s.detailValue}>{(parseFloat(amount || '0') / XRP_TO_USD).toFixed(2)}</Text>
                <Text style={s.detailLabel}>XRP LOCKED</Text>
              </View>
            </View>

            {escrowTxHash ? (
              <TouchableOpacity
                style={s.explorerBtn}
                onPress={() => Linking.openURL(`https://testnet.xrpl.org/transactions/${escrowTxHash}`)}
              >
                <Text style={s.explorerText}>View on XRPL Explorer →</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={s.spacer} />

          <TouchableOpacity style={s.doneBtn} onPress={() => router.back()}>
            <Text style={s.doneBtnText}>Done</Text>
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
  scrollContent: { flexGrow: 1, paddingTop: 8, paddingHorizontal: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  spacer: { flex: 1, minHeight: 32 },

  card: { backgroundColor: colors.card, borderRadius: 16, padding: 20 },

  nameInput: {
    fontSize: 18, color: colors.text, width: '100%',
    paddingBottom: 14, marginBottom: 24,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  label: {
    fontSize: 11, fontWeight: '600', color: colors.textMuted,
    letterSpacing: 1, marginBottom: 12,
  },
  amountInput: { fontSize: 40, fontWeight: '300', color: colors.textLight, padding: 0, marginBottom: 24 },
  amountActive: { color: colors.text },

  daysRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  daysText: { color: colors.textMuted, fontSize: 14 },
  daysInput: {
    fontSize: 16, fontWeight: '600', color: colors.text,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
    paddingBottom: 4, width: 44, textAlign: 'center',
  },

  primaryBtn: {
    backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.3 },
  primaryBtnText: { color: colors.white, fontSize: 16, fontWeight: '600' },

  stateLabel: { fontSize: 11, fontWeight: '600', color: colors.textMuted, letterSpacing: 1, marginTop: 24 },
  stateDesc: { fontSize: 16, color: colors.text, marginTop: 8 },

  // Success
  successCard: {
    backgroundColor: colors.card, borderRadius: 16, padding: 24,
    width: '100%', alignItems: 'center',
  },
  successIcon: { fontSize: 40, marginBottom: 12 },
  successAmount: { fontSize: 40, fontWeight: '700', color: colors.text },
  successName: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
  detailRow: { flexDirection: 'row', gap: 40, marginTop: 24 },
  detail: { alignItems: 'center' },
  detailValue: { fontSize: 18, fontWeight: '600', color: colors.text },
  detailLabel: { fontSize: 10, color: colors.textMuted, letterSpacing: 0.5, marginTop: 4 },
  explorerBtn: { marginTop: 20, paddingVertical: 10 },
  explorerText: { fontSize: 14, fontWeight: '600', color: colors.text },

  doneBtn: {
    backgroundColor: colors.card, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', width: '100%',
  },
  doneBtnText: { color: colors.text, fontSize: 16, fontWeight: '600' },
});

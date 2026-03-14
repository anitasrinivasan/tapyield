import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  StyleSheet, SafeAreaView, Alert,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createGoal } from '../../services/api';
import { colors, XRP_TO_USD } from '../theme';
import NumberPad from '../../components/NumberPad';

type GoalState = 'input' | 'loading' | 'success';

export default function CreateGoal() {
  const [state, setState] = useState<GoalState>('input');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [days, setDays] = useState('');
  const [resultAmount, setResultAmount] = useState('');
  const [resultName, setResultName] = useState('');
  const [resultDays, setResultDays] = useState(0);

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

  const handleCreate = async () => {
    if (!name.trim()) { Alert.alert('Enter a goal name'); return; }
    if (!amount || parseFloat(amount) <= 0) { Alert.alert('Enter an amount'); return; }
    if (!days || parseInt(days) <= 0) { Alert.alert('Enter days to lock'); return; }

    setState('loading');
    try {
      const stored = await AsyncStorage.getItem('wallet');
      if (!stored) throw new Error('No wallet found');
      const wallet = JSON.parse(stored);

      // Convert days to minutes for demo (1 day = 1 minute for hackathon)
      const durationMinutes = parseInt(days);
      const unlockDate = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();

      await createGoal(wallet.address, wallet.seed, name, xrpAmount, unlockDate);
      setResultAmount(displayAmount);
      setResultName(name.toUpperCase());
      setResultDays(parseInt(days));
      setState('success');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || err.message);
      setState('input');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {state === 'input' && (
        <View style={styles.content}>
          <View style={styles.nameRow}>
            <Text style={styles.nameIcon}>🎯</Text>
            <TextInput
              style={styles.nameInput}
              placeholder="Goal Name"
              placeholderTextColor={colors.textLight}
              value={name}
              onChangeText={setName}
            />
          </View>

          <View style={styles.amountSection}>
            <Text style={styles.label}>GOAL AMOUNT</Text>
            <Text style={[styles.amountDisplay, amount ? styles.amountActive : null]}>
              {displayAmount}
            </Text>
          </View>

          <NumberPad onPress={handleNumberPad} />

          <View style={styles.daysRow}>
            <Text style={styles.daysText}>Goal unlocks in</Text>
            <TextInput
              style={styles.daysInput}
              placeholder="0"
              placeholderTextColor={colors.textLight}
              keyboardType="number-pad"
              value={days}
              onChangeText={setDays}
              maxLength={3}
            />
            <Text style={styles.daysText}>days</Text>
          </View>

          <View style={styles.bottomAction}>
            <TouchableOpacity
              style={[styles.primaryBtn, (!name || !amount || !days) && styles.btnDisabled]}
              onPress={handleCreate}
              disabled={!name || !amount || !days}
            >
              <Text style={styles.primaryBtnText}>Create Goal</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {state === 'loading' && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.textMuted} />
          <Text style={styles.stateLabel}>LOADING</Text>
          <Text style={styles.stateDesc}>Creating goal...</Text>
        </View>
      )}

      {state === 'success' && (
        <View style={styles.centered}>
          <Text style={styles.lockIcon}>🔒</Text>
          <Text style={styles.successAmount}>{resultAmount}</Text>
          <Text style={styles.successName}>🎯  {resultName}</Text>

          <View style={styles.successDetails}>
            <View style={styles.detailRow}>
              <Text style={styles.detailValue}>$0.0000000</Text>
              <Text style={styles.detailLabel}>YIELD</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailValue}>{resultDays} d</Text>
              <Text style={styles.detailLabel}>UNTIL UNLOCK</Text>
            </View>
          </View>

          <View style={styles.progressBar}>
            <View style={styles.progressFill} />
          </View>

          <View style={styles.bottomAction}>
            <TouchableOpacity style={styles.doneBtn} onPress={() => router.back()}>
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, paddingTop: 12 },

  nameRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, marginBottom: 24, gap: 8 },
  nameIcon: { fontSize: 20 },
  nameInput: { flex: 1, fontSize: 18, color: colors.text, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 8 },

  amountSection: { paddingHorizontal: 24, marginBottom: 24 },
  label: { color: colors.textMuted, fontSize: 11, letterSpacing: 1, marginBottom: 8 },
  amountDisplay: { fontSize: 48, fontWeight: '300', color: colors.textLight },
  amountActive: { color: colors.text },

  daysRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, gap: 8, marginTop: 16 },
  daysText: { color: colors.textMuted, fontSize: 14 },
  daysInput: {
    fontSize: 16, fontWeight: '600', color: colors.text, borderBottomWidth: 1,
    borderBottomColor: colors.border, paddingBottom: 4, width: 40, textAlign: 'center',
  },

  bottomAction: { position: 'absolute', bottom: 40, left: 24, right: 24 },
  primaryBtn: { backgroundColor: colors.accent, borderRadius: 24, paddingVertical: 16, alignItems: 'center' },
  btnDisabled: { opacity: 0.3 },
  primaryBtnText: { color: colors.white, fontSize: 16, fontWeight: '600' },

  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  stateLabel: { color: colors.textMuted, fontSize: 11, letterSpacing: 1, marginTop: 24 },
  stateDesc: { color: colors.text, fontSize: 18, marginTop: 12 },

  lockIcon: { fontSize: 48, marginBottom: 16 },
  successAmount: { fontSize: 56, fontWeight: '700', color: colors.text },
  successName: { fontSize: 14, color: colors.textMuted, letterSpacing: 1, marginTop: 8 },

  successDetails: { flexDirection: 'row', gap: 40, marginTop: 32 },
  detailRow: { alignItems: 'center' },
  detailValue: { fontSize: 16, fontWeight: '600', color: colors.text },
  detailLabel: { fontSize: 10, color: colors.textMuted, letterSpacing: 0.5, marginTop: 4 },

  progressBar: { width: '80%', height: 4, backgroundColor: colors.border, borderRadius: 2, marginTop: 24 },
  progressFill: { width: '2%', height: 4, backgroundColor: colors.accent, borderRadius: 2 },

  doneBtn: { backgroundColor: colors.card, borderRadius: 24, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  doneBtnText: { color: colors.text, fontSize: 16, fontWeight: '600' },
});

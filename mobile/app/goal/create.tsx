import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  StyleSheet, SafeAreaView, Alert, ScrollView, Linking,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createGoal } from '../../services/api';

const XRP_TO_USD = 2.50;

const DURATION_OPTIONS = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: '180 days', days: 180 },
  { label: '265 days', days: 265 },
  { label: '1 year', days: 365 },
];

// For demo: also offer minute-based options
const DEMO_OPTIONS = [
  { label: '2 min', days: 0, minutes: 2 },
  { label: '5 min', days: 0, minutes: 5 },
];

export default function CreateGoal() {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedDays, setSelectedDays] = useState(30);
  const [selectedMinutes, setSelectedMinutes] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const usdEquiv = amount ? `$${(parseFloat(amount) * XRP_TO_USD).toFixed(2)}` : '';
  const durationLabel = selectedMinutes != null
    ? `${selectedMinutes} min${selectedMinutes !== 1 ? 's' : ''}`
    : `${selectedDays} days`;

  const handleCreate = async () => {
    if (!name.trim()) { Alert.alert('Error', 'Enter a goal name'); return; }
    if (!amount || parseFloat(amount) <= 0) { Alert.alert('Error', 'Enter a valid amount'); return; }

    setLoading(true);
    try {
      const stored = await AsyncStorage.getItem('wallet');
      if (!stored) throw new Error('No wallet found');
      const wallet = JSON.parse(stored);

      const ms = selectedMinutes != null
        ? selectedMinutes * 60 * 1000
        : selectedDays * 24 * 60 * 60 * 1000;
      const unlockDate = new Date(Date.now() + ms).toISOString();

      const result = await createGoal(wallet.address, wallet.seed, name.trim(), amount, unlockDate);
      const usdAmt = (parseFloat(amount) * XRP_TO_USD).toFixed(2);
      Alert.alert(
        'Goal Created!',
        `$${usdAmt} locked for ${durationLabel}.\n\nYour funds keep earning yield while locked.`,
        [
          { text: 'View on XRPL', onPress: () => Linking.openURL(`https://testnet.xrpl.org/transactions/${result.escrowTxHash}`) },
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
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back button */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backArrow}>‹</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>Create goal</Text>

        {/* Amount display */}
        <View style={styles.amountSection}>
          <Text style={styles.amountLabel}>GOAL AMOUNT</Text>
          <TextInput
            style={styles.amountInput}
            placeholder="$0.00"
            placeholderTextColor="#BBBBBB"
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
          />
          {usdEquiv && amount ? (
            <Text style={styles.amountSub}>≈ {usdEquiv} USD · {amount} XRP</Text>
          ) : null}
        </View>

        {/* Goal Name */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>GOAL NAME</Text>
          <TextInput
            style={styles.fieldInput}
            placeholder="e.g. School Fees, Emergency Fund…"
            placeholderTextColor="#BBBBBB"
            value={name}
            onChangeText={setName}
          />
        </View>

        {/* Duration */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>LOCK DURATION</Text>
          <View style={styles.durationGrid}>
            {DURATION_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.days}
                style={[styles.durationChip, selectedDays === opt.days && selectedMinutes == null && styles.durationChipActive]}
                onPress={() => { setSelectedDays(opt.days); setSelectedMinutes(null); }}
              >
                <Text style={[styles.durationChipText, selectedDays === opt.days && selectedMinutes == null && styles.durationChipTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.demoLabel}>Demo mode</Text>
          <View style={styles.durationRow}>
            {DEMO_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.minutes}
                style={[styles.durationChip, selectedMinutes === opt.minutes && styles.durationChipActive]}
                onPress={() => setSelectedMinutes(opt.minutes)}
              >
                <Text style={[styles.durationChipText, selectedMinutes === opt.minutes && styles.durationChipTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.lockNote}>
          <Text style={styles.lockNoteText}>
            Goal unlocks in {durationLabel} · funds earn yield while locked
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.createBtn, loading && styles.createBtnDisabled]}
          onPress={handleCreate}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.createBtnText}>Create Goal</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EBEBEB' },
  scroll: { flex: 1 },
  content: { paddingBottom: 48 },

  topBar: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#111111', justifyContent: 'center', alignItems: 'center',
  },
  backArrow: { color: '#FFFFFF', fontSize: 24, fontWeight: '300', marginTop: -2, marginLeft: -2 },

  title: {
    fontSize: 28, fontWeight: '800', color: '#111111',
    paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24,
  },

  amountSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    marginHorizontal: 16,
    padding: 24,
    marginBottom: 12,
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: 13, fontWeight: '700', color: '#999999', letterSpacing: 1, marginBottom: 12,
  },
  amountInput: {
    fontSize: 48, fontWeight: '700', color: '#111111', textAlign: 'center',
    minWidth: 200,
  },
  amountSub: { fontSize: 14, color: '#888888', marginTop: 8 },

  field: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    marginHorizontal: 16,
    padding: 24,
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12, fontWeight: '700', color: '#999999', letterSpacing: 1, marginBottom: 12,
  },
  fieldInput: {
    fontSize: 17, color: '#111111',
    borderBottomWidth: 1, borderBottomColor: '#EEEEEE',
    paddingBottom: 8,
  },

  durationGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
  },
  durationRow: {
    flexDirection: 'row', gap: 10, marginTop: 4,
  },
  durationChip: {
    backgroundColor: '#F0F0F0',
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10,
    borderWidth: 2, borderColor: 'transparent',
  },
  durationChipActive: {
    borderColor: '#111111', backgroundColor: '#F0F0F0',
  },
  durationChipText: { fontSize: 14, color: '#666666', fontWeight: '600' },
  durationChipTextActive: { color: '#111111' },
  demoLabel: { fontSize: 11, color: '#BBBBBB', marginTop: 16, marginBottom: 8, letterSpacing: 0.5 },

  lockNote: {
    marginHorizontal: 16,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 24,
  },
  lockNoteText: { fontSize: 13, color: '#888888', textAlign: 'center' },

  createBtn: {
    marginHorizontal: 16,
    backgroundColor: '#111111',
    borderRadius: 40,
    paddingVertical: 18,
    alignItems: 'center',
  },
  createBtnDisabled: { opacity: 0.6 },
  createBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
});

import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ActivityIndicator,
  TouchableOpacity, Linking,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getWalletStatus, Goal, Transaction } from '../../services/api';
import { colors, usd } from '../theme';

export default function GoalDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [goal, setGoal] = useState<Goal | null>(null);
  const [escrowTx, setEscrowTx] = useState<Transaction | null>(null);

  const loadGoal = useCallback(async () => {
    const stored = await AsyncStorage.getItem('wallet');
    if (!stored) return;
    const wallet = JSON.parse(stored);
    const status = await getWalletStatus(wallet.address);
    const found = status.goals.find((g) => g.id === id);
    if (found) {
      setGoal(found);
      const escrow = status.transactions.find(
        (tx) => tx.type === 'escrow_create' && Math.abs(new Date(tx.timestamp).getTime() - new Date(found.createdAt).getTime()) < 60000
      );
      if (escrow) setEscrowTx(escrow);
    }
  }, [id]);

  useEffect(() => { loadGoal(); }, [loadGoal]);

  if (!goal) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.centered}>
          <ActivityIndicator size="large" color={colors.textMuted} />
        </View>
      </SafeAreaView>
    );
  }

  const daysLeft = Math.max(0, Math.ceil(
    (new Date(goal.finishAfter).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  ));
  const totalDays = Math.max(1, Math.ceil(
    (new Date(goal.finishAfter).getTime() - new Date(goal.createdAt).getTime()) / (1000 * 60 * 60 * 24)
  ));
  const progress = Math.min(1, Math.max(0, (totalDays - daysLeft) / totalDays));

  return (
    <SafeAreaView style={s.container}>
      <View style={s.content}>
        {/* Goal Info Card */}
        <View style={s.card}>
          <Text style={s.goalName}>{goal.name}</Text>
          <Text style={s.goalAmount}>{usd(goal.targetAmount)}</Text>

          <View style={s.lockBadge}>
            <Text style={s.lockIcon}>🔒</Text>
            <Text style={s.lockText}>{daysLeft} days left of {totalDays}</Text>
          </View>

          <View style={s.progressBar}>
            <View style={[s.progressFill, { width: `${progress * 100}%` }]} />
          </View>
        </View>

        {/* Activity Card */}
        <View style={s.card}>
          <Text style={s.label}>ESCROW TRANSACTION</Text>
          <TouchableOpacity
            style={s.txRow}
            onPress={() => escrowTx?.txHash && Linking.openURL(`https://testnet.xrpl.org/transactions/${escrowTx.txHash}`)}
            activeOpacity={escrowTx?.txHash ? 0.7 : 1}
          >
            <View>
              <Text style={s.txDate}>
                {new Date(goal.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </Text>
              <Text style={s.txAmount}>{usd(goal.targetAmount)} locked</Text>
            </View>
            {escrowTx?.txHash && <Text style={s.txArrow}>XRPL →</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },

  card: {
    backgroundColor: colors.card, borderRadius: 16, padding: 20,
    marginBottom: 12, alignItems: 'center',
  },
  label: {
    fontSize: 11, fontWeight: '600', color: colors.textMuted,
    letterSpacing: 1, marginBottom: 12, alignSelf: 'flex-start',
  },

  goalName: { fontSize: 16, color: colors.text, fontWeight: '500', marginBottom: 4 },
  goalAmount: { fontSize: 40, fontWeight: '700', color: colors.text, marginBottom: 16 },

  lockBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.background, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  lockIcon: { fontSize: 12 },
  lockText: { color: colors.textMuted, fontSize: 13, fontWeight: '500' },

  progressBar: {
    width: '100%', height: 4, backgroundColor: colors.background,
    borderRadius: 2, marginTop: 20,
  },
  progressFill: { height: 4, backgroundColor: colors.accent, borderRadius: 2 },

  txRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    width: '100%',
  },
  txDate: { color: colors.textMuted, fontSize: 12, marginBottom: 4 },
  txAmount: { color: colors.text, fontSize: 18, fontWeight: '600' },
  txArrow: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
});

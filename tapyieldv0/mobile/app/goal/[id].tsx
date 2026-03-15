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
      // Find the matching escrow_create transaction (closest timestamp to goal creation)
      const escrow = status.transactions.find(
        (tx) => tx.type === 'escrow_create' && Math.abs(new Date(tx.timestamp).getTime() - new Date(found.createdAt).getTime()) < 60000
      );
      if (escrow) setEscrowTx(escrow);
    }
  }, [id]);

  useEffect(() => { loadGoal(); }, [loadGoal]);

  if (!goal) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
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
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.goalName}>{goal.name}</Text>
        <Text style={styles.goalAmount}>{usd(goal.targetAmount)}</Text>

        <View style={styles.lockBadge}>
          <Text style={styles.lockIcon}>🔒</Text>
          <Text style={styles.lockText}>{daysLeft} days left of {totalDays}</Text>
        </View>

        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>

        <Text style={styles.sectionLabel}>RECENT ACTIVITY</Text>
        <TouchableOpacity
          style={styles.activityRow}
          onPress={() => escrowTx?.txHash && Linking.openURL(`https://testnet.xrpl.org/transactions/${escrowTx.txHash}`)}
          activeOpacity={escrowTx?.txHash ? 0.7 : 1}
        >
          <Text style={styles.activityDate}>
            {new Date(goal.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()}
          </Text>
          <Text style={styles.activityAmount}>{usd(goal.targetAmount)}</Text>
          {escrowTx?.txHash && <Text style={styles.explorerHint}>View on XRPL Explorer →</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1, padding: 24, alignItems: 'center', paddingTop: 40 },

  goalName: { fontSize: 18, color: colors.text, fontWeight: '600', marginBottom: 8 },
  goalAmount: { fontSize: 48, fontWeight: '700', color: colors.text, marginBottom: 24 },

  lockBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.card, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8,
    borderWidth: 1, borderColor: colors.border,
  },
  lockIcon: { fontSize: 14 },
  lockText: { color: colors.textMuted, fontSize: 13, fontWeight: '500' },

  progressBar: { width: '80%', height: 4, backgroundColor: colors.border, borderRadius: 2, marginTop: 24, marginBottom: 40 },
  progressFill: { height: 4, backgroundColor: colors.accent, borderRadius: 2 },

  sectionLabel: { color: colors.textMuted, fontSize: 11, letterSpacing: 1, marginBottom: 12, alignSelf: 'flex-start' },
  activityRow: {
    backgroundColor: colors.card, borderRadius: 12, padding: 16, width: '100%',
    borderWidth: 1, borderColor: colors.border,
  },
  activityDate: { color: colors.textMuted, fontSize: 10, letterSpacing: 0.5, marginBottom: 4 },
  activityAmount: { color: colors.text, fontSize: 20, fontWeight: '600' },
  explorerHint: { color: colors.textMuted, fontSize: 10, marginTop: 8 },
});

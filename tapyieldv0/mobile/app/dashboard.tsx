import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, RefreshControl,
  StyleSheet, SafeAreaView, Alert, Linking,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getWalletStatus, releaseGoal, WalletStatusResponse, Goal, Transaction } from '../services/api';
import { colors, XRP_TO_USD, usd } from './theme';

export default function Dashboard() {
  const [wallet, setWallet] = useState<{ address: string; seed: string } | null>(null);
  const [status, setStatus] = useState<WalletStatusResponse | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [releasing, setReleasing] = useState<string | null>(null);
  const [showTechView, setShowTechView] = useState(false);

  const loadWallet = async () => {
    const stored = await AsyncStorage.getItem('wallet');
    if (stored) setWallet(JSON.parse(stored));
  };

  const fetchStatus = useCallback(async () => {
    if (!wallet) return;
    try {
      const data = await getWalletStatus(wallet.address);
      setStatus(data);
    } catch (err) {
      console.error('Status fetch error:', err);
    }
  }, [wallet]);

  useEffect(() => { loadWallet(); }, []);
  useEffect(() => {
    if (!wallet) return;
    fetchStatus();
    const interval = setInterval(fetchStatus, 8000);
    return () => clearInterval(interval);
  }, [wallet, fetchStatus]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStatus();
    setRefreshing(false);
  };

  const handleRelease = async (goal: Goal) => {
    if (!wallet) return;
    setReleasing(goal.id);
    try {
      await releaseGoal(wallet.address, wallet.seed, goal.id);
      await fetchStatus();
      Alert.alert('Goal Released!', `${usd(goal.targetAmount)} unlocked`);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || err.message);
    } finally {
      setReleasing(null);
    }
  };

  const isGoalReady = (goal: Goal) =>
    goal.status === 'locked' && new Date() >= new Date(goal.finishAfter);

  const daysLeft = (goal: Goal) => {
    const diff = new Date(goal.finishAfter).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  if (!status) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const spendingBalance = parseFloat(status.spendingBalance);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textMuted} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Tap Yield</Text>
          <View style={styles.headerIcon} />
        </View>

        {/* Card */}
        <TouchableOpacity
          style={styles.card}
          onLongPress={() => setShowTechView(!showTechView)}
          activeOpacity={0.9}
        >
          <Text style={styles.cardLabel}>YOUR CARD</Text>
          <Text style={styles.cardBalance}>{usd(spendingBalance)}</Text>
        </TouchableOpacity>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/deposit')}>
            <Text style={styles.actionLabel}>Deposit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/pay')}>
            <Text style={styles.actionLabel}>Receive</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/register-card')}>
            <Text style={styles.actionLabel}>Card</Text>
          </TouchableOpacity>
        </View>

        {/* Locked Funds */}
        <Text style={styles.sectionLabel}>YOUR LOCKED FUNDS</Text>
        {status.goals.filter(g => g.status === 'locked').map((goal) => (
          <TouchableOpacity
            key={goal.id}
            style={styles.goalRow}
            onPress={() => router.push({ pathname: '/goal/[id]', params: { id: goal.id } })}
          >
            <View>
              <Text style={styles.goalName}>{goal.name}</Text>
              <Text style={styles.goalAmount}>{usd(goal.targetAmount)}</Text>
            </View>
            <View style={styles.goalRight}>
              {isGoalReady(goal) ? (
                <TouchableOpacity
                  style={styles.releaseBtn}
                  onPress={() => handleRelease(goal)}
                  disabled={releasing === goal.id}
                >
                  <Text style={styles.releaseBtnText}>
                    {releasing === goal.id ? 'Releasing...' : 'Release'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.goalDays}>{daysLeft(goal)} days left</Text>
              )}
            </View>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={styles.createGoalBtn}
          onPress={() => router.push('/goal/create')}
        >
          <Text style={styles.createGoalText}>+ Create goal</Text>
        </TouchableOpacity>

        {/* Recent Activity */}
        {(status.transactions?.length > 0 || status.goals.length > 0) && (
          <>
            <TouchableOpacity onPress={() => router.push('/activity')}>
              <Text style={styles.sectionLabel}>RECENT ACTIVITY  ›</Text>
            </TouchableOpacity>
            {status.transactions?.slice(0, 5).map((tx, i) => (
              <View key={tx.txHash || i} style={styles.activityRow}>
                <Text style={styles.activityDate}>
                  {new Date(tx.timestamp).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()}
                  {tx.merchantName ? ` · ${tx.merchantName.toUpperCase()}` : ''}
                </Text>
                <Text style={styles.activityAmount}>
                  {tx.type === 'payment' ? '-' : '+'}{usd(tx.amount)}
                </Text>
              </View>
            ))}
            {(!status.transactions || status.transactions.length === 0) && status.goals.slice(0, 5).map((goal) => (
              <View key={goal.id} style={styles.activityRow}>
                <Text style={styles.activityDate}>
                  {new Date(goal.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()}
                </Text>
                <Text style={styles.activityAmount}>{usd(goal.targetAmount)}</Text>
              </View>
            ))}
          </>
        )}

        {/* Under the Hood (long press card to toggle) */}
        {showTechView && (
          <View style={styles.techCard}>
            <Text style={styles.techTitle}>UNDER THE HOOD</Text>
            <View style={styles.techRow}>
              <Text style={styles.techLabel}>Wallet</Text>
              <Text style={styles.techValue}>{wallet?.address}</Text>
            </View>
            <View style={styles.techRow}>
              <Text style={styles.techLabel}>XRP Balance</Text>
              <Text style={styles.techValue}>{status.xrpBalance} XRP</Text>
            </View>
            <View style={styles.techRow}>
              <Text style={styles.techLabel}>LP Tokens</Text>
              <Text style={styles.techValue}>{status.ammPosition.lpTokenBalance.toFixed(4)}</Text>
            </View>
            <View style={styles.techRow}>
              <Text style={styles.techLabel}>AMM Position</Text>
              <Text style={styles.techValue}>{status.ammPosition.xrpValue} XRP</Text>
            </View>
            <View style={styles.techRow}>
              <Text style={styles.techLabel}>Yield</Text>
              <Text style={styles.techValue}>+{status.totalYieldEarned} XRP ({status.yieldPercentage}%)</Text>
            </View>
            <TouchableOpacity
              style={styles.explorerBtn}
              onPress={() => Linking.openURL(`https://testnet.xrpl.org/accounts/${wallet?.address}`)}
            >
              <Text style={styles.explorerBtnText}>View on XRPL Explorer</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1, padding: 20 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: colors.textMuted, fontSize: 16 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  headerTitle: { fontSize: 28, fontWeight: '700', color: colors.text },
  headerIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.accent },

  card: {
    backgroundColor: colors.cardDark, borderRadius: 16, padding: 24,
    marginBottom: 20, minHeight: 120, justifyContent: 'flex-end',
  },
  cardLabel: { color: '#AAAAAA', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  cardBalance: { color: colors.white, fontSize: 32, fontWeight: '700' },

  actions: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  actionBtn: {
    flex: 1, backgroundColor: colors.card, borderRadius: 10, paddingVertical: 12,
    alignItems: 'center', borderWidth: 1, borderColor: colors.border,
  },
  actionLabel: { color: colors.text, fontSize: 13, fontWeight: '600' },

  sectionLabel: { color: colors.textMuted, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12, marginTop: 8 },

  goalRow: {
    backgroundColor: colors.card, borderRadius: 12, padding: 16, marginBottom: 8,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  goalName: { color: colors.textMuted, fontSize: 13, marginBottom: 4 },
  goalAmount: { color: colors.text, fontSize: 22, fontWeight: '700' },
  goalRight: { alignItems: 'flex-end' },
  goalDays: { color: colors.textMuted, fontSize: 13 },
  releaseBtn: { backgroundColor: colors.accent, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  releaseBtnText: { color: colors.white, fontSize: 13, fontWeight: '600' },

  createGoalBtn: {
    borderRadius: 12, paddingVertical: 14, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border, marginBottom: 28,
  },
  createGoalText: { color: colors.textMuted, fontSize: 14, fontWeight: '500' },

  activityRow: {
    backgroundColor: colors.card, borderRadius: 12, padding: 16, marginBottom: 8,
    borderWidth: 1, borderColor: colors.border,
  },
  activityDate: { color: colors.textMuted, fontSize: 10, letterSpacing: 0.5, marginBottom: 4 },
  activityAmount: { color: colors.text, fontSize: 20, fontWeight: '600' },

  techCard: {
    backgroundColor: colors.card, borderRadius: 12, padding: 16, marginTop: 16,
    borderWidth: 1, borderColor: colors.border,
  },
  techTitle: { color: colors.textMuted, fontSize: 11, letterSpacing: 1, marginBottom: 12 },
  techRow: { marginBottom: 8 },
  techLabel: { color: colors.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  techValue: { color: colors.text, fontSize: 13, fontFamily: 'monospace', marginTop: 2 },
  explorerBtn: { backgroundColor: colors.accent, borderRadius: 8, padding: 10, marginTop: 8, alignItems: 'center' },
  explorerBtnText: { color: colors.white, fontSize: 13, fontWeight: '600' },
});

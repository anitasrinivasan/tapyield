import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, RefreshControl,
  StyleSheet, SafeAreaView, Alert, Linking,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getWalletStatus, releaseGoal, WalletStatusResponse, Goal } from '../services/api';
import { colors, XRP_TO_USD, usd } from './theme';

export default function Dashboard() {
  const [wallet, setWallet] = useState<{ address: string; seed: string } | null>(null);
  const [status, setStatus] = useState<WalletStatusResponse | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [releasing, setReleasing] = useState<string | null>(null);
  const [showTech, setShowTech] = useState(false);

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
      <SafeAreaView style={s.container}>
        <View style={s.centered}>
          <Text style={s.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const spendingBalance = parseFloat(status.spendingBalance);
  const lockedGoals = status.goals.filter(g => g.status === 'locked');
  const recentTxs = status.transactions.slice(-3).reverse();

  return (
    <SafeAreaView style={s.container}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textMuted} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={s.header}>
          <Text style={s.logo}>TapYield</Text>
        </View>

        {/* Balance Card */}
        <TouchableOpacity
          style={s.card}
          onLongPress={() => setShowTech(!showTech)}
          activeOpacity={0.9}
        >
          <Text style={s.cardLabel}>SPENDING BALANCE</Text>
          <Text style={s.balanceAmount}>{usd(spendingBalance)}</Text>
          <Text style={s.balanceSub}>{spendingBalance.toFixed(2)} XRP</Text>

          <View style={s.actionRow}>
            <TouchableOpacity style={s.actionBtn} onPress={() => router.push('/deposit')}>
              <Text style={s.actionBtnText}>Deposit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.actionBtn} onPress={() => router.push('/pay')}>
              <Text style={s.actionBtnText}>Pay</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>

        {/* Tech View (hidden) */}
        {showTech && (
          <View style={s.card}>
            <Text style={s.cardLabel}>UNDER THE HOOD</Text>
            <View style={s.techRow}>
              <Text style={s.techLabel}>Wallet</Text>
              <Text style={s.techValue}>{wallet?.address}</Text>
            </View>
            <View style={s.techRow}>
              <Text style={s.techLabel}>XRP Balance</Text>
              <Text style={s.techValue}>{status.xrpBalance} XRP</Text>
            </View>
            <View style={s.techRow}>
              <Text style={s.techLabel}>LP Tokens</Text>
              <Text style={s.techValue}>{status.ammPosition.lpTokenBalance.toFixed(4)}</Text>
            </View>
            <View style={s.techRow}>
              <Text style={s.techLabel}>AMM Position</Text>
              <Text style={s.techValue}>{status.ammPosition.xrpValue} XRP</Text>
            </View>
            <View style={s.techRow}>
              <Text style={s.techLabel}>Yield</Text>
              <Text style={s.techValue}>+{status.totalYieldEarned} XRP ({status.yieldPercentage}%)</Text>
            </View>
            <TouchableOpacity
              style={s.techExplorerBtn}
              onPress={() => Linking.openURL(`https://testnet.xrpl.org/accounts/${wallet?.address}`)}
            >
              <Text style={s.techExplorerText}>View on XRPL Explorer →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Goals Card */}
        <View style={s.card}>
          <Text style={s.cardLabel}>SAVINGS GOALS</Text>

          {lockedGoals.length === 0 && (
            <Text style={s.emptyText}>No active goals</Text>
          )}

          {lockedGoals.map((goal) => (
            <TouchableOpacity
              key={goal.id}
              style={s.goalRow}
              onPress={() => router.push({ pathname: '/goal/[id]', params: { id: goal.id } })}
              activeOpacity={0.7}
            >
              <View style={s.goalInfo}>
                <Text style={s.goalName}>{goal.name}</Text>
                <Text style={s.goalAmount}>{usd(goal.targetAmount)}</Text>
              </View>
              <View style={s.goalRight}>
                {isGoalReady(goal) ? (
                  <TouchableOpacity
                    style={s.releaseBtn}
                    onPress={() => handleRelease(goal)}
                    disabled={releasing === goal.id}
                  >
                    <Text style={s.releaseBtnText}>
                      {releasing === goal.id ? '...' : 'Release'}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={s.goalDays}>{daysLeft(goal)}d left</Text>
                )}
              </View>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={s.newGoalBtn}
            onPress={() => router.push('/goal/create')}
          >
            <Text style={s.newGoalText}>+ New Goal</Text>
          </TouchableOpacity>
        </View>

        {/* Activity Card */}
        <View style={s.card}>
          <Text style={s.cardLabel}>RECENT ACTIVITY</Text>

          {recentTxs.length === 0 && (
            <Text style={s.emptyText}>No transactions yet</Text>
          )}

          {recentTxs.map((tx, i) => (
            <TouchableOpacity
              key={tx.txHash || i}
              style={s.txRow}
              onPress={() => tx.txHash && Linking.openURL(`https://testnet.xrpl.org/transactions/${tx.txHash}`)}
              activeOpacity={tx.txHash ? 0.7 : 1}
            >
              <View>
                <Text style={s.txType}>
                  {tx.type === 'payment' ? 'Payment' :
                   tx.type === 'deposit' ? 'Deposit' :
                   tx.type === 'withdraw' ? 'Withdrawal' :
                   tx.type === 'escrow_create' ? 'Goal Created' :
                   tx.type === 'escrow_finish' ? 'Goal Released' : tx.type}
                  {tx.merchantName ? ` · ${tx.merchantName}` : ''}
                </Text>
                <Text style={s.txDate}>
                  {new Date(tx.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Text>
              </View>
              <Text style={[s.txAmount, (tx.type === 'payment' || tx.type === 'escrow_create') && s.txNegative]}>
                {tx.type === 'payment' || tx.type === 'escrow_create' ? '-' : '+'}{usd(tx.amount)}
              </Text>
            </TouchableOpacity>
          ))}

          {status.transactions.length > 0 && (
            <TouchableOpacity style={s.viewAllBtn} onPress={() => router.push('/activity')}>
              <Text style={s.viewAllText}>View All →</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* NFC Card */}
        <TouchableOpacity style={s.card} onPress={() => router.push('/register-card')} activeOpacity={0.7}>
          <View style={s.nfcRow}>
            <View>
              <Text style={s.cardLabel}>NFC CARD</Text>
              <Text style={s.nfcDesc}>Tap-to-pay setup</Text>
            </View>
            <Text style={s.nfcArrow}>→</Text>
          </View>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: colors.textMuted, fontSize: 16 },

  // Header
  header: { paddingTop: 16, paddingBottom: 24, paddingHorizontal: 4 },
  logo: { fontSize: 28, fontWeight: '700', color: colors.text },

  // Cards
  card: {
    backgroundColor: colors.card, borderRadius: 16, padding: 20,
    marginBottom: 12,
  },
  cardLabel: {
    fontSize: 11, fontWeight: '600', color: colors.textMuted,
    letterSpacing: 1, marginBottom: 12,
  },

  // Balance
  balanceAmount: { fontSize: 36, fontWeight: '700', color: colors.text, marginBottom: 2 },
  balanceSub: { fontSize: 14, color: colors.textMuted, marginBottom: 20 },

  // Action buttons
  actionRow: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flex: 1, backgroundColor: colors.background, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  actionBtnText: { fontSize: 15, fontWeight: '600', color: colors.text },

  // Tech view
  techRow: { marginBottom: 10 },
  techLabel: { fontSize: 10, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  techValue: { fontSize: 13, color: colors.text, fontFamily: 'monospace', marginTop: 2 },
  techExplorerBtn: { marginTop: 8, paddingVertical: 10, alignItems: 'center', backgroundColor: colors.accent, borderRadius: 10 },
  techExplorerText: { color: colors.white, fontSize: 13, fontWeight: '600' },

  // Goals
  emptyText: { color: colors.textMuted, fontSize: 14, marginBottom: 12 },
  goalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  goalInfo: {},
  goalName: { fontSize: 14, color: colors.text, fontWeight: '500', marginBottom: 2 },
  goalAmount: { fontSize: 20, fontWeight: '700', color: colors.text },
  goalRight: { alignItems: 'flex-end' },
  goalDays: { fontSize: 13, color: colors.textMuted },
  releaseBtn: { backgroundColor: colors.accent, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6 },
  releaseBtnText: { color: colors.white, fontSize: 13, fontWeight: '600' },
  newGoalBtn: {
    marginTop: 14, paddingVertical: 12, alignItems: 'center',
    backgroundColor: colors.background, borderRadius: 10,
  },
  newGoalText: { fontSize: 14, fontWeight: '500', color: colors.text },

  // Transactions
  txRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  txType: { fontSize: 14, fontWeight: '500', color: colors.text },
  txDate: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  txAmount: { fontSize: 18, fontWeight: '600', color: colors.text },
  txNegative: { color: '#C62828' },
  viewAllBtn: { marginTop: 14, paddingVertical: 10, alignItems: 'center' },
  viewAllText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },

  // NFC Card
  nfcRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nfcDesc: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
  nfcArrow: { fontSize: 20, color: colors.textMuted },
});

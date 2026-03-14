import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, RefreshControl,
  StyleSheet, SafeAreaView, Alert, Linking,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getWalletStatus, releaseGoal, WalletStatusResponse, Goal } from '../services/api';

// Mock exchange rate — in production this comes from an oracle
const XRP_TO_USD = 2.50;
const usd = (xrp: number) => `$${(xrp * XRP_TO_USD).toFixed(2)}`;
const xrpLabel = (xrp: number) => `${xrp.toFixed(2)} XRP`;

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
      Alert.alert('Goal Released!', `${usd(goal.targetAmount)} unlocked and available to spend`);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || err.message);
    } finally {
      setReleasing(null);
    }
  };

  const isGoalReady = (goal: Goal) => {
    return goal.status === 'locked' && new Date() >= new Date(goal.finishAfter);
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
  const totalYield = parseFloat(status.totalYieldEarned);
  const lockedAmt = parseFloat(status.lockedAmount);
  const totalBalance = spendingBalance + lockedAmt;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00e676" />}
      >
        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Spending Balance</Text>
          <Text style={styles.balanceAmount}>{usd(spendingBalance)}</Text>
          <Text style={styles.balanceXrp}>{xrpLabel(spendingBalance)}</Text>

          <View style={styles.balanceRow}>
            <View style={styles.balanceSub}>
              <Text style={styles.subLabel}>Locked in Goals</Text>
              <Text style={styles.subValue}>{usd(lockedAmt)}</Text>
              <Text style={styles.subXrp}>{xrpLabel(lockedAmt)}</Text>
            </View>
            <View style={styles.balanceSub}>
              <Text style={styles.subLabel}>Yield Earned</Text>
              <Text style={[styles.subValue, styles.yieldText]}>
                +{usd(totalYield)}
              </Text>
              <Text style={styles.yieldXrp}>+{totalYield.toFixed(6)} XRP</Text>
            </View>
          </View>

          {parseFloat(status.yieldPercentage) > 0 && (
            <View style={styles.yieldBadge}>
              <Text style={styles.yieldBadgeText}>
                +{status.yieldPercentage}% yield — earning while you save
              </Text>
            </View>
          )}

          <Text style={styles.totalLabel}>
            Total Balance: {usd(totalBalance)}
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push('/deposit')}
          >
            <Text style={styles.actionIcon}>+</Text>
            <Text style={styles.actionLabel}>Deposit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push('/goal/create')}
          >
            <Text style={styles.actionIcon}>🎯</Text>
            <Text style={styles.actionLabel}>New Goal</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push('/register-card')}
          >
            <Text style={styles.actionIcon}>📇</Text>
            <Text style={styles.actionLabel}>Register Card</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push('/pay')}
          >
            <Text style={styles.actionIcon}>💳</Text>
            <Text style={styles.actionLabel}>Charge</Text>
          </TouchableOpacity>
        </View>

        {/* Goals */}
        {status.goals.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Savings Goals</Text>
            {status.goals.map((goal) => (
              <View key={goal.id} style={styles.goalCard}>
                <View style={styles.goalHeader}>
                  <Text style={styles.goalName}>{goal.name}</Text>
                  <Text style={[
                    styles.goalStatus,
                    goal.status === 'released' ? styles.releasedStatus :
                    isGoalReady(goal) ? styles.readyStatus : styles.lockedStatus,
                  ]}>
                    {goal.status === 'released' ? 'Released' :
                     isGoalReady(goal) ? 'Ready' : 'Locked'}
                  </Text>
                </View>
                <Text style={styles.goalAmount}>{usd(goal.targetAmount)}</Text>
                <Text style={styles.goalXrp}>{xrpLabel(goal.targetAmount)}</Text>
                <Text style={styles.goalDate}>
                  {goal.status === 'released' ? 'Released' :
                   isGoalReady(goal) ? 'Ready to release!' :
                   `Unlocks: ${new Date(goal.finishAfter).toLocaleString()}`}
                </Text>
                {isGoalReady(goal) && goal.status === 'locked' && (
                  <TouchableOpacity
                    style={styles.releaseBtn}
                    onPress={() => handleRelease(goal)}
                    disabled={releasing === goal.id}
                  >
                    <Text style={styles.releaseBtnText}>
                      {releasing === goal.id ? 'Releasing...' : 'Release Funds'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Under the Hood — Technical View */}
        <TouchableOpacity
          style={styles.techToggle}
          onPress={() => setShowTechView(!showTechView)}
        >
          <Text style={styles.techToggleText}>
            {showTechView ? 'Hide' : 'Show'} Under the Hood
          </Text>
          <Text style={styles.techToggleArrow}>{showTechView ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {showTechView && (
          <View style={styles.techCard}>
            <Text style={styles.techTitle}>Blockchain Details</Text>

            <View style={styles.techRow}>
              <Text style={styles.techLabel}>Wallet Address</Text>
              <Text style={styles.techValue}>{wallet?.address}</Text>
            </View>

            <View style={styles.techRow}>
              <Text style={styles.techLabel}>XRP Balance (on-chain)</Text>
              <Text style={styles.techValue}>{status.xrpBalance} XRP</Text>
            </View>

            <View style={styles.techRow}>
              <Text style={styles.techLabel}>LP Token Balance</Text>
              <Text style={styles.techValue}>
                {status.ammPosition.lpTokenBalance.toFixed(4)} LP
              </Text>
            </View>

            <View style={styles.techRow}>
              <Text style={styles.techLabel}>AMM Position Value</Text>
              <Text style={styles.techValue}>{status.ammPosition.xrpValue} XRP</Text>
            </View>

            <View style={styles.techRow}>
              <Text style={styles.techLabel}>Network</Text>
              <Text style={styles.techValue}>XRPL Testnet</Text>
            </View>

            {status.goals.filter(g => g.status === 'locked').map(goal => (
              <View key={goal.id} style={styles.techRow}>
                <Text style={styles.techLabel}>Escrow: {goal.name}</Text>
                <Text style={styles.techValue}>Seq #{(goal as any).escrowSequence || 'N/A'}</Text>
              </View>
            ))}

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
  container: { flex: 1, backgroundColor: '#0a0e1a' },
  scroll: { flex: 1, padding: 16 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#8892b0', fontSize: 16 },

  balanceCard: {
    backgroundColor: '#141929', borderRadius: 16, padding: 24, marginBottom: 20,
    borderWidth: 1, borderColor: '#1e2740',
  },
  balanceLabel: { color: '#8892b0', fontSize: 14, marginBottom: 4 },
  balanceAmount: { color: '#fff', fontSize: 40, fontWeight: '800', fontVariant: ['tabular-nums'] },
  balanceXrp: { color: '#4a5568', fontSize: 14, fontVariant: ['tabular-nums'], marginTop: 2 },
  balanceRow: { flexDirection: 'row', marginTop: 20, gap: 24 },
  balanceSub: { flex: 1 },
  subLabel: { color: '#8892b0', fontSize: 12, marginBottom: 2 },
  subValue: { color: '#ccd6f6', fontSize: 18, fontWeight: '600', fontVariant: ['tabular-nums'] },
  subXrp: { color: '#4a5568', fontSize: 11, fontVariant: ['tabular-nums'] },
  yieldText: { color: '#00e676' },
  yieldXrp: { color: '#00e67680', fontSize: 11, fontVariant: ['tabular-nums'] },
  yieldBadge: {
    backgroundColor: '#00e67615', borderRadius: 8, padding: 8, marginTop: 16,
    borderWidth: 1, borderColor: '#00e67630',
  },
  yieldBadgeText: { color: '#00e676', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  totalLabel: { color: '#8892b0', fontSize: 13, marginTop: 12, textAlign: 'right' },

  actions: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  actionBtn: {
    flex: 1, backgroundColor: '#141929', borderRadius: 12, padding: 16,
    alignItems: 'center', borderWidth: 1, borderColor: '#1e2740',
  },
  actionIcon: { fontSize: 24, marginBottom: 4 },
  actionLabel: { color: '#ccd6f6', fontSize: 13, fontWeight: '600' },

  section: { marginBottom: 24 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 12 },

  goalCard: {
    backgroundColor: '#141929', borderRadius: 12, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: '#1e2740',
  },
  goalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  goalName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  goalStatus: { fontSize: 12, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  lockedStatus: { backgroundColor: '#1e2740', color: '#8892b0' },
  readyStatus: { backgroundColor: '#00e67620', color: '#00e676' },
  releasedStatus: { backgroundColor: '#4a556820', color: '#4a5568' },
  goalAmount: { color: '#ccd6f6', fontSize: 22, fontWeight: '700', marginTop: 8, fontVariant: ['tabular-nums'] },
  goalXrp: { color: '#4a5568', fontSize: 12, fontVariant: ['tabular-nums'] },
  goalDate: { color: '#8892b0', fontSize: 12, marginTop: 4 },
  releaseBtn: {
    backgroundColor: '#00e676', borderRadius: 8, padding: 10, marginTop: 12, alignItems: 'center',
  },
  releaseBtnText: { color: '#0a0e1a', fontWeight: '700', fontSize: 14 },

  techToggle: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    paddingVertical: 12, gap: 8,
  },
  techToggleText: { color: '#4a5568', fontSize: 13, fontWeight: '600' },
  techToggleArrow: { color: '#4a5568', fontSize: 12 },
  techCard: {
    backgroundColor: '#0d1117', borderRadius: 12, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: '#1e274060',
  },
  techTitle: { color: '#8892b0', fontSize: 14, fontWeight: '700', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  techRow: { marginBottom: 10 },
  techLabel: { color: '#4a5568', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  techValue: { color: '#8892b0', fontSize: 13, fontFamily: 'monospace', marginTop: 2 },
  explorerBtn: {
    backgroundColor: '#1e2740', borderRadius: 8, padding: 10, marginTop: 8, alignItems: 'center',
  },
  explorerBtnText: { color: '#ccd6f6', fontSize: 13, fontWeight: '600' },
});

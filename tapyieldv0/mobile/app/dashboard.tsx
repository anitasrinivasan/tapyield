import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, RefreshControl,
  StyleSheet, SafeAreaView, Alert, Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getWalletStatus, releaseGoal, WalletStatusResponse, Goal } from '../services/api';
import { XRP_TO_USD, usd } from './theme';

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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8A8A8A" />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Tap Yield</Text>
          <View style={styles.headerIcon} />
        </View>

        {/* Card — gradient, 218px, text at top */}
        <TouchableOpacity
          onLongPress={() => setShowTechView(!showTechView)}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={['#C5C5C5', '#797979']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.card}
          >
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>YOUR CARD</Text>
              <Text style={styles.cardBalance}>{usd(spendingBalance)}</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* White panel — overlaps card with rounded top */}
        <View style={styles.whitePanel}>
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
        </View>

        {/* Recent Activity — dark panel with rounded top */}
        <TouchableOpacity
          style={styles.activityPanel}
          onPress={() => router.push('/activity')}
          activeOpacity={0.8}
        >
          <Text style={styles.activityLabel}>RECENT ACTIVITY</Text>
        </TouchableOpacity>

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
  // Background: Figma #E6E6E6
  container: { flex: 1, backgroundColor: '#E6E6E6' },
  scroll: { flex: 1 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#8A8A8A', fontSize: 16 },

  // Header: Figma 32px/500, circle 36x36 #000
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingTop: 16, marginBottom: 24,
  },
  headerTitle: { fontSize: 32, fontWeight: '500', color: '#000000' },
  headerIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#000000' },

  // Card: Figma 218px, gradient 117.88deg #C5C5C5→#797979, text at top
  card: {
    marginHorizontal: 14, borderRadius: 16, padding: 24,
    height: 218, justifyContent: 'flex-start',
  },
  cardRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
  },
  // Figma: 16px/400, letter-spacing 0.1em, #000
  cardLabel: {
    color: '#000000', fontSize: 16, fontWeight: '400',
    letterSpacing: 16 * 0.1, textTransform: 'uppercase',
  },
  // Figma: 32px/500, #000
  cardBalance: { color: '#000000', fontSize: 32, fontWeight: '500' },

  // White panel: overlaps card bottom, rounded top corners 24px
  whitePanel: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    marginTop: -80, paddingTop: 24, paddingHorizontal: 24, paddingBottom: 16,
  },

  // Action buttons
  actions: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  actionBtn: {
    flex: 1, backgroundColor: '#E6E6E6', borderRadius: 100, paddingVertical: 12,
    alignItems: 'center',
  },
  actionLabel: { color: '#070707', fontSize: 16, fontWeight: '400' },

  // Section label: Figma 16px/400, letter-spacing 0.1em, #000
  sectionLabel: {
    color: '#000000', fontSize: 16, fontWeight: '400',
    letterSpacing: 16 * 0.1, marginBottom: 16, marginTop: 8,
  },

  // Goal rows: Figma bg #E6E6E6, radius 8, height 107
  goalRow: {
    backgroundColor: '#E6E6E6', borderRadius: 8, padding: 16, marginBottom: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    minHeight: 107,
  },
  // Figma: 12px/400, #000
  goalName: { color: '#000000', fontSize: 12, fontWeight: '400', marginBottom: 8 },
  // Figma: 32px/500, #000
  goalAmount: { color: '#000000', fontSize: 32, fontWeight: '500' },
  goalRight: { alignItems: 'flex-end', justifyContent: 'flex-end' },
  // Figma: 12px/400, #555555
  goalDays: { color: '#555555', fontSize: 12, fontWeight: '400' },
  releaseBtn: { backgroundColor: '#070707', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  releaseBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '500' },

  // Create goal: Figma pill shape, bg #E6E6E6, radius 100px, 16px/400
  createGoalBtn: {
    backgroundColor: '#E6E6E6', borderRadius: 100, paddingVertical: 12,
    alignItems: 'center', marginBottom: 16,
  },
  createGoalText: { color: '#070707', fontSize: 16, fontWeight: '400' },

  // Activity panel: Figma #070707, rounded top 24px
  activityPanel: {
    backgroundColor: '#070707',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 24, paddingTop: 40, paddingBottom: 60,
  },
  // Figma: 16px/400, letter-spacing 0.1em, #FFF
  activityLabel: {
    color: '#FFFFFF', fontSize: 16, fontWeight: '400',
    letterSpacing: 16 * 0.1,
  },

  // Tech view (hidden by default)
  techCard: {
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginTop: 16,
    marginHorizontal: 24,
  },
  techTitle: { color: '#8A8A8A', fontSize: 11, letterSpacing: 1, marginBottom: 12 },
  techRow: { marginBottom: 8 },
  techLabel: { color: '#8A8A8A', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  techValue: { color: '#1A1A1A', fontSize: 13, fontFamily: 'monospace', marginTop: 2 },
  explorerBtn: { backgroundColor: '#070707', borderRadius: 8, padding: 10, marginTop: 8, alignItems: 'center' },
  explorerBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
});

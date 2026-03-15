import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, RefreshControl,
  StyleSheet, SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getWalletStatus, WalletStatusResponse, Goal } from '../services/api';

const XRP_TO_USD = 2.50;
const usd = (xrp: number) => `$${(xrp * XRP_TO_USD).toFixed(2)}`;

const MS_PER_DAY = 1000 * 60 * 60 * 24;
function daysLeft(goal: Goal): number {
  return Math.max(0, Math.ceil((new Date(goal.finishAfter).getTime() - Date.now()) / MS_PER_DAY));
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  }).toUpperCase();
}

export default function Dashboard() {
  const [wallet, setWallet] = useState<{ address: string; seed: string } | null>(null);
  const [status, setStatus] = useState<WalletStatusResponse | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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

  if (!status) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const spendingBalance = parseFloat(status.spendingBalance);
  const lockedGoals = status.goals.filter(g => g.status === 'locked');
  const allGoals = status.goals;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#555" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>Tap Yield</Text>
          <View style={styles.avatar}>
            <Text style={styles.avatarIcon}>⊙</Text>
          </View>
        </View>

        {/* Card Widget — floats above white panel */}
        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push('/card')}
          activeOpacity={0.9}
        >
          <View style={styles.cardTopRow}>
            <Text style={styles.cardLabel}>YOUR CARD</Text>
            <Text style={styles.cardBalance}>{usd(spendingBalance)}</Text>
          </View>
          {parseFloat(status.totalYieldEarned) > 0 && (
            <View style={styles.yieldBadgeRow}>
              <View style={styles.yieldBadge}>
                <Text style={styles.yieldBadgeText}>
                  +{usd(parseFloat(status.totalYieldEarned))} earned in yield
                </Text>
              </View>
            </View>
          )}
        </TouchableOpacity>

        {/* Locked Funds Panel — card overlaps its top */}
        <View style={styles.whitePanel}>
          <Text style={styles.sectionLabel}>YOUR LOCKED FUNDS</Text>

          {lockedGoals.length === 0 && (
            <Text style={styles.emptyText}>No locked goals yet</Text>
          )}

          {lockedGoals.map((goal) => (
            <TouchableOpacity
              key={goal.id}
              style={styles.goalCard}
              onPress={() => router.push(`/goal/${goal.id}`)}
              activeOpacity={0.7}
            >
              <View style={styles.goalCardInner}>
                <View>
                  <Text style={styles.goalName}>{goal.name}</Text>
                  <Text style={styles.goalAmount}>{usd(goal.targetAmount)}</Text>
                </View>
                <Text style={styles.goalDays}>{daysLeft(goal)} days left</Text>
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

        {/* Recent Activity Panel */}
        <View style={styles.darkPanel}>
          <Text style={styles.darkSectionLabel}>RECENT ACTIVITY</Text>

          {allGoals.length === 0 && (
            <Text style={styles.darkEmptyText}>No activity yet</Text>
          )}

          {allGoals.map((goal) => (
            <TouchableOpacity
              key={goal.id}
              style={styles.activityCard}
              onPress={() => router.push(`/goal/${goal.id}`)}
              activeOpacity={0.7}
            >
              <Text style={styles.activityDate}>
                {formatDate(goal.createdAt)} · {goal.name.toUpperCase()}
              </Text>
              <Text style={styles.activityAmount}>{usd(goal.targetAmount)}</Text>
            </TouchableOpacity>
          ))}

          {/* Utility actions */}
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/deposit')}>
              <Text style={styles.actionBtnText}>+ Deposit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/register-card')}>
              <Text style={styles.actionBtnText}>Register Card</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 48 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EBEBEB' },
  scroll: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#666', fontSize: 16 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 24,
  },
  logo: { fontSize: 34, fontWeight: '800', color: '#111111', letterSpacing: -0.5 },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#111111', justifyContent: 'center', alignItems: 'center',
  },
  avatarIcon: { color: '#FFFFFF', fontSize: 20 },

  // Card widget
  card: {
    marginHorizontal: 14,
    marginBottom: -64,          // overlaps white panel below
    backgroundColor: '#909090',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 20,
    height: 218,
    justifyContent: 'space-between',
    zIndex: 1,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
    marginTop: 4,
  },
  cardBalance: {
    color: '#FFFFFF',
    fontSize: 44,
    fontWeight: '700',
    letterSpacing: -1,
  },
  yieldBadgeRow: { alignItems: 'flex-end' },
  yieldBadge: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  yieldBadgeText: { color: '#FFFFFF', fontSize: 13, fontWeight: '500' },

  // White panel
  whitePanel: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 84,             // clears the card overlap (64 + 20 breathing room)
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111111',
    letterSpacing: 1.2,
    marginBottom: 20,
  },
  emptyText: { color: '#999', fontSize: 14, marginBottom: 16 },

  goalCard: {
    backgroundColor: '#F0F0F0',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  goalCardInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  goalName: { fontSize: 13, color: '#777777', marginBottom: 6 },
  goalAmount: { fontSize: 34, fontWeight: '700', color: '#111111', letterSpacing: -0.5 },
  goalDays: { fontSize: 13, color: '#999999', marginBottom: 4 },

  createGoalBtn: {
    backgroundColor: '#F0F0F0',
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 4,
  },
  createGoalText: { fontSize: 15, fontWeight: '600', color: '#111111' },

  // Dark panel
  darkPanel: {
    backgroundColor: '#111111',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  darkSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1.2,
    marginBottom: 20,
  },
  darkEmptyText: { color: '#555', fontSize: 14, marginBottom: 16 },

  activityCard: {
    backgroundColor: '#1C1C1C',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 20,
    marginBottom: 12,
  },
  activityDate: {
    fontSize: 11,
    color: '#777777',
    letterSpacing: 0.6,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  activityAmount: { fontSize: 34, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.5 },

  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: '#1C1C1C',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
  },
  actionBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
});

import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, RefreshControl,
  StyleSheet, SafeAreaView, Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getWalletStatus, releaseGoal, Goal } from '../../services/api';

const XRP_TO_USD = 2.50;
const usd = (xrp: number) => `$${(xrp * XRP_TO_USD).toFixed(2)}`;

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  }).toUpperCase();
}

function goalProgress(goal: Goal) {
  const createdAt = new Date(goal.createdAt).getTime();
  const finishAt = new Date(goal.finishAfter).getTime();
  const now = Date.now();
  const totalMs = finishAt - createdAt;
  const daysLeft = Math.max(0, Math.ceil((finishAt - now) / MS_PER_DAY));
  const totalDays = Math.max(1, Math.ceil(totalMs / MS_PER_DAY));
  const progress = Math.min(1, Math.max(0, (totalDays - daysLeft) / totalDays));
  return { daysLeft, totalDays, progress };
}

export default function GoalDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [wallet, setWallet] = useState<{ address: string; seed: string } | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [releasing, setReleasing] = useState(false);

  const loadData = useCallback(async () => {
    const stored = await AsyncStorage.getItem('wallet');
    if (!stored) return;
    const w = JSON.parse(stored);
    setWallet(w);
    try {
      const status = await getWalletStatus(w.address);
      const found = status.goals.find(g => g.id === id);
      if (found) setGoal(found);
    } catch (err) {
      console.error('Goal fetch error:', err);
    }
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleRelease = async () => {
    if (!wallet || !goal) return;
    setReleasing(true);
    try {
      await releaseGoal(wallet.address, wallet.seed, goal.id);
      Alert.alert('Funds Released!', `${usd(goal.targetAmount)} is now available to spend.`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || err.message);
    } finally {
      setReleasing(false);
    }
  };

  if (!goal) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backArrow}>‹</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { daysLeft, totalDays, progress } = goalProgress(goal);
  const isReady = goal.status === 'locked' && Date.now() >= new Date(goal.finishAfter).getTime();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#111" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Back button */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backArrow}>‹</Text>
          </TouchableOpacity>
        </View>

        {/* Goal header */}
        <View style={styles.goalHeader}>
          <Text style={styles.goalName}>{goal.name}</Text>
          <Text style={styles.goalAmount}>{usd(goal.targetAmount)}</Text>
        </View>

        {/* Progress card */}
        <View style={styles.progressCard}>
          <View style={styles.progressRow}>
            <Text style={styles.lockIcon}>🔒</Text>
            <Text style={styles.daysLeft}>
              {isReady ? 'Ready to unlock!' : `${daysLeft} days left`}
            </Text>
            <Text style={styles.totalDays}>of {totalDays} days</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
        </View>

        {/* Release button (if ready) */}
        {isReady && goal.status === 'locked' && (
          <TouchableOpacity
            style={[styles.releaseBtn, releasing && styles.releaseBtnDisabled]}
            onPress={handleRelease}
            disabled={releasing}
          >
            <Text style={styles.releaseBtnText}>
              {releasing ? 'Releasing...' : 'Unlock Funds'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Activity panel */}
        <View style={styles.darkPanel}>
          <Text style={styles.darkSectionLabel}>RECENT ACTIVITY</Text>

          <View style={styles.activityCard}>
            <Text style={styles.activityDate}>
              {formatDate(goal.createdAt)} · INITIAL LOCK
            </Text>
            <Text style={styles.activityAmount}>{usd(goal.targetAmount)}</Text>
          </View>

          {goal.status === 'released' && (
            <View style={styles.activityCard}>
              <Text style={styles.activityDate}>
                {formatDate(goal.finishAfter)} · RELEASED
              </Text>
              <Text style={styles.activityAmount}>{usd(goal.targetAmount)}</Text>
            </View>
          )}

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#666', fontSize: 16 },

  topBar: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#111111', justifyContent: 'center', alignItems: 'center',
  },
  backArrow: { color: '#FFFFFF', fontSize: 24, fontWeight: '300', marginTop: -2, marginLeft: -2 },

  goalHeader: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  goalName: { fontSize: 24, fontWeight: '700', color: '#111111', marginBottom: 4 },
  goalAmount: { fontSize: 52, fontWeight: '700', color: '#111111' },

  progressCard: {
    marginHorizontal: 16,
    backgroundColor: '#F0F0F0',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  lockIcon: { fontSize: 18, marginRight: 10 },
  daysLeft: { fontSize: 16, fontWeight: '600', color: '#111111', flex: 1 },
  totalDays: { fontSize: 14, color: '#888888' },
  progressTrack: {
    height: 10,
    backgroundColor: '#DDDDDD',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: 10,
    backgroundColor: '#111111',
    borderRadius: 5,
  },

  releaseBtn: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#111111',
    borderRadius: 40,
    paddingVertical: 18,
    alignItems: 'center',
  },
  releaseBtnDisabled: { opacity: 0.6 },
  releaseBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },

  darkPanel: {
    backgroundColor: '#111111',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 32,
    marginTop: 4,
  },
  darkSectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
    marginBottom: 20,
  },
  activityCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  activityDate: { fontSize: 12, color: '#888888', marginBottom: 8, letterSpacing: 0.5 },
  activityAmount: { fontSize: 32, fontWeight: '700', color: '#FFFFFF' },
});

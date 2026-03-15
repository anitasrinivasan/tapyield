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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#555" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Back button */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backArrow}>‹</Text>
          </TouchableOpacity>
        </View>

        {/* Goal name + amount — centered per Figma */}
        <View style={styles.goalHeader}>
          <Text style={styles.goalName}>{goal.name}</Text>
          <Text style={styles.goalAmount}>{usd(goal.targetAmount)}</Text>
        </View>

        {/* Progress card */}
        <View style={styles.progressCard}>
          <View style={styles.progressTopRow}>
            <Text style={styles.lockIcon}>🔒</Text>
            <Text style={styles.daysLeftText}>
              {isReady ? 'Ready to unlock!' : `${daysLeft} days left`}
            </Text>
            <Text style={styles.totalDaysText}>of {totalDays} days</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` as any }]} />
          </View>
        </View>

        {/* Release button — only shows when unlockable */}
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

          <View style={{ height: 48 }} />
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

  topBar: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#111111', justifyContent: 'center', alignItems: 'center',
  },
  backArrow: { color: '#FFFFFF', fontSize: 26, fontWeight: '300', marginTop: -2, marginLeft: -2 },

  // Centered header per Figma
  goalHeader: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 32,
  },
  goalName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111111',
    textAlign: 'center',
    marginBottom: 8,
  },
  goalAmount: {
    fontSize: 56,
    fontWeight: '700',
    color: '#111111',
    textAlign: 'center',
    letterSpacing: -1,
  },

  // Progress card
  progressCard: {
    marginHorizontal: 20,
    backgroundColor: '#F0F0F0',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  progressTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    gap: 8,
  },
  lockIcon: { fontSize: 18 },
  daysLeftText: { fontSize: 16, fontWeight: '600', color: '#111111', flex: 1 },
  totalDaysText: { fontSize: 14, color: '#888888' },
  progressTrack: {
    height: 12,
    backgroundColor: '#DDDDDD',
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: 12,
    backgroundColor: '#111111',
    borderRadius: 6,
  },

  // Release button
  releaseBtn: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: '#111111',
    borderRadius: 40,
    paddingVertical: 18,
    alignItems: 'center',
  },
  releaseBtnDisabled: { opacity: 0.6 },
  releaseBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },

  // Dark activity panel
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
});

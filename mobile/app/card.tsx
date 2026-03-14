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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  }).toUpperCase();
}

function NfcWaves() {
  return (
    <View style={nfcStyles.container}>
      <Text style={nfcStyles.wave}>{')))'}}</Text>
    </View>
  );
}

const nfcStyles = StyleSheet.create({
  container: { justifyContent: 'center', alignItems: 'center', width: 36, height: 36 },
  wave: { fontSize: 28, color: '#111111', fontWeight: '300', letterSpacing: -4 },
});

export default function CardPage() {
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
  }, [wallet, fetchStatus]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStatus();
    setRefreshing(false);
  };

  const spendingBalance = status ? parseFloat(status.spendingBalance) : 0;
  const totalYield = status ? parseFloat(status.totalYieldEarned) : 0;
  const allGoals = status?.goals ?? [];

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

        {/* Card Widget */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>YOUR CARD</Text>
          <Text style={styles.cardBalance}>{usd(spendingBalance)}</Text>
          {totalYield > 0 && (
            <View style={styles.yieldBadge}>
              <Text style={styles.yieldBadgeText}>
                +{usd(totalYield)} earned in yield
              </Text>
            </View>
          )}
        </View>

        {/* NFC Pay Instruction */}
        <TouchableOpacity
          style={styles.nfcRow}
          onPress={() => router.push('/pay')}
          activeOpacity={0.7}
        >
          <NfcWaves />
          <Text style={styles.nfcText}>Hold NFC near sensor to pay</Text>
        </TouchableOpacity>

        {/* Recent Activity */}
        <View style={styles.darkPanel}>
          <Text style={styles.darkSectionLabel}>RECENT ACTIVITY</Text>

          {allGoals.length === 0 && (
            <Text style={styles.darkEmptyText}>No activity yet</Text>
          )}

          {allGoals.map((goal: Goal) => (
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

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EBEBEB' },
  scroll: { flex: 1 },

  topBar: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#111111', justifyContent: 'center', alignItems: 'center',
  },
  backArrow: { color: '#FFFFFF', fontSize: 24, fontWeight: '300', marginTop: -2, marginLeft: -2 },

  card: {
    marginHorizontal: 16,
    marginBottom: -20,
    backgroundColor: '#8A8A8A',
    borderRadius: 20,
    padding: 24,
    minHeight: 200,
    justifyContent: 'space-between',
    zIndex: 1,
  },
  cardLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
  },
  cardBalance: {
    color: '#FFFFFF',
    fontSize: 48,
    fontWeight: '700',
    marginTop: 8,
  },
  yieldBadge: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  yieldBadgeText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },

  nfcRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    paddingTop: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  nfcText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#111111',
    flex: 1,
    lineHeight: 26,
  },

  darkPanel: {
    backgroundColor: '#111111',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 32,
    marginTop: 12,
  },
  darkSectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
    marginBottom: 20,
  },
  darkEmptyText: { color: '#666', fontSize: 14, marginBottom: 16 },

  activityCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  activityDate: { fontSize: 12, color: '#888888', marginBottom: 8, letterSpacing: 0.5 },
  activityAmount: { fontSize: 32, fontWeight: '700', color: '#FFFFFF' },
});

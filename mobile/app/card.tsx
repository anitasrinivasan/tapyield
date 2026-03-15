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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#555" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Back button */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backArrow}>‹</Text>
          </TouchableOpacity>
        </View>

        {/* Card Widget — floats above white NFC panel */}
        <View style={styles.card}>
          <View style={styles.cardTopRow}>
            <Text style={styles.cardLabel}>YOUR CARD</Text>
            <Text style={styles.cardBalance}>{usd(spendingBalance)}</Text>
          </View>
          {totalYield > 0 && (
            <View style={styles.yieldBadgeRow}>
              <View style={styles.yieldBadge}>
                <Text style={styles.yieldBadgeText}>
                  +{usd(totalYield)} earned in yield
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* NFC pay row — lives in white panel the card overlaps */}
        <View style={styles.whitePanel}>
          <TouchableOpacity
            style={styles.nfcRow}
            onPress={() => router.push('/pay')}
            activeOpacity={0.7}
          >
            {/* NFC waves icon — three concentric arcs */}
            <View style={styles.nfcIcon}>
              <Text style={styles.nfcArc1}>)</Text>
              <Text style={styles.nfcArc2}>)</Text>
              <Text style={styles.nfcArc3}>)</Text>
            </View>
            <Text style={styles.nfcText}>Hold NFC near{'\n'}sensor to pay</Text>
          </TouchableOpacity>
        </View>

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

          <View style={{ height: 48 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EBEBEB' },
  scroll: { flex: 1 },

  topBar: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20 },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#111111', justifyContent: 'center', alignItems: 'center',
  },
  backArrow: { color: '#FFFFFF', fontSize: 26, fontWeight: '300', marginTop: -2, marginLeft: -2 },

  // Card
  card: {
    marginHorizontal: 14,
    marginBottom: -64,
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

  // White panel with NFC row
  whitePanel: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 84,
    paddingHorizontal: 24,
    paddingBottom: 0,
  },
  nfcRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    paddingVertical: 24,
  },
  nfcIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 40,
  },
  nfcArc1: { fontSize: 28, color: '#111111', fontWeight: '200', marginRight: -10 },
  nfcArc2: { fontSize: 22, color: '#111111', fontWeight: '200', marginRight: -8 },
  nfcArc3: { fontSize: 16, color: '#111111', fontWeight: '200' },
  nfcText: {
    fontSize: 20,
    fontWeight: '500',
    color: '#111111',
    lineHeight: 28,
  },

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
});

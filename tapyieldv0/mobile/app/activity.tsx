import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, RefreshControl,
  StyleSheet, SafeAreaView, TouchableOpacity, Linking,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getWalletStatus, WalletStatusResponse, Transaction } from '../services/api';
import { colors, usd } from './theme';

export default function Activity() {
  const [status, setStatus] = useState<WalletStatusResponse | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStatus = useCallback(async () => {
    const stored = await AsyncStorage.getItem('wallet');
    if (!stored) return;
    const wallet = JSON.parse(stored);
    try {
      const data = await getWalletStatus(wallet.address);
      setStatus(data);
    } catch (err) {
      console.error('Status fetch error:', err);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStatus();
    setRefreshing(false);
  };

  const spendingBalance = status ? parseFloat(status.spendingBalance) : 0;
  const transactions = status?.transactions || [];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backArrow}>{'‹'}</Text>
        </TouchableOpacity>
      </View>

      {/* Card */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>YOUR CARD</Text>
        <Text style={styles.cardBalance}>{usd(spendingBalance)}</Text>
      </View>

      {/* Activity List */}
      <View style={styles.activitySection}>
        <Text style={styles.sectionLabel}>ALL ACTIVITY</Text>
        <ScrollView
          style={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textMuted} />}
        >
          {transactions.length === 0 && (
            <View style={styles.emptyRow}>
              <Text style={styles.emptyText}>No transactions yet</Text>
            </View>
          )}
          {transactions.map((tx, i) => (
            <TouchableOpacity
              key={tx.txHash || i}
              style={styles.activityRow}
              onPress={() => tx.txHash && Linking.openURL(`https://testnet.xrpl.org/transactions/${tx.txHash}`)}
              activeOpacity={tx.txHash ? 0.7 : 1}
            >
              <View style={styles.activityLeft}>
                <Text style={styles.activityDate}>
                  {new Date(tx.timestamp).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()}
                  {tx.merchantName ? ` · ${tx.merchantName.toUpperCase()}` : ''}
                </Text>
                <Text style={styles.activityType}>
                  {tx.type === 'payment' ? 'Payment' :
                   tx.type === 'deposit' ? 'Deposit' :
                   tx.type === 'withdraw' ? 'Withdrawal' :
                   tx.type === 'escrow_create' ? 'Goal Created' :
                   tx.type === 'escrow_finish' ? 'Goal Released' : tx.type}
                </Text>
              </View>
              <View style={styles.activityRight}>
                <Text style={[styles.activityAmount, tx.type === 'payment' && styles.amountNegative]}>
                  {tx.type === 'payment' || tx.type === 'escrow_create' ? '-' : '+'}{usd(tx.amount)}
                </Text>
                {tx.txHash && <Text style={styles.explorerHint}>View on XRPL →</Text>}
              </View>
            </TouchableOpacity>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cardDark },

  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  backArrow: { color: colors.white, fontSize: 32, fontWeight: '300' },

  card: {
    marginHorizontal: 20, backgroundColor: '#3A3A3A', borderRadius: 16,
    padding: 24, marginBottom: 24, minHeight: 100, justifyContent: 'flex-end',
  },
  cardLabel: { color: '#AAAAAA', fontSize: 11, letterSpacing: 1, marginBottom: 8 },
  cardBalance: { color: colors.white, fontSize: 32, fontWeight: '700' },

  activitySection: { flex: 1, backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 20, paddingHorizontal: 20 },
  sectionLabel: { color: colors.textMuted, fontSize: 11, letterSpacing: 1, marginBottom: 12 },
  scroll: { flex: 1 },

  activityRow: {
    backgroundColor: colors.card, borderRadius: 12, padding: 16, marginBottom: 8,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  activityLeft: { flex: 1, marginRight: 12 },
  activityDate: { color: colors.textMuted, fontSize: 10, letterSpacing: 0.5, marginBottom: 4 },
  activityType: { color: colors.text, fontSize: 14, fontWeight: '500' },
  activityRight: { alignItems: 'flex-end' },
  activityAmount: { color: colors.text, fontSize: 20, fontWeight: '600' },
  amountNegative: { color: '#C62828' },
  explorerHint: { color: colors.textMuted, fontSize: 10, marginTop: 4 },

  emptyRow: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { color: colors.textMuted, fontSize: 14 },
});

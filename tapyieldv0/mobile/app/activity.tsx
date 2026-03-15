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
  const transactions = status?.transactions?.slice().reverse() || [];

  return (
    <SafeAreaView style={s.container}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textMuted} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Balance */}
        <View style={s.card}>
          <Text style={s.label}>SPENDING BALANCE</Text>
          <Text style={s.balance}>{usd(spendingBalance)}</Text>
        </View>

        {/* Transactions */}
        <View style={s.card}>
          <Text style={s.label}>ALL ACTIVITY</Text>

          {transactions.length === 0 && (
            <Text style={s.emptyText}>No transactions yet</Text>
          )}

          {transactions.map((tx, i) => (
            <TouchableOpacity
              key={tx.txHash || i}
              style={[s.txRow, i === transactions.length - 1 && s.txRowLast]}
              onPress={() => tx.txHash && Linking.openURL(`https://testnet.xrpl.org/transactions/${tx.txHash}`)}
              activeOpacity={tx.txHash ? 0.7 : 1}
            >
              <View style={s.txLeft}>
                <Text style={s.txType}>
                  {tx.type === 'payment' ? 'Payment' :
                   tx.type === 'deposit' ? 'Deposit' :
                   tx.type === 'withdraw' ? 'Withdrawal' :
                   tx.type === 'escrow_create' ? 'Goal Created' :
                   tx.type === 'escrow_finish' ? 'Goal Released' : tx.type}
                  {tx.merchantName ? ` · ${tx.merchantName}` : ''}
                </Text>
                <Text style={s.txDate}>
                  {new Date(tx.timestamp).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </Text>
              </View>
              <View style={s.txRight}>
                <Text style={[s.txAmount, (tx.type === 'payment' || tx.type === 'escrow_create') && s.txNegative]}>
                  {tx.type === 'payment' || tx.type === 'escrow_create' ? '-' : '+'}{usd(tx.amount)}
                </Text>
                {tx.txHash && <Text style={s.explorerHint}>XRPL →</Text>}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8 },

  card: {
    backgroundColor: colors.card, borderRadius: 16, padding: 20,
    marginBottom: 12,
  },
  label: {
    fontSize: 11, fontWeight: '600', color: colors.textMuted,
    letterSpacing: 1, marginBottom: 12,
  },
  balance: { fontSize: 32, fontWeight: '700', color: colors.text },
  emptyText: { color: colors.textMuted, fontSize: 14 },

  txRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  txRowLast: { borderBottomWidth: 0 },
  txLeft: { flex: 1, marginRight: 12 },
  txType: { fontSize: 14, fontWeight: '500', color: colors.text },
  txDate: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  txRight: { alignItems: 'flex-end' },
  txAmount: { fontSize: 18, fontWeight: '600', color: colors.text },
  txNegative: { color: '#C62828' },
  explorerHint: { fontSize: 10, color: colors.textMuted, marginTop: 4 },
});

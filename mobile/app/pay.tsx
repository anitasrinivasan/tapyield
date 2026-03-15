import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  StyleSheet, SafeAreaView, Linking,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { tapPayment } from '../services/api';
import { readNfcCard } from '../services/nfc';

const XRP_TO_USD = 2.50;
const usdAmt = (xrp: number | string) => `$${(parseFloat(String(xrp)) * XRP_TO_USD).toFixed(2)}`;

type Stage = 'amount' | 'waiting' | 'processing' | 'success';

interface PayResult {
  txHash: string;
  customerName: string;
  remainingSpendingBalance: string;
  amountPaid: string;
}

export default function Pay() {
  const [stage, setStage] = useState<Stage>('amount');
  const [amount, setAmount] = useState('');
  const [merchantName, setMerchantName] = useState('');
  const [result, setResult] = useState<PayResult | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('wallet').then(stored => {
      if (stored) {
        const w = JSON.parse(stored);
        const addr: string = w.address;
        setMerchantName(`${addr.slice(0, 6)}…${addr.slice(-4)}`);
      }
    });
  }, []);

  // Start NFC scan when entering waiting stage
  useEffect(() => {
    if (stage !== 'waiting') return;
    let cancelled = false;

    const scan = async () => {
      setScanning(true);
      try {
        const { uid, ctr } = await readNfcCard();
        if (cancelled) return;
        await processPayment(uid, ctr);
      } catch {
        if (!cancelled) setScanning(false);
      }
    };

    scan();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  const processPayment = async (uid: string, ctr: number) => {
    setStage('processing');
    try {
      const stored = await AsyncStorage.getItem('wallet');
      if (!stored) throw new Error('No merchant wallet found');
      const merchantWallet = JSON.parse(stored);
      const res = await tapPayment(uid, ctr, merchantWallet.address, amount);
      setResult({
        txHash: res.txHash,
        customerName: res.customerName,
        remainingSpendingBalance: res.remainingSpendingBalance,
        amountPaid: amount,
      });
      setStage('success');
    } catch {
      setScanning(false);
      setStage('waiting');
    }
  };

  const reset = () => {
    setResult(null);
    setAmount('');
    setStage('amount');
  };

  const retryWaiting = () => {
    setScanning(false);
    setStage('amount');
    setTimeout(() => setStage('waiting'), 50);
  };

  // ── AMOUNT ENTRY ──
  if (stage === 'amount') {
    const amountNum = parseFloat(amount) || 0;
    const hasAmount = amountNum > 0;
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backArrow}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.merchantName}>{merchantName}</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.amountSection}>
          <Text style={styles.amountLabel}>PAYMENT AMOUNT</Text>
          <View style={styles.amountRow}>
            <Text style={styles.amountDollar}>$</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="0.00"
              placeholderTextColor="rgba(255,255,255,0.3)"
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={text => setAmount(text.replace(/[^0-9.]/g, ''))}
            />
          </View>
          {hasAmount && (
            <Text style={styles.amountXrp}>{amount} XRP</Text>
          )}
        </View>

        <TouchableOpacity
          style={[styles.readyBtn, !hasAmount && styles.readyBtnDisabled]}
          onPress={() => hasAmount && setStage('waiting')}
          disabled={!hasAmount}
        >
          <Text style={styles.readyBtnIcon}>✓</Text>
          <Text style={styles.readyBtnText}>Ready for Payment</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ── NFC WAITING ──
  if (stage === 'waiting') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setStage('amount')}>
            <Text style={styles.backArrow}>‹</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
        </View>

        <View style={styles.centeredContent}>
          <View style={styles.nfcIconContainer}>
            <View style={styles.nfcArcs}>
              <Text style={styles.nfcArc1}>)</Text>
              <Text style={styles.nfcArc2}>)</Text>
              <Text style={styles.nfcArc3}>)</Text>
            </View>
          </View>
          <Text style={styles.statusBadge}>WAITING FOR NFC</Text>
          <Text style={styles.statusMessage}>Hold customer's card near phone</Text>

          {scanning ? (
            <ActivityIndicator color="rgba(255,255,255,0.4)" size="small" style={{ marginTop: 24 }} />
          ) : (
            <TouchableOpacity style={styles.retryBtn} onPress={retryWaiting}>
              <Text style={styles.retryBtnText}>Tap to retry scan</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.amountFooter}>
          <Text style={styles.amountFooterLabel}>Charging</Text>
          <Text style={styles.amountFooterValue}>
            {usdAmt(amount)} · {amount} XRP
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── PROCESSING ──
  if (stage === 'processing') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centeredContent}>
          <ActivityIndicator color="#FFFFFF" size="large" />
          <Text style={[styles.statusBadge, { marginTop: 24 }]}>LOADING</Text>
          <Text style={styles.statusMessage}>Processing payment on XRPL...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── SUCCESS ──
  if (stage === 'success' && result) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centeredContent}>
          <Text style={styles.checkmark}>✓</Text>
          <Text style={styles.paidAmount}>{usdAmt(result.amountPaid)} paid</Text>
          {result.customerName ? (
            <Text style={styles.customerName}>{result.customerName}</Text>
          ) : null}
        </View>

        <View style={styles.txInfoPanel}>
          <Text style={styles.txId}>
            Transaction ID: …{result.txHash.slice(-4)}
          </Text>
          <TouchableOpacity
            onPress={() => Linking.openURL(`https://testnet.xrpl.org/transactions/${result.txHash}`)}
          >
            <Text style={styles.explorerLink}>XRPL explorer: testnet.xrpl.org ↗</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.newPaymentBtn} onPress={reset}>
          <Text style={styles.newPaymentIcon}>+</Text>
          <Text style={styles.newPaymentText}>New Payment</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111111' },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#2A2A2A', justifyContent: 'center', alignItems: 'center',
  },
  backArrow: { color: '#FFFFFF', fontSize: 24, fontWeight: '300', marginTop: -2, marginLeft: -2 },
  merchantName: {
    flex: 1, textAlign: 'center',
    color: '#888888', fontSize: 14, fontWeight: '600',
  },

  amountSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  amountLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  amountDollar: {
    fontSize: 40,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    marginRight: 4,
  },
  amountInput: {
    fontSize: 72,
    fontWeight: '700',
    color: '#FFFFFF',
    minWidth: 140,
  },
  amountXrp: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 16,
    marginTop: 8,
  },

  readyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2A2A2A',
    marginHorizontal: 24,
    marginBottom: 48,
    borderRadius: 40,
    paddingVertical: 18,
    gap: 10,
  },
  readyBtnDisabled: { opacity: 0.4 },
  readyBtnIcon: { color: '#FFFFFF', fontSize: 16 },
  readyBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },

  centeredContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  nfcIconContainer: {
    width: 100, height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  nfcArcs: { flexDirection: 'row', alignItems: 'center' },
  nfcArc1: { fontSize: 64, color: '#FFFFFF', fontWeight: '200', marginRight: -16 },
  nfcArc2: { fontSize: 48, color: '#FFFFFF', fontWeight: '200', marginRight: -12 },
  nfcArc3: { fontSize: 36, color: '#FFFFFF', fontWeight: '200' },
  statusBadge: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 12,
  },
  statusMessage: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 30,
  },
  retryBtn: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#2A2A2A',
    borderRadius: 20,
  },
  retryBtnText: { color: '#AAAAAA', fontSize: 14 },

  amountFooter: {
    paddingHorizontal: 24,
    paddingBottom: 48,
    alignItems: 'center',
  },
  amountFooterLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 4 },
  amountFooterValue: { color: '#FFFFFF', fontSize: 18, fontWeight: '600' },

  checkmark: { fontSize: 64, color: '#FFFFFF', marginBottom: 8 },
  paidAmount: {
    fontSize: 52, fontWeight: '700', color: '#FFFFFF', textAlign: 'center',
  },
  customerName: { color: 'rgba(255,255,255,0.6)', fontSize: 16, marginTop: 8 },

  txInfoPanel: {
    paddingHorizontal: 32,
    paddingBottom: 24,
    gap: 6,
  },
  txId: { color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center' },
  explorerLink: {
    color: 'rgba(255,255,255,0.7)', fontSize: 14,
    textAlign: 'center', textDecorationLine: 'underline',
  },

  newPaymentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2A2A2A',
    marginHorizontal: 24,
    marginBottom: 48,
    borderRadius: 40,
    paddingVertical: 18,
    gap: 10,
  },
  newPaymentIcon: { color: '#FFFFFF', fontSize: 20 },
  newPaymentText: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
});

import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  StyleSheet, SafeAreaView, Alert, Linking,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { tapPayment } from '../services/api';

const XRP_TO_USD = 2.50;

export default function Pay() {
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerSeed, setCustomerSeed] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [cardDetected, setCardDetected] = useState(false);
  const [customerName, setCustomerName] = useState('');

  const usdEquiv = amount ? `$${(parseFloat(amount) * XRP_TO_USD).toFixed(2)}` : '';

  const handleCharge = async () => {
    if (!customerAddress || !amount || parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Scan a customer card and enter an amount');
      return;
    }

    setLoading(true);
    try {
      // Merchant's wallet is in AsyncStorage — they are the payment receiver
      const stored = await AsyncStorage.getItem('wallet');
      if (!stored) throw new Error('No merchant wallet found');
      const merchantWallet = JSON.parse(stored);

      // Payment flows: customer's wallet → merchant's wallet
      const result = await tapPayment(
        customerAddress,
        customerSeed,
        merchantWallet.address,
        amount,
      );
      const usdAmt = (parseFloat(amount) * XRP_TO_USD).toFixed(2);
      Alert.alert(
        'Payment Received!',
        `$${usdAmt} received from customer.\nSettled instantly on-chain.`,
        [
          { text: 'View on Explorer', onPress: () => Linking.openURL(`https://testnet.xrpl.org/transactions/${result.txHash}`) },
          { text: 'Done', onPress: () => { resetCard(); router.back(); } },
        ]
      );
    } catch (err: any) {
      Alert.alert('Payment Failed', err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetCard = () => {
    setCustomerAddress('');
    setCustomerSeed('');
    setCardDetected(false);
    setCustomerName('');
  };

  // NFC card tap handler — Alex replaces with real NFC reading
  const handleCardTap = () => {
    Alert.alert(
      'Ready to Scan',
      'Ask the customer to tap their TapYield card.\n\nFor demo: paste customer wallet details below.',
    );
  };

  // Called by Alex's NFC module when a customer's card is read.
  // The NFC card contains the customer's wallet address + auth credentials.
  // Alex: call onCardRead(address, seed, name) when NFC tag is read.
  const onCardRead = (address: string, seed: string, name?: string) => {
    setCustomerAddress(address);
    setCustomerSeed(seed);
    setCardDetected(true);
    setCustomerName(name || 'Customer');
  };

  // Expose for Alex's NFC integration
  (globalThis as any).__tapyield_onCardRead = onCardRead;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Accept Payment</Text>
        <Text style={styles.subtitle}>
          Customer taps their card to pay
        </Text>

        {/* Amount — merchant enters what to charge */}
        <Text style={styles.label}>Charge Amount</Text>
        <TextInput
          style={styles.amountInput}
          placeholder="0.00"
          placeholderTextColor="#4a5568"
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
        />
        {usdEquiv ? (
          <Text style={styles.usdEquiv}>{usdEquiv} USD</Text>
        ) : null}
        {amount ? (
          <Text style={styles.xrpEquiv}>{amount} XRP</Text>
        ) : null}

        {/* NFC Card Tap Area */}
        <TouchableOpacity
          style={[styles.cardArea, cardDetected && styles.cardDetected]}
          onPress={cardDetected ? resetCard : handleCardTap}
        >
          {cardDetected ? (
            <>
              <Text style={styles.cardIconDetected}>✓</Text>
              <Text style={styles.cardTextDetected}>Card Detected</Text>
              <Text style={styles.cardCustomer}>{customerName}</Text>
              <Text style={styles.cardAddress}>
                {customerAddress.slice(0, 8)}...{customerAddress.slice(-6)}
              </Text>
              <Text style={styles.cardTapAgain}>Tap to reset</Text>
            </>
          ) : (
            <>
              <View style={styles.cardIconContainer}>
                <Text style={styles.cardIcon}>📶</Text>
              </View>
              <Text style={styles.cardText}>Tap Customer's Card</Text>
              <Text style={styles.cardSubtext}>NFC</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Manual entry fallback for demo */}
        {!cardDetected && (
          <>
            <Text style={styles.manualLabel}>Demo: Manual Entry</Text>
            <TextInput
              style={styles.input}
              placeholder="Customer wallet address (rXXX...)"
              placeholderTextColor="#4a5568"
              value={customerAddress}
              onChangeText={setCustomerAddress}
              autoCapitalize="none"
            />
            <TextInput
              style={[styles.input, { marginTop: 8 }]}
              placeholder="Customer seed (sXXX...)"
              placeholderTextColor="#4a5568"
              value={customerSeed}
              onChangeText={(text) => {
                setCustomerSeed(text);
                if (text && customerAddress) setCardDetected(true);
              }}
              autoCapitalize="none"
              secureTextEntry
            />
          </>
        )}

        <TouchableOpacity
          style={[
            styles.button,
            (loading || !cardDetected || !amount) && styles.buttonDisabled,
          ]}
          onPress={handleCharge}
          disabled={loading || !cardDetected || !amount}
        >
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#0a0e1a" />
              <Text style={styles.buttonText}>  Processing...</Text>
            </View>
          ) : (
            <Text style={styles.buttonText}>
              Charge {usdEquiv || '$0.00'}
            </Text>
          )}
        </TouchableOpacity>

        <Text style={styles.poweredBy}>
          Settled instantly on the XRP Ledger
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e1a' },
  content: { flex: 1, padding: 24 },
  title: { color: '#fff', fontSize: 28, fontWeight: '800', marginBottom: 8 },
  subtitle: { color: '#8892b0', fontSize: 14, marginBottom: 24 },

  label: { color: '#ccd6f6', fontSize: 14, fontWeight: '600', marginBottom: 8 },
  amountInput: {
    backgroundColor: '#141929', borderRadius: 12, padding: 20,
    color: '#fff', fontSize: 32, fontWeight: '700', fontVariant: ['tabular-nums'],
    borderWidth: 1, borderColor: '#1e2740', textAlign: 'center',
  },
  usdEquiv: { color: '#00e676', fontSize: 18, textAlign: 'center', marginTop: 8, fontWeight: '700' },
  xrpEquiv: { color: '#4a5568', fontSize: 13, textAlign: 'center', marginTop: 2 },

  cardArea: {
    backgroundColor: '#141929', borderRadius: 20, padding: 32,
    alignItems: 'center', borderWidth: 2, borderColor: '#1e2740',
    marginTop: 24, marginBottom: 16,
  },
  cardDetected: {
    borderColor: '#00e676', backgroundColor: '#00e67610',
  },
  cardIconContainer: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: '#1e2740',
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  cardIcon: { fontSize: 32 },
  cardIconDetected: { fontSize: 48, color: '#00e676', marginBottom: 8 },
  cardText: { color: '#ccd6f6', fontSize: 18, fontWeight: '700' },
  cardTextDetected: { color: '#00e676', fontSize: 18, fontWeight: '700' },
  cardSubtext: { color: '#4a5568', fontSize: 12, marginTop: 4 },
  cardCustomer: { color: '#ccd6f6', fontSize: 16, fontWeight: '600', marginTop: 4 },
  cardAddress: { color: '#8892b0', fontSize: 12, fontFamily: 'monospace', marginTop: 4 },
  cardTapAgain: { color: '#4a5568', fontSize: 11, marginTop: 8 },

  manualLabel: { color: '#4a5568', fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 4 },
  input: {
    backgroundColor: '#141929', borderRadius: 12, padding: 14,
    color: '#fff', fontSize: 14, borderWidth: 1, borderColor: '#1e2740',
  },
  button: {
    backgroundColor: '#00e676', borderRadius: 12, padding: 16,
    alignItems: 'center', marginTop: 20,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#0a0e1a', fontSize: 18, fontWeight: '700' },
  loadingRow: { flexDirection: 'row', alignItems: 'center' },
  poweredBy: { color: '#4a5568', fontSize: 11, textAlign: 'center', marginTop: 16 },
});

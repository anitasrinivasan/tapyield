import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../app/theme';

interface NumberPadProps {
  onPress: (key: string) => void;
}

const keys = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', '⌫'],
];

export default function NumberPad({ onPress }: NumberPadProps) {
  return (
    <View style={styles.pad}>
      {keys.map((row, i) => (
        <View key={i} style={styles.row}>
          {row.map((key) => (
            <TouchableOpacity
              key={key}
              style={styles.key}
              onPress={() => onPress(key)}
              activeOpacity={0.5}
            >
              <Text style={styles.keyText}>{key}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 24 },
  row: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12 },
  key: {
    width: 72, height: 56, justifyContent: 'center', alignItems: 'center',
    borderRadius: 8,
  },
  keyText: { fontSize: 28, fontWeight: '400', color: colors.text },
});

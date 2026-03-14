export const colors = {
  background: '#F5F0EB',
  card: '#FFFFFF',
  cardDark: '#2C2C2C',
  text: '#1A1A1A',
  textMuted: '#8A8A8A',
  textLight: '#B0B0B0',
  border: '#E5E0DB',
  accent: '#1A1A1A',
  success: '#2E7D32',
  white: '#FFFFFF',
};

export const fonts = {
  h1: { fontSize: 32 as const, fontWeight: '700' as const, color: colors.text },
  h2: { fontSize: 22 as const, fontWeight: '700' as const, color: colors.text },
  body: { fontSize: 16 as const, color: colors.text },
  caption: { fontSize: 12 as const, color: colors.textMuted, textTransform: 'uppercase' as const, letterSpacing: 1 },
  amount: { fontSize: 40 as const, fontWeight: '300' as const, color: colors.textLight, fontVariant: ['tabular-nums' as const] },
};

export const XRP_TO_USD = 2.50;
export const usd = (xrp: number) => `$${(xrp * XRP_TO_USD).toFixed(2)}`;

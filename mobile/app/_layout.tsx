import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#0a0e1a' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: '#0a0e1a' },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="dashboard" options={{ title: 'TapYield', headerBackVisible: false }} />
        <Stack.Screen name="deposit" options={{ title: 'Deposit' }} />
        <Stack.Screen name="goal/create" options={{ title: 'New Goal' }} />
        <Stack.Screen name="pay" options={{ title: 'Pay' }} />
        <Stack.Screen name="register-card" options={{ title: 'Register Card' }} />
      </Stack>
    </>
  );
}

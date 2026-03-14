import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#F5F0EB' },
          headerTintColor: '#1A1A1A',
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: '#F5F0EB' },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="dashboard" options={{ headerShown: false }} />
        <Stack.Screen name="deposit" options={{ title: 'Deposit' }} />
        <Stack.Screen name="goal/create" options={{ title: 'New Goal' }} />
        <Stack.Screen name="goal/[id]" options={{ title: '' }} />
        <Stack.Screen name="pay" options={{ title: '' }} />
        <Stack.Screen name="activity" options={{ title: 'Activity', headerShown: false }} />
        <Stack.Screen name="register-card" options={{ title: 'Register Card' }} />
      </Stack>
    </>
  );
}

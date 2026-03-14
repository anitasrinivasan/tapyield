import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#E6E6E6' },
          headerTintColor: '#000000',
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: '#E6E6E6' },
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

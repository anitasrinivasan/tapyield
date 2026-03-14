import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#EBEBEB' },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="dashboard" />
        <Stack.Screen name="card" />
        <Stack.Screen name="goal/[id]" />
        <Stack.Screen name="goal/create" />
        <Stack.Screen name="deposit" options={{ headerShown: true, title: 'Add Funds', headerStyle: { backgroundColor: '#EBEBEB' }, headerTintColor: '#111', headerShadowVisible: false }} />
        <Stack.Screen name="pay" />
        <Stack.Screen name="register-card" options={{ headerShown: true, title: 'Register Card', headerStyle: { backgroundColor: '#EBEBEB' }, headerTintColor: '#111', headerShadowVisible: false }} />
      </Stack>
    </>
  );
}

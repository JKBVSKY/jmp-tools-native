import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

// this is _layout from root/app/(auth)/_layout.jsx
export default function AuthLayout() {
  return (
    <>
        <StatusBar barStyle="auto" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="welcome" />
          <Stack.Screen name="login" />
          <Stack.Screen name="register" />
        </Stack>
    </>
  );
}

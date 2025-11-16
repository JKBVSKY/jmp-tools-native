import 'react-native-gesture-handler';
import { Stack, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '../_context/AuthContext';
import { ThemeProvider } from '../_context/ThemeContext';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { CalculatorProvider } from '../_context/CalculatorContext';

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!user && !inAuthGroup) {
      router.replace('/(auth)/welcome');
    } else if (user && inAuthGroup) {
      router.replace('/(app)');
    }
    SplashScreen.hideAsync();
  }, [user, segments, isLoading]);

  return (
    <ThemeProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" options={{ gestureEnabled: false }} />
        <Stack.Screen name="(app)" />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
          <CalculatorProvider>
            <RootLayoutNav />
          </CalculatorProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
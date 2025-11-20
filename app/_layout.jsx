import 'react-native-gesture-handler';

import { Stack, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '../_context/AuthContext';
import { ThemeProvider } from '../_context/ThemeContext';
import { UserProfileProvider } from '../_context/UserProfileContext';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { CalculatorProvider } from '../_context/CalculatorContext';
import * as NavigationBar from 'expo-navigation-bar';
import { Colors } from '../constants/Colors';
import { useThemeContext } from '../_context/ThemeContext';

SplashScreen.preventAutoHideAsync();

// this is _layout from root/app/_layout.jsx
function RootLayoutNav() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const { theme } = useThemeContext();

  // Set navigation bar color when theme changes
  useEffect(() => {
    const setNavBar = async () => {
      try {
        const navBarColor = Colors[theme].background;
        await NavigationBar.setBackgroundColorAsync(navBarColor);
        await NavigationBar.setButtonStyleAsync(theme === 'dark' ? 'light' : 'dark');
      } catch (error) {
        console.log('Navigation bar customization not supported on this device');
      }
    };
    setNavBar();
  }, [theme]);

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

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <ThemeProvider>
          <UserProfileProvider>
            <CalculatorProvider>
              <RootLayoutNav />
            </CalculatorProvider>
          </UserProfileProvider>
        </ThemeProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
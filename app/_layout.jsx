import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { CalculatorProvider } from '../context/CalculatorContext';
import { ThemeProvider, useThemeContext } from '../context/ThemeContext';
import { UserProfileProvider } from '../context/UserProfileContext';
import { useColors } from '../hooks/useColors';
import CalculatorHeaderTitle from './calculator_content/shared/CalculatorHeaderTitle';
import {
  attachNotificationListeners,
  attachPushTokenRefreshListener,
  registerForPushNotificationsAsync,
  saveUserPushTokenAsync,
} from '../services/NotificationService';

// inside app/_layout.jsx
function RootNavigator() {
  const { isLoading, user } = useAuth();
  const { theme } = useThemeContext();
  const colors = useColors();

  useEffect(() => {
    let isMounted = true;

    if (user?.id) {
      registerForPushNotificationsAsync().then(async ({ token, error }) => {
        if (!isMounted) {
          return;
        }

        if (token) {
          console.log('Expo push token:', token);
          await saveUserPushTokenAsync(user.id, token);
          console.log('Push token synced for user:', user.id);
        }

        if (error) {
          console.log('Push setup:', error);
        }
      });
    }

    const detachTokenRefreshListener = attachPushTokenRefreshListener(async (token) => {
      if (!user?.id || !isMounted) {
        return;
      }
      await saveUserPushTokenAsync(user.id, token);
      console.log('Push token refreshed and synced for user:', user.id);
    });

    const detachListeners = attachNotificationListeners({
      onNotification: (notification) => {
        console.log('Notification received:', notification.request.identifier);
      },
      onResponse: (response) => {
        console.log('Notification response:', response.actionIdentifier);
      },
    });

    return () => {
      isMounted = false;
      detachTokenRefreshListener();
      detachListeners();
    };
  }, [user?.id]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <>
      <StatusBar
        style={theme === 'dark' ? 'light' : 'dark'}
        backgroundColor={theme === 'dark' ? '#000000' : '#ffffff'}
        translucent={false}
      />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: colors.background },
          headerStyle: { backgroundColor: colors.navBackground },
          headerTintColor: colors.title,
          headerTitleStyle: { fontWeight: '700' },
          headerShadowVisible: false,
        }}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="misc/timeConverter"
          options={{ title: 'Przelicznik czasu', headerShown: true }}
        />
        <Stack.Screen
          name="misc/scoreSimulator"
          options={{ title: 'Symulator wyniku', headerShown: true }}
        />
        <Stack.Screen
          name="misc/ScheduleScreen"
          options={{ title: 'Harmonogram', headerShown: true }}
        />
        <Stack.Screen
          name="misc/ReportsScreen"
          options={{ title: 'Zgłoszenia', headerShown: true }}
        />
        <Stack.Screen
          name="calculator_content/calculator"
          options={{
            headerShown: true,
            headerTitle: () => <CalculatorHeaderTitle />,
            headerTitleAlign: 'left',
            headerBackTitleVisible: false,
            headerStyle: { backgroundColor: colors.navBackground, height: 102 },
          }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <UserProfileProvider>
              <CalculatorProvider>
                <RootNavigator />
              </CalculatorProvider>
            </UserProfileProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { CalculatorProvider } from '../context/CalculatorContext';
import { ThemeProvider, useThemeContext } from '../context/ThemeContext';
import { UserProfileProvider } from '../context/UserProfileContext';
import { useColors } from '../hooks/useColors';
import CalculatorHeaderTitle from './calculator_content/shared/CalculatorHeaderTitle';
import StartupLoadingScreen from '../components/StartupLoadingScreen';
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
  const [isNotificationsReady, setIsNotificationsReady] = useState(false);
  const [pushToken, setPushToken] = useState(null);

  useEffect(() => {
    let isMounted = true;

    registerForPushNotificationsAsync()
      .then(({ token, error }) => {
        if (!isMounted) {
          return;
        }

        if (token) {
          console.log('Expo push token:', token);
          setPushToken(token);
        }

        if (error) {
          console.log('Push setup:', error);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsNotificationsReady(true);
        }
      });

    const detachTokenRefreshListener = attachPushTokenRefreshListener(async (token) => {
      if (!isMounted) {
        return;
      }

      console.log('Expo push token refreshed:', token);
      setPushToken(token);
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
  }, []);

  useEffect(() => {
    if (!user?.id || !pushToken) {
      return;
    }

    saveUserPushTokenAsync(user.id, pushToken)
      .then(() => {
        console.log('Push token synced for user:', user.id);
      })
      .catch((error) => {
        console.log('Push token sync error:', error?.message ?? String(error));
      });
  }, [user?.id, pushToken]);

  if (!isNotificationsReady || isLoading) {
    return <StartupLoadingScreen subtitle="Restoring your session..." />;
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
        <Stack.Screen
          name="misc/Mapping"
          options={{ title: 'Lokalizator Palet', headerShown: true }}
        />
        <Stack.Screen
          name="misc/WarehouseMap"
          options={{ title: 'Mapa Magazynu', headerShown: false
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
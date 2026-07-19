import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { CalculatorProvider } from '../context/CalculatorContext';
import { ThemeProvider, useThemeContext } from '../context/ThemeContext';
import { UserProfileProvider } from '../context/UserProfileContext';
import { useColors } from '../hooks/useColors';

// inside app/_layout.jsx
function RootNavigator() {
  const { isLoading } = useAuth();
  const { theme } = useThemeContext();
  const colors = useColors();

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
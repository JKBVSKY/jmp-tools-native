import { Redirect, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useThemeContext } from '../../context/ThemeContext';

export default function AuthLayout() {
  const { user, isLoading } = useAuth();
  const { theme } = useThemeContext();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

if (user) {
  return <Redirect href="/" />;
}

  return (
    <>
      <StatusBar
        style={theme === 'dark' ? 'light' : 'dark'}
        backgroundColor={theme === 'dark' ? '#000000' : '#ffffff'}
        translucent={false}
      />
      <Stack
        initialRouteName="welcome"
        screenOptions={{ headerShown: false }}
      />
    </>
  );
}
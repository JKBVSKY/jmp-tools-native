import { Redirect, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../../context/AuthContext';
import { useThemeContext } from '../../context/ThemeContext';
import StartupLoadingScreen from '../../components/StartupLoadingScreen';

export default function AuthLayout() {
  const { user, isLoading } = useAuth();
  const { theme } = useThemeContext();

  if (isLoading) {
    return <StartupLoadingScreen subtitle="Preparing login..." />;
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
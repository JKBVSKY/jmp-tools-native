import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { useThemeContext } from '../../_context/ThemeContext';
import { useColors } from '../../_hooks/useColors';
import { StatusBar } from 'expo-status-bar';
import ThemedView from '../../components/ThemedView';
import { useAuth } from '../../_context/AuthContext';
import { useRouter } from 'expo-router';

export default function Dashboard() {
  const colors = useColors(); // colors = Colors.light or Colors.dark
  const { user, isGuest, signOut } = useAuth();
  const router = useRouter();

  const handleCreateAccount = async () => {
    await signOut(); // Sign them out of guest mode
    router.push('/(auth)/register');
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>

      {/* Top content */}
      {isGuest && (
        <View style={[styles.guestBanner, { backgroundColor: colors.guestBackground }]}>
          <Text style={[styles.guestText, { color: colors.guestText }]}>
            You're in guest mode. Sign up to save your data!
          </Text>
          <Pressable
            style={[styles.upgradeButton, { backgroundColor: colors.butBackground }]}
            onPress={handleCreateAccount}
          >
            <Text style={[styles.upgradeText, { color: colors.butText }] }>Create Account</Text>
          </Pressable>
        </View>
      )}

      {/* Center content wrapper */}
      <View style={styles.centerContent}>
        <Text style={[styles.welcome, { color: colors.text }]}>Welcome, {user?.name || 'User'}!</Text>
        <Text style={{ color: colors.text }}>Your productivity at a glance</Text>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 32,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  welcome: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  guestBanner: {
    backgroundColor: '#FFF3CD',
    padding: 15,
    borderRadius: 8,
  },
  guestText: {
    color: '#856404',
    marginBottom: 10,
  },
  upgradeButton: {
    backgroundColor: '#c50000',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  upgradeText: {
    color: '#fff',
    fontWeight: '600',
  },
  logoutButton: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
    width: '50%',
    alignSelf: 'center',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
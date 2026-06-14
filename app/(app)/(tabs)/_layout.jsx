import React, { useState } from 'react';
import { Tabs } from 'expo-router/tabs';
import { Ionicons } from '@expo/vector-icons';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useColors } from '@/_hooks/useColors';
import { useAuth } from '@/_context/AuthContext';

// inside app/(app)/(tabs)/_layout.jsx
export default function TabLayout() {
  const [menuVisible, setMenuVisible] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { signOut } = useAuth();
  const colors = useColors();

  const isWeb = Platform.OS === 'web';

  const openMenu = () => setMenuVisible(true);
  const closeMenu = () => setMenuVisible(false);

  const goTo = (path) => {
    closeMenu();
    router.push(path);
  };

  const isRouteActive = (segment) => pathname?.includes(segment);

  const handleLogout = async () => {
    closeMenu();
    await signOut();
    router.replace('/(auth)/welcome');
  };

  return (
    <>
      <View
        style={{
          flex: 1,
          flexDirection: isWeb ? 'row' : 'column',
          backgroundColor: colors.background,
        }}
      >
        {/* WEB: left side navigation */}
        {isWeb && (
          <View
            style={[
              styles.sidebar,
              { backgroundColor: colors.navBackground || colors.botBarBackground },
            ]}
          >
            <Text style={[styles.sidebarTitle, { color: colors.textSecondary }]}>
              Nawigacja
            </Text>

            <Pressable
              onPress={() => goTo('/(app)/(tabs)/scoreHistory')}
              style={({ pressed }) => [
                styles.sidebarItem,
                isRouteActive('scoreHistory') && styles.sidebarItemActive,
                pressed && styles.sidebarItemPressed,
              ]}
            >
              <Ionicons
                name="analytics-outline"
                size={22}
                color={colors.iconColor}
                style={styles.sidebarIcon}
              />
              <Text style={[styles.sidebarLabel, { color: colors.text }]}>Statystyki</Text>
            </Pressable>

            <Pressable
              onPress={() => goTo('/(app)/(tabs)/leaderboards')}
              style={({ pressed }) => [
                styles.sidebarItem,
                isRouteActive('leaderboards') && styles.sidebarItemActive,
                pressed && styles.sidebarItemPressed,
              ]}
            >
              <Ionicons
                name="trophy-outline"
                size={22}
                color={colors.iconColor}
                style={styles.sidebarIcon}
              />
              <Text style={[styles.sidebarLabel, { color: colors.text }]}>Ranking</Text>
            </Pressable>

            <Pressable
              onPress={() => goTo('/')}
              style={({ pressed }) => [
                styles.sidebarItem,
                isRouteActive('tabs') || isRouteActive('index'),
                pressed && styles.sidebarItemPressed,
              ]}
            >
              <Ionicons
                name="grid-outline"
                size={22}
                color={colors.iconColor}
                style={styles.sidebarIcon}
              />
              <Text style={[styles.sidebarLabel, { color: colors.text }]}>Panel Główny</Text>
            </Pressable>

            <Pressable
              onPress={() => goTo('/(app)/(tabs)/profile')}
              style={({ pressed }) => [
                styles.sidebarItem,
                isRouteActive('profile') && styles.sidebarItemActive,
                pressed && styles.sidebarItemPressed,
              ]}
            >
              <Ionicons
                name="person-circle-outline"
                size={22}
                color={colors.iconColor}
                style={styles.sidebarIcon}
              />
              <Text style={[styles.sidebarLabel, { color: colors.text }]}>Profil</Text>
            </Pressable>

            <View style={styles.sidebarDivider} />

            <Pressable
              onPress={openMenu}
              style={({ pressed }) => [
                styles.sidebarItem,
                pressed && styles.sidebarItemPressed,
              ]}
            >
              <Ionicons
                name="ellipsis-horizontal"
                size={22}
                color={colors.iconColor}
                style={styles.sidebarIcon}
              />
              <Text style={[styles.sidebarLabel, { color: colors.text }]}>Więcej</Text>
            </Pressable>
          </View>
        )}

        {/* Main content with Tabs. On web, tab bar is hidden; navigation is via sidebar. */}
        <View style={{ flex: 1 }}>
          <Tabs
            screenOptions={{
              initialRouteName: 'index',
              headerShown: false,
              tabBarActiveTintColor: 'red',
              tabBarInactiveTintColor: colors.tabInactive || '#9ca3af',
              tabBarStyle: {
                height: 70,
                backgroundColor: colors.botBarBackground,
                borderTopColor: 'transparent',
                overflow: 'hidden',
                ...(isWeb ? { display: 'none' } : null), // hide bar on web
              },
              tabBarLabelPosition: 'below-icon',
              tabBarLabelStyle: {
                fontSize: 10,
                lineHeight: 14,
                textAlign: 'center',
              },
              tabBarIconStyle: Platform.OS === 'web' ? { marginBottom: 2 } : undefined,
              tabBarItemStyle: Platform.OS === 'web'
                ? {
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 4,
                }
                : undefined,
              unmountOnBlur: true,
            }}
          >
            <Tabs.Screen
              name="scoreHistory"
              options={{
                title: 'Statystyki',
                tabBarIcon: ({ color }) => (
                  <Ionicons name="analytics-outline" size={28} color={color} />
                ),
              }}
            />
            <Tabs.Screen
              name="leaderboards"
              options={{
                title: 'Ranking',
                tabBarIcon: ({ color }) => (
                  <Ionicons name="trophy-outline" size={28} color={color} />
                ),
              }}
            />
            <Tabs.Screen
              name="index"
              options={{
                title: 'Panel Główny',
                tabBarIcon: ({ color }) => (
                  <Ionicons name="grid-outline" size={28} color={color} />
                ),
              }}
            />
            <Tabs.Screen
              name="profile"
              options={{
                title: 'Profil',
                tabBarIcon: ({ color }) => (
                  <Ionicons name="person-circle-outline" size={28} color={color} />
                ),
              }}
            />
            {/* Three-dots "More" tab – still used for mobile bottom bar */}
            <Tabs.Screen
              name="more"
              options={{
                title: 'Więcej',
                tabBarIcon: ({ color }) => (
                  <Ionicons name="ellipsis-horizontal" size={22} color={color} />
                ),
              }}
            />
          </Tabs>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  moreButton: {
    flex: 1,
    alignItems: 'center',
  },
  moreLabel: {
    fontSize: 10,
    lineHeight: 12,
    marginTop: 2,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 600 : '100%',
    alignSelf: 'center',
    paddingTop: 8,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginBottom: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  menuLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 8,
  },

  // --- WEB SIDEBAR STYLES ---
  sidebar: {
    width: 240,
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderRightWidth: 1,
    borderRightColor: 'rgba(0,0,0,0.06)',
    gap: 4,
  },
  sidebarTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 4,
  },
  sidebarItemActive: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  sidebarItemPressed: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  sidebarIcon: {
    marginRight: 10,
  },
  sidebarLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  sidebarDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginVertical: 10,
  },
});

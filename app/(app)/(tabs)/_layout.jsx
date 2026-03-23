import React, { useState } from 'react';
import { Tabs } from 'expo-router/tabs';
import { Ionicons } from '@expo/vector-icons';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useColors } from '@/_hooks/useColors';
import { useAuth } from '@/_context/AuthContext';

// inside app/(app)/(tabs)/_layout.jsx
export default function TabLayout() {
  const [menuVisible, setMenuVisible] = useState(false);
  const router = useRouter();
  const { signOut } = useAuth();
  const colors = useColors();

  const openMenu = () => setMenuVisible(true);
  const closeMenu = () => setMenuVisible(false);

  const goTo = (path) => {
    closeMenu();
    router.push(path);
  };

  const handleLogout = async () => {
    closeMenu();
    await signOut();
    router.replace('/(auth)/login');
  };

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: 'red',
          tabBarInactiveTintColor: colors.tabInactive || '#9ca3af',
          tabBarStyle: {
            height: 70,
            backgroundColor: colors.botBarBackground,
            borderTopColor: colors.border,
          }, // larger for thumbs
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Panel Główny',
            tabBarIcon: ({ color }) => <Ionicons name="grid-outline" size={28} color={color} />,
          }}
        />
        <Tabs.Screen
          name="scoreHistory"
          options={{
            title: 'Statystyki',
            tabBarIcon: ({ color }) => <Ionicons name="analytics-outline" size={28} color={color} />,
          }}
        />
        <Tabs.Screen
          name="calculator"
          options={{
            title: 'Załadunek',
            tabBarIcon: ({ color }) => <Ionicons name="calculator-outline" size={28} color={color} />,
          }}
        />
        <Tabs.Screen
          name="leaderboards"
          options={{
            title: 'Ranking',
            tabBarIcon: ({ color }) => <Ionicons name="trophy-outline" size={28} color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profil',
            tabBarIcon: ({ color }) => <Ionicons name="person-circle-outline" size={28} color={color} />,
          }}
        />
        {/* Three-dots "More" tab */}
        <Tabs.Screen
          name="more"
          options={{
            title: 'Więcej',
            tabBarIcon: ({ color }) => (
              <Ionicons
                name="ellipsis-horizontal"
                size={28}
                color={color}
              />
            ),
            // custom button that opens menu instead of navigating
            tabBarButton: (props) => (
              <Pressable
                {...props}
                onPress={openMenu}
                style={[
                  props.style,
                  styles.moreButton,
                ]}
              >
                <Ionicons
                  name="ellipsis-horizontal"
                  size={28}
                  color={
                    props.accessibilityState?.selected
                      ? colors.tabActive || 'blue'
                      : colors.tabInactive || '#9ca3af'
                  }
                />
                <Text style={[styles.moreLabel, { color: colors.tabInactive || '#9ca3af' }]}>
                  Więcej
                </Text>
              </Pressable>
            ),
          }}
        />
      </Tabs>

      {/* Slide-up menu */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={closeMenu}
      >
        <View style={styles.modalRoot}>
          {/* Dark backdrop */}
          <Pressable style={styles.backdrop} onPress={closeMenu} />

          {/* Bottom sheet */}
          <View style={[styles.sheet, { backgroundColor: colors.cardBackground || '#111827' }]}>
            <View style={styles.handle} />

            <MenuItem
              label="Przeliczanie Średniej"
              icon="calculator-outline"
              onPress={() => goTo('/(app)/misc/scoreSimulator')}
              colors={colors}
            />
            <MenuItem
              label="Konwerter Czasu"
              icon="time-outline"
              onPress={() => goTo('/(app)/misc/timeConverter')}
              colors={colors}
            />
            <MenuItem
              label="O aplikacji"
              icon="information-circle-outline"
              onPress={() => goTo('/(app)/misc/about')}
              colors={colors}
            />
            <MenuItem
              label="Changelog"
              icon="document-text-outline"
              onPress={() => goTo('/(app)/misc/changelog')}
              colors={colors}
            />
            <MenuItem
              label="Kontakt"
              icon="chatbubble-ellipses-outline"
              onPress={() => goTo('/(app)/misc/contact')}
              colors={colors}
            />
            <MenuItem
              label="Ustawienia"
              icon="settings-outline"
              onPress={() => goTo('/(app)/misc/settings')}
              colors={colors}
            />
            <View style={styles.divider} />

            <MenuItem
              label="Wyloguj się"
              icon="log-out-outline"
              onPress={handleLogout}
              colors={colors}
              danger
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

function MenuItem({ label, icon, onPress, colors, danger = false }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuItem,
        {
          backgroundColor: pressed
            ? colors.pressBackground || 'rgba(255,255,255,0.06)'
            : 'transparent',
        },
      ]}
    >
      <Ionicons
        name={icon}
        size={22}
        color={danger ? '#ef4444' : colors.iconColor || '#e5e7eb'}
        style={{ marginRight: 12 }}
      />
      <Text
        style={[
          styles.menuLabel,
          { color: danger ? '#ef4444' : colors.text || '#e5e7eb' },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  moreButton: {
    flex: 1,
    alignItems: 'center',
  },
  moreLabel: {
    fontSize: 10,
    marginTop: 14,
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
});

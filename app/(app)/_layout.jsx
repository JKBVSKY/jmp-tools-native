import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeContext } from '../../_context/ThemeContext';
import { useColors } from '../../_hooks/useColors';
import Colors from '../../constants/Colors';
import { StatusBar } from 'expo-status-bar';
import CustomDrawerContent from './customDrawerContent';

import Dashboard from './index';
import ScoreHistory from './scoreHistory';
import Settings from './settings';
import Changelog from './changelog';
import About from './about';
import Contact from './contact';
import Calculator from '../calculator/Calculator';

// this is _layout from root/app/(app)/_layout.jsx
const Drawer = createDrawerNavigator();

function DrawerScreens() {
  const { theme, toggleTheme } = useThemeContext();
  const colors = useColors();

  return (
    <>
      <StatusBar style="light" backgroundColor={colors.navBackground} />
      <Drawer.Navigator
        initialRouteName="Dashboard"
        drawerContent={(props) => <CustomDrawerContent {...props} />}
        screenOptions={{
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: colors.navBackground },
          headerTintColor: colors.navText,
          drawerActiveBackgroundColor: colors.draActiveBackground,
          drawerActiveTintColor: colors.draActiveText,
          drawerInactiveTintColor: colors.text,
          drawerLabelStyle: { fontSize: 16 },
          drawerStyle: { backgroundColor: colors.draBackground },
          swipeEnabled: true,
          edgeWidth: 100,
          headerRight: () => (
      <TouchableOpacity
        onPress={toggleTheme}
        style={{ marginRight: 16 }}
      >
        <Ionicons
          name={theme === 'dark' ? 'sunny-outline' : 'moon-outline'}
          size={24}
          color={colors.navText}
        />
      </TouchableOpacity>
      ),
        }}
      >
      <Drawer.Screen
        name="Dashboard"
        component={Dashboard}
        options={{
          drawerIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" size={size} color={color} />
          ),
        }}
      />

      <Drawer.Screen
        name="Calculator"
        component={Calculator}
        options={{
          drawerIcon: ({ color, size }) => (
            <Ionicons name="calculator-outline" size={size} color={color} />
          ),
        }}
      />

      <Drawer.Screen
        name="ScoreHistory"
        component={ScoreHistory}
        options={{
          drawerIcon: ({ color, size }) => (
            <Ionicons name="analytics-outline" size={size} color={color} />
          ),
        }}
      />

      <Drawer.Screen
        name="Settings"
        component={Settings}
        options={{
          drawerIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />

      <Drawer.Screen
        name="Changelog"
        component={Changelog}
        options={{
          drawerIcon: ({ color, size }) => (
            <Ionicons name="document-text-outline" size={size} color={color} />
          ),
        }}
      />

      <Drawer.Screen
        name="About"
        component={About}
        options={{
          drawerIcon: ({ color, size }) => (
            <Ionicons name="information-circle-outline" size={size} color={color} />
          ),
        }}
      />

      <Drawer.Screen
        name="Contact"
        component={Contact}
        options={{
          drawerIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-ellipses-outline" size={size} color={color} />
          ),
        }}
      />
    </Drawer.Navigator >
    </>

  );
}

export default function RootLayout() {
  return (
    <DrawerScreens />
  );
}
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
import Profile from './profile/index';

// this is _layout from root/app/(app)/_layout.jsx
const Drawer = createDrawerNavigator();

function DrawerScreens() {
  const { theme, toggleTheme } = useThemeContext();
  const colors = useColors();

  return (
    <>
      <StatusBar style={colors.statusBar}/>
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
          gestureEnabled: true,
          swipeEdgeWidth: 200,
          drawerHideStatusBarOnOpen: false,
          swipeVelocityThreshold: 1000,  // Must swipe this fast to trigger snap
          swipeMinDistance: 10,
          gestureVelocityImpact: 0.3, // Lower = velocity matters more
          gestureResponseDistance: 100, // How far before gesture registers
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

        <Drawer.Screen
          name="Profile"
          component={Profile}
          options={{
            drawerIcon: ({ color, size }) => (
              <Ionicons name="person-circle-outline" size={size} color={color} />
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

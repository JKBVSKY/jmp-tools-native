import React from 'react';
import { Tabs } from 'expo-router/tabs';
import { Ionicons } from '@expo/vector-icons';

// inside app/(app)/(tabs)/_layout.jsx
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: 'blue',
        tabBarStyle: { height: 70 }, // larger for thumbs
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
        name="timeConverter"
        options={{
          title: 'Konwerter',
          tabBarIcon: ({ color }) => <Ionicons name="time-outline" size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color }) => <Ionicons name="person-circle-outline" size={28} color={color} />,
        }}
      />
    </Tabs>
  );
}

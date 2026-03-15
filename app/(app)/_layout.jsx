// app/(app)/_layout.jsx
import React from 'react';
import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* (tabs) group as the main app UI */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

      {/* misc screens stay in this stack, not in tabs */}
      <Stack.Screen name="misc/about" options={{ title: 'O aplikacji' }} />
      <Stack.Screen name="misc/settings" options={{ title: 'Ustawienia' }} />
      <Stack.Screen name="misc/contact" options={{ title: 'Kontakt' }} />
      <Stack.Screen name="misc/changelog" options={{ title: 'Changelog' }} />
    </Stack>
  );
}

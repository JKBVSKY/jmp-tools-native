// app/(app)/_layout.jsx
import React from 'react';
import { Stack } from 'expo-router';
import { useColors } from '@/_hooks/useColors';
import { Platform, View } from 'react-native';

export default function AppLayout() {
  const colors = useColors();
  const webContainer = Platform.OS === 'web' ? {
    flex: 1,
    marginHorizontal: 'auto',
    width: '100%',
  } : { flex: 1 };
  return (
    <View style={{ flex: 1, width: '100%', backgroundColor: colors.background }}>
      <View style={webContainer}>
        <Stack
          screenOptions={{
            headerStyle: {
              backgroundColor: colors.navBackground, // ciemny/jasny zależnie od motywu
            },
            headerTintColor: colors.navText,         // kolor tekstu/ikon
            headerTitleStyle: {
              fontWeight: '600',
              color: colors.navText ?? colors.navBackground, // fallback na navBackground jeśli navText jest undefined
            },
          }}
        >
          {/* (tabs) group as the main app UI */}
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

          {/* misc screens stay in this stack, not in tabs */}
          <Stack.Screen name="misc/about" options={{ title: 'O aplikacji' }} />
          <Stack.Screen name="misc/settings" options={{ title: 'Ustawienia' }} />
          <Stack.Screen name="misc/contact" options={{ title: 'Kontakt' }} />
          <Stack.Screen name="misc/changelog" options={{ title: 'Changelog' }} />
          <Stack.Screen name="misc/scoreSimulator" options={{ title: 'Przeliczanie Średniej' }} />
          <Stack.Screen name="misc/timeConverter" options={{ title: 'Konwerter Czasu' }} />
          <Stack.Screen name="calculator_content/calculator" options={{ title: 'Załadunek' }} />
          <Stack.Screen name="misc/ReportsScreen" options={{ title: 'Zgłoszenia' }} />
        </Stack>
      </View>
    </View>
  );
}

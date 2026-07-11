// app/(app)/(tabs)/more.jsx
import React from 'react';
import { View, ScrollView, Text, TouchableOpacity, StyleSheet, Pressable, ActivityIndicator, Image } from 'react-native';
import { useColors } from '@/_hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from 'expo-router';
import { useAuth } from '@/_context/AuthContext';

export default function More() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const router = useRouter();
  const { user, isGuest, signOut } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut();
      router.replace('/(auth)/welcome');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.navBackground, paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <View style={[styles.headerContent]}>
          <Image
            source={require("@/assets/welcome_icon.png")}
            style={[
              styles.logo,
              {
                width: 64,
                height: 64,
                borderWidth: 1,
                borderColor: colors.outButBorder,
              },
            ]}
            resizeMode="contain"
          />
          <Text style={[styles.title, { color: colors.text, alignSelf: 'flex-end' }]}>

          </Text>
        </View>
      </View>
      <View style={styles.content}>

        <View style={styles.section}>
          <Text style={[styles.title, { color: colors.text }]}>Narzędzia</Text>

          <View style={styles.cardsGrid}>

            {/* Kalkulator Średniej */}
            <TouchableOpacity
              style={[styles.card, { backgroundColor: colors.cardButBackground }]}
              activeOpacity={0.8}
              onPress={() => {
                // route to path here
                router.push('/misc/scoreSimulator');
              }}
            >
              <Ionicons name="calculator" size={28} color={colors.iconColor} style={{ marginBottom: 6 }} />
              <Text style={[styles.cardText, { color: colors.text }]}>Kalkulator Średniej</Text>
            </TouchableOpacity>

            {/* Przelicznik Czasu */}
            <TouchableOpacity
              style={[styles.card, { backgroundColor: colors.cardButBackground }]}
              activeOpacity={0.8}
              onPress={() => {
                router.push('/misc/timeConverter');
              }}
            >
              <Ionicons name="time-outline" size={28} color={colors.iconColor} style={{ marginBottom: 6 }} />
              <Text style={[styles.cardText, { color: colors.text }]}>Przelicznik Czasu</Text>
            </TouchableOpacity>

            {/* Harmonogram */}
            <TouchableOpacity
              style={[styles.card, { backgroundColor: colors.cardButBackground }]}
              activeOpacity={0.8}
              onPress={() => {
                router.push('/misc/ScheduleScreen');
              }}
            >
              <MaterialCommunityIcons name="timetable" size={24} color={colors.iconColor} style={{ marginBottom: 6 }} />
              <Text style={[styles.cardText, { color: colors.text }]}>Harmonogram</Text>
            </TouchableOpacity>

            {/* Zgłoszenia */}
            <TouchableOpacity
              style={[styles.card, { backgroundColor: colors.cardButBackground }]}
              activeOpacity={0.8}
              onPress={() => {
                router.push('/misc/ReportsScreen');
              }}
            >
              <Ionicons name="warning" size={28} color={colors.iconColor} style={{ marginBottom: 6 }} />
              <Text style={[styles.cardText, { color: colors.text }]}>Zgłoszenia</Text>
            </TouchableOpacity>

            {/* Szukanie Towaru */}
            <TouchableOpacity
              style={[styles.card, { backgroundColor: colors.disabledButBackground }]}
              activeOpacity={0.8}
            // onPress={() => {
            //   router.push('/misc/goodsFinder');
            // }}
            >
              <Ionicons name="search" size={28} color={colors.grayIconColor} style={{ marginBottom: 6 }} />
              <Text style={[styles.cardText, { color: colors.textSecondary }]}>Szukanie Towaru</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.title, { color: colors.text }]}>Ogólne</Text>

          <View style={styles.cardsGrid}>
            <TouchableOpacity
              style={[styles.card, { backgroundColor: colors.disabledButBackground }]}
              activeOpacity={0.8}
            // onPress={() => {
            //   router.push('/misc/settings');
            // }}
            >
              <Ionicons name="settings" size={28} color={colors.grayIconColor} style={{ marginBottom: 6 }} />
              <Text style={[styles.cardText, { color: colors.textSecondary }]}>Ustawienia</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.card, { backgroundColor: colors.disabledButBackground }]}
              activeOpacity={0.8}
            // onPress={() => {
            //   router.push('/misc/about');
            // }}
            >
              <Ionicons name="information-circle" size={28} color={colors.grayIconColor} style={{ marginBottom: 6 }} />
              <Text style={[styles.cardText, { color: colors.textSecondary }]}>O aplikacji</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.card, { backgroundColor: colors.disabledButBackground }]}
              activeOpacity={0.8}
            // onPress={() => {
            //   router.push('/misc/help');
            // }}
            >
              <Ionicons name="help-circle" size={28} color={colors.grayIconColor} style={{ marginBottom: 6 }} />
              <Text style={[styles.cardText, { color: colors.textSecondary }]}>Pomoc</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.card, { backgroundColor: colors.cardButBackground }]}
              activeOpacity={0.8}
              onPress={handleLogout}
            >
              <Ionicons name="log-out" size={28} color={colors.iconColor} style={{ marginBottom: 6 }} />
              <Text style={[styles.cardText, { color: colors.text }]}>Wyloguj</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    gap: 24,
    paddingHorizontal: 16,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    marginBottom: 16,
    borderBottomWidth: 1,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 8,
  },
  section: {
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginHorizontal: 8,
    marginTop: 8,
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginHorizontal: 8,
  },
  card: {
    height: 100,
    width: '48%',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    textAlign: 'center',
  },
});
import React from 'react';
import { View, Text, StyleSheet, Image, ScrollView } from 'react-native';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../../hooks/useColors';

const About = () => {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const appVersion = Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '0.0.0';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.contentContainer, { paddingTop: insets.top + 12 }]}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.headerCard,
            {
              backgroundColor: colors.navBackground,
              borderColor: colors.border,
            },
          ]}
        >
          <Image
            source={require('../../assets/welcome_icon.png')}
            style={[styles.logo, { borderColor: colors.outButBorder }]}
            resizeMode="contain"
          />

          <Text style={[styles.title, { color: colors.text }]}>JMP Tools</Text>

          <View style={[styles.versionPill, { backgroundColor: colors.outButBackground, borderColor: colors.outButBorder }]}>
            <Text style={[styles.versionText, { color: colors.textSecondary }]}>v{appVersion}</Text>
          </View>
        </View>

        <View
          style={[
            styles.descriptionCard,
            {
              backgroundColor: colors.cardBackground,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.descriptionTitle, { color: colors.text }]}>O aplikacji</Text>

          <Text style={[styles.description, { color: colors.textSecondary }]}>
            JMP Tools to mobilna aplikacja stworzona z myślą o pracownikach magazynowych,
            którzy chcą śledzić, analizować i poprawiać swoją codzienną wydajność.
          </Text>

          <Text style={[styles.description, { color: colors.textSecondary }]}>
            Aplikacja umożliwia zapisywanie sesji pracy, monitorowanie efektywności oraz
            przeglądanie statystyk w różnych zakresach czasowych - dziennych, miesięcznych
            i ogólnych. Dzięki temu możesz łatwo zobaczyć, jak rozwijasz się na przestrzeni czasu.
          </Text>

          <Text style={[styles.description, { color: colors.textSecondary }]}>
            Oprócz podstawowego trackingu, JMP Tools oferuje gamifikację - system poziomów
            i osiągnięć, który motywuje do regularnej pracy i poprawy wyników. Dostępne są
            także wbudowane narzędzia obliczeniowe, przydatne podczas codziennych zadań
            magazynowych, oraz rozbudowany panel statystyk z wykresami i podsumowaniami.
          </Text>

          <Text style={[styles.description, { color: colors.textSecondary }]}>
            Aplikacja została napisana w React Native (Expo) i wykorzystuje Firebase
            (uwierzytelnianie + Firestore) do bezpiecznego przechowywania sesji i statystyk.
          </Text>

          {/* <Text style={[styles.description, { color: colors.textSecondary }]}>
            Jeśli przeglądasz ten ekran jako rekruter lub osoba zainteresowana współpracą,
            JMP Tools to projekt pokazujący umiejętność budowania pełnoprawnych aplikacji
            mobilnych: od architektury, przez integrację z backendem, po UX/UI i gamifikację.
          </Text>

          <Text style={[styles.contact, { color: colors.text }]}>Kontakt: [Twój email / GitHub / LinkedIn]</Text> */}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    gap: 16,
  },
  headerCard: {
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 18,
    paddingHorizontal: 16,
  },
  logo: {
    width: 96,
    height: 96,
    marginBottom: 10,
    borderWidth: 1,
    borderRadius: 18,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 0.3,
    marginBottom: 10,
  },
  versionPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  versionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  descriptionCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 18,
    gap: 12,
  },
  descriptionTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 2,
  },
  description: {
    fontSize: 15,
    lineHeight: 23,
  },
  contact: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 4,
  },
});

export default About;
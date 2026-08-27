// app/setup.jsx
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useUserProfile } from '../context/UserProfileContext';
import { db } from '../firebase/config';
import { useColors } from '../hooks/useColors';

const SECTION_OPTIONS = [
  { id: 'zaladunek', label: 'Załadunek' },
  { id: 'kompletacja', label: 'Kompletacja' },
];

export default function SetupScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user, isGuest } = useAuth();
  const {
    profile,
    isLoading: profileLoading,
    loadUserProfile,
  } = useUserProfile();

  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);
  const [initialChecked, setInitialChecked] = useState(false);

  // Decide if this screen should show at all
  useEffect(() => {
    if (!user) {
      // If somehow no user, send to auth
      router.replace('/(auth)/welcome');
      return;
    }

    if (isGuest) {
      // Guests skip setup and go straight to dashboard
      router.replace('/(tabs)');
      return;
    }

    if (!profile && profileLoading) {
      // Wait for profile to load
      return;
    }

    const hasCompletedSetup = profile?.hasCompletedSetup === true;
    const existingSections = profile?.preferences?.sections;

    if (hasCompletedSetup && Array.isArray(existingSections) && existingSections.length > 0) {
      // Already configured, go to dashboard
      router.replace('/(tabs)');
      return;
    }

    // Pre-fill from existing sections if any, otherwise default to Załadunek
    if (Array.isArray(existingSections) && existingSections.length > 0) {
      setSelected(existingSections);
    } else {
      setSelected(['zaladunek']);
    }

    setInitialChecked(true);
  }, [user, isGuest, profile, profileLoading, router]);

  const toggleSection = (id) => {
    setSelected((prev) => {
      if (prev.includes(id)) {
        // Prevent disabling the last remaining section
        if (prev.length === 1) {
          return prev;
        }
        return prev.filter((s) => s !== id);
      }

      // Max two sections
      if (prev.length === 2) {
        return prev;
      }

      return [...prev, id];
    });
  };

  const handleSave = async () => {
    if (!user?.id) {
      Alert.alert('Błąd', 'Nie znaleziono aktywnego użytkownika.');
      return;
    }

    if (selected.length === 0) {
      Alert.alert(
        'Wybór sekcji',
        'Wybierz przynajmniej jedną sekcję, z którą pracujesz.'
      );
      return;
    }

    try {
      setSaving(true);
      const userRef = doc(db, 'users', user.id);

      await updateDoc(userRef, {
        hasCompletedSetup: true,
        'preferences.sections': selected,
      });

      if (loadUserProfile) {
        await loadUserProfile(user.id);
      }

      router.replace('/(tabs)');
    } catch (error) {
      console.error('Error saving setup preferences', error);
      Alert.alert(
        'Błąd',
        'Nie udało się zapisać ustawień. Spróbuj ponownie.'
      );
    } finally {
      setSaving(false);
    }
  };

  if (!initialChecked || profileLoading) {
    return (
      <View
        style={[
          styles.center,
          { backgroundColor: colors.background },
        ]}
      >
        <ActivityIndicator size="large" color={colors.butBackground} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background },
      ]}
    >
      <View style={styles.content}>
        <Text
          style={[
            styles.title,
            { color: colors.title },
          ]}
        >
          Ustawienia profilu
        </Text>
        <Text
          style={[
            styles.subtitle,
            { color: colors.textSecondary },
          ]}
        >
          Wybierz sekcje, w których pracujesz. Dzięki temu statystyki będą
          dopasowane do Twojej pracy.
        </Text>

        <View style={styles.sectionsRow}>
          {SECTION_OPTIONS.map((section) => {
            const isSelected = selected.includes(section.id);
            return (
              <Pressable
                key={section.id}
                onPress={() => toggleSection(section.id)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: isSelected
                      ? colors.butBackground
                      : colors.cardBackground,
                    borderColor: isSelected
                      ? colors.butBorder
                      : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    {
                      color: isSelected
                        ? colors.butText
                        : colors.text,
                    },
                  ]}
                >
                  {section.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text
          style={[
            styles.infoText,
            { color: colors.textSecondary },
          ]}
        >
          Możesz zmienić te ustawienia później w zakładce Ustawienia.
        </Text>
      </View>

      <View style={styles.buttonsRow}>
        <Pressable
          onPress={handleSave}
          style={[
            styles.saveButton,
            {
              backgroundColor:
                selected.length === 0
                  ? colors.disabledButBackground
                  : colors.butBackground,
              borderColor:
                selected.length === 0
                  ? colors.disabledButBorder
                  : colors.butBorder,
            },
          ]}
          disabled={saving || selected.length === 0}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.butText} />
          ) : (
            <Text
              style={[
                styles.saveButtonText,
                {
                  color:
                    selected.length === 0
                      ? colors.disabledButText
                      : colors.butText,
                },
              ]}
            >
              Zapisz i przejdź dalej
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'space-between',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 24,
  },
  sectionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 16,
    fontWeight: '500',
  },
  infoText: {
    fontSize: 14,
    marginTop: 8,
  },
  buttonsRow: {
    paddingVertical: 16,
  },
  saveButton: {
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
// app/setup.jsx
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { useUserProfile } from '../context/UserProfileContext';
import { useColors } from '../hooks/useColors';
import {
  ensureNotificationPermissionsAsync,
  registerForPushNotificationsAsync,
  saveUserPushTokenAsync,
  scheduleCurrentShiftRemindersAsync,
  enableShiftReminders,
} from '../services/NotificationService';

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
    updateUserProfileFields,
  } = useUserProfile();

  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);
  const [initialChecked, setInitialChecked] = useState(false);
  const [currentStep, setCurrentStep] = useState('sections');

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

    if (
      hasCompletedSetup &&
      Array.isArray(existingSections) &&
      existingSections.length > 0 &&
      currentStep === 'sections' &&
      !saving
    ) {
      // Already configured, go to dashboard
      router.replace('/(tabs)');
      return;
    }

    if (!initialChecked) {
      // Pre-fill from existing sections if any, otherwise default to Załadunek
      if (Array.isArray(existingSections) && existingSections.length > 0) {
        setSelected(existingSections);
      } else {
        setSelected(['zaladunek']);
      }

      setInitialChecked(true);
    }
  }, [user, isGuest, profile, profileLoading, initialChecked, currentStep, saving, router]);

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

  const handleSaveSections = async () => {
    if (saving) return;

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
      const updateResult = await updateUserProfileFields({
        'preferences.sections': selected,
        hasCompletedSetup: false,
      });

      if (!updateResult?.success) {
        throw new Error('Nie udało się zapisać wybranych sekcji.');
      }

      setCurrentStep('notifications');
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

  const showNotificationSettingsAlert = () => {
    Alert.alert(
      'Powiadomienia zablokowane',
      `Zezwól na powiadomienia JMP Tools w ${
        Platform.OS === 'android' ? 'ustawieniach Androida' : 'ustawieniach urządzenia'
      }, aby je włączyć.`,
      [
        {
          text: 'Otwórz ustawienia',
          onPress: () => {
            Linking.openSettings().catch((error) => {
              console.error('Błąd otwierania ustawień aplikacji:', error);
              Alert.alert('Błąd', 'Nie udało się otworzyć ustawień aplikacji.');
            });
          },
        },
        { text: 'Anuluj', style: 'cancel' },
      ]
    );
  };

  const showPermissionIssue = (permissionResult) => {
    if (permissionResult.status === 'blocked') {
      showNotificationSettingsAlert();
      return;
    }

    Alert.alert(
      permissionResult.status === 'denied' ? 'Brak uprawnień' : 'Błąd',
      permissionResult.status === 'denied'
        ? 'Nie przyznano uprawnień do powiadomień. Możesz włączyć je później w ustawieniach aplikacji.'
        : permissionResult.error?.message || 'Nie udało się sprawdzić uprawnień do powiadomień.'
    );
  };

  const finishSetup = async (enableNotifications = false) => {
    if (saving) return;

    if (!user?.id) {
      Alert.alert('Błąd', 'Nie znaleziono aktywnego użytkownika.');
      return;
    }

    setSaving(true);
    try {
      if (enableNotifications) {
        const permissionResult = await ensureNotificationPermissionsAsync();
        if (permissionResult.status !== 'granted') {
          showPermissionIssue(permissionResult);
          return;
        }
      }

      const fieldsPatch = { hasCompletedSetup: true };
      if (enableNotifications) {
        fieldsPatch['notifications.enabled'] = true;
      }

      const updateResult = await updateUserProfileFields(fieldsPatch);
      if (!updateResult?.success) {
        throw new Error('Nie udało się zapisać ustawień profilu.');
      }

      if (enableNotifications) {
        enableShiftReminders(user.id);

        try {
          const pushRegistration = await registerForPushNotificationsAsync({
            requestPermission: false,
          });
          if (pushRegistration.token) {
            await saveUserPushTokenAsync(user.id, pushRegistration.token);
          } else if (pushRegistration.error) {
            console.log('Push notification token warning:', pushRegistration.error);
          }
        } catch (tokenError) {
          console.log('Push token setup warning:', tokenError);
        }

        const schedulingProfile = {
          ...(profile || {}),
          notifications: { ...(profile?.notifications || {}), enabled: true },
        };
        try {
          await scheduleCurrentShiftRemindersAsync(user.id, schedulingProfile);
        } catch (error) {
          console.error('Błąd planowania przypomnień o zmianach:', error);
        }
      }

      router.replace('/(tabs)');
    } catch (error) {
      console.error('Error saving setup preferences', error);
      Alert.alert(
        'Błąd',
        'Nie udało się zapisać ustawień. Możesz spróbować ponownie lub pominąć powiadomienia.'
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
          {currentStep === 'sections'
            ? 'Ustawienia profilu'
            : 'Nie przegap nadchodzącej zmiany'}
        </Text>
        <Text
          style={[
            styles.subtitle,
            { color: colors.textSecondary },
          ]}
        >
          {currentStep === 'sections'
            ? 'Wybierz sekcje, w których pracujesz. Dzięki temu statystyki będą dopasowane do Twojej pracy.'
            : 'Włącz przypomnienia, aby JMP Tools informowało Cię o zbliżających się dniach pracy zapisanych w grafiku.'}
        </Text>

        {currentStep === 'sections' ? (
          <>
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
          </>
        ) : null}
      </View>

      <View style={styles.buttonsRow}>
        {currentStep === 'sections' ? (
          <Pressable
            onPress={handleSaveSections}
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
        ) : (
          <>
            <Pressable
              onPress={() => finishSetup(true)}
              style={[
                styles.saveButton,
                {
                  backgroundColor: colors.butBackground,
                  borderColor: colors.butBorder,
                },
              ]}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.butText} />
              ) : (
                <Text style={[styles.saveButtonText, { color: colors.butText }]}>
                  Włącz powiadomienia
                </Text>
              )}
            </Pressable>
            <Pressable
              onPress={() => finishSetup(false)}
              style={[
                styles.skipButton,
                {
                  backgroundColor: colors.cardBackground,
                  borderColor: colors.border,
                },
              ]}
              disabled={saving}
            >
              <Text style={[styles.skipButtonText, { color: colors.text }]}>
                Pomiń
              </Text>
            </Pressable>
          </>
        )}
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
  skipButton: {
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    marginTop: 12,
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
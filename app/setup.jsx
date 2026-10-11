// app/setup.jsx
import React, { useEffect, useRef, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRouter } from 'expo-router';
import Animated, {
  cancelAnimation,
  Easing,
  useReducedMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
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
  const savingRef = useRef(false);
  const reduceMotion = useReducedMotion();
  const gearRotation = useSharedValue(0);
  const notificationScale = useSharedValue(1);
  const notificationRotation = useSharedValue(0);
  const gearStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${gearRotation.value}deg` }],
  }));
  const notificationStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: notificationScale.value },
      { rotate: `${notificationRotation.value}deg` },
    ],
  }));

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    if (currentStep === 'sections') {
      gearRotation.value = 0;
      gearRotation.value = withRepeat(
        withTiming(360, {
          duration: 8000,
          easing: Easing.linear,
        }),
        -1,
        false
      );
    }

    return () => cancelAnimation(gearRotation);
  }, [currentStep, gearRotation]);

  useEffect(() => {
    if (currentStep === 'notifications' && !reduceMotion) {
      notificationScale.value = 1;
      notificationRotation.value = 0;
      notificationScale.value = withRepeat(
        withSequence(
          withTiming(1.25, {
            duration: 1000,
            easing: Easing.out(Easing.quad),
          }),
          withDelay(
            2000,
            withTiming(1, {
              duration: 1000,
              easing: Easing.inOut(Easing.quad),
            })
          ),
          withDelay(4000, withTiming(1, { duration: 1 }))
        ),
        -1,
        false
      );
      notificationRotation.value = withRepeat(
        withSequence(
          withDelay(
            1000,
            withSequence(
              withTiming(-12, { duration: 125 }),
              withTiming(12, { duration: 250 }),
              withTiming(-10, { duration: 250 }),
              withTiming(10, { duration: 250 }),
              withTiming(-7, { duration: 250 }),
              withTiming(7, { duration: 250 }),
              withTiming(-3, { duration: 250 }),
              withTiming(3, { duration: 250 }),
              withTiming(0, { duration: 125 })
            )
          ),
          withDelay(5000, withTiming(0, { duration: 1 }))
        ),
        -1,
        false
      );
    }

    return () => {
      cancelAnimation(notificationScale);
      cancelAnimation(notificationRotation);
    };
  }, [
    currentStep,
    notificationRotation,
    notificationScale,
    reduceMotion,
  ]);

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
    if (savingRef.current) return;

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
      savingRef.current = true;
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
      savingRef.current = false;
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
    if (savingRef.current) return;

    if (!user?.id) {
      Alert.alert('Błąd', 'Nie znaleziono aktywnego użytkownika.');
      return;
    }

    savingRef.current = true;
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
      savingRef.current = false;
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
      <View
        style={[
          styles.content,
          styles.centeredContent,
        ]}
      >
        {currentStep === 'sections' ? (
          <Animated.View
            style={[styles.setupIcon, gearStyle]}
          >
            <Ionicons name="settings-outline" size={72} color={colors.butBackground} />
          </Animated.View>
        ) : (
          <Animated.View
            style={[styles.notificationIcon, notificationStyle]}
          >
            <Ionicons
              name="notifications-outline"
              size={72}
              color={colors.butBackground}
            />
            <View
              style={[
                styles.notificationBadge,
                { borderColor: colors.background },
              ]}
            />
          </Animated.View>
        )}
        <Text
          style={[
            styles.title,
            styles.centeredText,
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
            styles.centeredText,
            { color: colors.textSecondary },
          ]}
        >
          {currentStep === 'sections'
            ? 'Skonfiguruj profil przed rozpoczęciem korzystania z aplikacji. Wybierz sekcje, w których pracujesz, aby dopasować do nich statystyki.'
            : 'Włącz przypomnienia, aby JMP Tools informowało Cię o zbliżających się dniach pracy zapisanych w grafiku.'}
        </Text>

        {currentStep === 'sections' ? (
          <>
            <View style={[styles.sectionsRow, styles.centeredRow]}>
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
                    styles.centeredText,
                    { color: colors.textSecondary },
                  ]}
            >
              Możesz zmienić te ustawienia później w zakładce Ustawienia.
            </Text>
          </>
        ) : null}
      </View>

      <View
        style={[
          styles.buttonsRow,
          { paddingBottom: 16 + insets.bottom },
        ]}
      >
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
                  opacity: saving ? 0.5 : 1,
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
  centeredContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  setupIcon: {
    marginBottom: 16,
  },
  notificationIcon: {
    width: 72,
    height: 72,
    marginBottom: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBadge: {
    position: 'absolute',
    top: 2,
    right: 3,
    width: 17,
    height: 17,
    borderRadius: 9,
    borderWidth: 2,
    backgroundColor: '#EF4444',
  },
  centeredText: {
    textAlign: 'center',
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
  centeredRow: {
    justifyContent: 'center',
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
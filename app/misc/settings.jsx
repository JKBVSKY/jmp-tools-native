// Settings.jsx
import React, { useState, useEffect } from 'react';
import { View, Text, Switch, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import { useColors } from '../../hooks/useColors';
import { useThemeContext } from '../../context/ThemeContext';
import { doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { useUserProfile } from '../../context/UserProfileContext';
import { db } from '../../firebase/config';
import {
  registerForPushNotificationsAsync,
  saveUserPushTokenAsync,
  clearUserPushTokenAsync,
} from '../../services/NotificationService';

const Settings = () => {
  const {
    user,
    isLoading: authLoading,
    isGuest,
    deleteAccount,
  } = useAuth();
  const { profile, isLoading: profileLoading, loadUserProfile } = useUserProfile();
  const colors = useColors();
  const { themeMode, setThemeMode } = useThemeContext();
  const router = useRouter();

  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationLeadHours, setNotificationLeadHours] = useState(10);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [isSavingNotification, setIsSavingNotification] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (profile?.notifications?.enabled !== undefined) {
      setNotificationsEnabled(profile.notifications.enabled === true);
    }
    if (profile?.preferences?.notificationLeadHours !== undefined && profile?.preferences?.notificationLeadHours !== null) {
      setNotificationLeadHours(profile.preferences.notificationLeadHours);
    }
  }, [profile?.notifications?.enabled, profile?.preferences?.notificationLeadHours]);

  const isDataReady = !authLoading && !profileLoading && (user || profile);

  const handleNotificationLeadChange = async (value) => {
    setNotificationLeadHours(value);
    const userId = user?.id || profile?.userId;
    if (!userId) return;
    try {
      await updateDoc(
        doc(db, 'users', userId),
        { 'preferences.notificationLeadHours': value }
      );
      if (loadUserProfile) {
        await loadUserProfile(userId);
      }
    } catch (error) {
      console.error('Błąd zapisu lead hours:', error);
      Alert.alert('Błąd', 'Nie udało się zapisać ustawienia powiadomień.');
    }
  };

  if (authLoading || profileLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.text} />
        <Text style={{ color: colors.text, marginTop: 12 }}>
          Ładowanie ustawień...
        </Text>
      </View>
    );
  }

  const handleToggleNotifications = async () => {
    const userId = user?.id || profile?.userId;
    if (!userId) {
      Alert.alert(
        'Logowanie wymagane',
        'Nie znaleziono aktywnej sesji użytkownika.'
      );
      return;
    }

    if (isSavingNotification || loadingNotifications) return;

    setIsSavingNotification(true);
    setLoadingNotifications(true);

    const nextEnabledState = !notificationsEnabled;
    setNotificationsEnabled(nextEnabledState);

    try {
      if (nextEnabledState) {
        try {
          const { token, error } = await registerForPushNotificationsAsync();
          if (token) {
            await saveUserPushTokenAsync(userId, token);
          } else if (error) {
            console.log('Push notification token warning:', error);
          }
        } catch (pushRegErr) {
          console.log('Push notification registration skipped or failed in preview/simulator:', pushRegErr);
        }

        await updateDoc(
          doc(db, 'users', userId),
          { 'notifications.enabled': true }
        );
      } else {
        try {
          await clearUserPushTokenAsync(userId);
          await Notifications.cancelAllScheduledNotificationsAsync();
        } catch (clearErr) {
          console.log('Clear push notifications error:', clearErr);
        }

        await updateDoc(
          doc(db, 'users', userId),
          { 'notifications.enabled': false }
        );
      }

      if (loadUserProfile) {
        await loadUserProfile(userId);
      }
    } catch (error) {
      console.error('Błąd zmiany powiadomień:', error);
      setNotificationsEnabled(!nextEnabledState);
      Alert.alert(
        'Błąd',
        error?.message || 'Nie udało się zmienić ustawień powiadomień.'
      );
    } finally {
      setIsSavingNotification(false);
      setLoadingNotifications(false);
    }
  };

  const handleDeleteAccountPress = () => {
    Alert.alert(
      'Usuń konto',
      'Czy na pewno chcesz usunąć swoje konto? Tej operacji nie można cofnąć.',
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Tak',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Ostatnie ostrzeżenie',
              'Wszystkie Twoje dane, wyniki i postępy zostaną trwale usunięte z aplikacji i bazy danych. Czy na pewno kontynuować?',
              [
                { text: 'Anuluj', style: 'cancel' },
                {
                  text: 'Usuń trwale',
                  style: 'destructive',
                  onPress: async () => {
                    setIsDeleting(true);
                    try {
                      const result = await deleteAccount();
                      if (result.success) {
                        router.replace({ pathname: '/(auth)/welcome', params: { deleted: 'true' } });
                      } else {
                        setIsDeleting(false);
                        Alert.alert('Błąd', result.error || 'Nie udało się usunąć konta.');
                      }
                    } catch (_error) {
                      setIsDeleting(false);
                      Alert.alert('Błąd', 'Wystąpił nieoczekiwany błąd.');
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background },
      ]}
    >
      <Text
        style={[
          styles.title,
          { color: colors.title },
        ]}
      >
        Ustawienia
      </Text>

      {/* Motyw */}
      <View
        style={[
          styles.section,
          {
            backgroundColor: colors.cardBackground,
            borderColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.label, { color: colors.text }]}>Motyw</Text>
        {Platform.OS === 'web' ? (
          <select
            value={themeMode}
            onChange={(e) => {
              setThemeMode(e.target.value);
            }}
            style={{
              padding: 8,
              borderRadius: 8,
              backgroundColor: colors.inputBackground || colors.cardBackground,
              color: colors.text,
              borderColor: colors.border,
              borderWidth: 1,
              fontSize: 16,
            }}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System Settings</option>
          </select>
        ) : (
          <Picker
            selectedValue={themeMode}
            onValueChange={(itemValue) => {
              setThemeMode(itemValue);
            }}
            style={{ width: 160, color: colors.text }}
            dropdownIconColor={colors.text}
          >
            <Picker.Item label="Light" value="light" />
            <Picker.Item label="Dark" value="dark" />
            <Picker.Item label="System Settings" value="system" />
          </Picker>
        )}
      </View>

      {!isGuest && (
        <>
          {/* Powiadomienia */}
          <View
        style={[
          styles.section,
          {
            backgroundColor: colors.cardBackground,
            borderColor: colors.border,
          },
        ]}
      >
        <Text
          style={[
            styles.label,
            { color: colors.text },
          ]}
        >
          Powiadomienia
        </Text>
        {!isDataReady ? (
          <ActivityIndicator size="small" color={colors.text} />
        ) : (
          <Switch
            value={notificationsEnabled}
            onValueChange={handleToggleNotifications}
            disabled={!isDataReady || loadingNotifications || isGuest || isSavingNotification}
            thumbColor={
              notificationsEnabled
                ? (colors.butBackground || colors.textRed)
                : (colors.grayIconColor || colors.textSecondary)
            }
            trackColor={{
              true: colors.butBackground || colors.selection,
              false: colors.breakLine || colors.border,
            }}
          />
        )}
          </View>

          {/* Czas powiadomienia o pracy */}
          <View
            style={[
              styles.section,
              {
                backgroundColor: colors.cardBackground,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.label, { color: colors.text }]}>
              Czas powiadomienia o pracy
            </Text>
            {Platform.OS === 'web' ? (
              <select
                value={notificationLeadHours !== null ? notificationLeadHours : 'disabled'}
                onChange={(e) => {
                  const val = e.target.value;
                  handleNotificationLeadChange(val === 'disabled' ? null : Number(val));
                }}
                style={{
                  padding: 8,
                  borderRadius: 8,
                  backgroundColor: colors.inputBackground || colors.cardBackground,
                  color: colors.text,
                  borderColor: colors.border,
                  borderWidth: 1,
                  fontSize: 16,
                }}
              >
                <option value="1">1h</option>
                <option value="2">2h</option>
                <option value="5">5h</option>
                <option value="10">10h</option>
                <option value="disabled">Disabled</option>
              </select>
            ) : (
              !isDataReady ? (
                <ActivityIndicator size="small" color={colors.text} />
              ) : (
                <Picker
                  selectedValue={notificationLeadHours !== null ? notificationLeadHours : 'disabled'}
                  onValueChange={(itemValue) => {
                    handleNotificationLeadChange(itemValue === 'disabled' ? null : Number(itemValue));
                  }}
                  style={{ width: 140, color: colors.text }}
                  dropdownIconColor={colors.text}
                >
                  <Picker.Item label="1h" value={1} />
                  <Picker.Item label="2h" value={2} />
                  <Picker.Item label="5h" value={5} />
                  <Picker.Item label="10h" value={10} />
                  <Picker.Item label="Disabled" value="disabled" />
                </Picker>
              )
            )}
          </View>
        </>
      )}

      {!isGuest && (
        <>
          {/* Usuń konto – placeholder */}
      <View
        style={[
          styles.section,
          {
            backgroundColor: colors.cardBackground,
            borderColor: colors.border,
          },
        ]}
      >
        <Text
          style={[
            styles.label,
            { color: colors.text },
          ]}
        >
          Usuń konto
        </Text>
        <TouchableOpacity
          onPress={handleDeleteAccountPress}
          style={[
            styles.deleteButton,
            {
              backgroundColor: colors.butBackground,
              borderColor: colors.butBorder,
            },
          ]}
        >
          <Text
            style={[
              styles.deleteButtonText,
              { color: colors.butText },
            ]}
          >
            Usuń konto
          </Text>
        </TouchableOpacity>
          </View>
        </>
      )}
      {isDeleting && (
        <View style={styles.loadingOverlay}>
          <View style={[styles.loadingBox, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <ActivityIndicator size="large" color={colors.butBackground || colors.primary} />
            <Text style={[styles.loadingText, { color: colors.text }]}>Usuwanie konta i danych...</Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  // statyczny layout – bez hooka colors
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 16,
  },
  section: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
  },
  label: {
    fontSize: 16,
  },
  deleteButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  deleteButtonText: {
    fontWeight: '600',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  loadingBox: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default Settings;

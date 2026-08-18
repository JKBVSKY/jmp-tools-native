// Settings.jsx
import React, { useEffect, useState } from 'react';
import { View, Text, Switch, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useColors } from '../../hooks/useColors';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
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
  } = useAuth();
  const colors = useColors();

  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadNotificationState = async () => {
      if (!user?.id) {
        if (!cancelled) setNotificationsEnabled(false);
        return;
      }

      try {
        const [userSnapshot, permission] = await Promise.all([
          getDoc(doc(db, 'users', user.id)),
          Notifications.getPermissionsAsync(),
        ]);
        const notificationSettings = userSnapshot.data()?.notifications;
        const enabled = notificationSettings?.enabled !== false && (
          permission.status === 'granted' ||
          !!notificationSettings?.expoPushToken
        );

        if (!cancelled) setNotificationsEnabled(enabled);
      } catch (error) {
        console.error('Błąd odczytu ustawień powiadomień:', error);
      }
    };

    loadNotificationState();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (authLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>
          Ładowanie ustawień...
        </Text>
      </View>
    );
  }

  const handleToggleNotifications = async () => {
    console.log('Aktualny user:', user);

    if (!user?.id) {
      Alert.alert(
        'Logowanie wymagane',
        'Nie znaleziono aktywnej sesji użytkownika.'
      );
      return;
    }

    if (loadingNotifications) return;

    setLoadingNotifications(true);

    try {
      if (!notificationsEnabled) {
        const { token, error } =
          await registerForPushNotificationsAsync();

        if (!token) {
          Alert.alert(
            'Nie udało się włączyć powiadomień',
            error || 'Brak tokena Expo Push.'
          );
          return;
        }

        await saveUserPushTokenAsync(user.id, token);
        await setDoc(
          doc(db, 'users', user.id),
          { 'notifications.enabled': true },
          { merge: true }
        );
        setNotificationsEnabled(true);
      } else {
        await clearUserPushTokenAsync(user.id);
        await Notifications.cancelAllScheduledNotificationsAsync();
        setNotificationsEnabled(false);
      }
    } catch (error) {
      console.error('Błąd zmiany powiadomień:', error);

      Alert.alert(
        'Błąd',
        error?.message || 'Nie udało się zmienić ustawień powiadomień.'
      );
    } finally {
      setLoadingNotifications(false);
    }
  };

  const handleDeleteAccountPress = () => {
    // Placeholder – tutaj kiedyś:
    // 1) usunięcie konta i danych z Firestore
    // 2) reset nawigacji / przejście do Welcome.jsx
    Alert.alert(
      'Usuń konto',
      'Tutaj zaimplementuj logikę usuwania konta z Firestore i przejście do ekranu Welcome.',
      [
        { text: 'Anuluj', style: 'cancel' },
        { text: 'OK', onPress: () => console.log('Delete account placeholder pressed') },
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
        <Switch
          value={notificationsEnabled}
          onValueChange={handleToggleNotifications}
          disabled={authLoading || loadingNotifications || isGuest}
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
      </View>

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
});

export default Settings;
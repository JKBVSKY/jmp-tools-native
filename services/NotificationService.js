import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

export const DEFAULT_ANDROID_CHANNEL_ID = 'default';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function enableUserNotificationsAsync(userId) {
  const { token, error } = await registerForPushNotificationsAsync();
  if (!token) {
    return { success: false, error };
  }

  await saveUserPushTokenAsync(userId, token);
  return { success: true, token };
}

export async function disableUserNotificationsAsync(userId) {
  // W Firestore wyczyść token
  await clearUserPushTokenAsync(userId);
  // Lokalnie anuluj wszystkie zaplanowane notyfikacje
  await Notifications.cancelAllScheduledNotificationsAsync();
  return { success: true };
}

async function setupAndroidChannelAsync() {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync(DEFAULT_ANDROID_CHANNEL_ID, {
    name: 'Default',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#e3452d',
  });
}

function getEasProjectId() {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? null;
}

async function getExpoPushTokenValueAsync(devicePushToken) {
  const projectId = getEasProjectId();
  if (!projectId) {
    return {
      token: null,
      error: 'EAS projectId is missing in app config',
    };
  }

  try {
    const token = (await Notifications.getExpoPushTokenAsync({ projectId, devicePushToken })).data;
    return {
      token,
      error: null,
    };
  } catch (error) {
    return {
      token: null,
      error: error?.message ?? String(error),
    };
  }
}

export async function registerForPushNotificationsAsync() {
  if (Platform.OS === 'web') {
    return {
      token: null,
      error: 'Push notifications are not enabled on web in this setup',
    };
  }

  await setupAndroidChannelAsync();

  const permissions = await Notifications.getPermissionsAsync();
  let finalStatus = permissions.status;

  if (finalStatus !== 'granted') {
    const request = await Notifications.requestPermissionsAsync();
    finalStatus = request.status;
  }

  if (finalStatus !== 'granted') {
    return {
      token: null,
      error: 'Notification permission not granted',
    };
  }

  return getExpoPushTokenValueAsync();
}

export async function saveUserPushTokenAsync(userId, token) {
  if (!userId || !token) {
    return;
  }

  const userRef = doc(db, 'users', userId);
  await setDoc(
    userRef,
    {
      'notifications.expoPushToken': token,
      'notifications.platform': Platform.OS,
      'notifications.updatedAt': new Date().toISOString(),
    },
    { merge: true }
  );
}

export async function clearUserPushTokenAsync(userId) {
  if (!userId) {
    return;
  }

  const userRef = doc(db, 'users', userId);
  await setDoc(
    userRef,
    {
      'notifications.expoPushToken': null,
      'notifications.enabled': false,
      'notifications.platform': Platform.OS,
      'notifications.updatedAt': new Date().toISOString(),
    },
    { merge: true }
  );
}

export function attachPushTokenRefreshListener(onTokenRefreshed) {
  if (Platform.OS === 'web') {
    return () => { };
  }

  const subscription = Notifications.addPushTokenListener(async (devicePushToken) => {
    // Do not call getDevicePushTokenAsync here; Expo emits this event from that method.
    const { token, error } = await getExpoPushTokenValueAsync(devicePushToken);
    if (!token) {
      if (error) {
        console.log('Push token refresh:', error);
      }
      return;
    }
    onTokenRefreshed?.(token);
  });

  return () => {
    subscription.remove();
  };
}

export function attachNotificationListeners({ onNotification, onResponse } = {}) {
  if (Platform.OS === 'web') {
    return () => { };
  }

  const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
    onNotification?.(notification);
  });

  const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
    onResponse?.(response);
  });

  return () => {
    receivedSub.remove();
    responseSub.remove();
  };
}

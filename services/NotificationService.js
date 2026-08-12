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

async function getExpoPushTokenValueAsync() {
  const projectId = getEasProjectId();
  if (!projectId) {
    return {
      token: null,
      error: 'EAS projectId is missing in app config',
    };
  }

  try {
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
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
      notifications: {
        expoPushToken: token,
        platform: Platform.OS,
        updatedAt: new Date().toISOString(),
      },
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
      notifications: {
        expoPushToken: null,
        platform: Platform.OS,
        updatedAt: new Date().toISOString(),
      },
    },
    { merge: true }
  );
}

export function attachPushTokenRefreshListener(onTokenRefreshed) {
  if (Platform.OS === 'web') {
    return () => {};
  }

  const subscription = Notifications.addPushTokenListener(async () => {
    const { token, error } = await getExpoPushTokenValueAsync();
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
    return () => {};
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

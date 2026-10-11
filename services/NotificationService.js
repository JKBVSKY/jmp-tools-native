import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getCacheEntry } from './cache/cacheStore';
import { applyPendingFields, getPendingMutation } from './pendingMutations/pendingMutationStore';
import { USER_PROFILE_PENDING_DOMAIN } from './pendingMutations/userProfileSync';

export const DEFAULT_ANDROID_CHANNEL_ID = 'default';
const PROFILE_CACHE_DOMAIN = 'profile';

let reminderOperations = Promise.resolve();
const notificationIntents = new Map();
const inFlightReminderPlans = new Map();
let appliedReminderPlan = null;

function enqueueReminderOperation(operation) {
  const result = reminderOperations.then(operation, operation);
  reminderOperations = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

export function cancelScheduledShiftRemindersAsync() {
  appliedReminderPlan = null;
  return enqueueReminderOperation(async () => {
    await Notifications.cancelAllScheduledNotificationsAsync();
    return { status: 'disabled' };
  });
}

export function scheduleTestNotificationAsync(notification) {
  return enqueueReminderOperation(() =>
    Notifications.scheduleNotificationAsync(notification)
  );
}

function getNotificationIntent(userId) {
  return notificationIntents.get(userId) || { enabled: null, epoch: 0, source: null };
}

export function enableShiftReminders(userId) {
  if (!userId) return { success: false, reason: 'no-user' };

  const previous = getNotificationIntent(userId);
  const intent = {
    enabled: true,
    epoch: previous.epoch + 1,
    source: 'explicit',
  };
  notificationIntents.set(userId, intent);
  appliedReminderPlan = null;
  return { success: true, epoch: intent.epoch };
}

export function disableShiftRemindersAsync(userId) {
  let intent = null;
  if (userId) {
    const previous = getNotificationIntent(userId);
    intent = {
      enabled: false,
      epoch: previous.epoch + 1,
      source: 'explicit',
    };
    notificationIntents.set(userId, intent);
  }

  appliedReminderPlan = null;

  return enqueueReminderOperation(async () => {
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (userId && getNotificationIntent(userId).epoch === intent.epoch) {
      appliedReminderPlan = {
        userId,
        signature: getDisabledReminderSignature(userId, intent.epoch),
        epoch: intent.epoch,
      };
    }
    return { status: 'disabled', epoch: intent?.epoch };
  });
}

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
  const cancellation = disableShiftRemindersAsync(userId);
  try {
    await clearUserPushTokenAsync(userId);
  } finally {
    await cancellation;
  }
  return { success: true };
}

export async function ensureNotificationPermissionsAsync({ requestPermission = true } = {}) {
  if (Platform.OS === 'web') {
    return {
      status: 'error',
      error: new Error('Notifications are not enabled on web in this setup'),
    };
  }

  try {
    let permissions = await Notifications.getPermissionsAsync();

    if (permissions.granted) {
      await setupAndroidChannelAsync();
      return { status: 'granted' };
    }

    if (!requestPermission) {
      return { status: permissions.canAskAgain ? 'denied' : 'blocked' };
    }

    if (!permissions.canAskAgain) {
      return { status: 'blocked' };
    }

    await setupAndroidChannelAsync();
    permissions = await Notifications.requestPermissionsAsync();

    if (permissions.granted) {
      return { status: 'granted' };
    }

    return { status: permissions.canAskAgain ? 'denied' : 'blocked' };
  } catch (error) {
    return { status: 'error', error };
  }
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

export async function registerForPushNotificationsAsync({ requestPermission = true } = {}) {
  if (Platform.OS === 'web') {
    return {
      token: null,
      error: 'Push notifications are not enabled on web in this setup',
    };
  }

  const permissionResult = await ensureNotificationPermissionsAsync({ requestPermission });
  if (permissionResult.status !== 'granted') {
    return {
      token: null,
      error: permissionResult.error?.message ?? 'Notification permission not granted',
    };
  }

  return getExpoPushTokenValueAsync();
}

export function getAllFutureWorkShifts(schedule) {
  const now = new Date();
  const shifts = [];

  for (const [dateKey, entry] of Object.entries(schedule || {})) {
    if (entry.type !== 'work') continue;

    const [year, month, day] = dateKey.split('-').map(Number);
    const shiftDate = new Date(year, month - 1, day);
    const [hours, mins] = (entry.start || '06:00').split(':').map(Number);
    shiftDate.setHours(hours, mins, 0, 0);

    if (shiftDate <= now) continue;

    shifts.push({
      dateKey,
      shift: entry,
      date: shiftDate,
    });
  }

  shifts.sort((a, b) => a.date.getTime() - b.date.getTime());
  return shifts;
}

export function getShiftReminderPlanSignature(userId, schedule, userProfile) {
  const shifts = Object.entries(schedule || {})
    .map(([dateKey, entry]) => [
      dateKey,
      entry?.type ?? null,
      entry?.type === 'work' ? (entry.start || '06:00') : null,
    ])
    .sort(([dateKeyA], [dateKeyB]) =>
      dateKeyA < dateKeyB ? -1 : dateKeyA > dateKeyB ? 1 : 0
    );

  const leadHours = userProfile?.preferences?.notificationLeadHours;
  return JSON.stringify([
    userId,
    userProfile?.notifications?.enabled ?? null,
    leadHours === undefined ? 'default' : leadHours,
    shifts,
  ]);
}

function getDisabledReminderSignature(userId, epoch) {
  return JSON.stringify([userId, 'disabled', epoch]);
}

async function getSchedulingProfileAsync(userId, userProfile) {
  const pendingMutation = await getPendingMutation(
    USER_PROFILE_PENDING_DOMAIN,
    userId,
    { strict: true }
  );
  const pendingFields = pendingMutation?.fields;

  if (userProfile != null) {
    return applyPendingFields(userProfile, pendingFields);
  }

  if (typeof pendingFields?.['notifications.enabled'] === 'boolean') {
    return applyPendingFields({ userId }, pendingFields);
  }

  let cachedProfile = null;
  try {
    const cached = await getCacheEntry(PROFILE_CACHE_DOMAIN, userId);
    cachedProfile = cached?.data || null;
  } catch (error) {
    console.warn('Nie udało się odczytać cache profilu do planowania przypomnień:', error);
  }

  let profileData = null;
  try {
    const userSnap = await getDoc(doc(db, 'users', userId));
    profileData = userSnap.exists() ? userSnap.data() : cachedProfile;
  } catch (error) {
    if (!cachedProfile) {
      console.error('Błąd pobierania profilu do planowania przypomnień:', error);
      return null;
    }
    console.warn('Nie udało się pobrać profilu; używam lokalnego cache:', error);
    profileData = cachedProfile;
  }

  return profileData ? applyPendingFields(profileData, pendingFields) : null;
}

export function scheduleShiftReminderAsync(userId, schedule, userProfile) {
  if (!userId) {
    return Promise.resolve({ status: 'retry', reason: 'no-user' });
  }

  const suppliedProfile = userProfile;
  const intent = getNotificationIntent(userId);

  const requestEpoch = intent.epoch;
  const requestSignature = getShiftReminderPlanSignature(userId, schedule, suppliedProfile);
  const requestKey = JSON.stringify([userId, requestEpoch, requestSignature]);
  const inFlight = inFlightReminderPlans.get(requestKey);
  if (inFlight) return inFlight;

  const planPromise = enqueueReminderOperation(async () => {
    const currentIntent = getNotificationIntent(userId);
    if (currentIntent.epoch !== requestEpoch) {
      return { status: 'superseded', reason: 'newer-intent' };
    }

    if (currentIntent.enabled === false) {
      const disabledSignature = getDisabledReminderSignature(userId, requestEpoch);
      if (
        appliedReminderPlan?.userId === userId &&
        appliedReminderPlan.signature === disabledSignature &&
        appliedReminderPlan.epoch === requestEpoch
      ) {
        return { status: 'disabled' };
      }

      appliedReminderPlan = null;
      await Notifications.cancelAllScheduledNotificationsAsync();
      if (getNotificationIntent(userId).epoch === requestEpoch) {
        appliedReminderPlan = {
          userId,
          signature: disabledSignature,
          epoch: requestEpoch,
        };
        return { status: 'disabled' };
      }
      return { status: 'superseded', reason: 'newer-intent' };
    }

    let profileData;
    try {
      profileData = await getSchedulingProfileAsync(userId, suppliedProfile);
    } catch (error) {
      appliedReminderPlan = null;
      console.error('Błąd odczytu oczekującej mutacji profilu do planowania przypomnień:', error);
      await Notifications.cancelAllScheduledNotificationsAsync();
      return { status: 'retry', reason: 'pending-profile-read-failed' };
    }

    if (getNotificationIntent(userId).epoch !== requestEpoch) {
      return { status: 'superseded', reason: 'newer-intent' };
    }

    if (!profileData) {
      appliedReminderPlan = null;
      return { status: 'retry', reason: 'profile-unavailable' };
    }

    const latestIntent = getNotificationIntent(userId);
    if (latestIntent.enabled === true && latestIntent.source === 'explicit') {
      profileData = {
        ...profileData,
        notifications: { ...(profileData.notifications || {}), enabled: true },
      };
    } else if (profileData.notifications?.enabled === false) {
      const disabledSignature = getDisabledReminderSignature(userId, requestEpoch);
      if (
        appliedReminderPlan?.userId === userId &&
        appliedReminderPlan.signature === disabledSignature &&
        appliedReminderPlan.epoch === requestEpoch
      ) {
        return { status: 'disabled' };
      }

      appliedReminderPlan = null;
      await Notifications.cancelAllScheduledNotificationsAsync();
      if (getNotificationIntent(userId).epoch === requestEpoch) {
        appliedReminderPlan = {
          userId,
          signature: disabledSignature,
          epoch: requestEpoch,
        };
        return { status: 'disabled' };
      }
      return { status: 'superseded', reason: 'newer-intent' };
    }

    const signature = getShiftReminderPlanSignature(userId, schedule, profileData);
    if (
      appliedReminderPlan?.userId === userId &&
      appliedReminderPlan.signature === signature &&
      appliedReminderPlan.epoch === requestEpoch
    ) {
      return { status: 'unchanged' };
    }

    appliedReminderPlan = null;
    let result;
    try {
      result = await scheduleShiftReminderInternalAsync(schedule, profileData);
    } catch (error) {
      if (getNotificationIntent(userId).epoch === requestEpoch) {
        appliedReminderPlan = null;
      }
      throw error;
    }

    if (getNotificationIntent(userId).epoch !== requestEpoch) {
      return { status: 'superseded', reason: 'newer-intent' };
    }

    if (result?.status === 'complete' || result?.status === 'disabled') {
      appliedReminderPlan = { userId, signature, epoch: requestEpoch };
    } else {
      appliedReminderPlan = null;
    }
    return result;
  }).finally(() => {
    if (inFlightReminderPlans.get(requestKey) === planPromise) {
      inFlightReminderPlans.delete(requestKey);
    }
  });

  inFlightReminderPlans.set(requestKey, planPromise);
  return planPromise;
}

async function scheduleShiftReminderInternalAsync(schedule, profileData) {
  if (profileData == null) {
    return { status: 'retry', reason: 'profile-unavailable' };
  }

  if (profileData.notifications?.enabled === false) {
    await Notifications.cancelAllScheduledNotificationsAsync();
    return { status: 'disabled' };
  }

  if (profileData.notifications?.enabled !== true) {
    return { status: 'retry', reason: 'notifications-not-enabled' };
  }

  let leadHours = 10;
  const leadHoursPref = profileData?.preferences?.notificationLeadHours;
  if (leadHoursPref === null || leadHoursPref === 'disabled') {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('Powiadomienia o zmianach wyłączone (leadHours = null)');
    return { status: 'disabled' };
  }

  if (leadHoursPref !== undefined) {
    const parsed = parseInt(leadHoursPref, 10);
    if (!isNaN(parsed)) {
      leadHours = parsed;
    }
  }

  await Notifications.cancelAllScheduledNotificationsAsync();

  const futureShifts = getAllFutureWorkShifts(schedule);
  if (futureShifts.length === 0) {
    console.log('Brak przyszłych zmian typu work do powiadomienia');
    return { status: 'complete', scheduledCount: 0 };
  }

  const permissionResult = await ensureNotificationPermissionsAsync({ requestPermission: false });
  if (permissionResult.status !== 'granted') {
    if (permissionResult.error) {
      console.error('Błąd sprawdzania uprawnień powiadomień:', permissionResult.error);
    } else {
      console.warn('Brak uprawnień na powiadomienia');
    }
    return { status: 'retry', reason: 'permission-unavailable' };
  }

  const scheduledIds = [];

  for (const { dateKey, shift, date } of futureShifts) {
    const reminderDate = new Date(date.getTime() - leadHours * 60 * 60 * 1000);
    if (reminderDate <= new Date()) {
      continue;
    }

    const dateStr = date.toLocaleDateString('pl-PL', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
    });

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Nadchodząca zmiana',
        body: `Masz pracę ${dateStr} o ${shift.start}.`,
        sound: true,
        data: {
          type: 'shift_reminder',
          dateKey,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminderDate,
      },
    });

    console.log(
      'Scheduling notification for shift at:',
      date,
      'with reminderDate:',
      reminderDate,
      'leadHours:',
      leadHours
    );
    scheduledIds.push(notificationId);
  }

  console.log(`Zaplanowano ${scheduledIds.length} powiadomień o zmianach.`, scheduledIds);
  return { status: 'complete', scheduledCount: scheduledIds.length };
}

export async function scheduleCurrentShiftRemindersAsync(userId, userProfile) {
  if (!userId) {
    return { status: 'retry', reason: 'no-user' };
  }

  const cached = await getCacheEntry('timetable', userId);
  let schedule;

  if (cached?.data?.pendingSync) {
    schedule = cached.data.schedule || {};
  } else {
    try {
      const scheduleSnap = await getDoc(doc(db, 'users', userId, 'timetable', 'current'));
      schedule = scheduleSnap.exists()
        ? scheduleSnap.data()?.schedule || {}
        : cached?.data?.schedule || {};
    } catch (error) {
      if (!cached?.data) {
        throw error;
      }
      console.warn('Nie udało się pobrać grafiku; używam lokalnego cache:', error);
      schedule = cached.data.schedule || {};
    }
  }

  return scheduleShiftReminderAsync(userId, schedule, userProfile);
}

export async function saveUserPushTokenAsync(userId, token) {
  if (!userId || !token) {
    return;
  }

  const userRef = doc(db, 'users', userId);
  await updateDoc(
    userRef,
    {
      'notifications.expoPushToken': token,
      'notifications.platform': Platform.OS,
      'notifications.updatedAt': new Date().toISOString(),
    }
  );
}

export async function clearUserPushTokenAsync(userId) {
  if (!userId) {
    return;
  }

  const userRef = doc(db, 'users', userId);
  await updateDoc(
    userRef,
    {
      'notifications.expoPushToken': null,
      'notifications.platform': Platform.OS,
      'notifications.updatedAt': new Date().toISOString(),
    }
  );
}

export function attachPushTokenRefreshListener(onTokenRefreshed) {
  if (Platform.OS === 'web') {
    return () => { };
  }

  const subscription = Notifications.addPushTokenListener(async (devicePushToken) => {
    // Do not call getDevicePushTokenAsync here; Expo emits this event from that method.
    let permissions;
    try {
      permissions = await Notifications.getPermissionsAsync();
    } catch (error) {
      console.log('Push permission refresh:', error?.message ?? String(error));
      return;
    }

    if (!permissions.granted) {
      return;
    }

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

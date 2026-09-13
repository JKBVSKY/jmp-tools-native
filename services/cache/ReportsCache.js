// services/cache/ReportsCache.js
// Persistent read-cache for the global `reports` collection.
// Kept separate from cacheStore.js because Reports is not per-user data.
import AsyncStorage from '@react-native-async-storage/async-storage';

const REPORTS_CACHE_KEY = 'cache:v1:reports';

// Firestore Timestamp instances aren't JSON-serializable, so they're stored
// as plain {seconds, nanoseconds} and rehydrated into a toDate()-compatible shape.
const isFirestoreTimestamp = (value) =>
    !!value && typeof value === 'object' && typeof value.toDate === 'function' && typeof value.seconds === 'number';

const serializeReport = (report) => {
    const serialized = {};
    for (const [key, value] of Object.entries(report)) {
        serialized[key] = isFirestoreTimestamp(value)
            ? { __firestoreTimestamp: true, seconds: value.seconds, nanoseconds: value.nanoseconds || 0 }
            : value;
    }
    return serialized;
};

const deserializeReport = (report) => {
    const deserialized = {};
    for (const [key, value] of Object.entries(report)) {
        deserialized[key] =
            value && typeof value === 'object' && value.__firestoreTimestamp
                ? { ...value, toDate: () => new Date(value.seconds * 1000 + value.nanoseconds / 1e6) }
                : value;
    }
    return deserialized;
};

export async function getReportsCache() {
    try {
        const raw = await AsyncStorage.getItem(REPORTS_CACHE_KEY);
        if (!raw) return null;

        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return null;

        return parsed.map(deserializeReport);
    } catch (error) {
        console.warn('ReportsCache: failed to read cache:', error);
        return null;
    }
}

export async function setReportsCache(reports) {
    try {
        const serializable = Array.isArray(reports) ? reports.map(serializeReport) : [];
        await AsyncStorage.setItem(REPORTS_CACHE_KEY, JSON.stringify(serializable));
    } catch (error) {
        console.warn('ReportsCache: failed to write cache:', error);
    }
}

export async function clearReportsCache() {
    try {
        await AsyncStorage.removeItem(REPORTS_CACHE_KEY);
    } catch (error) {
        console.warn('ReportsCache: failed to clear cache:', error);
    }
}

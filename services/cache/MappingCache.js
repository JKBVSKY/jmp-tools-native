// services/cache/MappingCache.js
// Persistent read-cache for Mapping.jsx (Lokalizator Palet).
// Caches `users/{userId}/palletMappings` and `users/{userId}/scheduleItems`
// separately, keyed by userId. Follows the same pattern as ReportsCache.js.
import AsyncStorage from '@react-native-async-storage/async-storage';

const PALLET_MAPPINGS_CACHE_PREFIX = 'cache:v1:palletMappings:';
const SCHEDULE_ITEMS_CACHE_PREFIX = 'cache:v1:scheduleItems:';

// Firestore Timestamp instances aren't JSON-serializable, so they're stored
// as plain {seconds, nanoseconds} and rehydrated into a toDate()-compatible shape.
const isFirestoreTimestamp = (value) =>
    !!value && typeof value === 'object' && typeof value.toDate === 'function' && typeof value.seconds === 'number';

const serializeItem = (item) => {
    const serialized = {};
    for (const [key, value] of Object.entries(item)) {
        serialized[key] = isFirestoreTimestamp(value)
            ? { __firestoreTimestamp: true, seconds: value.seconds, nanoseconds: value.nanoseconds || 0 }
            : value;
    }
    return serialized;
};

const deserializeItem = (item) => {
    const deserialized = {};
    for (const [key, value] of Object.entries(item)) {
        deserialized[key] =
            value && typeof value === 'object' && value.__firestoreTimestamp
                ? { ...value, toDate: () => new Date(value.seconds * 1000 + value.nanoseconds / 1e6) }
                : value;
    }
    return deserialized;
};

const readCache = async (storageKey) => {
    try {
        const raw = await AsyncStorage.getItem(storageKey);
        if (!raw) return null;

        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return null;

        return parsed.map(deserializeItem);
    } catch (error) {
        console.warn(`MappingCache: failed to read "${storageKey}":`, error);
        return null;
    }
};

const writeCache = async (storageKey, items) => {
    try {
        const serializable = Array.isArray(items) ? items.map(serializeItem) : [];
        await AsyncStorage.setItem(storageKey, JSON.stringify(serializable));
    } catch (error) {
        console.warn(`MappingCache: failed to write "${storageKey}":`, error);
    }
};

export async function getPalletMappingsCache(userId) {
    if (!userId) return null;
    return readCache(`${PALLET_MAPPINGS_CACHE_PREFIX}${userId}`);
}

export async function setPalletMappingsCache(userId, mappings) {
    if (!userId) return;
    await writeCache(`${PALLET_MAPPINGS_CACHE_PREFIX}${userId}`, mappings);
}

export async function getScheduleItemsCache(userId) {
    if (!userId) return null;
    return readCache(`${SCHEDULE_ITEMS_CACHE_PREFIX}${userId}`);
}

export async function setScheduleItemsCache(userId, scheduleItems) {
    if (!userId) return;
    await writeCache(`${SCHEDULE_ITEMS_CACHE_PREFIX}${userId}`, scheduleItems);
}

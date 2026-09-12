// services/cache/cacheStore.js
// Generic, namespaced (domain + userId) local cache on top of AsyncStorage.
// Intentionally independent of NetworkProvider/useNetwork - correctness of
// what gets cached must never depend on network state.
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_VERSION = 1;
const KEY_PREFIX = 'cache:v1:';

// Keep in sync with every domain that starts using this store.
const KNOWN_DOMAINS = ['profile'];

const buildKey = (domain, userId) => `${KEY_PREFIX}${domain}:${userId}`;

export async function getCacheEntry(domain, userId) {
  if (!domain || !userId) return null;
  try {
    const raw = await AsyncStorage.getItem(buildKey(domain, userId));
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    // Guards against corrupted data and cross-user/cross-schema leaks.
    if (!parsed || parsed.version !== CACHE_VERSION || parsed.userId !== userId) {
      return null;
    }
    return parsed;
  } catch (error) {
    console.warn(`cacheStore: failed to read "${domain}" cache for ${userId}:`, error);
    return null;
  }
}

export async function setCacheEntry(domain, userId, data) {
  if (!domain || !userId) return;
  const entry = {
    version: CACHE_VERSION,
    userId,
    updatedAt: Date.now(),
    data,
  };
  try {
    await AsyncStorage.setItem(buildKey(domain, userId), JSON.stringify(entry));
  } catch (error) {
    console.warn(`cacheStore: failed to write "${domain}" cache for ${userId}:`, error);
  }
}

export async function removeCacheEntry(domain, userId) {
  if (!domain || !userId) return;
  try {
    await AsyncStorage.removeItem(buildKey(domain, userId));
  } catch (error) {
    console.warn(`cacheStore: failed to remove "${domain}" cache for ${userId}:`, error);
  }
}

// Removes every known-domain entry for a given user (e.g. on explicit account deletion).
export async function clearUserCache(userId) {
  if (!userId) return;
  try {
    await Promise.all(KNOWN_DOMAINS.map((domain) => removeCacheEntry(domain, userId)));
  } catch (error) {
    console.warn(`cacheStore: failed to clear cache for ${userId}:`, error);
  }
}

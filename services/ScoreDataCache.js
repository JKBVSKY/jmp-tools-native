import AsyncStorage from '@react-native-async-storage/async-storage';
const memoryCache = new Map();
const getStorageKey = (key) => 'score-data-cache:v1:' + key;
const readCache = async (key) => {
  if (memoryCache.has(key)) return memoryCache.get(key);
  try {
    const stored = await AsyncStorage.getItem(getStorageKey(key));
    if (!stored) return null;
    const value = JSON.parse(stored);
    memoryCache.set(key, value);
    return value;
  } catch (error) {
    console.warn('Failed to read score data cache:', error);
    return null;
  }
};
const writeCache = async (key, value) => {
  memoryCache.set(key, value);
  try { await AsyncStorage.setItem(getStorageKey(key), JSON.stringify(value)); }
  catch (error) { console.warn('Failed to write score data cache:', error); }
};
export const getUserScoreHistoryCache = (userId) => readCache('user-score-history:' + userId);
export const setUserScoreHistoryCache = (userId, sessions) => writeCache('user-score-history:' + userId, sessions);
export const getLeaderboardCache = (monthKey) => readCache('leaderboard:' + monthKey);
export const setLeaderboardCache = (monthKey, data) => writeCache('leaderboard:' + monthKey, data);

export const invalidateScoreDataCache = async (userId) => {
  memoryCache.delete('user-score-history:' + userId);
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter((key) => key.startsWith('score-data-cache:v1:'));
    await AsyncStorage.multiRemove(cacheKeys);
    for (const key of memoryCache.keys()) {
      if (key.startsWith('leaderboard:')) memoryCache.delete(key);
    }
  } catch (error) {
    console.warn('Failed to invalidate score data cache:', error);
  }
};

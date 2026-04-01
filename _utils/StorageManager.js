import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Cross-platform storage manager
 * Uses SecureStore on mobile, localStorage on web
 */
export const StorageManager = {
  async setItem(key, value) {
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(key, value);
      } else {
        await SecureStore.setItemAsync(key, value);
      }
    } catch (error) {
      console.error(`Storage error setting ${key}:`, error);
    }
  },

  async getItem(key) {
    try {
      if (Platform.OS === 'web') {
        return localStorage.getItem(key);
      } else {
        return await SecureStore.getItemAsync(key);
      }
    } catch (error) {
      console.error(`Storage error getting ${key}:`, error);
      return null;
    }
  },

  async removeItem(key) {
    try {
      if (Platform.OS === 'web') {
        localStorage.removeItem(key);
      } else {
        await SecureStore.deleteItemAsync(key);
      }
    } catch (error) {
      console.error(`Storage error removing ${key}:`, error);
    }
  },

  async multiSet(items) {
    for (const [key, value] of items) {
      await this.setItem(key, value);
    }
  },

  async multiGet(keys) {
    const result = {};
    for (const key of keys) {
      result[key] = await this.getItem(key);
    }
    return result;
  },
};
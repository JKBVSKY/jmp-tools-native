// services/PendingXPService.js
import AsyncStorage from '@react-native-async-storage/async-storage';

const PENDING_XP_KEY = 'pending_xp_actions';
const SESSION_START_KEY = 'xp_session_start';

export class PendingXPService {
  /**
   * Record an XP action locally (doesn't require network)
   * Called when user is working, regardless of screen state
   */
  static async recordXPAction(xpAmount, metadata = {}) {
    try {
      const action = {
        id: Date.now() + Math.random(),
        xpAmount,
        timestamp: Date.now(),
        isSynced: false,
        metadata,
      };

      const existing = await AsyncStorage.getItem(PENDING_XP_KEY);
      const actions = existing ? JSON.parse(existing) : [];

      actions.push(action);

      await AsyncStorage.setItem(PENDING_XP_KEY, JSON.stringify(actions));

      console.log('✅ XP action recorded locally:', action);
      return action;
    } catch (error) {
      console.error('❌ Error recording XP action:', error);
      throw error;
    }
  }

  /**
   * Get all pending (unsynced) XP actions
   */
  static async getPendingActions() {
    try {
      const existing = await AsyncStorage.getItem(PENDING_XP_KEY);
      return existing ? JSON.parse(existing) : [];
    } catch (error) {
      console.error('❌ Error getting pending actions:', error);
      return [];
    }
  }

// ✅ NEW: Retry sync with exponential backoff
static async syncWithRetry(awardXPFunction, maxRetries = 3) {
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      const result = await this.syncPendingXP(awardXPFunction);
      if (result.synced > 0) {
        return result;
      }
    } catch (error) {
      attempt++;
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        console.log(`⏳ Retry ${attempt}/${maxRetries} in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  console.error('❌ All sync retries failed');
  return { synced: 0, total: 0, totalXP: 0 };
}


// ✅ FIXED syncPendingXP with better error handling
static async syncPendingXP(awardXPFunction) {
  try {
    const pendingActions = await this.getPendingActions();

    if (pendingActions.length === 0) {
      console.log('✅ No pending XP to sync');
      return { synced: 0, total: 0, totalXP: 0 };
    }

    console.log(`🔄 Syncing ${pendingActions.length} pending XP actions...`);

    // Calculate total XP from all actions
    const totalXPToSync = pendingActions
      .filter(a => !a.isSynced)
      .reduce((sum, a) => sum + a.xpAmount, 0);

    console.log(`📊 Total XP to sync: ${totalXPToSync}`);

    if (totalXPToSync <= 0) {
      console.log('✅ No XP to sync (all already synced)');
      return { synced: 0, total: 0, totalXP: 0 };
    }

    // ✅ Check if awardXPFunction exists
    if (!awardXPFunction || typeof awardXPFunction !== 'function') {
      console.error('❌ awardXPFunction is not valid:', awardXPFunction);
      return { synced: 0, total: pendingActions.length, totalXP: 0, error: 'Invalid function' };
    }

    try {
      // Award all XP at once
      const result = await awardXPFunction(totalXPToSync);

      // ✅ Check result more carefully
      if (!result) {
        console.warn('⚠️ Award XP returned falsy');
        return { synced: 0, total: pendingActions.length, totalXP: 0 };
      }

      // Mark ALL actions as synced
      pendingActions.forEach(action => {
        action.isSynced = true;
        action.syncedAt = Date.now();
      });

      await AsyncStorage.setItem(
        PENDING_XP_KEY,
        JSON.stringify(pendingActions)
      );

      console.log(
        `✅ Batch sync complete: ${pendingActions.length} actions, +${totalXPToSync} XP total`
      );

      return {
        synced: pendingActions.length,
        total: pendingActions.length,
        totalXP: totalXPToSync,
      };
    } catch (error) {
      console.error('❌ Error awarding batch XP:', error);
      return { synced: 0, total: pendingActions.length, totalXP: 0, error };
    }
  } catch (error) {
    console.error('❌ Error syncing pending XP:', error);
    return { synced: 0, total: 0, totalXP: 0, error };
  }
}

  /**
   * Clear all synced actions (cleanup)
   */
  static async clearSyncedActions() {
    try {
      const pending = await this.getPendingActions();
      const unsynced = pending.filter(a => !a.isSynced);
      await AsyncStorage.setItem(PENDING_XP_KEY, JSON.stringify(unsynced));
      console.log('✅ Cleared synced actions');
    } catch (error) {
      console.error('❌ Error clearing synced actions:', error);
    }
  }

  /**
   * Get total unsynced XP
   */
  static async getUnsyncedXPTotal() {
    try {
      const actions = await this.getPendingActions();
      return actions
        .filter(a => !a.isSynced)
        .reduce((sum, a) => sum + a.xpAmount, 0);
    } catch (error) {
      console.error('❌ Error getting unsynced total:', error);
      return 0;
    }
  }

  /**
   * Save session start time
   */
  static async saveSessionStart(startTime) {
    try {
      await AsyncStorage.setItem(SESSION_START_KEY, JSON.stringify({ startTime }));
    } catch (error) {
      console.error('❌ Error saving session start:', error);
    }
  }

  /**
   * Get session start time
   */
  static async getSessionStart() {
    try {
      const data = await AsyncStorage.getItem(SESSION_START_KEY);
      return data ? JSON.parse(data).startTime : null;
    } catch (error) {
      console.error('❌ Error getting session start:', error);
      return null;
    }
  }

  /**
   * Clear session data
   */
  static async clearSessionData() {
    try {
      await AsyncStorage.removeItem(SESSION_START_KEY);
    } catch (error) {
      console.error('❌ Error clearing session data:', error);
    }
  }
}

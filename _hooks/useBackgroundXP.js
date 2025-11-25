import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { PendingXPService } from '../services/PendingXPService';

export function useBackgroundXP(awardXPFunction, enabled = true) {
  const appState = useRef(AppState.currentState);
  const isSyncingRef = useRef(false);

  // ✅ REMOVED: Auto-sync on app foreground
  // Now handled in layout.jsx for better UX with toast notification

  const syncPendingXP = async () => {
    if (isSyncingRef.current) {
      console.warn('⚠️ Sync already in progress');
      return { synced: 0, total: 0, totalXP: 0 };
    }

    isSyncingRef.current = true;

    try {
      const result = await PendingXPService.syncPendingXP(awardXPFunction);
      
      if (result.synced > 0) {
        console.log(`✅ Synced ${result.synced} XP actions (+${result.totalXP} XP total)`);
      }

      return result;
    } catch (error) {
      console.error('❌ Error syncing XP:', error);
      return { synced: 0, total: 0, totalXP: 0 };
    } finally {
      isSyncingRef.current = false;
    }
  };

  return { syncPendingXP };
}
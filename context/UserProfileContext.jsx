import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { calculateLevelFromXP, calculateXPFromScore, checkAchievements } from '../constants/LevelSystem';
import { doc, getDoc, onSnapshot, runTransaction, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { PendingXPService } from '../services/PendingXPService';
import { useNetwork } from '../services/useNetwork';
import { getCacheEntry, setCacheEntry } from '../services/cache/cacheStore';

const UserProfileContext = createContext();

const PROFILE_CACHE_DOMAIN = 'profile';
// Safety net for "offline + no cache" - guarantees we never spin forever even
// if NetworkProvider/useNetwork is wrong or unavailable. Purely a UX bound,
// not something cache correctness relies on.
const OFFLINE_NO_CACHE_TIMEOUT_MS = 8000;

// Pure data-shaping: figures out the hydrated profile plus which backfill
// writes (if any) it would need. Does NOT touch Firestore or React state.
const hydrateProfileData = (existingProfile, userId, user) => {
  const parsedXP = Number(existingProfile.totalXP ?? existingProfile.xp ?? 0);
  const hasValidXP = Number.isFinite(parsedXP) && parsedXP >= 0;
  let totalXP = hasValidXP ? parsedXP : 0;
  let xp = Number.isFinite(Number(existingProfile.xp)) ? Number(existingProfile.xp) : totalXP;

  const calculatedLevelResult = calculateLevelFromXP(totalXP);
  let level = calculatedLevelResult.level;

  const identityFallbacks = {
    displayName: existingProfile.displayName || user?.name || '',
    name: existingProfile.name || user?.name || '',
    email: existingProfile.email || user?.email || '',
  };
  let stats = {
    ...DEFAULT_STATS,
    ...(existingProfile.stats && typeof existingProfile.stats === 'object'
      ? existingProfile.stats
      : {}),
  };
  let achievements = Array.isArray(existingProfile.achievements)
    ? existingProfile.achievements
    : [];
  const needsIdentityBackfill = !existingProfile.displayName || !existingProfile.name || !existingProfile.email;

  const preferences = {
    ...(existingProfile.preferences || {}),
    sections: Array.isArray(existingProfile.preferences?.sections)
      ? existingProfile.preferences.sections
      : [],
  };

  const hasCompletedSetup =
    typeof existingProfile.hasCompletedSetup === 'boolean'
      ? existingProfile.hasCompletedSetup
      : false;

  const hydratedProfile = {
    ...existingProfile,
    ...identityFallbacks,
    userId,
    stats,
    achievements,
    totalXP,
    xp,
    level,
    preferences,
    hasCompletedSetup,
  };

  const schemaBackfill = {};
  if (Number(existingProfile.level) !== level) {
    schemaBackfill.level = level;
  }
  if (!existingProfile.stats || typeof existingProfile.stats !== 'object') {
    schemaBackfill.stats = stats;
  }
  if (!Array.isArray(existingProfile.achievements)) {
    schemaBackfill.achievements = achievements;
  }

  return {
    hydratedProfile,
    backfill: {
      identity: needsIdentityBackfill ? identityFallbacks : null,
      schema: Object.keys(schemaBackfill).length > 0 ? schemaBackfill : null,
    },
  };
};

const DEFAULT_STATS = {
  totalTimeWorked: 0,
  palletsLoaded: 0,
  palletsLoadedInSession: 0,
  totalSessions: 0,
  bestScore: 0,
  totalScore: 0,
  perfectScores: 0,
  nightShiftsCompleted: 0,
  pickingTotalSessions: 0,
  pickingTotalTimeWorked: 0,
  pickingTotalBoxes: 0,
  pickingTotalOrders: 0,
  pickingBestRate: 0,
  pickingTotalScore: 0,
  pickingBestScore: 0,
  pickingBoxesInSession: 0,
};

export function useUserProfile() {
  return useContext(UserProfileContext);
}

export function UserProfileProvider({ children }) {
  const { user } = useAuth();
  const { isOffline } = useNetwork();
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStale, setIsStale] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState(null);

  const loadRequestRef = useRef(0);
  const unsubscribeRef = useRef(null);
  const noCacheTimeoutRef = useRef(null);
  const hasAnyDataRef = useRef(false);

  const clearNoCacheTimeout = () => {
    if (noCacheTimeoutRef.current) {
      clearTimeout(noCacheTimeoutRef.current);
      noCacheTimeoutRef.current = null;
    }
  };

  const teardownSubscription = () => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    clearNoCacheTimeout();
  };

  // Initialize or load user profile
  useEffect(() => {
    let isMounted = true;
    if (user?.id) {
      if (user?.isGuest) {
        console.log('👤 Guest user, initializing local guest profile');
        teardownSubscription();
        loadRequestRef.current += 1;
        hasAnyDataRef.current = false;
        setProfile({
          userId: user.id,
          displayName: user.name || 'Gość',
          name: user.name || 'Gość',
          email: user.email || '',
          level: 1,
          totalXP: 0,
          achievements: [],
          stats: DEFAULT_STATS,
        });
        setIsLoading(false);
        setIsStale(false);
        setIsSyncing(false);
        setError(null);
      } else {
        console.log('📱 Loading profile for user:', user?.id); // DEBUG LOG
        // Reset immediately so a user switch can never render the previous user's profile, even briefly.
        setProfile(null);
        setError(null);
        setIsStale(false);
        setIsLoading(true);
        loadUserProfile(user?.id, () => isMounted);
      }
    } else {
      teardownSubscription();
      loadRequestRef.current += 1;
      hasAnyDataRef.current = false;
      console.log('❌ No user logged in');
      setProfile(null);
      setIsLoading(false);
      setIsStale(false);
      setIsSyncing(false);
      setError(null);
    }
    return () => {
      isMounted = false;
      teardownSubscription();
    };
  }, [user?.id, user?.isGuest]);

  // Applies a Firestore snapshot to React state + cache. Distinguishes
  // server-confirmed data (metadata.fromCache === false && !hasPendingWrites)
  // from local-only data (our own cacheStore hydration, Firestore's in-memory
  // cache, or an unacknowledged optimistic write) so we never write unconfirmed
  // data back into the persistent cache, and never run backfill writes offline.
  const handleProfileSnapshot = (snapshot, userId, requestId, getIsMounted) => {
    if (requestId !== loadRequestRef.current || !getIsMounted()) return;

    const fromCache = snapshot.metadata.fromCache;
    const hasPendingWrites = snapshot.metadata.hasPendingWrites;
    const serverConfirmed = !fromCache && !hasPendingWrites;

    if (!snapshot.exists()) {
      if (!serverConfirmed || hasAnyDataRef.current) {
        // Inconclusive local-only read, OR a server-confirmed negative result that
        // contradicts data we already trust (cache/previous snapshot). Firestore's
        // watch stream can transiently report "not found" while (re)establishing a
        // listener; a known-good profile must never be wiped because of it.
        setIsSyncing(true);
        return;
      }
      // HARD LOCK: only reachable when we have no prior data at all for this user.
      console.error('❌ User profile document does not exist in Firestore for userId:', userId);
      hasAnyDataRef.current = true;
      clearNoCacheTimeout();
      setProfile(null);
      setError('not-found');
      setIsLoading(false);
      setIsStale(false);
      setIsSyncing(false);
      return;
    }

    const existingProfile = snapshot.data();
    const { hydratedProfile, backfill } = hydrateProfileData(existingProfile, userId, user);

    hasAnyDataRef.current = true;
    clearNoCacheTimeout();
    console.log(serverConfirmed ? '✅ Profile confirmed by server:' : '📦 Profile snapshot (local/pending):', hydratedProfile);
    setProfile(hydratedProfile);
    setIsLoading(false);
    setError(null);

    if (serverConfirmed) {
      setIsStale(false);
      setIsSyncing(false);
      setCacheEntry(PROFILE_CACHE_DOMAIN, userId, hydratedProfile).catch(() => {});
      runBackfillIfNeeded(userId, backfill);
    } else {
      // Local-only snapshot: show it, but don't treat it as confirmed truth yet.
      setIsStale(true);
      setIsSyncing(true);
    }
  };

  const handleProfileError = (snapshotError, requestId, getIsMounted) => {
    if (requestId !== loadRequestRef.current || !getIsMounted()) return;

    console.error('❌ Error observing profile:', snapshotError?.code, snapshotError?.message);
    const isOfflineError = snapshotError?.code === 'unavailable';

    setIsSyncing(false);
    if (!hasAnyDataRef.current) {
      clearNoCacheTimeout();
      setIsLoading(false);
      setError(isOfflineError ? 'profile-unavailable-offline' : (snapshotError?.code || 'unknown'));
      return;
    }

    // We already have a known-good (cached or server) profile displayed.
    // An offline error is expected and must not erase it or surface as a user-facing error.
    if (!isOfflineError) {
      setError(snapshotError?.code || 'unknown');
    }
  };

  // Best-effort only: identity/schema backfill is only attempted once data is
  // server-confirmed, so it never fires purely off of a cache-hydrated or
  // offline-restored profile. A failure here must not affect the displayed profile.
  const runBackfillIfNeeded = async (userId, backfill) => {
    if (!backfill.identity && !backfill.schema) return;
    const userRef = doc(db, 'users', userId);
    try {
      if (backfill.identity) {
        await updateDoc(userRef, backfill.identity);
      }
      if (backfill.schema) {
        await updateDoc(userRef, backfill.schema);
      }
    } catch (backfillError) {
      console.warn('⚠️ Profile backfill failed (non-fatal):', backfillError);
    }
  };

  const loadUserProfile = async (userId, getIsMounted = () => true) => {
    teardownSubscription();
    const requestId = ++loadRequestRef.current;
    hasAnyDataRef.current = false;

    // 1. Cache-first hydration: shows the last known-good profile instantly,
    // independent of network state, before we even talk to Firestore.
    try {
      const cached = await getCacheEntry(PROFILE_CACHE_DOMAIN, userId);
      if (requestId !== loadRequestRef.current || !getIsMounted()) return;
      if (cached?.data) {
        console.log('📦 Hydrated profile from local cache');
        hasAnyDataRef.current = true;
        setProfile(cached.data);
        setIsStale(true);
        setIsLoading(false);
        setError(null);
      }
    } catch (cacheError) {
      console.warn('⚠️ Failed to read profile cache:', cacheError);
    }

    setIsSyncing(true);

    // Safety net for cold offline starts with no cache: never wait forever.
    // useNetwork() is used only to shorten this wait when we *already know*
    // we're offline (isOffline is strictly true, never true during the initial
    // NetInfo "checking" state) - it is never the thing that decides correctness.
    if (!hasAnyDataRef.current) {
      const delay = isOffline ? 0 : OFFLINE_NO_CACHE_TIMEOUT_MS;
      noCacheTimeoutRef.current = setTimeout(() => {
        if (requestId !== loadRequestRef.current || !getIsMounted()) return;
        if (!hasAnyDataRef.current) {
          setIsLoading(false);
          setIsSyncing(false);
          setError('profile-unavailable-offline');
        }
      }, delay);
    }

    // 2. Live Firestore subscription. Self-heals on reconnect (Firestore's
    // watch stream automatically resumes), and gives us fromCache/hasPendingWrites
    // metadata to know when data is truly server-confirmed.
    const userRef = doc(db, 'users', userId);
    unsubscribeRef.current = onSnapshot(
      userRef,
      { includeMetadataChanges: true },
      (snapshot) => handleProfileSnapshot(snapshot, userId, requestId, getIsMounted),
      (snapshotError) => handleProfileError(snapshotError, requestId, getIsMounted)
    );
  };

  // Get total cached (unsynced) XP
  const getLocalCachedXP = async () => {
    try {
      const total = await PendingXPService.getUnsyncedXPTotal();
      return total;
    } catch (error) {
      console.error('❌ Error getting cached XP:', error);
      return 0;
    }
  };

  // Award XP
  const awardXP = async (xpAmount) => {
    try {
      if (!user?.id) {
        console.error('❌ User not authenticated');
        return null;
      }

      const numericXP = Number(xpAmount);
      if (!Number.isFinite(numericXP) || numericXP < 0) {
        console.error('Invalid XP amount:', xpAmount);
        return null;
      }

      const userRef = doc(db, 'users', user.id);
      const result = await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(userRef);

        if (!snapshot.exists()) {
          console.error('❌ Profile not found in Firestore');
          return null;
        }

        const freshProfile = snapshot.data();
        const currentTotalXP = Number(freshProfile.totalXP);
        const safeCurrentTotalXP = Number.isFinite(currentTotalXP) && currentTotalXP >= 0
          ? currentTotalXP
          : 0;
        const newTotalXP = safeCurrentTotalXP + numericXP;
        const newLevel = calculateLevelFromXP(newTotalXP).level;

        transaction.update(userRef, {
          totalXP: newTotalXP,
          level: newLevel,
        });

        return {
          previousLevel: Number(freshProfile.level) || 1,
          newLevel,
          newTotalXP,
        };
      });

      if (!result) {
        return null;
      }

      // Merge with the latest React state; do not replace it with a stale profile snapshot.
      setProfile((previous) => ({
        ...(previous || {}),
        totalXP: result.newTotalXP,
        level: result.newLevel,
      }));

      console.log('✅ XP saved:', { xpAmount: numericXP, ...result });

      return {
        xpEarned: numericXP,
        newLevel: result.newLevel,
        leveledUp: result.newLevel > result.previousLevel,
        newTotalXP: result.newTotalXP,
      };
    } catch (error) {
      console.error('❌ Error awarding XP:', error.message);
      return null;
    }
  };

  // Add new achievement
  const unlockAchievement = async (achievementId) => {
    const profileUserId = profile?.userId || user?.id;
    if (!profileUserId) {
      console.error('❌ No profile to unlock achievement');
      return false;
    }

    // Fetch FRESH profile from Firestore
    const userRef = doc(db, 'users', profileUserId);
    const freshSnap = await getDoc(userRef);  // ✅ Now it exists!
    const freshProfile = freshSnap.data();

    // Use FRESH achievements array
    const updatedAchievements = [
      ...(Array.isArray(freshProfile.achievements) ? freshProfile.achievements : []),
      achievementId,
    ];

    // Save to Firestore
    await updateDoc(userRef, { achievements: updatedAchievements });

    // Merge with the latest React state so XP, level, and stats cannot be reverted.
    setProfile((previous) => ({
      ...(previous || {}),
      ...freshProfile,
      achievements: updatedAchievements,
    }));
    return true;
  }

  // Update session stats
  const updateStats = async (newStats) => {
    if (!profile) {
      console.error('❌ No profile to update stats');
      return;
    }

    const mergedStats = {
      ...DEFAULT_STATS,
      ...(profile.stats || {}),
      ...newStats,
    };

    // Merge with the latest React state instead of the render-time profile snapshot.
    setProfile((previous) => ({
      ...(previous || {}),
      stats: mergedStats,
    }));

    // ✅ SAVE TO FIRESTORE
    try {
      const userRef = doc(db, 'users', user?.id || profile.userId);
      await updateDoc(userRef, {
        stats: mergedStats,
      });
      console.log('✅ Stats updated:', mergedStats);
    } catch (error) {
      console.error('❌ Error saving stats to Firestore:', error);
    }
  };

  const updateProfileNameLocally = (newName) => {
    setProfile((prev) =>
      prev
        ? {
          ...prev,
          name: newName,
          displayName: newName,
        }
        : prev
    );
  };

  const value = {
    profile,
    isLoading,
    isStale,
    isSyncing,
    error,
    awardXP,
    unlockAchievement,
    updateStats,
    loadUserProfile,
    getLocalCachedXP,
    updateProfileNameLocally,
  };

  return (
    <UserProfileContext.Provider value={value}>
      {children}
    </UserProfileContext.Provider>
  );
}

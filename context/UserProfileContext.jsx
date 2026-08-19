import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { calculateLevelFromXP, calculateXPFromScore, checkAchievements } from '../constants/LevelSystem';
import { collection, doc, getDoc, getDocs, runTransaction, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { PendingXPService } from '../services/PendingXPService';

const UserProfileContext = createContext();

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
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const loadRequestRef = useRef(0);

  // Initialize or load user profile
  useEffect(() => {
    if (user) {
      console.log('📱 Loading profile for user:', user.id); // DEBUG LOG
      setIsLoading(true);
      loadUserProfile(user.id);
    } else {
      loadRequestRef.current += 1;
      console.log('❌ No user logged in');
      setProfile(null);
      setIsLoading(false);
    }
  }, [user]);

  const loadUserProfile = async (userId) => {
    const requestId = ++loadRequestRef.current;

    try {
      console.log('🔄 Fetching profile from Firestore...');

      // Fetch user profile from Firestore
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        // User profile exists
        const existingProfile = userSnap.data();

        const parsedXP = Number(existingProfile.totalXP);
        const hasValidXP = Number.isFinite(parsedXP) && parsedXP >= 0;
        let totalXP = hasValidXP ? parsedXP : 0;

        const parsedLevel = Number(existingProfile.level);
        let level = Number.isFinite(parsedLevel) && parsedLevel >= 1
          ? Math.floor(parsedLevel)
          : calculateLevelFromXP(totalXP).level;

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

        if (needsIdentityBackfill && user) {
          await updateDoc(userRef, identityFallbacks);
        }

        const hydratedProfile = {
          ...existingProfile,
          ...identityFallbacks,
          userId,
          stats,
          achievements,
          totalXP,
          level,
        };
        const schemaBackfill = {};
        if (!hasValidXP) {
          // Recover progress from saved sessions created before the profile fields existed.
          const historySnapshot = await getDocs(collection(db, 'users', userId, 'scoreHistory'));
          if (!historySnapshot.empty) {
            let recoveredXP = 0;
            const recoveredStats = { ...DEFAULT_STATS };

            historySnapshot.forEach((sessionDoc) => {
              const session = sessionDoc.data();
              const score = Number(session.score ?? session.picking?.score);
              const safeScore = Number.isFinite(score) ? score : 0;
              const sessionXP = calculateXPFromScore(safeScore);
              const sessionTime = Number(session.sessionTime ?? session.loadingTime) || 0;
              const isPicking = session.sessionType === 'picking';
              const boxes = Number(session.picking?.totalBoxes) || 0;
              const orders = Number(session.picking?.totalOrders) || 0;
              const pallets = Number(session.palletsLoaded) || 0;

              recoveredXP += sessionXP;
              recoveredStats.totalSessions += 1;
              recoveredStats.totalTimeWorked += sessionTime / 3600;
              recoveredStats.totalScore += safeScore;
              recoveredStats.bestScore = Math.max(recoveredStats.bestScore, safeScore);
              recoveredStats.palletsLoaded += pallets;
              recoveredStats.perfectScores += safeScore === 10 ? 1 : 0;
              recoveredStats.nightShiftsCompleted += session.nightShift ? 1 : 0;

              if (isPicking) {
                recoveredStats.pickingTotalSessions += 1;
                recoveredStats.pickingTotalTimeWorked += sessionTime / 3600;
                recoveredStats.pickingTotalBoxes += boxes;
                recoveredStats.pickingTotalOrders += orders;
                recoveredStats.pickingTotalScore += safeScore;
                recoveredStats.pickingBestScore = Math.max(recoveredStats.pickingBestScore, safeScore);
                recoveredStats.pickingBoxesInSession = boxes;
              }
            });

            totalXP = recoveredXP;
            level = calculateLevelFromXP(totalXP).level;
            stats = recoveredStats;
            achievements = checkAchievements(
              { ...stats, level, totalXP },
              0,
              []
            );
            schemaBackfill.totalXP = totalXP;
            schemaBackfill.level = level;
            schemaBackfill.stats = stats;
            schemaBackfill.achievements = achievements;
            console.log('🔧 Recovered profile progress from scoreHistory:', {
              totalXP,
              level,
              achievements: achievements.length,
              sessions: stats.totalSessions,
            });
          } else {
            console.warn('⚠️ Profile has no valid totalXP and no sessions to recover.');
          }
        }
        // Recovery may have changed these values; reflect them in the profile returned to React.
        hydratedProfile.totalXP = totalXP;
        hydratedProfile.level = level;
        hydratedProfile.stats = stats;
        hydratedProfile.achievements = achievements;

        if (!Number.isFinite(parsedLevel) || parsedLevel < 1) {
          schemaBackfill.level = level;
        }
        if (!existingProfile.stats || typeof existingProfile.stats !== 'object') {
          schemaBackfill.stats = stats;
        }
        if (!Array.isArray(existingProfile.achievements)) {
          schemaBackfill.achievements = achievements;
        }
        if (Object.keys(schemaBackfill).length > 0) {
          await updateDoc(userRef, schemaBackfill);
        }

        console.log('✅ Profile found:', hydratedProfile);
        if (requestId === loadRequestRef.current) {
          setProfile(hydratedProfile);
          setError(null);
        }
      } else {
        // First time user - create profile
        console.log('🆕 First time user, creating profile...');
        const newProfile = {
          userId,
          displayName: user?.name || '',
          name: user?.name || '',
          email: user?.email || '',
          level: 1,
          totalXP: 0,
          achievements: [],
          stats: {
            totalTimeWorked: 0,
            palletsLoaded: 0,
            palletsLoadedInSession: 0,
            totalSessions: 0,
            bestScore: 0,
            totalScore: 0,
          },
          lastPalletsUpdateDate: new Date().toDateString(),
          createdAt: new Date().toISOString(),
        };

        await setDoc(userRef, newProfile);
        console.log('✅ Profile created:', newProfile);
        if (requestId === loadRequestRef.current) {
          setProfile(newProfile);
          setError(null);
        }
      }
    } catch (error) {
      console.error('❌ Error loading profile:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      if (requestId === loadRequestRef.current) {
        setError(error.message);
        setProfile(null);
      }
    } finally {
      if (requestId === loadRequestRef.current) {
        setIsLoading(false);
      }
    }
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

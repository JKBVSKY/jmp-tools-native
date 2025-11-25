import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { calculateLevelFromXP } from '../constants/LevelSystem';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

const UserProfileContext = createContext();

export function useUserProfile() {
  return useContext(UserProfileContext);
}

export function UserProfileProvider({ children }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize or load user profile
  useEffect(() => {
    if (user) {
      console.log('📱 Loading profile for user:', user.id); // DEBUG LOG
      loadUserProfile(user.id);
    } else {
      console.log('❌ No user logged in');
      setProfile(null);
      setIsLoading(false);
    }
  }, [user]);

  const loadUserProfile = async (userId) => {
    try {
      console.log('🔄 Fetching profile from Firestore...');

      // Fetch user profile from Firestore
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        // User profile exists
        console.log('✅ Profile found:', userSnap.data());
        setProfile(userSnap.data());
        setError(null);
      } else {
        // First time user - create profile
        console.log('🆕 First time user, creating profile...');
        const newProfile = {
          userId,
          level: 1,
          totalXP: 0,
          achievements: [],
          stats: {
            totalTimeWorked: 0,
            palletsLoaded: 0,
            totalSessions: 0,
            bestScore: 0,
            totalScore: 0,
          },
          createdAt: new Date().toISOString(),
        };

        await setDoc(userRef, newProfile);
        console.log('✅ Profile created:', newProfile);
        setProfile(newProfile);
        setError(null);
      }
    } catch (error) {
      console.error('❌ Error loading profile:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      setError(error.message);
      setProfile(null);
    } finally {
      setIsLoading(false);
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
    if (!user || !user.id) {
      console.error('❌ User not authenticated');
      return null;
    }

    // ✅ NEW: Add timeout to detect offline
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Firestore timeout - likely offline')), 3000) // 3 second timeout
    );

    const awardPromise = (async () => {
      const userRef = doc(db, 'users', user.id);
      const freshSnap = await Promise.race([
        getDoc(userRef),
        timeoutPromise
      ]);

      if (!freshSnap.exists()) {
        console.error('❌ Profile not found in Firestore');
        return null;
      }

      const freshProfile = freshSnap.data();
      const currentTotalXP = freshProfile.totalXP || 0;

      const newTotalXP = currentTotalXP + xpAmount;
      const levelData = calculateLevelFromXP(newTotalXP);

      // ✅ Update with timeout
      await Promise.race([
        updateDoc(userRef, {
          totalXP: newTotalXP,
          level: levelData.level,
        }),
        timeoutPromise
      ]);

      const updated = {
        ...freshProfile,
        totalXP: newTotalXP,
        level: levelData.level,
      };
      setProfile(updated);

      console.log('✅ XP saved:', { xpAmount, newTotalXP, level: levelData.level });

      return {
        xpEarned: xpAmount,
        newLevel: levelData.level,
        leveledUp: levelData.level > (freshProfile.level || 1),
      };
    })();

    return await Promise.race([
      awardPromise,
      timeoutPromise
    ]);
  } catch (error) {
    console.error('❌ Error awarding XP (will cache):', error.message);
    return null; // ✅ Return null so fallback caching triggers
  }
};

  // Add new achievement
  const unlockAchievement = async (achievementId) => {
    // Fetch FRESH profile from Firestore
    const userRef = doc(db, 'users', profile.userId);
    const freshSnap = await getDoc(userRef);  // ✅ Now it exists!
    const freshProfile = freshSnap.data();

    // Use FRESH achievements array
    const updatedAchievements = [...freshProfile.achievements, achievementId];

    // Save to Firestore
    await updateDoc(userRef, { achievements: updatedAchievements });

    // Update state with fresh data
    setProfile({ ...freshProfile, achievements: updatedAchievements });
  }

  // Update session stats
  const updateStats = async (newStats) => {
    if (!profile) {
      console.error('❌ No profile to update stats');
      return;
    }

    const updated = {
      ...profile,
      stats: {
        ...profile.stats,
        ...newStats,
      },
    };

    setProfile(updated);

    // ✅ SAVE TO FIRESTORE
    try {
      const userRef = doc(db, 'users', profile.userId);
      await updateDoc(userRef, {
        stats: updated.stats,
      });
      console.log('✅ Stats updated:', updated.stats);
    } catch (error) {
      console.error('❌ Error saving stats to Firestore:', error);
    }
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
  };

  return (
    <UserProfileContext.Provider value={value}>
      {children}
    </UserProfileContext.Provider>
  );
}
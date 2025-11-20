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

  // Award XP after completing a work session
  const awardXP = async (xpAmount) => {
    if (!profile) {
      console.error('❌ No profile to award XP to');
      return;
    }

    const newTotalXP = profile.totalXP + xpAmount;
    const levelData = calculateLevelFromXP(newTotalXP);

    const updated = {
      ...profile,
      totalXP: newTotalXP,
      level: levelData.level,
    };

    setProfile(updated);

    // ✅ SAVE TO FIRESTORE
    try {
      const userRef = doc(db, 'users', profile.userId);
      await updateDoc(userRef, {
        totalXP: newTotalXP,
        level: levelData.level,
      });
      console.log('✅ XP saved:', { xpAmount, newTotalXP, level: levelData.level });
    } catch (error) {
      console.error('❌ Error saving XP to Firestore:', error);
    }

    return {
      xpEarned: xpAmount,
      newLevel: levelData.level,
      leveledUp: levelData.level > profile.level,
    };
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
  };

  return (
    <UserProfileContext.Provider value={value}>
      {children}
    </UserProfileContext.Provider>
  );
}
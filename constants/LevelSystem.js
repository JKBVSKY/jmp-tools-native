/**
 * LevelSystem.js
 * 
 * This file contains all the functions and constants for your gamification system:
 * - XP calculation based on session score
 * - Level calculation from total XP
 * - Achievement system
 */

// ============================================
// XP CALCULATION FROM SESSION SCORE
// ============================================

/**
 * Calculate XP earned from a work session based on score (0-10)
 */
export const calculateXPFromScore = (score) => {
  // Convert to number just in case
  const numScore = parseFloat(score);

  if (numScore >= 9.5) {
    return 1000; // Perfect score bonus!
  } else if (numScore >= 8.5) {
    return 900;
  } else if (numScore >= 8.0) {
    return 800;
  } else if (numScore >= 7.0) {
    return 700;
  } else if (numScore >= 6.0) {
    return 600;
  } else if (numScore >= 5.0) {
    return 500;
  } else if (numScore >= 4.0) {
    return 400;
  } else if (numScore >= 3.0) {
    return 300;
  } else {
    return 200;
  }
};

// ============================================
// LEVEL CALCULATION FROM TOTAL XP
// ============================================

/**
 * Calculate what level user should be based on total XP
 * 
 * XP formula: Each level requires (level * 1000) XP to reach it
 * 
 * Level 1: 0 XP needed
 * Level 2: 1,000 XP needed (1000 total)
 * Level 3: 2,000 XP needed (3000 total)
 * Level 4: 3,000 XP needed (6000 total)
 * Level 5: 4,000 XP needed (10000 total)
 * ... and so on
 */
export const calculateLevelFromXP = (totalXP) => {
  let level = 1;
  let xpRequired = 0;

  // Keep adding levels while user has enough XP
  while (xpRequired + level * 1000 <= totalXP) {
    xpRequired += level * 1000;
    level++;
  }

  // Calculate current XP progress towards next level
  const currentXP = totalXP - xpRequired;
  const xpToNextLevel = level * 1000;

  return {
    level,
    currentXP,
    xpToNextLevel,
    totalXP,
  };
};

// ============================================
// ACHIEVEMENTS SYSTEM
// ============================================

/**
 * All available achievements in your game
 * Each achievement has:
 * - id: unique identifier
 * - name: display name
 * - icon: emoji icon
 * - description: what it does
 * - requirement: what's needed to unlock
 */
export const ACHIEVEMENTS = {
  FIRST_SHIFT: {
    id: 'achievement_first_shift',
    name: 'Pierwsza zmiana',
    icon: '🌅',
    description: 'Complete your first work session',
    requirement: 'Complete 1 session',
  },
  SPEED_HUNTER: {
    id: 'achievement_speed_hunter',
    name: 'Rajdowiec',
    icon: '⚡',
    description: 'Load 400+ pallets in one session',
    requirement: '400+ pallets loaded in one session',
  },
  CONSISTENCY: {
    id: 'achievement_consistency',
    name: 'Konsekwentny',
    icon: '📈',
    description: 'Maintain 8.5+ average score',
    requirement: 'Average score >= 8.5',
  },
  NIGHT_OWL: {
    id: 'achievement_night_owl',
    name: 'Nocny Marek',
    icon: '🌙',
    description: 'Complete 20 night shifts',
    requirement: '20 shifts between 22:00-06:00',
  },
  MASTER_LOADER: {
    id: 'achievement_master_loader',
    name: 'Mistrz Ładowania',
    icon: '👑',
    description: 'Reach level 50',
    requirement: 'Level 50',
  },
  PERFECTIONIST: {
    id: 'achievement_perfectionist',
    name: 'Perfekcjonista',
    icon: '💎',
    description: 'Score 10.0 on 5 sessions',
    requirement: 'Get perfect score 5 times',
  },
  CENTURY: {
    id: 'achievement_century',
    name: 'Klub Stulecia',
    icon: '💯',
    description: 'Load 1000 pallets total',
    requirement: 'totalPallets >= 1000',
  },
  MARATHON: {
    id: 'achievement_marathon',
    name: 'Maratończyk',
    icon: '🏃',
    description: 'Work for 100 hours total',
    requirement: 'totalTimeWorked >= 100h',
  },
};

/**
 * Check if user earned a new achievement
 * 
 * Call this function after each work session to check
 * if user unlocked any new achievements
 * 
 * Returns array of achievement IDs that were just unlocked
 */
export const checkAchievements = (userStats, newScore, alreadyUnlocked = []) => {
  const newAchievements = [];

  console.log('🔍 Achievement checking started with stats:', userStats);
  console.log('📝 Already unlocked:', alreadyUnlocked);

  // Check FIRST_SHIFT - first time doing a session
  if (userStats.totalSessions >= 1 && !alreadyUnlocked.includes(ACHIEVEMENTS.FIRST_SHIFT.id)) {
    newAchievements.push(ACHIEVEMENTS.FIRST_SHIFT.id);
    console.log('🏆 ✅ FIRST_SHIFT: TRUE - totalSessions is', userStats.totalSessions);
  } else {
    console.log('🏆 ❌ FIRST_SHIFT: FALSE - totalSessions is', userStats.totalSessions);
  }

    // Check SPEED_HUNTER - load 400 pallets in ONE session
    if (userStats.palletsLoadedInSession >= 400 && !alreadyUnlocked.includes(ACHIEVEMENTS.SPEED_HUNTER.id)) {
      newAchievements.push(ACHIEVEMENTS.SPEED_HUNTER.id);
      console.log('🏆 ✅ SPEED_HUNTER: TRUE - palletsLoadedInSession is', userStats.palletsLoadedInSession);
    } else {
      console.log('🏆 ❌ SPEED_HUNTER: FALSE - palletsLoadedInSession is', userStats.palletsLoadedInSession);
    }

// Check PERFECTIONIST - got 10.0 score 5+ times
if (userStats.perfectScores >= 5 && !alreadyUnlocked.includes(ACHIEVEMENTS.PERFECTIONIST.id)) {
  newAchievements.push(ACHIEVEMENTS.PERFECTIONIST.id);
  console.log('🏆 ✅ PERFECTIONIST: TRUE - perfectScores is', userStats.perfectScores);
} else {
  console.log('🏆 ❌ PERFECTIONIST: FALSE - perfectScores is', userStats.perfectScores);
}

    // Check MASTER_LOADER - level 50
    if (userStats.level >= 50 && !alreadyUnlocked.includes(ACHIEVEMENTS.MASTER_LOADER.id)) {
        newAchievements.push(ACHIEVEMENTS.MASTER_LOADER.id);
        console.log('🏆 ✅ MASTER_LOADER: TRUE - Level is', userStats.level);
    } else {
        console.log('🏆 ❌ MASTER_LOADER: FALSE - Level is', userStats.level);
    }


// Check NIGHT_OWL - 20 shifts between 22:00-06:00
if (userStats.nightShiftsCompleted >= 20 && !alreadyUnlocked.includes(ACHIEVEMENTS.NIGHT_OWL.id)) {
  newAchievements.push(ACHIEVEMENTS.NIGHT_OWL.id);
  console.log('🏆 ✅ NIGHT_OWL: TRUE - Night shifts completed:', userStats.nightShiftsCompleted);
} else {
  console.log('🏆 ❌ NIGHT_OWL: FALSE - Night shifts completed:', userStats.nightShiftsCompleted);
}

  // Check CONSISTENCY - average score >= 8.5
  const averageScore = userStats.totalSessions > 0 ? userStats.totalScore / userStats.totalSessions : 0;
  if (averageScore >= 8.5 && !alreadyUnlocked.includes(ACHIEVEMENTS.CONSISTENCY.id)) {
    newAchievements.push(ACHIEVEMENTS.CONSISTENCY.id);
    console.log('🏆 ✅ CONSISTENCY: TRUE - Average score:', averageScore);
  } else {
    console.log('🏆 ❌ CONSISTENCY: FALSE - Average score:', averageScore, '(need >= 8.5)');
  }

  // ✅ Check CENTURY - 1000+ total pallets
  if (userStats.palletsLoaded >= 1000 && !alreadyUnlocked.includes(ACHIEVEMENTS.CENTURY.id)) {
    newAchievements.push(ACHIEVEMENTS.CENTURY.id);
    console.log('🏆 ✅ CENTURY: TRUE - Pallets loaded:', userStats.palletsLoaded);
  } else {
    console.log('🏆 ❌ CENTURY: FALSE - Pallets loaded:', userStats.palletsLoaded);
  }

  // ✅ Check MARATHON - 100+ hours worked
  if (userStats.totalTimeWorked >= 100 && !alreadyUnlocked.includes(ACHIEVEMENTS.MARATHON.id)) {
    newAchievements.push(ACHIEVEMENTS.MARATHON.id);
    console.log('🏆 ✅ MARATHON: TRUE - Hours worked:', userStats.totalTimeWorked);
  } else {
    console.log('🏆 ❌ MARATHON: FALSE - Hours worked:', userStats.totalTimeWorked, '(need >= 100)');
  }

  console.log('🏆 Final achievements to unlock:', newAchievements);

  return newAchievements;
};

/**
 * Get all achievement objects as an array
 * Useful for displaying all achievements in UI
 */
export const getAllAchievements = () => {
  return Object.values(ACHIEVEMENTS);
};

// ============================================
// EXPORT AS DEFAULT
// ============================================

export default {
  calculateXPFromScore,
  calculateLevelFromXP,
  checkAchievements,
  getAllAchievements,
  ACHIEVEMENTS,
};
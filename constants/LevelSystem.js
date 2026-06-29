/**
 * LevelSystem.js
 *
 * This file contains all the functions and constants for your gamification system:
 * - XP calculation based on session score
 * - Level calculation from total XP
 * - Achievement system
 */

import PalletTier1 from '../assets/icons/PalletTier1';
import PalletTier2 from '../assets/icons/PalletTier2';
import PalletTier3 from '../assets/icons/PalletTier3';
import PalletTier4 from '../assets/icons/PalletTier4';
import PalletTier5 from '../assets/icons/PalletTier5';
import PalletTier6 from '../assets/icons/PalletTier6';

// ============================================
// XP CALCULATION FROM SESSION SCORE
// ============================================

export const calculateXPFromScore = (score) => {
  const numScore = parseFloat(score);

  if (numScore >= 9.5) return 1000;
  if (numScore >= 8.5) return 900;
  if (numScore >= 8.0) return 800;
  if (numScore >= 7.0) return 700;
  if (numScore >= 6.0) return 600;
  if (numScore >= 5.0) return 500;
  if (numScore >= 4.0) return 400;
  if (numScore >= 3.0) return 300;
  return 200;
};

// ============================================
// LEVEL CALCULATION FROM TOTAL XP
// ============================================

export const calculateLevelFromXP = (totalXP = 0) => {
  let level = 1;
  let xpRequired = 0;

  while (xpRequired + level * 1000 <= totalXP) {
    xpRequired += level * 1000;
    level++;
  }

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

export const ACHIEVEMENTS = {
  FIRST_SHIFT: {
    id: 'achievement_first_shift',
    name: 'Pierwsza zmiana',
    icon: '🌅',
    description: 'Tu zaczyna się legenda.',
    requirement: 'Zakończ swoją pierwszą sesję roboczą w aplikacji.',
  },
  SPEED_HUNTER: {
    id: 'achievement_speed_hunter',
    name: 'Rajdowiec',
    icon: '⚡',
    description: '400 palet. Tempo jak wózek bez blokady.',
    requirement: 'Załaduj 400 palet w jednej sesji!',
  },
  CONSISTENCY: {
    id: 'achievement_consistency',
    name: 'Konsekwentny',
    icon: '📈',
    description: 'Stabilność godna mistrza.',
    requirement: 'Utrzymaj średnią ocenę na poziomie 8.5 lub wyżej.',
  },
  NIGHT_OWL: {
    id: 'achievement_night_owl',
    name: 'Nocny Marek',
    icon: '🌙',
    description: 'Nocna zmiana? Standard. 🌙',
    requirement: 'Ukończ 20 sesji między 22:00 - 06:00',
  },
  MASTER_LOADER: {
    id: 'achievement_master_loader',
    name: 'Mistrz Ładowania',
    icon: '👑',
    description: 'Poziom 50. Status: legenda hali.',
    requirement: 'Zdobądź poziom 50',
  },
  PERFECTIONIST: {
    id: 'achievement_perfectionist',
    name: 'Perfekcjonista',
    icon: '💎',
    description: 'Pięć sesji. Pełna dziesiątka.',
    requirement: 'Zdobądź ocenę 10.0 w 5 sesjach',
  },
  PALLETS_1: {
    id: 'achievement_pallets_1',
    name: 'Tysiąc na liczniku',
    icon: PalletTier1,
    description: 'To już nie przypadek. To regularna robota.',
    requirement: 'Załaduj w sumie 1 000 palet.',
  },
  PALLETS_2: {
    id: 'achievement_pallets_2',
    name: 'Wyjadacz Hali',
    icon: PalletTier2,
    description: 'Palety lecą, doświadczenie rośnie.',
    requirement: 'Załaduj w sumie 5 000 palet.',
  },
  PALLETS_3: {
    id: 'achievement_pallets_3',
    name: 'Maszyna do Palet',
    icon: PalletTier3,
    description: 'Tempo, które robi wrażenie.',
    requirement: 'Załaduj w sumie 10 000 palet.',
  },
  PALLETS_4: {
    id: 'achievement_pallets_4',
    name: 'Legenda Zmiany',
    icon: PalletTier4,
    description: 'Twoje wyniki krążą po hali.',
    requirement: 'Załaduj w sumie 25 000 palet.',
  },
  PALLETS_5: {
    id: 'achievement_pallets_5',
    name: 'Żywa Instrukcja Obsługi',
    icon: PalletTier5,
    description: 'Jeśli ktoś wie, jak to się robi — to Ty.',
    requirement: 'Załaduj w sumie 50 000 palet.',
  },
  PALLETS_6: {
    id: 'achievement_pallets_6',
    name: 'Mit Paletowy',
    icon: PalletTier6,
    description: 'Tego wyniku nie da się przebić. Można go tylko podziwiać.',
    requirement: 'Załaduj w sumie 100 000 palet.',
  },
  MARATHON: {
    id: 'achievement_marathon',
    name: 'Maratończyk',
    icon: '🏃',
    description: '100 godzin na liczniku. Bez gadania.',
    requirement: 'Przepracuj w sumie 100 godzin',
  },
};

const getAchievementStats = (userStats = {}) => {
  const totalSessions = userStats.totalSessions || 0;
  const totalScore = userStats.totalScore || 0;
  const averageScore = totalSessions > 0 ? totalScore / totalSessions : 0;

  return {
    totalSessions,
    totalScore,
    averageScore,
    palletsLoadedInSession: userStats.palletsLoadedInSession || 0,
    nightShiftsCompleted: userStats.nightShiftsCompleted || 0,
    level: userStats.level || 0,
    perfectScores: userStats.perfectScores || 0,
    palletsLoaded: userStats.palletsLoaded || 0,
    totalTimeWorked: userStats.totalTimeWorked || 0,
  };
};

export const meetsAchievementRequirement = (achievementId, userStats = {}) => {
  const stats = getAchievementStats(userStats);

  switch (achievementId) {
    case ACHIEVEMENTS.FIRST_SHIFT.id:
      return stats.totalSessions >= 1;
    case ACHIEVEMENTS.SPEED_HUNTER.id:
      return stats.palletsLoadedInSession >= 400;
    case ACHIEVEMENTS.CONSISTENCY.id:
      return stats.averageScore >= 8.5;
    case ACHIEVEMENTS.NIGHT_OWL.id:
      return stats.nightShiftsCompleted >= 20;
    case ACHIEVEMENTS.MASTER_LOADER.id:
      return stats.level >= 50;
    case ACHIEVEMENTS.PERFECTIONIST.id:
      return stats.perfectScores >= 5;
    case ACHIEVEMENTS.PALLETS_1.id:
      return stats.palletsLoaded >= 1000;
    case ACHIEVEMENTS.PALLETS_2.id:
      return stats.palletsLoaded >= 5000;
    case ACHIEVEMENTS.PALLETS_3.id:
      return stats.palletsLoaded >= 10000;
    case ACHIEVEMENTS.PALLETS_4.id:
      return stats.palletsLoaded >= 25000;
    case ACHIEVEMENTS.PALLETS_5.id:
      return stats.palletsLoaded >= 50000;
    case ACHIEVEMENTS.PALLETS_6.id:
      return stats.palletsLoaded >= 100000;
    case ACHIEVEMENTS.MARATHON.id:
      return stats.totalTimeWorked >= 100;
    default:
      return false;
  }
};

export const isAchievementUnlocked = (
  achievementId,
  userStats = {},
  alreadyUnlocked = []
) => {
  return (
    alreadyUnlocked.includes(achievementId) ||
    meetsAchievementRequirement(achievementId, userStats)
  );
};

export const getAchievementProgress = (achievementId, userStats = {}, alreadyUnlocked = []) => {
  const stats = getAchievementStats(userStats);
  const unlocked = isAchievementUnlocked(achievementId, userStats, alreadyUnlocked);

  if (unlocked) {
    return {
      current: 1,
      total: 1,
      percent: 100,
      label: 'Osiągnięcie odblokowane',
      unlockedMessage: 'To osiągnięcie masz już zaliczone.',
      isCompleted: true,
    };
  }

  switch (achievementId) {
    case ACHIEVEMENTS.FIRST_SHIFT.id:
      return {
        current: Math.min(stats.totalSessions, 1),
        total: 1,
        percent: Math.min((stats.totalSessions / 1) * 100, 100),
        label: `${stats.totalSessions} / 1 sesja`,
      };

    case ACHIEVEMENTS.SPEED_HUNTER.id:
      return {
        current: Math.min(stats.palletsLoadedInSession, 400),
        total: 400,
        percent: Math.min((stats.palletsLoadedInSession / 400) * 100, 100),
        label: `${stats.palletsLoadedInSession} / 400 palet w sesji`,
      };

    case ACHIEVEMENTS.CONSISTENCY.id:
      return {
        current: stats.averageScore,
        total: 8.5,
        percent: Math.min((stats.averageScore / 8.5) * 100, 100),
        label: `Średnia: ${stats.averageScore.toFixed(2)} / 8.5`,
      };

    case ACHIEVEMENTS.NIGHT_OWL.id:
      return {
        current: stats.nightShiftsCompleted,
        total: 20,
        percent: Math.min((stats.nightShiftsCompleted / 20) * 100, 100),
        label: `${stats.nightShiftsCompleted} / 20 zmian nocnych`,
      };

    case ACHIEVEMENTS.MASTER_LOADER.id:
      return {
        current: stats.level,
        total: 50,
        percent: Math.min((stats.level / 50) * 100, 100),
        label: `Poziom ${stats.level} / 50`,
      };

    case ACHIEVEMENTS.PERFECTIONIST.id:
      return {
        current: stats.perfectScores,
        total: 5,
        percent: Math.min((stats.perfectScores / 5) * 100, 100),
        label: `${stats.perfectScores} / 5 idealnych wyników`,
      };

    case ACHIEVEMENTS.PALLETS_1.id:
      return {
        current: stats.palletsLoaded,
        total: 1000,
        percent: Math.min((stats.palletsLoaded / 1000) * 100, 100),
        label: `${stats.palletsLoaded} / 1000 palet`,
      };

    case ACHIEVEMENTS.PALLETS_2.id:
      return {
        current: stats.palletsLoaded,
        total: 5000,
        percent: Math.min((stats.palletsLoaded / 5000) * 100, 100),
        label: `${stats.palletsLoaded} / 5000 palet`,
      };

    case ACHIEVEMENTS.PALLETS_3.id:
      return {
        current: stats.palletsLoaded,
        total: 10000,
        percent: Math.min((stats.palletsLoaded / 10000) * 100, 100),
        label: `${stats.palletsLoaded} / 10000 palet`,
      };

    case ACHIEVEMENTS.PALLETS_4.id:
      return {
        current: stats.palletsLoaded,
        total: 25000,
        percent: Math.min((stats.palletsLoaded / 25000) * 100, 100),
        label: `${stats.palletsLoaded} / 25000 palet`,
      };

    case ACHIEVEMENTS.PALLETS_5.id:
      return {
        current: stats.palletsLoaded,
        total: 50000,
        percent: Math.min((stats.palletsLoaded / 50000) * 100, 100),
        label: `${stats.palletsLoaded} / 50000 palet`,
      };

    case ACHIEVEMENTS.PALLETS_6.id:
      return {
        current: stats.palletsLoaded,
        total: 100000,
        percent: Math.min((stats.palletsLoaded / 100000) * 100, 100),
        label: `${stats.palletsLoaded} / 100000 palet`,
      };

    case ACHIEVEMENTS.MARATHON.id:
      return {
        current: stats.totalTimeWorked,
        total: 100,
        percent: Math.min((stats.totalTimeWorked / 100) * 100, 100),
        label: `${stats.totalTimeWorked.toFixed(1)} / 100 godzin`,
      };

    default:
      return {
        current: 0,
        total: 100,
        percent: 0,
        label: 'N/A',
        isCompleted: false,
      };
  }
};

export const checkAchievements = (userStats, newScore, alreadyUnlocked = []) => {
  return Object.values(ACHIEVEMENTS)
    .filter((achievement) => {
      const meetsRequirement = meetsAchievementRequirement(achievement.id, userStats);
      const wasAlreadyUnlocked = alreadyUnlocked.includes(achievement.id);
      return meetsRequirement && !wasAlreadyUnlocked;
    })
    .map((achievement) => achievement.id);
};

export const getAllAchievements = () => {
  return Object.values(ACHIEVEMENTS);
};

export default {
  calculateXPFromScore,
  calculateLevelFromXP,
  isAchievementUnlocked,
  getAchievementProgress,
  checkAchievements,
  getAllAchievements,
  ACHIEVEMENTS,
};
import { invalidateScoreDataCache } from '../../../services/ScoreDataCache';
import { addDoc, collection } from 'firebase/firestore';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { ACHIEVEMENTS, calculateLevelFromXP, calculateXPFromScore, checkAchievements } from '../../../constants/LevelSystem';
import { useAuth } from '../../../context/AuthContext';
import { useCalculator } from '../../../context/CalculatorContext';
import { useUserProfile } from '../../../context/UserProfileContext';
import { db } from '../../../firebase/config';
import { useBackgroundXP } from '../../../hooks/useBackgroundXP';
import { useColors } from '../../../hooks/useColors';
import { appAlert, appConfirm } from '../../../utils/crossPlatformAlert';
import { PICKING_SUBSECTIONS } from './usePickingLogic';

const formatElapsed = (seconds) => {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const h = Math.floor(safeSeconds / 3600);
  const m = Math.floor((safeSeconds % 3600) / 60);
  const s = safeSeconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
};

export default function PickingResults({
  sessionTime,
  startTime,
  endTime,
  boxesCount,
  ordersCount,
  subsection,
  boxesRateGoal,
  pickingSubsectionGoals,
  pickingSubsectionStats,
}) {
  const calc = useCalculator();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const userId = user?.id;
  const { profile, awardXP, updateStats, unlockAchievement } = useUserProfile();
  const { syncPendingXP } = useBackgroundXP(awardXP, true);
  const [isSaving, setIsSaving] = useState(false);

  const normalizedStats = (() => {
    if (pickingSubsectionStats && typeof pickingSubsectionStats === 'object') {
      return pickingSubsectionStats;
    }
    return {};
  })();

  const normalizedGoals = (() => {
    if (pickingSubsectionGoals && typeof pickingSubsectionGoals === 'object') {
      return pickingSubsectionGoals;
    }
    return {};
  })();

  const hasAnySavedSubsectionStats = Object.keys(normalizedStats).length > 0;
  const fallbackStats = hasAnySavedSubsectionStats
    ? normalizedStats
    : (subsection
      ? {
        [subsection]: {
          boxesCount: Number(boxesCount || 0),
          ordersCount: Number(ordersCount || 0),
          sessionTime: Number(sessionTime || 0),
        },
      }
      : {});

  const subsectionEntries = PICKING_SUBSECTIONS
    .map((key) => {
      const item = fallbackStats[key];
      if (!item) return null;

      const itemBoxes = Number(item.boxesCount || 0);
      const itemOrders = Number(item.ordersCount || 0);
      const itemTime = Number(item.sessionTime || 0);
      const itemRate = itemTime > 0 ? itemBoxes / (itemTime / 3600) : 0;

      if (itemBoxes <= 0 && itemOrders <= 0 && itemTime <= 0) {
        return null;
      }

      return {
        subsection: key,
        boxesCount: itemBoxes,
        ordersCount: itemOrders,
        sessionTime: itemTime,
        boxesRate: Number.isFinite(itemRate) ? itemRate : 0,
        boxesRateGoal: Number(normalizedGoals[key] ?? ((key === subsection) ? boxesRateGoal : 0) ?? 0),
      };
    })
    .filter(Boolean);

  const totals = useMemo(() => {
    return subsectionEntries.reduce(
      (acc, item) => {
        acc.boxes += Number(item.boxesCount || 0);
        acc.orders += Number(item.ordersCount || 0);
        acc.time += Number(item.sessionTime || 0);
        return acc;
      },
      { boxes: 0, orders: 0, time: 0 }
    );
  }, [subsectionEntries]);

  const effectiveSessionTime = Math.max(0, Number(sessionTime || totals.time || 0));
  const boxesRate = effectiveSessionTime > 0
    ? totals.boxes / (effectiveSessionTime / 3600)
    : 0;

  const calculateSubsectionScore = (entry) => {
    const subsectionGoal = Number(entry.boxesRateGoal || 0);
    const subsectionRate = Number(entry.boxesRate || 0);

    if (subsectionGoal <= 0) {
      const capped = Math.max(1, Math.min(10, subsectionRate / 6));
      return Number(capped.toFixed(1));
    }

    const ratio = subsectionRate / subsectionGoal;
    const score = Math.max(1, Math.min(10, ratio * 10));
    return Number(score.toFixed(1));
  };

  const calculateSessionScore = () => {
    if (subsectionEntries.length === 0) {
      return 1;
    }

    const weightedScoreSum = subsectionEntries.reduce((sum, entry) => {
      const weight = Math.max(1, Number(entry.sessionTime || 0));
      return sum + calculateSubsectionScore(entry) * weight;
    }, 0);

    const totalWeight = subsectionEntries.reduce(
      (sum, entry) => sum + Math.max(1, Number(entry.sessionTime || 0)),
      0
    );

    if (totalWeight <= 0) {
      return 1;
    }

    return Number((weightedScoreSum / totalWeight).toFixed(1));
  };

  const sessionScore = calculateSessionScore();

  const isNightShiftSession = (startTimeValue) => {
    if (!startTimeValue) return false;

    const date = new Date(startTimeValue);
    if (Number.isNaN(date.getTime())) return false;

    const totalMinutes = date.getHours() * 60 + date.getMinutes();
    const nightStart = 22 * 60;
    const nightEnd = 6 * 60;

    return totalMinutes >= nightStart || totalMinutes < nightEnd;
  };

  const handleSave = async () => {
    if (!userId) {
      appAlert('Błąd', 'Brak zalogowanego użytkownika - nie można zapisać historii.');
      return;
    }

    if (!profile) {
      appAlert('Błąd', 'Profil użytkownika nie jest gotowy. Spróbuj ponownie za chwilę.');
      return;
    }

    try {
      setIsSaving(true);

      const syncResult = await syncPendingXP();
      if (syncResult && syncResult.synced > 0) {
        console.log(
          `✅ Synced ${syncResult.synced} cached actions (+${syncResult.totalXP} XP total)`
        );
      }

      const wasNightShift = isNightShiftSession(startTime);
      const sessionPayload = {
        sessionType: 'picking',
        date: new Date(startTime || Date.now()).toISOString(),
        startTime: startTime || null,
        endTime: endTime || null,
        sessionTime: effectiveSessionTime,
        nightShift: Boolean(wasNightShift),
        picking: {
          subsectionEntries,
          totalBoxes: totals.boxes,
          totalOrders: totals.orders,
          averageBoxesRate: Number(boxesRate.toFixed(2)),
          score: sessionScore,
        },
      };

      const sessionsRef = collection(db, 'users', userId, 'scoreHistory');
      await addDoc(sessionsRef, sessionPayload);
      await invalidateScoreDataCache(userId);

      const xpEarned = calculateXPFromScore(sessionScore);
      const xpResult = await awardXP(xpEarned);

      if (!xpResult) {
        appAlert('Błąd', 'Nie udało się przyznać XP za sesję kompletacji.');
        return;
      }

      const currentStats = profile.stats || {};
      const newStats = {
        totalSessions: (currentStats.totalSessions || 0) + 1,
        totalTimeWorked: (currentStats.totalTimeWorked || 0) + (effectiveSessionTime / 3600),
        totalScore: (currentStats.totalScore || 0) + sessionScore,
        bestScore: Math.max(currentStats.bestScore || 0, sessionScore),
        perfectScores: (currentStats.perfectScores || 0) + (sessionScore === 10 ? 1 : 0),
        nightShiftsCompleted: (currentStats.nightShiftsCompleted || 0) + (wasNightShift ? 1 : 0),
        pickingTotalSessions: (currentStats.pickingTotalSessions || 0) + 1,
        pickingTotalTimeWorked: (currentStats.pickingTotalTimeWorked || 0) + (effectiveSessionTime / 3600),
        pickingTotalBoxes: (currentStats.pickingTotalBoxes || 0) + totals.boxes,
        pickingTotalOrders: (currentStats.pickingTotalOrders || 0) + totals.orders,
        pickingBestRate: Math.max(currentStats.pickingBestRate || 0, boxesRate),
        pickingTotalScore: (currentStats.pickingTotalScore || 0) + sessionScore,
        pickingBestScore: Math.max(currentStats.pickingBestScore || 0, sessionScore),
        pickingBoxesInSession: totals.boxes,
      };

      const achievementsStats = {
        ...newStats,
        level: xpResult.newLevel,
        totalXP: xpResult.newTotalXP,
      };

      const newAchievements = checkAchievements(
        achievementsStats,
        sessionScore,
        profile.achievements || []
      );

      await updateStats(newStats);

      for (const achievementId of newAchievements) {
        const success = await unlockAchievement(achievementId);
        if (success) {
          const achievementDetails = Object.values(ACHIEVEMENTS).find((a) => a.id === achievementId);
          if (achievementDetails) {
            console.log(`🏆 Achievement unlocked: ${achievementDetails.name}`);
          }
        }
      }

      let message = `🎯 Sesja kompletacji zapisana!\n+${xpEarned} XP zdobytych`;

      if (newAchievements.length > 0) {
        const achievementNames = newAchievements
          .map((id) => Object.values(ACHIEVEMENTS).find((a) => a.id === id)?.name)
          .filter(Boolean)
          .join(', ');
        message += `\n🏆 Osiągnięcie${newAchievements.length > 1 ? 's' : ''} odblokowane: ${achievementNames}`;
      }

      if (xpResult.leveledUp) {
        appAlert(
          '🎉 Level Up!',
          `Gratulacje! Zdobyłeś poziom ${xpResult.newLevel}!\n\n${message}`,
          handleFinish
        );
      } else {
        const levelData = calculateLevelFromXP(xpResult.newTotalXP);
        const progressText = `Postęp do Poziomu ${xpResult.newLevel + 1}: ${levelData.currentXP} / ${levelData.xpToNextLevel} XP`;

        appAlert(
          '⭐ Sesja zapisana!',
          `${message}\n\n${progressText}`,
          handleFinish
        );
      }
    } catch (error) {
      console.error('❌ Error saving picking session:', error);
      appAlert('Błąd', `Nie udało się zapisać sesji: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFinish = async () => {
    await calc.clearState();
    calc.updateState({ mode: 'init' });
  };

  const handleDiscard = async () => {
    appConfirm(
      'Odrzuć sesję',
      'Czy na pewno chcesz odrzucić tę sesję kompletacji?',
      async () => {
        await calc.clearState();
        calc.updateState({ mode: 'init' });
      }
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {isSaving && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.iconColor} />
          <Text style={{ color: '#fff', marginTop: 8 }}>Zapisywanie...</Text>
        </View>
      )}
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.title }]}>Sesja kompletacji zakończona</Text>

        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}> 
          <Text style={[styles.label, { color: colors.textSecondary }]}>Czas sesji</Text>
          <Text style={[styles.value, { color: colors.text }]}>{formatElapsed(sessionTime)}</Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}> 
          <Text style={[styles.label, { color: colors.textSecondary }]}>Ocena sesji</Text>
          <Text style={[styles.value, { color: colors.text }]}>{sessionScore.toFixed(1)} / 10.0</Text>
          <Text style={[styles.subValue, { color: colors.textSecondary }]}>+{calculateXPFromScore(sessionScore)} XP</Text>
        </View>

        {subsectionEntries.length === 0 ? (
          <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}> 
            <Text style={[styles.label, { color: colors.textSecondary }]}>Podsekcje</Text>
            <Text style={[styles.valueSmall, { color: colors.text }]}>Brak danych podsekcji.</Text>
          </View>
        ) : (
          subsectionEntries.map((entry) => (
            <View
              key={entry.subsection}
              style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
            >
              <Text style={[styles.label, { color: colors.textSecondary }]}>Podsekcja {entry.subsection}</Text>
              <View style={styles.statsRow}>
                <Text style={[styles.statKey, { color: colors.textSecondary }]}>Czas pracy</Text>
                <Text style={[styles.statValue, { color: colors.text }]}>{formatElapsed(entry.sessionTime)}</Text>
              </View>
              <View style={styles.statsRow}>
                <Text style={[styles.statKey, { color: colors.textSecondary }]}>Paczki</Text>
                <Text style={[styles.statValue, { color: colors.text }]}>{entry.boxesCount}</Text>
              </View>
              <View style={styles.statsRow}>
                <Text style={[styles.statKey, { color: colors.textSecondary }]}>Zamówienia</Text>
                <Text style={[styles.statValue, { color: colors.text }]}>{entry.ordersCount}</Text>
              </View>
              <View style={styles.statsRow}>
                <Text style={[styles.statKey, { color: colors.textSecondary }]}>Wynik / godz</Text>
                <Text style={[styles.statValue, { color: colors.text }]}>{entry.boxesRate.toFixed(2)}</Text>
              </View>
              <Text style={[styles.subValue, { color: colors.textSecondary }]}>Cel: {entry.boxesRateGoal || 'brak'}</Text>
            </View>
          ))
        )}

        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}> 
          <Text style={[styles.label, { color: colors.textSecondary }]}>Start</Text>
          <Text style={[styles.valueSmall, { color: colors.text }]}>{startTime ? new Date(startTime).toLocaleString() : 'Brak'}</Text>
          <Text style={[styles.label, { color: colors.textSecondary, marginTop: 12 }]}>Koniec</Text>
          <Text style={[styles.valueSmall, { color: colors.text }]}>{endTime ? new Date(endTime).toLocaleString() : 'Brak'}</Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.navBackground, borderTopColor: colors.border, paddingBottom: insets.bottom }]}> 
        <TouchableOpacity style={[styles.button, { backgroundColor: colors.outButBackground, borderColor: colors.outButBorder }]} onPress={handleDiscard}>
          <Ionicons name="close-circle-outline" size={20} color={colors.outButText} />
          <Text style={[styles.buttonText, { color: colors.outButText }]}>Odrzuć</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.butBackground }]}
          onPress={handleSave}
          disabled={isSaving}
        >
          <Ionicons name="checkmark-circle-outline" size={20} color={colors.butText} />
          <Text style={[styles.buttonText, { color: colors.butText }]}>Zapisz sesję</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 120,
    gap: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 4,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  value: {
    fontSize: 24,
    fontWeight: '700',
  },
  valueSmall: {
    fontSize: 16,
    fontWeight: '600',
  },
  subValue: {
    marginTop: 6,
    fontSize: 14,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  statKey: {
    fontSize: 14,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
});

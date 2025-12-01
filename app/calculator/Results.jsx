import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors } from '../../_hooks/useColors';
import { useCalculator } from '../../_context/CalculatorContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useUserProfile } from '../../_context/UserProfileContext';
import { calculateXPFromScore, calculateLevelFromXP, checkAchievements, ACHIEVEMENTS } from '../../constants/LevelSystem';
import { PendingXPService } from '../../services/PendingXPService';
import { useBackgroundXP } from '../../_hooks/useBackgroundXP';

export default function Results({
  loadingTime,
  startTime,
  endTime,
  trucksHistory,
  changeMode,
  clearCalculator,
}) {
  const colors = useColors();
  const calc = useCalculator();
  const { awardXP, updateStats, unlockAchievement, profile } = useUserProfile(); // ✅ MOVED INSIDE COMPONENT

  const palletsLoaded = trucksHistory.reduce((sum, t) => sum + Number(t.pallets || 0), 0);
  const trucksCount = trucksHistory.length;
  const palletsRate = loadingTime > 0 ? (palletsLoaded / (loadingTime / 3600)).toFixed(2) : '0.00';

  const { syncPendingXP } = useBackgroundXP(awardXP, true);

  // ✅ Calculate session score (0-10) based on pallets/hour efficiency
  const calculateScore = () => {
    const rate = parseFloat(palletsRate);
    if (rate >= 48) return 10.0;
    if (rate >= 47) return 9.0;
    if (rate >= 46) return 8.0;
    if (rate >= 45) return 7.0;
    if (rate >= 44) return 6.0;
    if (rate >= 43) return 5.0;
    if (rate >= 42) return 4.0;
    if (rate >= 41) return 3.0;
    return 2.0;
  };

  const sessionScore = calculateScore();

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  // ✅ MAIN SAVE HANDLER - NOW WITH CORRECT ORDER!
  const handleSave = async () => {
    try {
      // ✅ STEP 1: Sync cached XP as BATCH
      const syncResult = await syncPendingXP();
      if (syncResult && syncResult.synced > 0) {
        console.log(
          `✅ Synced ${syncResult.synced} cached actions (+${syncResult.totalXP} XP total)`
        );
      }

      const sessionData = {
        id: Date.now(),
        date: new Date().toISOString(),
        loadingTime,
        startTime,
        endTime,
        palletsLoaded,
        trucksCount,
        palletsRate: parseFloat(palletsRate),
        score: sessionScore,
        trucks: trucksHistory,
      };

      // Get existing scores
      const existingScores = await AsyncStorage.getItem('scoreHistory');
      const scores = existingScores ? JSON.parse(existingScores) : [];

      // Add new score
      scores.push(sessionData);

      // Save back to AsyncStorage
      await AsyncStorage.setItem('scoreHistory', JSON.stringify(scores));

      // ✅ STEP 2: Award session completion bonus
      const xpEarned = calculateXPFromScore(sessionScore);
      const xpResult = await awardXP(xpEarned);

      if (!xpResult) {
        Alert.alert('Error', 'Failed to award XP for session');
        return;
      }

      // ✅ STEP 3: Calculate NEW stats (BEFORE checking achievements!)
      const newStats = {
        totalSessions: (profile.stats.totalSessions || 0) + 1,
        totalTimeWorked: (profile.stats.totalTimeWorked || 0) + (loadingTime / 3600),
        palletsLoaded: (profile.stats.palletsLoaded || 0) + palletsLoaded,
        totalScore: (profile.stats.totalScore || 0) + sessionScore,
        bestScore: Math.max(profile.stats.bestScore || 0, sessionScore),
        palletsLoadedInSession: palletsLoaded,  // ✅ ADD THIS - Save the session value
      };

      console.log('📊 New Stats calculated:', newStats);

      // ✅ STEP 4: Check achievements with NEW stats (BEFORE updating!)
      console.log('🔍 Checking achievements with NEW stats...');
      const newAchievements = checkAchievements(
        {
          ...newStats,
          palletsLoadedInSession: palletsLoaded  // ✅ Add this line - pallets from THIS session
        },
        sessionScore,
        profile.achievements
      );
      console.log('🏆 Achievements to unlock:', newAchievements);

      // ✅ STEP 5: Update stats in Firestore
      await updateStats(newStats);
      console.log('✅ Stats saved to Firestore');

      // ✅ STEP 6: Unlock each new achievement
      for (const achievementId of newAchievements) {
        const success = await unlockAchievement(achievementId);
        if (success) {
          const achievementDetails = Object.values(ACHIEVEMENTS).find(a => a.id === achievementId);
          if (achievementDetails) {
            console.log(`🏆 Achievement unlocked: ${achievementDetails.name}`);
          }
        }
      }

      // ✅ STEP 7: Show results to user
      let message = `🎯 Session Complete!\n+${xpEarned} XP earned`;

      if (newAchievements.length > 0) {
        const achievementNames = newAchievements
          .map(id => Object.values(ACHIEVEMENTS).find(a => a.id === id)?.name)
          .filter(Boolean)
          .join(', ');
        message += `\n🏆 Achievement${newAchievements.length > 1 ? 's' : ''} unlocked: ${achievementNames}`;
      }

      if (xpResult.leveledUp) {
        Alert.alert(
          '🎉 Level Up!',
          `Congratulations! You reached level ${xpResult.newLevel}!\n\n${message}`,
          [{ text: 'Continue', onPress: finishSession }]
        );
      } else {
        const levelData = calculateLevelFromXP(profile.totalXP + xpEarned);
        const progressText = `Progress to Level ${xpResult.newLevel + 1}: ${levelData.currentXP} / ${levelData.xpToNextLevel} XP`;

        Alert.alert(
          '⭐ Session Saved!',
          `${message}\n\n${progressText}`,
          [{ text: 'Continue', onPress: finishSession }]
        );
      }
    } catch (error) {
      console.error('❌ Error saving session:', error);
      Alert.alert('Error', 'Failed to save session: ' + error.message);
    }
  };

  const finishSession = async () => {
    try {
      await calc.clearState();
      changeMode('init');
    } catch (error) {
      console.error('Error clearing calculator:', error);
    }
  };

  const handleDiscard = async () => {
    Alert.alert('Discard Session', 'Are you sure? You will lose XP rewards!', [
      { text: 'Cancel' },
      {
        text: 'Discard',
        onPress: async () => {
          await calc.clearState();
          changeMode('init');
        },
        style: 'destructive',
      },
    ]);
  };

  return (
    <ScrollView style={[styles.scrollContent, { backgroundColor: colors.background }]}>
      <View style={styles.container}>
        <Text style={[styles.title, { color: colors.title }]}>Session Complete! ✓</Text>

        {/* Score Display */}
        <View style={[styles.scoreCard, { backgroundColor: colors.cardBackground }]}>
          <View style={styles.scoreContent}>
            <Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>Session Score</Text>
            <Text style={[styles.scoreValue, { color: colors.text }]}>{sessionScore.toFixed(1)}/10.0</Text>
            <Text style={[styles.scoreXP, { color: colors.textSecondary }]}>
              +{calculateXPFromScore(sessionScore)} XP
            </Text>
          </View>
          <View style={styles.scoreIcon}>
            <Ionicons name="star" size={40} color={colors.iconColor} />
          </View>
        </View>

        {/* Stats Cards Section */}
        <View style={styles.statsSection}>
          <View style={styles.statsGrid}>
            {/* Card 1: Elapsed Time */}
            <View style={[styles.statCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="clock" size={20} color={colors.iconColor} />
                <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>Total Time</Text>
              </View>
              <Text style={[styles.cardValue, { color: colors.title }]}>{formatTime(loadingTime)}</Text>
            </View>

            {/* Card 2: Pallets Loaded */}
            <View style={[styles.statCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="cube-send" size={20} color={colors.iconColor} />
                <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>Pallets Loaded</Text>
              </View>
              <Text style={[styles.cardValue, { color: colors.title }]}>{palletsLoaded}</Text>
            </View>
          </View>
          <View style={styles.statsGrid}>
            {/* Card 3: Rate (per hour) */}
            <View style={[styles.statCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="speedometer" size={20} color={colors.iconColor} />
                <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>Rate/hour</Text>
              </View>
              <Text style={[styles.cardValue, { color: colors.title }]}>{palletsRate}</Text>
            </View>

            {/* Card 4: Trucks Loaded */}
            <View style={[styles.statCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="truck" size={20} color={colors.iconColor} />
                <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>Trucks Loaded</Text>
              </View>
              <Text style={[styles.cardValue, { color: colors.title }]}>{trucksCount}</Text>
            </View>
          </View>

        </View>


        {/* Session Details */}
        <View style={[styles.detailsBox, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          <Text style={[styles.detailsTitle, { color: colors.title }]}>Session Details</Text>
          <View style={[styles.detailRow, { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Started:</Text>
            <Text style={[styles.detailValue, { color: colors.title }]}>{formatDate(startTime)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Ended:</Text>
            <Text style={[styles.detailValue, { color: colors.title }]}>{formatDate(endTime)}</Text>
          </View>
        </View>

        {/* Trucks Summary */}
        <View style={[styles.trucksBox, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          <Text style={[styles.trucksTitle, { color: colors.title }]}>Trucks Summary</Text>
          {trucksHistory.map((truck, idx) => (
            <View key={idx} style={[styles.truckRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.truckNum, { color: colors.iconColor }]}>#{truck.displayId}</Text>
              <View style={styles.truckInfo}>
                <Text style={[styles.truckInfo, { color: colors.text }]}>
                  {truck.pallets} pallets • Shop {truck.shop} • Gate {truck.gate}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonsContainer}>
          <Pressable
            style={[
              styles.button,
              {
                backgroundColor: colors.butBackground,
              },
            ]}
            onPress={handleSave}
          >
            <MaterialCommunityIcons name="check" size={20} color={colors.butText} />
            <Text style={[styles.buttonText, { color: colors.butText }]}>Save to History</Text>
          </Pressable>

          <Pressable
            style={[
              styles.button,
              styles.discardButton,
              {
                backgroundColor: 'transparent',
                borderColor: colors.border,
              },
            ]}
            onPress={handleDiscard}
          >
            <MaterialCommunityIcons name="close" size={20} color={colors.text} />
            <Text style={[styles.buttonText, { color: colors.text }]}>Discard</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  scoreCard: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scoreContent: {
    flex: 1,
  },
  scoreLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 5,
  },
  scoreValue: {
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  scoreXP: {
    fontSize: 14,
    fontWeight: '500',
  },
  scoreIcon: {
    marginLeft: 20,
  },
  statsSection: {
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 24,
    padding: 16,
    marginBottom: 12,
    borderWidth: 0,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  cardValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  detailsBox: {
    borderWidth: 0,
    borderRadius: 24,
    padding: 16,
    marginBottom: 20,
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  trucksBox: {
    borderWidth: 0,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  trucksTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  truckRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  truckNum: {
    fontWeight: '600',
    marginRight: 12,
  },
  truckInfo: {
    flex: 1,
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 40,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  discardButton: {
    borderWidth: 1,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
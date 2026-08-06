import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { addDoc, collection } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ThemedCard from '../../../components/ThemedCard';
import { ACHIEVEMENTS, calculateLevelFromXP, calculateXPFromScore, checkAchievements } from '../../../constants/LevelSystem';
import { useAuth } from '../../../context/AuthContext';
import { useCalculator } from '../../../context/CalculatorContext';
import { useUserProfile } from '../../../context/UserProfileContext';
import { db } from '../../../firebase/config';
import { useAutoHorizontalScroll } from '../../../hooks/useAutoHorizontalScroll';
import { useBackgroundXP } from '../../../hooks/useBackgroundXP';
import { useColors } from '../../../hooks/useColors';
import AdjustTimeModal from './AdjustTimeModal';
import { appAlert, appConfirm } from '../../../utils/crossPlatformAlert';


export default function Results({
  sessionTime,
  startTime,
  endTime,
  trucksHistory,
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const calc = useCalculator();
  const { awardXP, updateStats, unlockAchievement, profile } = useUserProfile(); // ✅ MOVED INSIDE COMPONENT
  const { user } = useAuth();
  const userId = user?.id; // uid from AuthContext
  const [isSaving, setIsSaving] = useState(false);
  const initialPalletsLoaded = trucksHistory.reduce((sum, t) => sum + Number(t.pallets || 0), 0);
  const initialTrucksCount = trucksHistory.length;
  const [editedPalletsLoaded, setEditedPalletsLoaded] = useState(initialPalletsLoaded);
  const [editedTrucksCount, setEditedTrucksCount] = useState(initialTrucksCount);
  const [editedStartTime, setEditedStartTime] = useState(startTime);
  const [editedEndTime, setEditedEndTime] = useState(endTime);
  const [activeTimeModal, setActiveTimeModal] = useState(null);
  const [isPalletsModalVisible, setIsPalletsModalVisible] = useState(false);
  const [isTrucksModalVisible, setIsTrucksModalVisible] = useState(false);
  const [palletsInput, setPalletsInput] = useState(String(initialPalletsLoaded));
  const [trucksInput, setTrucksInput] = useState(String(initialTrucksCount));

  const CARD_SIZE = 140;

  useEffect(() => {
    setEditedStartTime(startTime);
    setEditedEndTime(endTime);
    setEditedPalletsLoaded(initialPalletsLoaded);
    setEditedTrucksCount(initialTrucksCount);
    setPalletsInput(String(initialPalletsLoaded));
    setTrucksInput(String(initialTrucksCount));
  }, [startTime, endTime, initialPalletsLoaded, initialTrucksCount]);

  const recalculatedSessionTime = Math.floor((editedEndTime - editedStartTime) / 1000);
  const hasInvalidTimeRange =
    !editedStartTime || !editedEndTime || Number.isNaN(recalculatedSessionTime) || recalculatedSessionTime <= 0;
  const effectiveSessionTime = hasInvalidTimeRange ? 0 : recalculatedSessionTime;
  const palletsRate = effectiveSessionTime > 0 ? (editedPalletsLoaded / (effectiveSessionTime / 3600)).toFixed(2) : '0.00';

  const { syncPendingXP } = useBackgroundXP(awardXP, true);

  // ✅ Calculate session score (0-10) based on pallets/hour efficiency
  const calculateScore = () => {
    const rate = parseFloat(palletsRate);
    if (rate >= 48) return 10.0; if (rate >= 47) return 9.5; if (rate >= 46) return 9.0; if (rate >= 45) return 8.5;
    if (rate >= 44) return 8.0; if (rate >= 43) return 7.5; if (rate >= 42) return 7.0; if (rate >= 41) return 6.5;
    if (rate >= 40) return 6.0; if (rate >= 39) return 5.5; if (rate >= 38) return 5.0; if (rate >= 37) return 4.5;
    if (rate >= 36) return 4.0; if (rate >= 35) return 3.5; if (rate >= 34) return 3.0; if (rate >= 33) return 2.5;
    if (rate >= 32) return 2.0; if (rate >= 31) return 1.5;
    return 1.0;
  };

  const sessionScore = calculateScore();

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '--';
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return '--';
    return date.toLocaleString();
  };

  const isNightShiftSession = (startTimeValue) => {
    if (!startTimeValue) return false;

    const date = new Date(startTimeValue);
    if (Number.isNaN(date.getTime())) return false;

    const totalMinutes = date.getHours() * 60 + date.getMinutes();
    const nightStart = 22 * 60; // 22:00
    const nightEnd = 6 * 60;    // 06:00

    return totalMinutes >= nightStart || totalMinutes < nightEnd;
  };

  // ✅ MAIN SAVE HANDLER - NOW WITH CORRECT ORDER!
  const handleSave = async () => {
    try {
      if (hasInvalidTimeRange) {
        appAlert('Błąd', 'Nieprawidłowy zakres czasu. Ustaw poprawny czas rozpoczęcia i zakończenia.');
        return;
      }

      setIsSaving(true);
      // ✅ STEP 1: Sync cached XP as BATCH
      const syncResult = await syncPendingXP();
      if (syncResult && syncResult.synced > 0) {
        console.log(
          `✅ Synced ${syncResult.synced} cached actions (+${syncResult.totalXP} XP total)`
        );
      }

      const wasNightShift = isNightShiftSession(editedStartTime);

      const sessionData = {
        date: new Date(editedStartTime).toISOString(),  // ✅ Safe conversion
        sessionTime: effectiveSessionTime,
        startTime: editedStartTime,
        endTime: editedEndTime,
        nightShift: Boolean(wasNightShift),
        palletsLoaded: editedPalletsLoaded,
        trucksCount: editedTrucksCount,
        palletsRate: parseFloat(palletsRate),
        score: sessionScore,
        trucks: trucksHistory,
      };

      if (!userId) {
        appAlert('Błąd', 'Brak zalogowanego użytkownika – nie można zapisać historii.');
        return;
      }

      const sessionsRef = collection(db, 'users', userId, 'scoreHistory');
      await addDoc(sessionsRef, sessionData);

      // ✅ STEP 2: Award session completion bonus
      const xpEarned = calculateXPFromScore(sessionScore);
      const xpResult = await awardXP(xpEarned);

      if (!xpResult) {
        appAlert('Error', 'Failed to award XP for session');
        return;
      }

      // ✅ STEP 3: Calculate NEW stats (BEFORE checking achievements!)
      const newStats = {
        totalSessions: (profile.stats.totalSessions || 0) + 1,
        totalTimeWorked: (profile.stats.totalTimeWorked || 0) + (effectiveSessionTime / 3600),
        palletsLoaded: (profile.stats.palletsLoaded || 0) + editedPalletsLoaded,
        totalScore: (profile.stats.totalScore || 0) + sessionScore,
        bestScore: Math.max(profile.stats.bestScore || 0, sessionScore),
        palletsLoadedInSession: editedPalletsLoaded,
        perfectScores:
          (profile.stats.perfectScores || 0) + (sessionScore === 10 ? 1 : 0),
        nightShiftsCompleted:
          (profile.stats.nightShiftsCompleted || 0) + (wasNightShift ? 1 : 0),
      };

      console.log('📊 New Stats calculated:', newStats);

      // ✅ STEP 4: Check achievements with NEW stats (BEFORE updating!)
      console.log('🔍 Checking achievements with NEW stats...');
      const newAchievements = checkAchievements(
        newStats,
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
      let message = `🎯 Sesja Ukończona!\n+${xpEarned} XP zdobytych`;

      if (newAchievements.length > 0) {
        const achievementNames = newAchievements
          .map(id => Object.values(ACHIEVEMENTS).find(a => a.id === id)?.name)
          .filter(Boolean)
          .join(', ');
        message += `\n🏆 Osiągnięcie${newAchievements.length > 1 ? 's' : ''} odblokowane: ${achievementNames}`;
      }

      if (xpResult.leveledUp) {
        appAlert(
          '🎉 Level Up!',
          `Gratulacje! Zdobyłeś poziom ${xpResult.newLevel}!\n\n${message}`,
          finishSession
        );
      } else {
        const levelData = calculateLevelFromXP(profile.totalXP + xpEarned);
        const progressText = `Postęp do Poziomu ${xpResult.newLevel + 1}: ${levelData.currentXP} / ${levelData.xpToNextLevel} XP`;

        appAlert(
          '⭐ Sesja Zapisana!',
          `${message}\n\n${progressText}`,
          finishSession
        );
      }

    } catch (error) {
      console.error('❌ Error saving session:', error);
      appAlert('Błąd', 'Nie udało się zapisać sesji: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const finishSession = async () => {
    try {
      await calc.clearState();
      calc.updateState({ mode: 'init' });
    } catch (error) {
      console.error('Błąd podczas czyszczenia kalkulatora:', error);
    }
  };

  const handleDiscard = async () => {
    appConfirm(
      'Odrzucanie sesji',
      'Jesteś pewien? Stracisz punkty XP!',
      async () => {
        await calc.clearState();
        calc.updateState({ mode: 'init' });
      }
    );
  };

  const handleConfirmPallets = () => {
    const parsed = parseInt(palletsInput, 10);
    if (Number.isNaN(parsed) || parsed < 0) {
      appAlert('Błąd', 'Podaj poprawną liczbę palet (0 lub więcej).');
      return;
    }

    setEditedPalletsLoaded(parsed);
    setIsPalletsModalVisible(false);
  };

  const handleTimeConfirm = (value) => {
    if (activeTimeModal === 'start') {
      setEditedStartTime(value);
    }
    if (activeTimeModal === 'finish') {
      setEditedEndTime(value);
    }
    setActiveTimeModal(null);
  };

  const handleConfirmTrucks = () => {
    const parsed = parseInt(trucksInput, 10);
    if (Number.isNaN(parsed) || parsed < 0) {
      appAlert('Błąd', 'Podaj poprawną liczbę dostaw (0 lub więcej).');
      return;
    }

    setEditedTrucksCount(parsed);
    setIsTrucksModalVisible(false);
  };

  //AutoHorizontalScroll Configuration
  const {
    scrollRef,
    handleLayout,
    handleContentSizeChange,
    handleUserInteraction,
    handleMomentumScrollEnd,
    handleScrollEndDrag,
  } = useAutoHorizontalScroll({
    speed: 20,
    pauseAtEdgesMs: 2000,
    idleToResumeMs: 5000,
  });

  return (
    <View style={[styles.scrollContent, { backgroundColor: colors.background }]}>
      {isSaving && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.iconColor} />
          <Text style={{ color: colors.text, marginTop: 8 }}>Zapisywanie...</Text>
        </View>
      )}

      <View style={styles.container}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* Score Display */}
          <View style={[styles.scoreCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <View style={styles.scoreContent}>
              <Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>Ocena Sesji</Text>
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
          <View style={[styles.statsSection, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            {/* Card 1: Rate (per hour) */}
            <View style={[styles.statCardWide, { backgroundColor: colors.cardInCardBackground, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="speedometer" size={20} color={colors.grayIconColor} />
                <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>Wynik/h</Text>
              </View>
              <Text style={[styles.cardValue, { color: colors.title }]}>{palletsRate}</Text>
            </View>

            {/* HORIZONTAL CARDS */}
            <Animated.ScrollView
              ref={scrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              onLayout={handleLayout}
              onContentSizeChange={handleContentSizeChange}
              onTouchStart={handleUserInteraction}
              onScrollBeginDrag={handleUserInteraction}
              onScrollEndDrag={handleScrollEndDrag}
              onMomentumScrollEnd={handleMomentumScrollEnd}
              scrollEventThrottle={16}
              contentContainerStyle={styles.horizontalCardsContent}
            >
              {/* Card 2: Elapsed Time */}
              <ThemedCard style={[styles.statCard, { backgroundColor: colors.cardInCardBackground, borderColor: colors.border, width: CARD_SIZE }]}>
                <MaterialCommunityIcons name="clock" size={28} color={colors.grayIconColor} />
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>Czas</Text>
                </View>
                <Text style={[styles.cardValue, { color: colors.title }]}>{formatTime(effectiveSessionTime)}</Text>
              </ThemedCard>

              {/* Card 3: Pallets Loaded */}
              <ThemedCard style={[styles.statCard, { backgroundColor: colors.cardInCardBackground, borderColor: colors.border, width: CARD_SIZE }]}>
                <View style={styles.statCardTopRow}>
                  <MaterialCommunityIcons name="cube-send" size={28} color={colors.grayIconColor} />
                  <Pressable
                    onPress={() => {
                      setPalletsInput(String(editedPalletsLoaded));
                      setIsPalletsModalVisible(true);
                    }}
                    style={[styles.inlineIconEditButton, { borderColor: colors.border, backgroundColor: colors.cardBackground }]}
                  >
                    <MaterialCommunityIcons name="pencil" size={12} color={colors.textSecondary} />
                    <Text style={[styles.inlineEditText, { color: colors.textSecondary }]}>Edytuj</Text>
                  </Pressable>
                </View>
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>Palety</Text>
                </View>
                <Text style={[styles.cardValue, { color: colors.title }]}>{editedPalletsLoaded}</Text>
              </ThemedCard>
              {/* Card 4: Trucks Loaded */}
              <ThemedCard style={[styles.statCard, { backgroundColor: colors.cardInCardBackground, borderColor: colors.border, width: CARD_SIZE }]}>
                <View style={styles.statCardTopRow}>
                  <MaterialCommunityIcons name="truck" size={28} color={colors.grayIconColor} />
                  <Pressable
                    onPress={() => {
                      setTrucksInput(String(editedTrucksCount));
                      setIsTrucksModalVisible(true);
                    }}
                    style={[styles.inlineIconEditButton, { borderColor: colors.border, backgroundColor: colors.cardBackground }]}
                  >
                    <MaterialCommunityIcons name="pencil" size={12} color={colors.textSecondary} />
                    <Text style={[styles.inlineEditText, { color: colors.textSecondary }]}>Edytuj</Text>
                  </Pressable>
                </View>
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>Dostawy</Text>
                </View>
                <Text style={[styles.cardValue, { color: colors.title }]}>{editedTrucksCount}</Text>
              </ThemedCard>
            </Animated.ScrollView>
          </View>

          {/* Session Details */}
          <View style={[styles.detailsBox, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <Text style={[styles.detailsTitle, { color: colors.title }]}>Szczegóły Sesji</Text>
            <View style={[styles.detailRow, { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Rozpoczęto o:</Text>
              <View style={styles.detailValueWithEdit}>
                <Text style={[styles.detailValue, { color: colors.title }]}>{formatDate(editedStartTime)}</Text>
                <Pressable
                  onPress={() => setActiveTimeModal('start')}
                  style={[styles.timeEditButton, { borderColor: colors.border, backgroundColor: colors.cardInCardBackground }]}
                >
                  <MaterialCommunityIcons name="pencil" size={14} color={colors.textSecondary} />
                </Pressable>
              </View>
            </View>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Zakończono o:</Text>
              <View style={styles.detailValueWithEdit}>
                <Text style={[styles.detailValue, { color: colors.title }]}>{formatDate(editedEndTime)}</Text>
                <Pressable
                  onPress={() => setActiveTimeModal('finish')}
                  style={[styles.timeEditButton, { borderColor: colors.border, backgroundColor: colors.cardInCardBackground }]}
                >
                  <MaterialCommunityIcons name="pencil" size={14} color={colors.textSecondary} />
                </Pressable>
              </View>
            </View>

            {hasInvalidTimeRange && (
              <Text style={[styles.validationText, { color: colors.error || '#ef4444' }]}>Czas zakończenia musi być późniejszy niż rozpoczęcia.</Text>
            )}
          </View>

          {/* <ScrollView style={styles.scrollView}>
            <View style={[styles.trucksBox, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
              <Text style={[styles.trucksTitle, { color: colors.title }]}>Szczegóły Dostaw</Text>
              {trucksHistory.map((truck, idx) => (
                <View key={idx} style={[styles.truckRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.truckNum, { color: colors.iconColor }]}>#{truck.displayId}</Text>
                  <View style={styles.truckInfo}>
                    <Text style={[styles.truckInfo, { color: colors.text }]}>
                      {truck.pallets} palet • Sklep {truck.shop} • Brama {truck.gate} • Naczepa {truck.trailer}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView> */}
        </ScrollView>
        {/* Action Buttons */}
        <View style={[styles.buttonsContainer, { backgroundColor: colors.navBackground, borderTopColor: colors.border, paddingBottom: insets.bottom }]}>
          <Pressable
            style={[
              styles.button,
              {
                backgroundColor: isSaving ? colors.disabledButBackground : colors.butBackground,
                borderWidth: 1,
                borderColor: isSaving ? colors.disabledButBorder : colors.butBorder,
                color: isSaving ? colors.disabledButText : colors.butText,
              },
            ]}
            onPress={handleSave}
            disabled={isSaving || hasInvalidTimeRange}
          >
            <MaterialCommunityIcons name="check" size={24} color={colors.butText} />
            <Text style={[styles.buttonText, { color: colors.butText }]}>Zapisz Sesję</Text>
          </Pressable>

          <Pressable
            style={[
              styles.button,
              styles.discardButton,
              {
                backgroundColor: colors.disabledButBackground,
                borderWidth: 1,
                borderColor: colors.disabledButBorder,
                color: colors.disabledButText,
              },
            ]}
            onPress={handleDiscard}
          >
            <MaterialCommunityIcons name="close" size={24} color={colors.text} />
            <Text style={[styles.buttonText, { color: colors.text }]}>Nie Zapisuj</Text>
          </Pressable>
        </View>
      </View>

      <AdjustTimeModal
        visible={activeTimeModal === 'start'}
        onClose={() => setActiveTimeModal(null)}
        onConfirm={handleTimeConfirm}
        initialTime={editedStartTime}
        type="start"
      />

      <AdjustTimeModal
        visible={activeTimeModal === 'finish'}
        onClose={() => setActiveTimeModal(null)}
        onConfirm={handleTimeConfirm}
        initialTime={editedEndTime}
        type="finish"
        startTime={editedStartTime}
      />

      <Modal
        visible={isPalletsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsPalletsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={[styles.palletsModal, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}> 
              <Text style={[styles.palletsModalTitle, { color: colors.title }]}>Edytuj liczbę palet</Text>
              <TextInput
                value={palletsInput}
                onChangeText={(value) => setPalletsInput(value.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={colors.textSecondary}
                style={[styles.palletsInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                autoFocus
              />

              <View style={styles.palletsModalButtons}>
                <Pressable
                  onPress={() => setIsPalletsModalVisible(false)}
                  style={[styles.modalButton, { borderColor: colors.border, backgroundColor: colors.cardInCardBackground }]}
                >
                  <Text style={[styles.modalButtonText, { color: colors.textSecondary }]}>Anuluj</Text>
                </Pressable>

                <Pressable
                  onPress={handleConfirmPallets}
                  style={[styles.modalButton, { borderColor: colors.butBorder, backgroundColor: colors.butBackground }]}
                >
                  <Text style={[styles.modalButtonText, { color: colors.butText }]}>Zapisz</Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal
        visible={isTrucksModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsTrucksModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={[styles.palletsModal, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}> 
              <Text style={[styles.palletsModalTitle, { color: colors.title }]}>Edytuj liczbę dostaw</Text>
              <TextInput
                value={trucksInput}
                onChangeText={(value) => setTrucksInput(value.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={colors.textSecondary}
                style={[styles.palletsInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                autoFocus
              />

              <View style={styles.palletsModalButtons}>
                <Pressable
                  onPress={() => setIsTrucksModalVisible(false)}
                  style={[styles.modalButton, { borderColor: colors.border, backgroundColor: colors.cardInCardBackground }]}
                >
                  <Text style={[styles.modalButtonText, { color: colors.textSecondary }]}>Anuluj</Text>
                </Pressable>

                <Pressable
                  onPress={handleConfirmTrucks}
                  style={[styles.modalButton, { borderColor: colors.butBorder, backgroundColor: colors.butBackground }]}
                >
                  <Text style={[styles.modalButtonText, { color: colors.butText }]}>Zapisz</Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View >
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flex: 1,
  },
  scrollView: {
    marginBottom: 20,
  },
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: 16,
  },
  scoreCard: {
    borderRadius: 24,
    marginHorizontal: 24,
    padding: 24,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    borderWidth: 1,
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
    padding: 24,
    marginHorizontal: 24,
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    borderRadius: 16,
    borderWidth: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  horizontalCardsContent: {
    gap: 12,
  },
  statCard: {
    aspectRatio: 1,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
  },
  statCardWide: {
    width: '100%',
    padding: 16,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  statCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardLabel: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 2,
    marginTop: 2,
  },
  cardValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  detailsBox: {
    marginHorizontal: 24,
    padding: 24,
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    borderRadius: 16,
    borderWidth: 1,
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
  detailValueWithEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  timeEditButton: {
    borderWidth: 1,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineIconEditButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 999,
  },
  inlineEditText: {
    fontSize: 12,
    fontWeight: '600',
  },
  validationText: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '600',
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
    gap: 8,
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    paddingTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  discardButton: {
    borderWidth: 1,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  palletsModal: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  palletsModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  palletsInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  palletsModalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  modalButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
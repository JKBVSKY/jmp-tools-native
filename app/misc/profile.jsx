import React, { useMemo, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Modal, View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, TouchableOpacity } from 'react-native';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { useUserProfile } from '../../context/UserProfileContext';
import { useColors } from '../../hooks/useColors';
import { Ionicons } from '@expo/vector-icons';
import { ACHIEVEMENTS, calculateLevelFromXP, isAchievementUnlocked, } from '../../constants/LevelSystem';
import { useRouter } from 'expo-router';
import { AchievementModal } from '../modals/AchievementModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsive } from '../../hooks/useResponsive';

// NEW: All-time stats fetched from database
const calculateAggregateStats = (sessions = []) => {
  const totalSessions = sessions.length;

  const totalTimeSeconds = sessions.reduce(
    (sum, s) => sum + (Number(s.sessionTime ?? s.loadingTime) || 0),
    0
  );
  const totalPallets = sessions.reduce(
    (sum, s) => sum + (Number(s.palletsLoaded) || 0),
    0
  );
  const totalTrucks = sessions.reduce(
    (sum, s) => sum + (Number(s.trucksCount) || (Array.isArray(s.trucks) ? s.trucks.length : 0)),
    0
  );
  const totalRate = sessions.reduce(
    (sum, s) => sum + (Number(s.palletsRate) || 0),
    0
  );
  const totalScore = sessions.reduce(
    (sum, s) => sum + (Number(s.score) || 0),
    0
  );

  return {
    totalSessions,
    totalTimeSeconds,
    totalPallets,
    totalTrucks,
    totalRate,
    totalScore,
    averageRate: totalTimeSeconds > 0
      ? totalPallets / (totalTimeSeconds / 3600)
      : 0,
    averageSessionRate: totalSessions > 0
      ? totalRate / totalSessions
      : 0,
    averageScore: totalSessions > 0
      ? totalScore / totalSessions
      : 0,
  };
};

const calculatePickingAggregateStats = (sessions = []) => {
  const pickingSessions = sessions.filter((s) => s.sessionType === 'picking');

  const totals = pickingSessions.reduce(
    (acc, session) => {
      const entries = Array.isArray(session.picking?.subsectionEntries)
        ? session.picking.subsectionEntries
        : [];

      const entryBoxes = entries.reduce((sum, item) => sum + (Number(item?.boxesCount) || 0), 0);
      const entryTime = entries.reduce((sum, item) => sum + (Number(item?.sessionTime) || 0), 0);

      const sessionBoxes = Number(session.picking?.totalBoxes) || entryBoxes;
      const sessionTime = Number(session.sessionTime) || entryTime;
      const sessionScore = Number(session.picking?.score) || 0;

      acc.totalSessions += 1;
      acc.totalTimeSeconds += sessionTime;
      acc.totalBoxes += sessionBoxes;
      acc.totalScore += sessionScore;
      return acc;
    },
    {
      totalSessions: 0,
      totalTimeSeconds: 0,
      totalBoxes: 0,
      totalScore: 0,
    }
  );

  return {
    ...totals,
    averageBoxesRate: totals.totalTimeSeconds > 0
      ? totals.totalBoxes / (totals.totalTimeSeconds / 3600)
      : 0,
    averageScore: totals.totalSessions > 0
      ? totals.totalScore / totals.totalSessions
      : 0,
  };
};

const calculateScoreFromRate = (rate) => {
  const parsedRate = parseFloat(rate);

  if (parsedRate >= 48) return 10.0;
  if (parsedRate >= 47) return 9.5;
  if (parsedRate >= 46) return 9.0;
  if (parsedRate >= 45) return 8.5;
  if (parsedRate >= 44) return 8.0;
  if (parsedRate >= 43) return 7.5;
  if (parsedRate >= 42) return 7.0;
  if (parsedRate >= 41) return 6.5;
  if (parsedRate >= 40) return 6.0;
  if (parsedRate >= 39) return 5.5;
  if (parsedRate >= 38) return 5.0;
  if (parsedRate >= 37) return 4.5;
  if (parsedRate >= 36) return 4.0;
  if (parsedRate >= 35) return 3.5;
  if (parsedRate >= 34) return 3.0;
  if (parsedRate >= 33) return 2.5;
  if (parsedRate >= 32) return 2.0;
  if (parsedRate >= 31) return 1.5;
  return 1.0;
};

const PROFILE_STAT_CARDS_KEY = 'profileStatCards';

const STAT_OPTIONS = {
  totalTrucks: { label: 'Samochody', icon: 'car-outline' },
  totalTime: { label: 'Czas pracy', icon: 'time-outline' },
  totalPallets: { label: 'Załadowane palety', icon: 'cube-outline' },
};

export default function Profile() {
  const { user, isGuest, signOut } = useAuth();
  const userId = user?.id;
  const [sessions, setSessions] = useState([]);
  const [statsTab, setStatsTab] = useState('truck');
  const [sessionsLoading, setSessionsLoading] = useState(true);

  const [statCards, setStatCards] = React.useState([null, null]);
  const [statPickerVisible, setStatPickerVisible] = React.useState(false);
  const [selectedStatCard, setSelectedStatCard] = React.useState(null);
  const { profile, isLoading } = useUserProfile();

  const colors = useColors();
  const router = useRouter();
  const [selectedAchievement, setSelectedAchievement] = React.useState(null);
  const [modalVisible, setModalVisible] = React.useState(false);
  const insets = useSafeAreaInsets();
  const { width, isSmallPhone } = useResponsive();
  const [gridWidth, setGridWidth] = React.useState(0);

  // How many columns we want
  const columns = width < 340 ? 1 : width <= 375 ? 2 : 3;
  const gap = isSmallPhone ? 12 : 14;

  const rawItemWidth = gridWidth > 0
    ? (gridWidth - gap * (columns - 1)) / columns - 2
    : 0;

  useEffect(() => {
    let isMounted = true;

    const loadStatCards = async () => {
      if (!userId) {
        return;
      }

      try {
        const savedCards = await AsyncStorage.getItem(`${PROFILE_STAT_CARDS_KEY}:${userId}`);
        if (!savedCards || !isMounted) {
          return;
        }

        const parsedCards = JSON.parse(savedCards);
        if (Array.isArray(parsedCards)) {
          setStatCards([parsedCards[0] || null, parsedCards[1] || null]);
        }
      } catch (error) {
        console.error('Failed to load profile stat cards:', error);
      }
    };

    loadStatCards();

    return () => {
      isMounted = false;
    };
  }, [userId]);

  useEffect(() => {
    const loadSessions = async () => {
      if (!userId) {
        setSessions([]);
        setSessionsLoading(false);
        return;
      }

      try {
        setSessionsLoading(true);
        const sessionsRef = collection(db, 'users', userId, 'scoreHistory');
        const q = query(sessionsRef, orderBy('date', 'desc'));
        const snapshot = await getDocs(q);

        const fetchedSessions = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setSessions(fetchedSessions);
      } catch (error) {
        console.error('Failed to load profile sessions:', error);
      } finally {
        setSessionsLoading(false);
      }
    };

    loadSessions();
  }, [userId]);

  const allTimeStats = useMemo(() => calculateAggregateStats(sessions), [sessions]);
  const pickingAllTimeStats = useMemo(() => calculatePickingAggregateStats(sessions), [sessions]);

  const persistStatCards = async (nextCards) => {
    setStatCards(nextCards);

    if (!userId) {
      return;
    }

    try {
      await AsyncStorage.setItem(
        `${PROFILE_STAT_CARDS_KEY}:${userId}`,
        JSON.stringify(nextCards)
      );
    } catch (error) {
      console.error('Failed to save profile stat cards:', error);
    }
  };

  const openStatPicker = (cardIndex) => {
    setSelectedStatCard(cardIndex);
    setStatPickerVisible(true);
  };

  const closeStatPicker = () => {
    setStatPickerVisible(false);
    setSelectedStatCard(null);
  };

  const assignStatCard = (statKey) => {
    if (selectedStatCard === null) {
      return;
    }

    const nextCards = [...statCards];
    nextCards[selectedStatCard] = statKey;
    persistStatCards(nextCards);
    closeStatPicker();
  };

  const removeStatCard = () => {
    if (selectedStatCard === null) {
      return;
    }

    const nextCards = [...statCards];
    nextCards[selectedStatCard] = null;
    persistStatCards(nextCards);
    closeStatPicker();
  };


  // ✅ HANDLE GUEST USERS
  if (isGuest) {
    return (
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.cardBackground, borderColor: colors.border, borderWidth: 1 }]}>
          <Ionicons name="person-outline" size={80} color={colors.iconColor} />
          <Text style={[styles.userName, { color: colors.title }]}>Gość</Text>
          <Text style={[styles.userEmail, { color: colors.textSecondary }]}>
            Przeglądasz jako gość
          </Text>
        </View>

        <View style={[styles.guestCard, { backgroundColor: colors.inputBackground, borderColor: colors.border, borderWidth: 1 }]}>
          <Ionicons name="information-circle" size={24} color={colors.iconColor} />
          <Text style={[styles.guestTitle, { color: colors.title }]}>Utwórz Konto</Text>
          <Text style={[styles.guestText, { color: colors.textSecondary }]}>
            Zarejestruj się, aby odblokować pełną wersję! Śledź swoje postępy, zdobywaj XP, odblokowuj osiągnięcia i rywalizuj w rankingach.
          </Text>

          <View style={styles.guestFeatures}>
            <View style={styles.featureRow}>
              <Ionicons name="star" size={20} color={colors.iconColor} />
              <Text style={[styles.featureText, { color: colors.text }]}>System XP i Poziomów</Text>
            </View>
            <View style={styles.featureRow}>
              <Ionicons name="trophy" size={20} color={colors.iconColor} />
              <Text style={[styles.featureText, { color: colors.text }]}>Zdobywaj Osiągnięcia</Text>
            </View>
            <View style={styles.featureRow}>
              <Ionicons name="bar-chart" size={20} color={colors.iconColor} />
              <Text style={[styles.featureText, { color: colors.text }]}>Statystyki i Rankingi</Text>
            </View>
            <View style={styles.featureRow}>
              <Ionicons name="cloud-upload" size={20} color={colors.iconColor} />
              <Text style={[styles.featureText, { color: colors.text }]}>Synchronizacja w Chmurze</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.signUpButton, { backgroundColor: colors.butBackground }]}
          onPress={() => {
            signOut();
            router.replace('/(auth)/register');
          }}
        >
          <Ionicons name="pencil" size={20} color={colors.butText} />
          <Text style={[styles.buttonText, { color: colors.butText }]}>Utwórz Konto Teraz</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ✅ HANDLE LOADING
  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary, marginTop: 10 }]}>Ładowanie profilu...</Text>
      </View>
    );
  }

  // ✅ HANDLE ERROR
  if (!profile) {
    return (

      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Ionicons name="alert-circle" size={50} color={colors.primary} />
        <Text style={[styles.errorText, { color: colors.title, marginTop: 10 }]}>Błąd ładowania profilu</Text>
        <Text style={[styles.errorSubText, { color: colors.textSecondary, marginTop: 5 }]}>Proszę spróbować ponownie później</Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: colors.primary, marginTop: 20 }]}
          onPress={() => router.back()}
        >
          <Text style={[styles.buttonText, { color: colors.butText }]}>Powrót</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ✅ HANDLE ACHIEVEMENTS
  const handleAchievementPress = (achievement) => {
    setSelectedAchievement(achievement);
    setModalVisible(true);
  };

  // ✅ CALCULATE LEVEL PROGRESS CORRECTLY
  const levelData = calculateLevelFromXP(profile?.totalXP ?? 0);

  // Calculate XP needed for NEXT level
  const xpForNextLevel = (profile?.level || 1) * 1000;

  // Calculate current XP in this level (how much we've earned towards next level)
  const xpInCurrentLevel = levelData.currentXP;

  // Calculate percentage to next level
  const levelProgress = (xpInCurrentLevel / xpForNextLevel) * 100;
  const remainingXP = xpForNextLevel - xpInCurrentLevel;
  const remainingPercent = 100 - levelProgress;

  // ✅ FORMAT TIME
  const formatTime = (seconds) => {
    const hours = seconds / 3600;
    const days = Math.floor(hours / 24);
    const remainingHours = Math.floor(hours % 24);
    return `${days}d ${remainingHours}h`;
  };

  // ✅ CALCULATE AVERAGE SCORE
  const avgScore = calculateScoreFromRate(allTimeStats.averageRate).toFixed(1);
  const pickingAvgScore = pickingAllTimeStats.averageScore.toFixed(1);

  const achievementStats = {
    ...(profile?.stats || {}),
    totalPallets: allTimeStats.totalPallets,
    level: profile?.level || 1,
    totalXP: profile?.totalXP || 0,
  };

  const statValues = {
    totalTrucks: allTimeStats.totalTrucks,
    totalTime: formatTime(allTimeStats.totalTimeSeconds),
    totalPallets: allTimeStats.totalPallets,
  };

  const allAchievements = Object.values(ACHIEVEMENTS).map((achievement) => ({
    ...achievement,
    unlocked: isAchievementUnlocked(
      achievement.id,
      achievementStats,
      profile?.achievements || []
    ),
  }));

  const iconSize = isSmallPhone ? 50 : 30;

  const renderIcon = (icon) => {
    if (typeof icon === 'string') {
      return (
        <Text style={{ fontSize: iconSize }}>
          {icon}
        </Text>
      );
    }

    if (typeof icon === 'function' || (typeof icon === 'object' && icon?.render)) {
      const IconComponent = icon;
      return <IconComponent size={iconSize} />;
    }

    return null;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.profileShell} showsVerticalScrollIndicator={false}>

        <View style={[styles.headerSection, { backgroundColor: colors.navBackground }]}>
          <View style={[styles.profileHeaderCard, { backgroundColor: colors.navBackground, borderColor: colors.border }]}>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => router.push('/(app)/editProfile')}
            >
              <Ionicons name="pencil" size={19} color={colors.textSecondary} />
            </TouchableOpacity>

            <View style={styles.profileSection}>
              <View style={styles.profileImageContainer}>
                <Ionicons name="person-circle" size={68} color={colors.iconColor} />
              </View>
              <View style={styles.profileDetails}>
                <Text style={[styles.userName, { color: colors.title }]} numberOfLines={1}>
                  {profile?.name || profile?.displayName || user?.name || user?.email || 'User'}
                </Text>
                <Text style={[styles.userEmail, { color: colors.textSecondary }]} numberOfLines={1}>
                  {user?.email || 'email@example.com'}
                </Text>
                <View style={styles.profileSummaryRow}>
                  <View style={[styles.compactCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                    <Text style={[styles.compactCardTitle, { color: colors.title }]}>Poziom {profile?.level || 1}</Text>
                  </View>

                  <View style={[styles.compactCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                    <Text style={[styles.compactCardTitle, { color: colors.text }]}>
                      {allAchievements.filter((achievement) => achievement.unlocked).length} osiągnięć
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.featuredStatsRow}>
            <View style={[styles.featuredStatCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
              <Ionicons name="sparkles-outline" size={20} color={colors.iconColor} />
              <Text style={[styles.featuredStatLabel, { color: colors.textSecondary }]}>XP łącznie</Text>
              <Text style={[styles.featuredStatValue, { color: colors.text }]}>{profile?.totalXP || 0}</Text>
            </View>

            {statCards.map((statKey, cardIndex) => {
              const statOption = statKey ? STAT_OPTIONS[statKey] : null;

              return (
                <Pressable
                  key={`profile-stat-${cardIndex}`}
                  onPress={() => openStatPicker(cardIndex)}
                  style={({ pressed }) => [
                    styles.featuredStatCard,
                    styles.selectableStatCard,
                    {
                      backgroundColor: colors.cardBackground,
                      borderColor: colors.border,
                      opacity: pressed ? 0.75 : 1,
                    },
                  ]}
                >
                  {statOption ? (
                    <>
                      <Ionicons name={statOption.icon} size={20} color={colors.iconColor} />
                      <Text style={[styles.featuredStatLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                        {statOption.label}
                      </Text>
                      <Text style={[styles.featuredStatValue, { color: colors.text }]}>
                        {statValues[statKey]}
                      </Text>
                      <Text style={[styles.changeStatHint, { color: colors.textSecondary }]}>zmień</Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="add" size={28} color={colors.iconColor} />
                      <Text style={[styles.emptyStatText, { color: colors.textSecondary }]}>Dodaj statystykę</Text>
                    </>
                  )}
                </Pressable>
              );
            })}
          </View>

          <Modal
            visible={statPickerVisible}
            transparent
            animationType="fade"
            onRequestClose={closeStatPicker}
          >
            <View style={styles.modalBackdrop}>
              <View style={[styles.statPickerModal, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: colors.title }]}>Wybierz statystykę</Text>
                  <Pressable onPress={closeStatPicker} hitSlop={10}>
                    <Ionicons name="close" size={24} color={colors.textSecondary} />
                  </Pressable>
                </View>

                {Object.entries(STAT_OPTIONS)
                  .filter(([statKey]) => statKey === statCards[selectedStatCard] || !statCards.includes(statKey))
                  .map(([statKey, statOption]) => (
                    <Pressable
                      key={statKey}
                      onPress={() => assignStatCard(statKey)}
                      style={({ pressed }) => [
                        styles.statOption,
                        { borderColor: colors.border, backgroundColor: pressed ? colors.inputBackground : colors.cardInCardBackground },
                      ]}
                    >
                      <Ionicons name={statOption.icon} size={22} color={colors.iconColor} />
                      <Text style={[styles.statOptionText, { color: colors.text }]}>{statOption.label}</Text>
                    </Pressable>
                  ))}

                {selectedStatCard !== null && statCards[selectedStatCard] && (
                  <Pressable
                    onPress={removeStatCard}
                    style={[styles.removeStatButton, { borderColor: colors.border }]}
                  >
                    <Ionicons name="trash-outline" size={18} color={colors.primary} />
                    <Text style={[styles.removeStatText, { color: colors.primary }]}>Usuń statystykę</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </Modal>
        </View>

        {/* Statistics Card */}
        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="bar-chart" size={24} color={colors.iconColor} />
            <Text style={[styles.cardTitle, { color: colors.title }]}>Statystyki</Text>
          </View>

          <View style={styles.statsTabsRow}>
            <Pressable
              onPress={() => setStatsTab('truck')}
              style={[
                styles.statsTab,
                {
                  borderColor: statsTab === 'truck' ? colors.butBorder : colors.border,
                  backgroundColor: statsTab === 'truck' ? colors.butBackground : colors.cardInCardBackground,
                },
              ]}
            >
              <Text style={{ color: statsTab === 'truck' ? colors.butText : colors.text, fontWeight: '700' }}>
                Załadunek
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setStatsTab('picking')}
              style={[
                styles.statsTab,
                {
                  borderColor: statsTab === 'picking' ? colors.butBorder : colors.border,
                  backgroundColor: statsTab === 'picking' ? colors.butBackground : colors.cardInCardBackground,
                },
              ]}
            >
              <Text style={{ color: statsTab === 'picking' ? colors.butText : colors.text, fontWeight: '700' }}>
                Kompletacja
              </Text>
            </Pressable>
          </View>

          <View style={styles.statsGrid}>
            <View style={[styles.statItem, { borderRightColor: colors.border, borderRightWidth: 1, borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
              <Ionicons name="time" size={28} color={colors.iconColor} />
              <Text style={[styles.statValue, { color: colors.title }]}>
                {formatTime(statsTab === 'truck' ? allTimeStats.totalTimeSeconds : pickingAllTimeStats.totalTimeSeconds)}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Ogólny czas pracy</Text>
            </View>
            <View style={[styles.statItem, { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
              <Ionicons name={statsTab === 'truck' ? 'cube' : 'cube-outline'} size={28} color={colors.iconColor} />
              <Text style={[styles.statValue, { color: colors.title }]}>
                {statsTab === 'truck' ? allTimeStats.totalPallets : pickingAllTimeStats.totalBoxes}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                {statsTab === 'truck' ? 'Palety załadowane' : 'Paczki skompletowane'}
              </Text>
            </View>

            <View style={[styles.statItem, { borderRightColor: colors.border, borderRightWidth: 1 }]}>
              <Ionicons name="star" size={28} color={colors.iconColor} />
              <Text style={[styles.statValue, { color: colors.title }]}>
                {statsTab === 'truck' ? avgScore : pickingAvgScore}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Ocena</Text>
            </View>

            <View style={styles.statItem}>
              <Ionicons name="trending-up" size={28} color={colors.iconColor} />
              <Text style={[styles.statValue, { color: colors.title }]}>
                {(statsTab === 'truck' ? allTimeStats.averageRate : pickingAllTimeStats.averageBoxesRate).toFixed(1)}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                {statsTab === 'truck' ? 'Średnia ogólna' : 'Średnia paczek/h'}
              </Text>
            </View>

            <View
              style={{
                paddingTop: 24,
                paddingBottom: 0,
                justifyContent: 'center',
                alignItems: 'center',
                width: '100%',
                flexDirection: 'row',
              }}
            >
              {/* <Ionicons name="information-circle" size={20} color={colors.grayIconColor} /> */}
              <Text style={[styles.achievementCounter, { color: colors.textSecondary }]}>
                {(statsTab === 'truck' ? allTimeStats.totalSessions : pickingAllTimeStats.totalSessions)} sesji ukończonych łącznie
              </Text>
            </View>
          </View>
        </View>

        {/* Achievements Card */}
        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border, borderWidth: 1 }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="trophy" size={24} color={colors.iconColor} />
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              Osiągnięcia
            </Text>
          </View>

          <View
            style={[styles.achievementsGrid, { gap }]}
            onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}
          >
            {allAchievements.map((achievement) => (
              <Pressable
                key={achievement.id}
                style={({ pressed }) => [
                  styles.achievementItem,
                  {
                    width: rawItemWidth,
                    backgroundColor: achievement.unlocked
                      ? 'rgba(34, 197, 94, 0.12)' // Lighter green background
                      : 'rgba(107, 114, 128, 0.08)', // Subtle gray background
                    borderColor: achievement.unlocked
                      ? colors.primary // Green border for unlocked
                      : colors.borderColor, // Gray border for locked
                    opacity: pressed ? 0.7 : 1,
                  }
                ]}
                onPress={() => handleAchievementPress(achievement)}
              >

                {/* Lock Icon in Corner */}
                {!achievement.unlocked && (
                  <View style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                  }}>
                    <Ionicons name="lock-closed" size={16} color={colors.textSecondary} />
                  </View>
                )}

                {/* Unlocked Check Badge */}
                {achievement.unlocked && (
                  <View style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                  }}>
                    <Ionicons name="checkmark-circle" size={18} color={'rgba(34, 197, 94, 1)'} />
                  </View>
                )}

                <Text style={[styles.achievementIcon, isSmallPhone && styles.achievementIconSmall]}>{renderIcon(achievement.icon)}</Text>
                <Text
                  style={[
                    styles.achievementName,
                    isSmallPhone && styles.achievementNameSmall,
                    {
                      color: achievement.unlocked ? colors.text : colors.textSecondary,
                    }
                  ]}
                  numberOfLines={2}
                  ellipsizeMode="tail"
                >
                  {achievement.name.replace('Mistrz Ładowania', 'Mistrz Magazynu')}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.achievementCounter, { color: colors.textSecondary }]}>
            {allAchievements.filter(a => a.unlocked).length} z {allAchievements.length} odblokowano
          </Text>
        </View>

        <View style={{ height: 30 }} />
        <AchievementModal
          visible={modalVisible}
          achievement={selectedAchievement}
          onClose={() => setModalVisible(false)}
          userStats={{
            ...(profile?.stats || {}),
            totalPallets: allTimeStats.totalPallets,
            level: profile?.level || 1,
            totalXP: profile?.totalXP || 0
          }}
          isUnlocked={
            selectedAchievement
              ? isAchievementUnlocked(
                selectedAchievement.id,
                {
                  ...(profile?.stats || {}),
                  totalPallets: allTimeStats.totalPallets,
                  level: profile?.level || 1,
                  totalXP: profile?.totalXP || 0,
                },
                profile?.achievements || []
              )
              : false
          } />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerSection: {
    paddingHorizontal: 12,
    marginBottom: 24,
  },
  profileHeaderCard: {
    minHeight: 106,
    justifyContent: 'center',
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  profileDetails: {
    flex: 1,
    minWidth: 0,
  },
  editButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 1,
    padding: 4,
  },
  profileSummaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    marginBottom: 24,
  },
  compactCard: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
  },
  compactCardTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  compactCardValue: {
    fontSize: 24,
    fontWeight: '800',
    marginTop: 4,
  },
  compactCardCaption: {
    fontSize: 11,
    marginTop: 2,
  },
  compactProgressBackground: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 8,
  },
  featuredStatsRow: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    gap: 8,
    marginBottom: 12,
  },
  featuredStatCard: {
    flex: 1,
    minHeight: 104,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    justifyContent: 'center',
  },
  selectableStatCard: {
    alignItems: 'flex-start',
  },
  featuredStatLabel: {
    fontSize: 11,
    marginTop: 7,
  },
  featuredStatValue: {
    fontSize: 19,
    fontWeight: '800',
    marginTop: 3,
  },
  emptyStatText: {
    fontSize: 11,
    marginTop: 6,
  },
  changeStatHint: {
    fontSize: 10,
    marginTop: 3,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  statPickerModal: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  statOption: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    padding: 13,
    marginTop: 8,
  },
  statOptionText: {
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 10,
  },
  removeStatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginTop: 14,
  },
  removeStatText: {
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 7,
  },
  loadingText: {
    fontSize: 16,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
  },
  errorSubText: {
    fontSize: 14,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 25,
    marginTop: 12,
    marginHorizontal: 12,
    borderRadius: 12,
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    borderWidth: 1,
  },
  profileImageContainer: {
    alignSelf: 'flex-start',
    marginRight: 12,
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
  },
  card: {
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 10,
  },
  levelInfo: {
    marginBottom: 10,
  },
  xpText: {
    fontSize: 14,
    marginBottom: 8,
  },
  xpProgressContainer: {
    marginBottom: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  xpProgressText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  progressBarBackground: {
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: 12,
    borderRadius: 6,
  },
  progressText: {
    fontSize: 12,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statsTabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  statsTab: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  statItem: {
    width: '50%',
    alignItems: 'center',
    paddingVertical: 15,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginVertical: 5,
  },
  statLabel: {
    fontSize: 12,
  },
  achievementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start', // Better distribution
  },
  achievementItem: {
    aspectRatio: 1, // Square cards
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.8,
    borderColor: 'transparent',
    paddingHorizontal: 12,
    paddingVertical: 16,
    position: 'relative',
  },
  achievementIcon: {
    marginBottom: 8,
  },
  achievementIconSmall: {
    fontSize: 34,
    marginBottom: 8,
  },
  achievementName: {
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
  },
  achievementNameSmall: {
    fontSize: 12,
    lineHeight: 14,
  },
  achievementCounter: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  infoCard: {
    borderRadius: 12,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  infoText: {
    marginLeft: 10,
    fontSize: 13,
    flex: 1,
  },
  guestCard: {
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 12,
    marginBottom: 20,
    alignItems: 'center',
  },
  guestTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 10,
  },
  guestText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  guestFeatures: {
    width: '100%',
    marginTop: 15,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  featureText: {
    marginLeft: 10,
    fontSize: 14,
    flex: 1,
  },
  signUpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 10,
    marginHorizontal: 12,
    gap: 8,
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 10,
    gap: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  retryButton: {
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
  },
  profileShell: {
    width: '100%',
    alignSelf: 'center',
  },

});

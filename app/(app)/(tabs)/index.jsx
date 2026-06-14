import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, Pressable, ActivityIndicator, ScrollView, Image, Platform } from 'react-native';
import { useColors } from '@/_hooks/useColors';
import ThemedView from '@/components/ThemedView';
import { useAuth } from '@/_context/AuthContext';
import { useUserProfile } from '@/_context/UserProfileContext';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { collection, collectionGroup, query, orderBy, getDocs, where } from 'firebase/firestore';
import { db } from '@/firebase/config';
import ThemedCard from '@/components/ThemedCard';
import { ACHIEVEMENTS, calculateLevelFromXP } from '@/constants/LevelSystem';
import { TouchableOpacity } from 'react-native-gesture-handler';
import SessionModal from '../modals/SessionModal';
import { useCalculator } from '@/_context/CalculatorContext';
import { Ionicons } from "@expo/vector-icons";


const calculateSummary = (sessionsArray) => {
  const totalPallets = sessionsArray.reduce((sum, s) => sum + (parseFloat(s.palletsLoaded) || 0), 0);
  const totalTime = sessionsArray.reduce((sum, s) => sum + (parseFloat(s.loadingTime) || 0), 0);
  const averageRate = totalTime > 0 ? totalPallets / (totalTime / 3600) : 0;
  return { totalPallets, totalTime, averageRate };
};

const getMonthBounds = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
};

const getDisplayName = (entry, currentUser, currentProfile) => {
  if (entry.userId === currentUser?.id) {
    return (
      currentProfile?.name ||
      currentProfile?.displayName ||
      currentUser?.name ||
      currentUser?.email ||
      `Pracownik ${entry.userId.slice(0, 6)}`
    );
  }

  return (
    entry.displayName ||
    entry.name ||
    entry.email ||
    `Pracownik ${entry.userId.slice(0, 6)}`
  );
};

export default function Dashboard() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { user, isGuest, signOut } = useAuth();
  const { profile } = useUserProfile();
  const router = useRouter();

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSessionModalVisible, setSessionModalVisible] = useState(false);
  const [rank, setRank] = useState('-');
  const userId = user?.id;

  const calc = useCalculator();
  const isWeb = Platform.OS === 'web';

  const isSessionActive =
    calc.mode === 'working' ||
    calc.mode === 'paused' ||
    calc.mode === 'results';

  const sessionButtonLabel = isSessionActive
    ? 'Kontynuuj Sesję'
    : 'Rozpocznij Sesję';

  const now = new Date();
  const currentMonth = { month: now.getMonth(), year: now.getFullYear() };

  const getMonthKey = (dateString) => {
    const d = new Date(dateString);
    const month = d.getMonth();
    const year = d.getFullYear();
    return { month, year, key: `${year}-${month}` };
  };

  const sessionsForMonth = sessions.filter((s) => {
    const { month, year } = getMonthKey(s.date);
    return month === currentMonth.month && year === currentMonth.year;
  });

  const summary = calculateSummary(sessionsForMonth);
  const monthBounds = getMonthBounds();

  const loadSessions = useCallback(async () => {
    setLoading(true);
    if (!userId) {
      setSessions([]);
      setLoading(false);
      return;
    }

    try {
      const sessionsRef = collection(db, 'users', userId, 'scoreHistory');
      const q = query(sessionsRef, orderBy('date', 'desc'));
      const snapshot = await getDocs(q);
      const fetchedSessions = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setSessions(fetchedSessions);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const loadRank = useCallback(async () => {
    if (!userId) {
      setRank('-');
      return;
    }

    try {
      const usersPromise = getDocs(collection(db, 'users'));
      const sessionsPromise = getDocs(
        query(
          collectionGroup(db, 'scoreHistory'),
          where('date', '>=', monthBounds.startIso),
          where('date', '<', monthBounds.endIso)
        )
      );

      const [usersSnapshot, sessionsSnapshot] = await Promise.all([usersPromise, sessionsPromise]);

      const usersMap = new Map(
        usersSnapshot.docs.map((docSnapshot) => [docSnapshot.id, docSnapshot.data()])
      );

      const grouped = new Map();

      sessionsSnapshot.forEach((sessionDoc) => {
        const ownerRef = sessionDoc.ref.parent.parent;
        const sessionUserId = ownerRef?.id;

        if (!sessionUserId || sessionUserId.startsWith('guest_')) {
          return;
        }

        const session = sessionDoc.data();
        const current = grouped.get(sessionUserId) || {
          userId: sessionUserId,
          totalPallets: 0,
          totalTime: 0,
          sessionsCount: 0,
        };

        current.totalPallets += parseFloat(session.palletsLoaded) || 0;
        current.totalTime += parseFloat(session.loadingTime) || 0;
        current.sessionsCount += 1;

        grouped.set(sessionUserId, current);
      });

      const ranked = Array.from(grouped.values())
        .map((entry) => {
          const userProfile = usersMap.get(entry.userId) || {};
          const averageRate = entry.totalTime > 0
            ? entry.totalPallets / (entry.totalTime / 3600)
            : 0;

          return {
            ...entry,
            ...userProfile,
            averageRate,
          };
        })
        .filter((entry) => entry.averageRate > 0)
        .sort((a, b) => {
          if (b.averageRate !== a.averageRate) {
            return b.averageRate - a.averageRate;
          }

          if (b.totalPallets !== a.totalPallets) {
            return b.totalPallets - a.totalPallets;
          }

          return getDisplayName(a, user, profile).localeCompare(getDisplayName(b, user, profile), 'pl');
        })
        .map((entry, index) => ({
          ...entry,
          place: index + 1,
        }));

      const currentUserEntry = ranked.find((entry) => entry.userId === userId);
      setRank(currentUserEntry ? `${currentUserEntry.place}.` : '-');
    } catch (error) {
      console.error('Failed to load rank:', error);
      setRank('-');
    }
  }, [monthBounds.endIso, monthBounds.startIso, profile, user, userId]);

  useFocusEffect(useCallback(() => {
    loadSessions();
    loadRank();
  }, [loadRank, loadSessions]));
  useEffect(() => {
    loadSessions();
    loadRank();
  }, [loadRank, loadSessions]);

  const handleCreateAccount = async () => {
    await signOut();
    router.push('/(auth)/register');
  };

  const handleSessionOptionSelect = (route) => {
    setSessionModalVisible(false);
    if (route) {
      router.push(route);
    }
  };

  const handleSessionButtonPress = () => {
    if (isSessionActive) {
      router.push('/(app)/calculator_content/calculator');
      return;
    }

    setSessionModalVisible(true);
  };

  const levelData = calculateLevelFromXP(profile?.totalXP || 0);
  const level = levelData.level;
  const currentXP = levelData.currentXP;
  const nextXP = levelData.xpToNextLevel;
  const achievementsUnlocked = profile?.achievements?.length || 0;
  const achievementsTotal = Object.values(ACHIEVEMENTS).length;
  const xpProgress = nextXP > 0 ? (currentXP / nextXP) * 100 : 0;

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const handleAvatarPress = () => {
    router.push('/(app)/(tabs)/profile');
  };

  const avatarUri = profile?.photoURL || 'https://via.placeholder.com/150/cccccc/ffffff?text=Avatar';

  return (
    <ThemedView style={styles.container}>
      {isGuest && (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'left' }}>
          <View style={{ marginBottom: 20 }}>
            <View style={styles.headerRow}>
              <TouchableOpacity onPress={handleAvatarPress} style={styles.avatarTouchable}>
                <Image source={{ uri: avatarUri }} style={styles.avatar} />
              </TouchableOpacity>
              <Text style={[styles.welcome, { color: colors.text, marginLeft: 12 }]}>Witaj, {user?.name || 'User'}!</Text>
            </View>
            <Text style={{ color: colors.text, fontSize: 15 }}>Produktywność na wyciągnięcie ręki.</Text>
          </View>
          <View style={[styles.guestBanner, { backgroundColor: colors.guestBackground }]}>
            <Text style={[styles.guestText, { color: colors.guestText }]}>
              Korzystasz z aplikacji w trybie gościa. Zarejestruj się, aby móc w pełni korzystać z funkcji!
            </Text>
            <Pressable
              style={[styles.upgradeButton, { backgroundColor: colors.butBackground }]}
              onPress={handleCreateAccount}
            >
              <Text style={[styles.upgradeText, { color: colors.butText }]}>Utwórz Konto</Text>
            </Pressable>
          </View>
        </View>
      )}

      {!isGuest && isWeb && (
        // WEB DASHBOARD LAYOUT
        <View style={styles.webRoot}>
          <ScrollView
            style={[
              styles.webShell,
              { backgroundColor: colors.navBackground, borderColor: colors.border },
            ]}
          >
            {/* Top header row */}
            <View style={[styles.webHeader, { borderBottomColor: colors.border }]}>
              <View style={styles.webHeaderLeft}>
                <TouchableOpacity onPress={handleAvatarPress} style={styles.avatarTouchable}>
                  <Ionicons name="person-circle" size={72} color={colors.iconColor} />
                </TouchableOpacity>
                <View style={{ marginLeft: 16, flexShrink: 1 }}>
                  <Text style={[styles.welcome, { color: colors.text, fontSize: 26 }]}>
                    Witaj, {profile?.name || profile?.displayName || user?.name || user?.email || 'User'}!
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 15 }}>
                    Produktywność na wyciągnięcie ręki.
                  </Text>
                </View>
              </View>
            </View>

            {/* Main two‑column content */}
            <View style={styles.webMain}>
              {/* Left column – level card */}
              <View style={styles.webLeftColumn}>
                <ThemedCard style={[styles.levelCard, { backgroundColor: colors.cardBackground }]}>
                  <View>
                    <Text style={[styles.levelTitle, { color: colors.title }]}>Poziom {level}</Text>
                    <Text style={[styles.achievements, { color: colors.textSecondary }]}>
                      Osiągnięcia: {achievementsUnlocked} / {achievementsTotal}
                    </Text>
                  </View>
                  <View style={styles.progressContainer}>
                    <View
                      style={[
                        styles.progressBar,
                        {
                          backgroundColor: colors.inputBackground,
                          borderColor: colors.border,
                          borderWidth: 1,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.progressFill,
                          {
                            backgroundColor: colors.iconColor,
                            width: `${Math.min(xpProgress, 100)}%`,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.progressText, { color: colors.textSecondary }]}>
                      {currentXP} / {nextXP} XP
                    </Text>
                  </View>
                </ThemedCard>

                {/* Session button under the card on web - DISABLED FOR WEB
                <View style={{ marginTop: 24 }}>
                  <TouchableOpacity
                    onPress={handleSessionButtonPress}
                    disabled={isSessionModalVisible}
                    style={[
                      styles.webStartButton,
                      {
                        backgroundColor: colors.butBackground,
                        opacity: isSessionModalVisible ? 0.85 : 1,
                      },
                    ]}
                  >
                    {isSessionModalVisible ? (
                      <ActivityIndicator size="small" color={colors.butText} />
                    ) : (
                      <Text style={[styles.webStartButtonText, { color: colors.butText }]}>
                        {sessionButtonLabel}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View> */}
              </View>

              {/* Right column – monthly summary grid */}
              <View style={[styles.summaryContainer, { backgroundColor: colors.cardBackground }]}>
                <Text style={[styles.gridTitle, { color: colors.text, fontSize: 22 }]}>
                  Załadunek
                </Text>
                <View style={styles.statsGrid}>
                  <ThemedCard
                    style={[styles.statCard, { backgroundColor: colors.cardInCardBackground }]}
                  >
                    <Ionicons
                      name="flash-outline"
                      size={28}
                      style={[
                        styles.cardIcon,
                        { color: colors.grayIconColor, marginLeft: -4, marginBottom: 4 },
                      ]}
                    />
                    <Text style={[styles.statTitle, { color: colors.cardTitle }]}>
                      Średnia miesięczna
                    </Text>
                    <Text style={[styles.statValue, { color: colors.cardValue }]}>
                      {summary.averageRate.toFixed(2)} pal/h
                    </Text>
                  </ThemedCard>

                  <ThemedCard
                    style={[styles.statCard, { backgroundColor: colors.cardInCardBackground }]}
                  >
                    <Ionicons
                      name="layers-outline"
                      size={28}
                      style={[
                        styles.cardIcon,
                        { color: colors.grayIconColor, marginLeft: -4, marginBottom: 4 },
                      ]}
                    />
                    <Text style={[styles.statTitle, { color: colors.cardTitle }]}>
                      Palety
                    </Text>
                    <Text style={[styles.statValue, { color: colors.cardValue }]}>
                      {summary.totalPallets}
                    </Text>
                  </ThemedCard>

                  <ThemedCard
                    style={[styles.statCard, { backgroundColor: colors.cardInCardBackground }]}
                  >
                    <Ionicons
                      name="trophy-outline"
                      size={28}
                      style={[
                        styles.cardIcon,
                        { color: colors.grayIconColor, marginLeft: -4, marginBottom: 4 },
                      ]}
                    />
                    <Text style={[styles.statTitle, { color: colors.cardTitle }]}>
                      Ranking
                    </Text>
                    <Text style={[styles.statValue, { color: colors.cardValue }]}>{rank}</Text>
                  </ThemedCard>

                  <ThemedCard
                    style={[styles.statCard, { backgroundColor: colors.cardInCardBackground }]}
                  >
                    <Ionicons
                      name="time-outline"
                      size={28}
                      style={[styles.cardIcon, { color: colors.grayIconColor, marginLeft: -4 }]}
                    />
                    <Text style={[styles.statTitle, { color: colors.cardTitle }]}>
                      Czas ładowania
                    </Text>
                    <Text style={[styles.statValue, { color: colors.cardValue }]}>
                      {formatTime(summary.totalTime)}
                    </Text>
                  </ThemedCard>
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      )}

      {/* ORIGINAL MOBILE DASHBOARD – unchanged */}
      {!isGuest && !isWeb && (
        <View style={styles.content}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Top content */}
            <View>
              <View
                style={[
                  styles.headerRow,
                  { backgroundColor: colors.navBackground, paddingTop: insets.top + 8 },
                ]}
              >
                <TouchableOpacity onPress={handleAvatarPress} style={styles.avatarTouchable}>
                  <Ionicons name="person-circle" size={64} color={colors.iconColor} />
                  {/* <Image source={{ uri: avatarUri }} style={styles.avatar} /> */}
                </TouchableOpacity>
                <View style={{ marginLeft: 12, flexShrink: 1 }}>
                  <Text style={[styles.welcome, { color: colors.text }]}>
                    Witaj, {profile?.name || profile?.displayName || user?.name || user?.email || 'User'}!
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 15 }}>
                    Produktywność na wyciągnięcie ręki.
                  </Text>
                </View>
              </View>

              {/* Level Card */}
              <ThemedCard style={[styles.levelCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                <View>
                  <Text style={[styles.levelTitle, { color: colors.title }]}>Poziom {level}</Text>
                  <Text style={[styles.achievements, { color: colors.textSecondary }]}>
                    Osiągnięcia: {achievementsUnlocked} / {achievementsTotal}
                  </Text>
                </View>
                <View style={styles.progressContainer}>
                  <View
                    style={[
                      styles.progressBar,
                      {
                        backgroundColor: colors.inputBackground,
                        borderColor: colors.border,
                        borderWidth: 1,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.progressFill,
                        { backgroundColor: colors.iconColor, width: `${Math.min(xpProgress, 100)}%` },
                      ]}
                    />
                  </View>
                  <Text style={[styles.progressText, { color: colors.textSecondary }]}>
                    {currentXP} / {nextXP} XP
                  </Text>
                </View>
              </ThemedCard>

              {/* Monthly Summary */}
              <View style={[styles.summaryContainer, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                <Text style={[styles.gridTitle, { color: colors.text, fontSize: 24 }]}>
                  Załadunek
                </Text>
                <Text style={[styles.gridSubtitle, { color: colors.textSecondary }]}>
                  Podsumowanie Twojej aktywności w tym miesiącu
                </Text>
                <View style={styles.statsGrid}>
                  <ThemedCard
                    style={[styles.statCardWide, { backgroundColor: colors.cardInCardBackground, borderColor: colors.border }]}
                  >
                    <Ionicons
                      name="flash-outline"
                      size={28}
                      style={[
                        styles.cardIcon,
                        { color: colors.grayIconColor, marginLeft: -4, marginBottom: 4 },
                      ]}
                    />
                    <Text style={[styles.statTitle, { color: colors.cardTitle }]}>
                      Średnia miesięczna
                    </Text>
                    <Text style={[styles.statValue, { color: colors.cardValue, fontSize: 24 }]}>
                      {summary.averageRate.toFixed(2)} pal/h
                    </Text>
                  </ThemedCard>
                  <ThemedCard
                    style={[styles.statCard, { backgroundColor: colors.cardInCardBackground, borderColor: colors.border }]}
                  >
                    <Ionicons
                      name="layers-outline"
                      size={28}
                      style={[
                        styles.cardIcon,
                        { color: colors.grayIconColor, marginLeft: -4, marginBottom: 4 },
                      ]}
                    />
                    <Text style={[styles.statTitle, { color: colors.cardTitle }]}>
                      Palety
                    </Text>
                    <Text style={[styles.statValue, { color: colors.cardValue, fontSize: 20 }]}>
                      {summary.totalPallets}
                    </Text>
                  </ThemedCard>
                  <ThemedCard
                    style={[styles.statCard, { backgroundColor: colors.cardInCardBackground, borderColor: colors.border }]}
                  >
                    <Ionicons
                      name="trophy-outline"
                      size={28}
                      style={[
                        styles.cardIcon,
                        { color: colors.grayIconColor, marginLeft: -4, marginBottom: 4 },
                      ]}
                    />
                    <Text style={[styles.statTitle, { color: colors.cardTitle }]}>
                      Ranking
                    </Text>
                    <Text style={[styles.statValue, { color: colors.cardValue, fontSize: 20 }]}>{rank}</Text>
                  </ThemedCard>
                  <ThemedCard
                    style={[styles.statCard, { backgroundColor: colors.cardInCardBackground, borderColor: colors.border }]}
                  >
                    <Ionicons
                      name="time-outline"
                      size={28}
                      style={[styles.cardIcon, { color: colors.grayIconColor, marginLeft: -4, marginBottom: 4 }]}
                    />
                    <Text style={[styles.statTitle, { color: colors.cardTitle }]}>
                      Czas
                    </Text>
                    <Text style={[styles.statValue, { color: colors.cardValue, fontSize: 18, marginTop: 2 }]}>
                      {formatTime(summary.totalTime)}
                    </Text>
                  </ThemedCard>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Bottom Content */}
          <View
            style={[
              styles.buttonContainer,
              {
                backgroundColor: colors.navBackground,
                borderTopColor: colors.border,
                borderTopWidth: 1,
              },
            ]}
          >
            {/* Start Button */}
            <TouchableOpacity
              onPress={handleSessionButtonPress}
              disabled={isSessionModalVisible}
              style={[
                styles.startButton,
                {
                  backgroundColor: colors.butBackground,
                  marginTop: 8,
                  opacity: isSessionModalVisible ? 0.85 : 1,
                  height: 48,
                  justifyContent: 'center',
                },
              ]}
            >
              {isSessionModalVisible ? (
                <ActivityIndicator size="small" color={colors.butText} />
              ) : (
                <Text style={[styles.startButtonText, { color: colors.butText }]}>
                  {sessionButtonLabel}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
      <SessionModal
        visible={isSessionModalVisible}
        onClose={() => setSessionModalVisible(false)}
        onOptionSelect={handleSessionOptionSelect}
        options={[
          { key: 'zaladunek', label: 'Załadunek', route: '/(app)/calculator_content/calculator', icon: 'flash' },
          { key: 'kompletacja', label: 'Kompletacja', icon: 'layers' },
          { key: 'wsparcie', label: 'Wsparcie', icon: 'help-circle' },
          { key: 'owijarki', label: 'Owijarki', icon: 'settings' },
        ]}
      />
    </ThemedView >
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // padding: 32,
    paddingBottom: 0,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  welcome: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 0,
  },
  summaryContainer: {
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    padding: 16,
  },
  gridTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginHorizontal: 8,
  },
  gridSubtitle: {
    fontSize: 15,
    marginHorizontal: 8,
    marginBottom: 12,
  },
  levelCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginVertical: 16,
    borderRadius: 16,
    gap: 32,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  levelTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  progressContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  progressBar: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: 10,
    borderRadius: 5,
  },
  progressText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 5,
  },
  achievements: {
    fontSize: 15,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  avatarTouchable: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#cccccc',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginHorizontal: 8,
  },
  statCard: {
    width: '31%',
    borderRadius: 16,
    borderWidth: 1,
  },
  statCardWide: {
    width: '100%',
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  statTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 2,
    marginTop: 2,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  guestBanner: {
    backgroundColor: '#FFF3CD',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  guestText: {
    color: '#856404',
    marginBottom: 10,
  },
  upgradeButton: {
    backgroundColor: '#c50000',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  upgradeText: {
    color: '#fff',
    fontWeight: '600',
  },
  buttonContainer: {
    paddingVertical: 8,
  },
  startButton: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 16,
    marginHorizontal: 16,
    gap: 6,
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: '400',
  },
  logoutButton: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
    width: '50%',
    alignSelf: 'center',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
  },
  // --- WEB ONLY STYLES BELOW ---
  webRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: 24,
    paddingHorizontal: 32,
  },
  webShell: {
    flex: 1,
    maxWidth: 1200,
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  webHeader: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
  },
  webHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  webMain: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 24,
    gap: 24,
  },
  webLeftColumn: {
    flex: 1,
    minWidth: 280,
  },
  webStartButton: {
    height: 50,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    alignSelf: 'flex-start',
  },
  webStartButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

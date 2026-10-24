import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, doc, getDoc, getDocsFromServer, orderBy, query } from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ThemedCard from '../../components/ThemedCard';
import ThemedView from '../../components/ThemedView';
import { calculateLevelFromXP } from '../../constants/LevelSystem';
import { useAuth } from '../../context/AuthContext';
import { useCalculator } from '../../context/CalculatorContext';
import { useThemeContext } from '../../context/ThemeContext';
import { useTimetable } from '../../context/TimetableContext';
import { useUserProfile } from '../../context/UserProfileContext';
import { db } from '../../firebase/config';
import { useAutoHorizontalScroll } from '../../hooks/useAutoHorizontalScroll';
import { useColors } from '../../hooks/useColors';
import { isSessionStartAllowed } from '../../utils/timetableAvailability';
import SessionModal from '../modals/SessionModal';
import { getLeaderboardCache, getUserScoreHistoryCache, setLeaderboardCache, setUserScoreHistoryCache } from '../../services/ScoreDataCache';
import { useNetwork } from '../../services/useNetwork';

const PICKING_SUBSECTIONS = ['P01', 'P02', 'P03', 'P04', 'P05', 'P06', 'P15', 'P21', 'P28'];


// inside app/(tabs)/index.jsx
const calculateSummary = (sessionsArray) => {
  const totalPallets = sessionsArray.reduce((sum, s) => sum + (parseFloat(s.palletsLoaded) || 0), 0);
  const totalTime = sessionsArray.reduce((sum, s) => sum + (parseFloat(s.sessionTime ?? s.loadingTime) || 0), 0);
  const averageRate = totalTime > 0 ? totalPallets / (totalTime / 3600) : 0;
  return { totalPallets, totalTime, averageRate };
};

const AVERAGE_CHART_DATA = {
  today: {
    label: 'Dzisiaj',
    values: [38, 45, 34, 49, 41, 36, 47, 32, 44, 39],
    labels: Array(10).fill('00:00'),
  },
  week: {
    label: 'Tydzień',
    values: [42, 35, 48, 39, 45, 33, 50],
    labels: ['pon', 'wt', 'śr', 'czw', 'pt', 'sob', 'nd'],
  },
  month: {
    label: 'Miesiąc',
    values: [36, 44, 39, 48, 32, 45, 41, 37, 49, 34, 43, 38, 46, 31, 50, 40, 35, 47, 42, 33],
    labels: Array.from({ length: 20 }, (_, index) => String(index + 1)),
  },
  year: {
    label: 'Rok',
    values: [45, 38, 49, 34, 42, 36, 48, 40, 33, 46, 39, 50],
    labels: ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru'],
  },
};

const MONTHLY_CARD_PALETTE = {
  light: {
    background: '#FFFDFC',
    surface: '#F4F3F1',
    border: '#E3E4E8',
    text: '#202226',
    textSecondary: '#737780',
    bar: '#647C89',
    barBottom: '#34454D',
    highlightedBar: '#F0785F',
  },
  dark: {
    background: '#292C31',
    surface: '#202226',
    border: '#383B40',
    text: '#F3F4F6',
    textSecondary: '#A5A9B1',
    bar: '#8499A5',
    barBottom: '#202226',
    highlightedBar: '#F0785F',
  },
};

function AverageChartTabs({ selectedPeriod, onSelectPeriod, palette }) {
  return (
    <View style={[styles.averageChartTabs, { backgroundColor: palette.surface }]}>
      {Object.entries(AVERAGE_CHART_DATA).map(([period, { label }]) => {
        const isSelected = selectedPeriod === period;
        return (
          <Pressable
            key={period}
            onPress={() => onSelectPeriod(period)}
            style={[
              styles.averageChartTab,
              isSelected && styles.averageChartTabSelected,
              isSelected && {
                backgroundColor: palette.background,
                borderColor: palette.border,
              },
            ]}
          >
            <Text
              style={[
                styles.averageChartTabText,
                { color: isSelected ? palette.text : palette.textSecondary },
              ]}
              numberOfLines={1}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function AverageBarChart({ selectedPeriod, palette }) {
  const chartData = AVERAGE_CHART_DATA[selectedPeriod];
  const [plotHeight, setPlotHeight] = useState(0);
  const [selectedBarIndex, setSelectedBarIndex] = useState(null);
  useEffect(() => {
    setSelectedBarIndex(null);
  }, [selectedPeriod]);

  const labelFontSize = selectedPeriod === 'week'
    ? 11
    : selectedPeriod === 'year'
      ? 9
      : 8;
  const handleBarAreaLayout = (event) => {
    const nextHeight = Math.round(event.nativeEvent.layout.height);
    if (nextHeight > 0) {
      setPlotHeight((currentHeight) => (
        currentHeight === nextHeight ? currentHeight : nextHeight
      ));
    }
  };

  return (
    <View style={styles.averageChartBars}>
      {chartData.values.map((value, index) => {
        const isSelected = selectedBarIndex === index;
        const barAreaHeight = Math.max(10, plotHeight - 14);
        const barHeight = Math.max(
          10,
          barAreaHeight * (0.6 + ((value - 30) / 20) * 0.4)
        );
        return (
          <View key={`${selectedPeriod}-${index}`} style={styles.averageChartColumn}>
            <View
              style={styles.averageChartBarArea}
              onLayout={index === 0 ? handleBarAreaLayout : undefined}
            >
              {isSelected && (
                <Text
                  style={[
                    styles.averageChartBarValue,
                    {
                      bottom: barHeight + 2,
                      color: palette.highlightedBar,
                    },
                  ]}
                >
                  {value}
                </Text>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${chartData.labels[index]}: ${value}`}
                accessibilityState={{ selected: isSelected }}
                onPress={() => setSelectedBarIndex((currentIndex) => (
                  currentIndex === index ? null : index
                ))}
                style={[styles.averageChartBarPressable, { height: barHeight }]}
              >
                <LinearGradient
                  colors={isSelected
                    ? [palette.highlightedBar, palette.highlightedBar]
                    : [palette.bar, palette.barBottom]}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={styles.averageChartBar}
                >
                  {index === chartData.values.length - 1 && !isSelected && (
                    <View style={[styles.averageChartBarHighlight, { backgroundColor: palette.highlightedBar }]} />
                  )}
                </LinearGradient>
              </Pressable>
            </View>
            <Text
              style={[
                styles.averageChartLabel,
                { color: palette.textSecondary, fontSize: labelFontSize },
              ]}
              numberOfLines={1}
            >
              {chartData.labels[index]}
            </Text>
          </View>
        );
      })}
    </View>
  );
}


export default function Dashboard() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { theme } = useThemeContext();
  const monthlyCardPalette = MONTHLY_CARD_PALETTE[theme];
  const { user, isGuest, signOut } = useAuth();
  const { profile } = useUserProfile();
  const { loading: timetableLoading, getCurrentSnapshot } = useTimetable();
  const router = useRouter();
  
  const { isOnline } = useNetwork();
  console.log('Internet:', isOnline);

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSessionModalVisible, setSessionModalVisible] = useState(false);
  const [rank, setRank] = useState('-');
  const [pickingRanks, setPickingRanks] = useState({});
  const [selectedPickingSubsection, setSelectedPickingSubsection] = useState(null);
  const [selectedDashboardTab, setSelectedDashboardTab] = useState('truck');
  const [averageChartPeriod, setAverageChartPeriod] = useState('week');
  const [now, setNow] = useState(() => new Date());
  const userId = user?.id;

  // Derive section visibility flags from user preferences
  const showTruck = Array.isArray(profile?.preferences?.sections) && profile.preferences.sections.includes('zaladunek');
  const showPicking = Array.isArray(profile?.preferences?.sections) && profile.preferences.sections.includes('kompletacja');
  const hasNoSections = !showTruck && !showPicking;

  const CARD_SIZE = 140;

  const calc = useCalculator();

  const isSessionActive =
    calc.mode === 'working' ||
    calc.mode === 'paused' ||
    calc.mode === 'results';

  const timetableSnapshot = getCurrentSnapshot();
  const canStartNewSession =
    !isGuest &&
    !isSessionActive &&
    isSessionStartAllowed(timetableSnapshot.schedule, timetableSnapshot.isReady, now);
  const sessionAvailabilityText =
    isGuest || isSessionActive
      ? null
      : !timetableSnapshot.isReady
        ? timetableLoading
          ? 'Ładowanie grafiku…'
          : 'Grafik niedostępny'
        : canStartNewSession
          ? 'Możesz rozpocząć sesję'
          : 'Poza godzinami zmiany';

  const sessionButtonLabel = isSessionActive
    ? 'Kontynuuj Sesję'
    : 'Rozpocznij Sesję';

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

  const truckSessionsForMonth = sessionsForMonth.filter((s) => s.sessionType !== 'picking');
  const pickingSessionsForMonth = sessionsForMonth.filter((s) => s.sessionType === 'picking');

  const summary = calculateSummary(truckSessionsForMonth);

  const pickingStatsBySubsection = useMemo(() => {
    const base = PICKING_SUBSECTIONS.reduce((acc, subsection) => {
      acc[subsection] = {
        subsection,
        boxesCount: 0,
        sessionTime: 0,
        ordersCount: 0,
        boxesRate: 0,
      };
      return acc;
    }, {});

    pickingSessionsForMonth.forEach((session) => {
      const entries = Array.isArray(session.picking?.subsectionEntries)
        ? session.picking.subsectionEntries
        : [];

      entries.forEach((entry) => {
        const subsection = entry?.subsection;
        if (!subsection || !base[subsection]) return;

        base[subsection].boxesCount += Number(entry.boxesCount || 0);
        base[subsection].sessionTime += Number(entry.sessionTime || 0);
        base[subsection].ordersCount += Number(entry.ordersCount || 0);
      });
    });

    Object.keys(base).forEach((subsection) => {
      const subsectionStats = base[subsection];
      subsectionStats.boxesRate = subsectionStats.sessionTime > 0
        ? subsectionStats.boxesCount / (subsectionStats.sessionTime / 3600)
        : 0;
    });

    return base;
  }, [pickingSessionsForMonth]);

  const pickingDefaultSubsection = useMemo(() => {
    let best = PICKING_SUBSECTIONS[0];
    let bestTime = -1;

    PICKING_SUBSECTIONS.forEach((subsection) => {
      const sessionTime = Number(pickingStatsBySubsection[subsection]?.sessionTime || 0);
      if (sessionTime > bestTime) {
        best = subsection;
        bestTime = sessionTime;
      }
    });

    return best;
  }, [pickingStatsBySubsection]);

  useEffect(() => {
    if (!selectedPickingSubsection) {
      setSelectedPickingSubsection(pickingDefaultSubsection);
      return;
    }

    if (!PICKING_SUBSECTIONS.includes(selectedPickingSubsection)) {
      setSelectedPickingSubsection(pickingDefaultSubsection);
    }
  }, [pickingDefaultSubsection, selectedPickingSubsection]);

  const activePickingSubsection = selectedPickingSubsection || pickingDefaultSubsection;
  const activePickingStats = pickingStatsBySubsection[activePickingSubsection] || {
    boxesCount: 0,
    sessionTime: 0,
    ordersCount: 0,
    boxesRate: 0,
  };

  const activePickingRank = pickingRanks[activePickingSubsection] || '-';


  useEffect(() => {
    const loadDashboardPreferences = async () => {
      try {
        const storedTab = await AsyncStorage.getItem('dashboardSectionsVisibility');
        if (storedTab === 'truck' || storedTab === 'picking') {
          setSelectedDashboardTab(storedTab);
        }
      } catch (error) {
        console.error('Failed to load dashboard preferences:', error);
      }
    };

    loadDashboardPreferences();
  }, []);

  const handleDashboardTabChange = async (nextTab) => {
    setSelectedDashboardTab(nextTab);

    try {
      await AsyncStorage.setItem('dashboardSectionsVisibility', nextTab);
    } catch (error) {
      console.error('Failed to persist dashboard tab:', error);
    }
  };

  const loadSessions = useCallback(async (active) => {
    const isActive = () => (typeof active === 'function' ? active() : active !== false);
    if (!userId) {
      if (!isActive()) return;
      setSessions([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Cache-first hydration: shows last known sessions instantly, independent of network state.
    let hasCachedSessions = false;
    try {
      const cachedSessions = await getUserScoreHistoryCache(userId);
      if (!isActive()) return;
      if (cachedSessions) {
        console.log('[Dashboard] Score history cache hit');
        hasCachedSessions = true;
        setSessions(cachedSessions);
        setLoading(false);
      }
    } catch (cacheError) {
      console.warn('[Dashboard] Failed to read score history cache:', cacheError);
    }

    // getDocsFromServer forces a real network round-trip, so being offline throws
    // instead of silently resolving to an empty snapshot that would poison the cache.
    try {
      const sessionsRef = collection(db, 'users', userId, 'scoreHistory');
      const q = query(sessionsRef, orderBy('date', 'desc'));
      const snapshot = await getDocsFromServer(q);
      if (!isActive()) return;
      const fetchedSessions = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      console.log('[Dashboard] Score history loaded from server');
      setSessions(fetchedSessions);
      setUserScoreHistoryCache(userId, fetchedSessions)
        .then(() => console.log('[Dashboard] Score history cache updated'))
        .catch(() => {});
    } catch (error) {
      if (!isActive()) return;
      // A server error must never wipe out sessions we already hydrated from cache.
      if (hasCachedSessions) {
        console.log('[Dashboard] Score history server unavailable, keeping cache');
      } else {
        console.error('Failed to load sessions:', error);
      }
    } finally {
      if (!isActive()) return;
      setLoading(false);
    }
  }, [userId]);

  const applyLeaderboardData = useCallback((docData) => {
    const truckArray = Array.isArray(docData?.truck) ? docData.truck : [];
    const userTruckIndex = truckArray.findIndex((entry) => entry.userId === userId);
    setRank(userTruckIndex >= 0 ? `${userTruckIndex + 1}.` : '-');

    const nextPickingRanks = {};
    const pickingObj = docData?.picking || {};
    PICKING_SUBSECTIONS.forEach((subsection) => {
      const subArray = Array.isArray(pickingObj[subsection]) ? pickingObj[subsection] : [];
      const userSubIndex = subArray.findIndex((entry) => entry.userId === userId);
      nextPickingRanks[subsection] = userSubIndex >= 0 ? `${userSubIndex + 1}.` : '-';
    });
    setPickingRanks(nextPickingRanks);
  }, [userId]);

  const loadRank = useCallback(async (active) => {
    const isActive = () => (typeof active === 'function' ? active() : active !== false);
    if (!userId) {
      if (!isActive()) return;
      setRank('-');
      setPickingRanks({});
      return;
    }

    const monthKey = `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, '0')}`;

    // Cache-first hydration: shows last known rank instantly, independent of network state.
    let hasCachedLeaderboard = false;
    try {
      const cachedLeaderboard = await getLeaderboardCache(monthKey);
      if (!isActive()) return;
      if (cachedLeaderboard) {
        console.log('[Dashboard] Leaderboard cache hit');
        hasCachedLeaderboard = true;
        applyLeaderboardData(cachedLeaderboard);
      }
    } catch (cacheError) {
      console.warn('[Dashboard] Failed to read leaderboard cache:', cacheError);
    }

    try {
      const docRef = doc(db, 'leaderboards', monthKey);
      const docSnap = await getDoc(docRef);

      if (!isActive()) return;

      const docData = docSnap.exists() ? docSnap.data() || {} : {};
      console.log('[Dashboard] Leaderboard loaded from Firestore');
      applyLeaderboardData(docData);
      setLeaderboardCache(monthKey, docData)
        .then(() => console.log('[Dashboard] Leaderboard cache updated'))
        .catch(() => {});
    } catch (error) {
      if (!isActive()) return;
      // A Firestore error must never wipe out a rank we already hydrated from cache.
      if (hasCachedLeaderboard) {
        console.log('[Dashboard] Firestore unavailable, keeping cached leaderboard');
      } else {
        console.error('Failed to load rank:', error);
        setRank('-');
        setPickingRanks({});
      }
    }
  }, [applyLeaderboardData, currentMonth.month, currentMonth.year, userId]);

  // useFocusEffect already runs on initial mount as well as on every focus,
  // so a separate mount-only effect would just duplicate these loads.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadSessions(() => active);
      loadRank(() => active);
      return () => {
        active = false;
      };
    }, [loadRank, loadSessions])
  );

  useFocusEffect(
    useCallback(() => {
      let isFocused = true;
      let isForeground = Platform.OS === 'web'
        ? !document.hidden
        : AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
      let timeoutId;

      const clearMinuteTimeout = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = undefined;
        }
      };

      const scheduleMinuteTimeout = () => {
        clearMinuteTimeout();
        if (!isFocused || !isForeground) return;

        const delay = 60000 - (Date.now() % 60000);
        timeoutId = setTimeout(() => {
          timeoutId = undefined;
          if (!isFocused || !isForeground) return;

          setNow(new Date());
          scheduleMinuteTimeout();
        }, delay);
      };

      const refreshTime = () => {
        if (!isFocused) return;
        setNow(new Date());
        scheduleMinuteTimeout();
      };

      refreshTime();

      let removeForegroundListener;
      if (Platform.OS === 'web') {
        const handleVisibilityChange = () => {
          isForeground = !document.hidden;
          if (isForeground) {
            refreshTime();
          } else {
            clearMinuteTimeout();
          }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        removeForegroundListener = () =>
          document.removeEventListener('visibilitychange', handleVisibilityChange);
      } else {
        let previousAppState = AppState.currentState;
        const subscription = AppState.addEventListener('change', (nextAppState) => {
          const wasForeground = previousAppState === 'active';
          isForeground = nextAppState === 'active';

          if (!wasForeground && isForeground) {
            refreshTime();
          } else if (wasForeground && !isForeground) {
            clearMinuteTimeout();
          }

          previousAppState = nextAppState;
        });
        removeForegroundListener = () => subscription.remove();
      }

      return () => {
        isFocused = false;
        clearMinuteTimeout();
        removeForegroundListener?.();
      };
    }, [])
  );

  // Reconnect refresh: re-run loaders only on the false -> true transition,
  // so we don't refetch on mount (undefined -> false/true) or on every render.
  const previousOnlineRef = useRef(isOnline);
  useEffect(() => {
    const wasOffline = previousOnlineRef.current === false;
    const isNowOnline = isOnline === true;

    if (wasOffline && isNowOnline) {
      console.log('[Dashboard] Reconnected, refreshing score history and leaderboard');
      loadSessions();
      loadRank();
    }

    previousOnlineRef.current = isOnline;
  }, [isOnline, loadRank, loadSessions]);

  useEffect(() => {
    if (!user || !profile) return;
    if (isGuest) return; // guests skip setup

    const hasCompletedSetup = profile.hasCompletedSetup === true;
    const sections = profile.preferences?.sections;

    const needsSetup =
      !hasCompletedSetup ||
      !Array.isArray(sections) ||
      sections.length === 0;

    if (needsSetup) {
      router.replace('/setup');
    }
  }, [user, profile, isGuest, router]);

  const handleCreateAccount = async () => {
    await signOut();
    router.push('/(auth)/register');
  };

  const handleSessionOptionSelect = (option) => {
    setSessionModalVisible(false);
    if (option?.key === 'zaladunek') {
      calc.updateState({ sessionType: 'truck-loading' });
    }

    if (option?.key === 'kompletacja') {
      calc.updateState({ sessionType: 'picking' });
    }

    if (option?.route) {
      router.push(option.route);
    }
  };

  const handleSessionButtonPress = () => {
    if (isSessionActive) {
      router.push('/calculator_content/calculator');
      return;
    }

    setSessionModalVisible(true);
  };

  const levelData = calculateLevelFromXP(profile?.totalXP || 0);
  const level = levelData.level;
  const currentXP = levelData.currentXP;
  const nextXP = levelData.xpToNextLevel;
  const xpProgress = nextXP > 0 ? (currentXP / nextXP) * 100 : 0;
  const unlockedAchievementsCount = Array.isArray(profile?.achievements)
    ? profile.achievements.length
    : 0;

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
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

  const {
    scrollRef: pickingScrollRef,
    handleLayout: handlePickingLayout,
    handleContentSizeChange: handlePickingContentSizeChange,
    handleUserInteraction: handlePickingUserInteraction,
    handleMomentumScrollEnd: handlePickingMomentumScrollEnd,
    handleScrollEndDrag: handlePickingScrollEndDrag,
  } = useAutoHorizontalScroll({
    speed: 20,
    pauseAtEdgesMs: 2000,
    idleToResumeMs: 5000,
  });

  const handleAvatarPress = () => {
    router.push('/(tabs)/profile');
  };

  const avatarUri = profile?.photoURL || 'https://via.placeholder.com/150/cccccc/ffffff?text=Avatar';

  const truckSummarySection = (
    <View style={styles.summaryContainer}>
      <View style={styles.statsGrid}>
        <ThemedCard
          style={[
            styles.statCardWide,
            {
              backgroundColor: monthlyCardPalette.background,
              borderColor: monthlyCardPalette.border,
            },
          ]}
        >
          <View style={styles.monthlyAverageContent}>
            <AverageChartTabs
              selectedPeriod={averageChartPeriod}
              onSelectPeriod={setAverageChartPeriod}
              palette={monthlyCardPalette}
            />
            <View style={styles.monthlyAverageMetric}>
              <Text style={[styles.monthlyAverageTitle, { color: monthlyCardPalette.text }]}>
                Średnia miesięczna
              </Text>
              <Text style={[styles.monthlyAverageValue, { color: monthlyCardPalette.text }]}>
                {summary.averageRate.toFixed(2)} pal/h
              </Text>
            </View>
            <AverageBarChart
              selectedPeriod={averageChartPeriod}
              palette={monthlyCardPalette}
            />
          </View>
        </ThemedCard>

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
          <ThemedCard
            style={[styles.statCard, { backgroundColor: colors.cardInCardBackground, borderColor: colors.border, width: CARD_SIZE, height: CARD_SIZE, }]}
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
            style={[styles.statCard, { backgroundColor: colors.cardInCardBackground, borderColor: colors.border, width: CARD_SIZE, height: CARD_SIZE, }]}
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
            style={[styles.statCard, { backgroundColor: colors.cardInCardBackground, borderColor: colors.border, width: CARD_SIZE, height: CARD_SIZE, }]}
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
        </Animated.ScrollView>
      </View>
    </View>
  );

  const pickingSummarySection = (
    <View style={styles.summaryContainer}>
      <View style={styles.pickingSubsectionSelector}>
        {PICKING_SUBSECTIONS.map((subsection) => {
          const isActive = activePickingSubsection === subsection;
          return (
            <Pressable
              key={subsection}
              onPress={() => setSelectedPickingSubsection(subsection)}
              style={[
                styles.subsectionChip,
                {
                  borderColor: isActive ? colors.butBorder : colors.border,
                  backgroundColor: isActive ? colors.butBackground : colors.cardInCardBackground,
                },
              ]}
            >
              <Text style={{ color: isActive ? colors.butText : colors.text, fontWeight: '700' }}>{subsection}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.statsGrid}>
        <ThemedCard
          style={[
            styles.statCardWide,
            {
              backgroundColor: monthlyCardPalette.background,
              borderColor: monthlyCardPalette.border,
            },
          ]}
        >
          <View style={styles.monthlyAverageContent}>
            <AverageChartTabs
              selectedPeriod={averageChartPeriod}
              onSelectPeriod={setAverageChartPeriod}
              palette={monthlyCardPalette}
            />
            <View style={styles.monthlyAverageMetric}>
              <Text style={[styles.monthlyAverageTitle, { color: monthlyCardPalette.text }]}>
                Średnia miesięczna ({activePickingSubsection})
              </Text>
              <Text style={[styles.monthlyAverageValue, { color: monthlyCardPalette.text }]}>
                {activePickingStats.boxesRate.toFixed(2)} pacz/h
              </Text>
            </View>
            <AverageBarChart
              selectedPeriod={averageChartPeriod}
              palette={monthlyCardPalette}
            />
          </View>
        </ThemedCard>

        <Animated.ScrollView
          ref={pickingScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          onLayout={handlePickingLayout}
          onContentSizeChange={handlePickingContentSizeChange}
          onTouchStart={handlePickingUserInteraction}
          onScrollBeginDrag={handlePickingUserInteraction}
          onScrollEndDrag={handlePickingScrollEndDrag}
          onMomentumScrollEnd={handlePickingMomentumScrollEnd}
          scrollEventThrottle={16}
          contentContainerStyle={styles.horizontalCardsContent}
        >
          <ThemedCard
            style={[styles.statCard, { backgroundColor: colors.cardInCardBackground, borderColor: colors.border, width: CARD_SIZE, height: CARD_SIZE }]}
          >
            <Ionicons
              name="cube-outline"
              size={28}
              style={[
                styles.cardIcon,
                { color: colors.grayIconColor, marginLeft: -4, marginBottom: 4 },
              ]}
            />
            <Text style={[styles.statTitle, { color: colors.cardTitle }]}>Paczki</Text>
            <Text style={[styles.statValue, { color: colors.cardValue, fontSize: 20 }]}>
              {activePickingStats.boxesCount.toFixed(2)}
            </Text>
          </ThemedCard>

          <ThemedCard
            style={[styles.statCard, { backgroundColor: colors.cardInCardBackground, borderColor: colors.border, width: CARD_SIZE, height: CARD_SIZE }]}
          >
            <Ionicons
              name="trophy-outline"
              size={28}
              style={[
                styles.cardIcon,
                { color: colors.grayIconColor, marginLeft: -4, marginBottom: 4 },
              ]}
            />
            <Text style={[styles.statTitle, { color: colors.cardTitle }]}>Ranking</Text>
            <Text style={[styles.statValue, { color: colors.cardValue, fontSize: 20 }]}>{activePickingRank}</Text>
          </ThemedCard>

          <ThemedCard
            style={[styles.statCard, { backgroundColor: colors.cardInCardBackground, borderColor: colors.border, width: CARD_SIZE, height: CARD_SIZE }]}
          >
            <Ionicons
              name="time-outline"
              size={28}
              style={[styles.cardIcon, { color: colors.grayIconColor, marginLeft: -4, marginBottom: 4 }]}
            />
            <Text style={[styles.statTitle, { color: colors.cardTitle }]}>Czas</Text>
            <Text style={[styles.statValue, { color: colors.cardValue, fontSize: 18, marginTop: 2 }]}>
              {formatTime(activePickingStats.sessionTime)}
            </Text>
          </ThemedCard>
        </Animated.ScrollView>
      </View>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      {isGuest && (
        <View
          style={[
            styles.guestContent,
            {
              paddingTop: insets.top + 8,
              backgroundColor: colors.background,
            },
          ]}
        >
          <View style={styles.guestHeader}>
            <View style={styles.headerRow}>
              <TouchableOpacity onPress={handleAvatarPress} style={styles.avatarTouchable}>
                <Ionicons name="person-circle" size={64} color={colors.iconColor} />
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

      {!isGuest && (
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
                  {
                    backgroundColor: colors.navBackground,
                    paddingTop: insets.top + 8,
                    paddingHorizontal: 24,
                  },
                ]}
              >
                <TouchableOpacity onPress={handleAvatarPress} style={styles.avatarTouchable}>
                  <Ionicons name="person-circle" size={64} color={colors.iconColor} />
                  {/* <Image source={{ uri: avatarUri }} style={styles.avatar} /> */}
                </TouchableOpacity>
                <View style={styles.headerDetails}>
                  <Text style={[styles.welcome, { color: colors.text }]}>
                    Witaj, {profile?.name || profile?.displayName || user?.name || user?.email || 'User'}!
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 15 }}>
                    Produktywność na wyciągnięcie ręki.
                  </Text>
                  <View style={styles.headerChipRow}>
                    <View style={[styles.headerChip, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                      <Text style={[styles.headerChipText, { color: colors.title }]}>Poziom {level}</Text>
                    </View>
                    <View style={[styles.headerChip, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                      <Text style={[styles.headerChipText, { color: colors.text }]}>
                        {unlockedAchievementsCount} osiągnięć
                      </Text>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.headerXPTrack,
                      { backgroundColor: colors.inputBackground, borderColor: colors.border },
                    ]}
                  >
                    <View
                      style={[
                        styles.headerXPFill,
                        { backgroundColor: colors.iconColor, width: `${Math.min(xpProgress, 100)}%` },
                      ]}
                    />
                  </View>
                  <Text style={[styles.headerXPText, { color: colors.textSecondary }]} numberOfLines={1}>
                    {currentXP} / {nextXP} XP
                  </Text>
                </View>
              </View>

              {hasNoSections ? (
                <View style={[styles.emptyStateContainer, { backgroundColor: colors.cardBackground, borderColor: colors.border, alignItems: 'center', paddingVertical: 32 }]}>
                  <Ionicons name="settings-outline" size={54} color={colors.iconColor} />
                  <Text style={[styles.emptyTitle, { color: colors.text, textAlign: 'center', marginTop: 12 }]}>Brak wybranych sekcji</Text>
                  <Text style={[styles.emptyText, { color: colors.textSecondary, textAlign: 'center', marginHorizontal: 16, marginBottom: 20 }]}>
                    Brak wybranych sekcji. Przejdź do Ustawień, aby wybrać sekcje, z którymi pracujesz.
                  </Text>
                  <Pressable
                    style={[styles.upgradeButton, { backgroundColor: colors.butBackground, paddingHorizontal: 20, paddingVertical: 12 }]}
                    onPress={() => router.push('/misc/settings')}
                  >
                    <Text style={[styles.upgradeText, { color: colors.butText }]}>Przejdź do Ustawień</Text>
                  </Pressable>
                </View>
              ) : showTruck && !showPicking ? (
                // Pokaż statystyki tylko jeśli użytkownik wybrał sekcję "Załadunek"
                truckSummarySection
              ) : !showTruck && showPicking ? (
                // Pokaż statystyki tylko jeśli użytkownik wybrał sekcję "Kompletacja"
                pickingSummarySection
              ) : (
                <>
                  <View
                    style={[
                      styles.dashboardTabs,
                      { backgroundColor: colors.cardInCardBackground, marginHorizontal: 24 },
                    ]}
                  >
                    {[
                      { key: 'truck', label: 'Załadunek' },
                      { key: 'picking', label: 'Kompletacja' },
                    ].map(({ key, label }) => {
                      const isSelected = selectedDashboardTab === key;
                      return (
                        <Pressable
                          key={key}
                          onPress={() => handleDashboardTabChange(key)}
                          style={[
                            styles.dashboardTab,
                            {
                              backgroundColor: isSelected ? colors.cardBackground : 'transparent',
                              borderColor: isSelected ? colors.border : 'transparent',
                              elevation: isSelected ? 3 : 0,
                              shadowOpacity: isSelected ? 0.18 : 0,
                            },
                          ]}
                        >
                          <Text style={[styles.dashboardTabText, { color: colors.text }]}>
                            {label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {selectedDashboardTab === 'truck' ? truckSummarySection : pickingSummarySection}
                </>
              )}
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
            {sessionAvailabilityText ? (
              <Text
                style={[
                  styles.sessionAvailabilityText,
                  { color: canStartNewSession ? colors.textSuccess : colors.textSecondary },
                ]}
              >
                {sessionAvailabilityText}
              </Text>
            ) : null}
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
          ...(showTruck ? [{ key: 'zaladunek', label: 'Załadunek', route: '/calculator_content/calculator', icon: 'truck-cargo-container' }] : []),
          ...(showPicking ? [{ key: 'kompletacja', label: 'Kompletacja', route: '/calculator_content/calculator', icon: 'package' }] : []),
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
  guestContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  guestHeader: {
    marginBottom: 20,
  },
  welcome: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 0,
  },
  summaryContainer: {
    marginHorizontal: 24,
  },
  emptyStateContainer: {
    marginHorizontal: 24,
    borderRadius: 16,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  headerDetails: {
    flex: 1,
    minWidth: 0,
    marginLeft: 12,
  },
  headerChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  headerChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
  },
  headerChipText: {
    fontSize: 14,
    fontWeight: '700',
  },
  headerXPTrack: {
    height: 8,
    marginTop: 6,
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 1,
  },
  headerXPFill: {
    height: '100%',
    borderRadius: 999,
  },
  headerXPText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
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
    marginHorizontal: 4,
  },
  dashboardTabs: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 16,
    marginBottom: 12,
  },
  dashboardTab: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
  },
  dashboardTabText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  pickingSubsectionSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginHorizontal: 4,
    marginBottom: 12,
  },
  subsectionChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  horizontalCardsContent: {
    gap: 12,
  },
  statCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    justifyContent: 'center',
  },
  statCardWide: {
    width: '100%',
    aspectRatio: 1.25,
    marginBottom: 12,
    padding: 0,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 4,
  },
  monthlyAverageContent: {
    flex: 1,
    padding: 14,
  },
  monthlyAverageTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  monthlyAverageMetric: {
    paddingVertical: 6,
  },
  monthlyAverageValue: {
    fontSize: 32,
    fontWeight: '800',
    marginTop: 4,
  },
  averageChartTabs: {
    height: 32,
    flexDirection: 'row',
    padding: 2,
    gap: 2,
    borderRadius: 999,
    marginBottom: 12,
  },
  averageChartTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  averageChartTabSelected: {
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.16,
    shadowRadius: 2,
  },
  averageChartTabText: {
    fontSize: 12,
    fontWeight: '700',
  },
  averageChartBars: {
    flex: 1,
    minHeight: 62,
    flexDirection: 'row',
    gap: 1,
    marginTop: 6,
  },
  averageChartColumn: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
  },
  averageChartBarArea: {
    flex: 1,
    position: 'relative',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  averageChartBarPressable: {
    width: '72%',
    minHeight: 10,
    borderRadius: 4,
    overflow: 'hidden',
  },
  averageChartBar: {
    flex: 1,
    width: '100%',
    borderRadius: 4,
    overflow: 'hidden',
  },
  averageChartBarValue: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 1,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
    textAlign: 'center',
  },
  averageChartBarHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  averageChartLabel: {
    fontSize: 7,
    lineHeight: 9,
    marginTop: 2,
    textAlign: 'center',
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
  sessionAvailabilityText: {
    fontSize: 13,
    lineHeight: 16,
    marginBottom: 4,
    textAlign: 'center',
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
});

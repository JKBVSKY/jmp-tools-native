import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { useColors } from '@/_hooks/useColors';
import ThemedView from '@/components/ThemedView';
import { useAuth } from '@/_context/AuthContext';
import { useUserProfile } from '@/_context/UserProfileContext';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/firebase/config';
import ThemedCard from '@/components/ThemedCard';
import { ACHIEVEMENTS, calculateLevelFromXP } from '@/constants/LevelSystem';

const calculateSummary = (sessionsArray) => {
  const totalPallets = sessionsArray.reduce((sum, s) => sum + (parseFloat(s.palletsLoaded) || 0), 0);
  const totalTime = sessionsArray.reduce((sum, s) => sum + (parseFloat(s.loadingTime) || 0), 0);
  const averageRate = totalTime > 0 ? totalPallets / (totalTime / 3600) : 0;
  return { totalPallets, totalTime, averageRate };
};

export default function Dashboard() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { user, isGuest, signOut } = useAuth();
  const { profile } = useUserProfile();
  const router = useRouter();

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const userId = user?.id;

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

  useFocusEffect(useCallback(() => { loadSessions(); }, [loadSessions]));
  useEffect(() => { loadSessions(); }, [loadSessions]);

  const handleCreateAccount = async () => {
    await signOut();
    router.push('/(auth)/register');
  };

  const levelData = calculateLevelFromXP(profile?.totalXP || 0);
  const level = levelData.level;
  const currentXP = levelData.currentXP;
  const nextXP = levelData.xpToNextLevel;
  const achievementsUnlocked = profile?.achievements?.length || 0;
  const achievementsTotal = Object.values(ACHIEVEMENTS).length;
  const xpProgress = nextXP > 0 ? (currentXP / nextXP) * 100 : 0;
  const rank = '1. miejsce';

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  return (
    <ThemedView
      style={[
        styles.container,
        {
          paddingTop: insets.top + 8,
          backgroundColor: colors.background,
        },
      ]}
    >
      {isGuest && (
        <View style={[styles.guestBanner, { backgroundColor: colors.guestBackground }]}>
          <Text style={[styles.guestText, { color: colors.guestText }]}>
            Korzystasz z aplikacji w trybie gościa. Zarejestruj się, aby zapisać swoje dane!
          </Text>
          <Pressable
            style={[styles.upgradeButton, { backgroundColor: colors.butBackground }]}
            onPress={handleCreateAccount}
          >
            <Text style={[styles.upgradeText, { color: colors.butText }]}>Utwórz Konto</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.content}>
        <Text style={[styles.welcome, { color: colors.text }]}>Witaj, {user?.name || 'User'}!</Text>
        <Text style={{ color: colors.text }}>Produktywność na wyciągnięcie ręki.</Text>

        <ThemedCard style={[styles.levelCard, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.levelTitle, { color: colors.title }]}>Poziom {level}</Text>
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { backgroundColor: colors.inputBackground, borderColor: colors.border, borderWidth: 1 }]}>
              <View
                style={[
                  styles.progressFill,
                  { backgroundColor: colors.iconColor, width: `${Math.min(xpProgress, 100)}%` },
                ]}
              />
            </View>
            <Text style={[styles.progressText, { color: colors.text }]}>{currentXP} / {nextXP} XP</Text>
          </View>
          <Text style={[styles.achievements, { color: colors.text }]}>Osiągnięcia: {achievementsUnlocked} / {achievementsTotal}</Text>
        </ThemedCard>

        <Text style={[styles.welcome, { color: colors.text, fontSize: 16 }]}>Podsumowanie Miesięczne - Załadunek</Text>
        <View style={styles.statsGrid}>
          <ThemedCard style={[styles.statCard, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.statTitle, { color: colors.text }]}>Średnia miesięczna</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{summary.averageRate.toFixed(2)} pal/h</Text>
          </ThemedCard>
          <ThemedCard style={[styles.statCard, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.statTitle, { color: colors.text }]}>Palety w miesiącu</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{summary.totalPallets}</Text>
          </ThemedCard>
          <ThemedCard style={[styles.statCard, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.statTitle, { color: colors.text }]}>Miejsce w rankingu</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{rank}</Text>
          </ThemedCard>
          <ThemedCard style={[styles.statCard, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.statTitle, { color: colors.text }]}>Czas ładowania</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{formatTime(summary.totalTime)}</Text>
          </ThemedCard>
        </View>
        {/* <Text style={[styles.welcome, { color: colors.text, fontSize: 16 }]}>Podsumowanie Miesięczne - Kompletacja</Text>
        <View style={styles.statsGrid}>
          <ThemedCard style={[styles.statCard, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.statTitle, { color: colors.text }]}>Średnia miesięczna</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>194.35 opak/h</Text>
          </ThemedCard>
          <ThemedCard style={[styles.statCard, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.statTitle, { color: colors.text }]}>Opak. w miesiącu</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>1652</Text>
          </ThemedCard>
          <ThemedCard style={[styles.statCard, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.statTitle, { color: colors.text }]}>Miejsce w rankingu</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>12. miejsce</Text>
          </ThemedCard>
          <ThemedCard style={[styles.statCard, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.statTitle, { color: colors.text }]}>Czas kompletacji</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>8h 30m</Text>
          </ThemedCard>
        </View> */}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 32,
  },
  content: {
    flex: 1,
    marginTop: 20,
  },
  welcome: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  levelCard: {
    marginVertical: 20,
    borderRadius: 12,
  },
  levelTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  progressContainer: {
    marginBottom: 10,
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
    fontSize: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    marginBottom: 10,
    borderRadius: 8,
  },
  statTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
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

import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  collection,
  collectionGroup,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import ThemedView from '@/components/ThemedView';
import { useColors } from '@/_hooks/useColors';
import { useAuth } from '@/_context/AuthContext';
import { db } from '@/firebase/config';
import { useUserProfile } from '@/_context/UserProfileContext';

const PODIUM_STYLES = {
  1: {
    icon: 'trophy',
    outline: '#D4A017',
    fill: 'rgba(212, 160, 23, 0.12)',
    iconColor: '#D4A017',
  },
  2: {
    icon: 'trophy',
    outline: '#9CA3AF',
    fill: 'rgba(156, 163, 175, 0.12)',
    iconColor: '#9CA3AF',
  },
  3: {
    icon: 'trophy',
    outline: '#B87333',
    fill: 'rgba(184, 115, 51, 0.12)',
    iconColor: '#B87333',
  },
};

const getMonthBounds = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    label: now.toLocaleDateString('pl-PL', {
      month: 'long',
      year: 'numeric',
    }),
  };
};

const formatRate = (value) => `${value.toFixed(2)} pal/h`;

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

export default function Leaderboards() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const monthInfo = useMemo(() => getMonthBounds(), []);


  const loadLeaderboard = useCallback(async () => {
    try {
      setLoading(true);

      const usersPromise = getDocs(collection(db, 'users'));
      const sessionsPromise = getDocs(
        query(
          collectionGroup(db, 'scoreHistory'),
          where('date', '>=', monthInfo.startIso),
          where('date', '<', monthInfo.endIso)
        )
      );

      const [usersSnapshot, sessionsSnapshot] = await Promise.all([usersPromise, sessionsPromise]);

      const usersMap = new Map(
        usersSnapshot.docs.map((docSnapshot) => [docSnapshot.id, docSnapshot.data()])
      );

      const grouped = new Map();

      sessionsSnapshot.forEach((sessionDoc) => {
        const ownerRef = sessionDoc.ref.parent.parent;
        const userId = ownerRef?.id;

        if (!userId || userId.startsWith('guest_')) {
          return;
        }

        const session = sessionDoc.data();
        const current = grouped.get(userId) || {
          userId,
          totalPallets: 0,
          totalTime: 0,
          sessionsCount: 0,
        };

        current.totalPallets += parseFloat(session.palletsLoaded) || 0;
        current.totalTime += parseFloat(session.loadingTime) || 0;
        current.sessionsCount += 1;

        grouped.set(userId, current);
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

      setLeaderboard(ranked);
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
      setLeaderboard([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [monthInfo.endIso, monthInfo.startIso, user]);

  useFocusEffect(
    useCallback(() => {
      loadLeaderboard();
    }, [loadLeaderboard])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadLeaderboard();
  }, [loadLeaderboard]);

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
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Tablice Wyników - Załadunek</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Srednia miesięczna palet na godzinę, {monthInfo.label}
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.iconColor} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Ładowanie rankingu...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.iconColor}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.summaryCard,
              {
                backgroundColor: colors.cardBackground,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Uczestnicy</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>{leaderboard.length}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Lider</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>
                {leaderboard[0] ? formatRate(leaderboard[0].averageRate) : 'Brak'}
              </Text>
            </View>
          </View>

          {leaderboard.length === 0 ? (
            <View
              style={[
                styles.emptyState,
                {
                  backgroundColor: colors.cardBackground,
                  borderColor: colors.border,
                },
              ]}
            >
              <Ionicons name="trophy-outline" size={54} color={colors.iconColor} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Brak rankingu w tym miesiącu</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Gdy użytkownicy zapiszą sesje w tym miesiącu, ranking pojawi się tutaj.
              </Text>
            </View>
          ) : (
            <View style={styles.list}>
              {leaderboard.map((entry) => {
                const podiumStyle = PODIUM_STYLES[entry.place];
                const isCurrentUser = entry.userId === user?.id;
                const borderColor = podiumStyle?.outline || (isCurrentUser ? colors.iconColor : colors.border);
                const backgroundColor = podiumStyle?.fill || colors.cardBackground;

                return (
                  <View
                    key={entry.userId}
                    style={[
                      styles.row,
                      {
                        backgroundColor,
                        borderColor,
                      },
                    ]}
                  >
                    <Text style={[styles.place, { color: colors.text }]}>#{entry.place}</Text>

                    <View style={styles.nameWrap}>
                      <Ionicons
                        name={podiumStyle?.icon || 'person-circle-outline'}
                        size={22}
                        color={podiumStyle?.iconColor || colors.iconColor}
                        style={styles.prefixIcon}
                      />
                      <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                        {getDisplayName(entry, user, profile)}
                      </Text>
                    </View>

                    <Text style={[styles.rate, { color: colors.text }]}>
                      {formatRate(entry.averageRate)}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  header: {
    marginTop: 12,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  scroll: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 14,
    fontSize: 16,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
  },
  summaryItem: {
    flex: 1,
  },
  summaryDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(127,127,127,0.25)',
    marginHorizontal: 18,
  },
  summaryLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 36,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 14,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  list: {
    gap: 12,
    paddingBottom: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 14,
  },
  place: {
    width: 42,
    fontSize: 16,
    fontWeight: '700',
  },
  nameWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    marginRight: 12,
  },
  prefixIcon: {
    marginRight: 10,
  },
  name: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  rate: {
    fontSize: 15,
    fontWeight: '700',
  },
});


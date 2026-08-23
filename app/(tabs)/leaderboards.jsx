import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
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
  doc,
  getDoc,
} from 'firebase/firestore';
import ThemedView from '../../components/ThemedView';
import { useColors } from '../../hooks/useColors';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase/config';
import { useUserProfile } from '../../context/UserProfileContext';
import { getLeaderboardCache, setLeaderboardCache } from '../../services/ScoreDataCache';

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

const PICKING_SUBSECTIONS = ['P01', 'P02', 'P03', 'P04', 'P05', 'P06', 'P15', 'P21', 'P28'];

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

const formatRate = (value, sectionType) => {
  const unit = sectionType === 'picking' ? 'pacz/h' : 'pal/h';
  return `${value.toFixed(2)} ${unit}`;
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

export default function Leaderboards() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sectionType, setSectionType] = useState('truck');
  const [pickingSubsection, setPickingSubsection] = useState('P01');

  const monthInfo = useMemo(() => getMonthBounds(), []);


  const loadLeaderboard = useCallback(async ({ force = false } = {}) => {
    try {
      setLoading(true);

      const now = new Date();
      const docId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const cacheKey = 'leaderboard:' + docId;
      let docData = !force ? await getLeaderboardCache(cacheKey) : null;
      if (!docData) {
        const docRef = doc(db, 'leaderboards', docId);
        const docSnap = await getDoc(docRef);
        docData = docSnap.exists() ? docSnap.data() || {} : {};
        await setLeaderboardCache(cacheKey, docData);
      }

      const truckArray = Array.isArray(docData.truck) ? docData.truck : [];
      const pickingObj = docData.picking || {};
      const pickingArray = Array.isArray(pickingObj[pickingSubsection]) ? pickingObj[pickingSubsection] : [];

      const rawList = sectionType === 'truck' ? truckArray : pickingArray;

      const ranked = rawList.map((entry, index) => ({
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
  }, [pickingSubsection, sectionType]);

  useFocusEffect(
    useCallback(() => {
      loadLeaderboard();
    }, [loadLeaderboard])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadLeaderboard({ force: true });
  }, [loadLeaderboard]);

  return (
    <ThemedView
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
        },
      ]}
    >
      <View style={[styles.header, { backgroundColor: colors.navBackground, paddingTop: insets.top + 8 }]}>
        <Text style={[styles.title, { color: colors.text }]}>Tablice wyników</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {sectionType === 'picking'
            ? `Średnia miesięczna paczek na godzinę, ${monthInfo.label}`
            : `Średnia miesięczna palet na godzinę, ${monthInfo.label}`}
        </Text>

        <View style={styles.sectionTabsRow}>
          <Pressable
            onPress={() => setSectionType('truck')}
            style={[
              styles.sectionTab,
              {
                borderColor: sectionType === 'truck' ? colors.butBorder : colors.outButBorder,
                backgroundColor: sectionType === 'truck' ? colors.butBackground : colors.outButBackground,
              },
            ]}
          >
            <Text style={{ color: sectionType === 'truck' ? colors.butText : colors.outButText, fontWeight: '700' }}>
              Załadunek
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setSectionType('picking')}
            style={[
              styles.sectionTab,
              {
                borderColor: sectionType === 'picking' ? colors.butBorder : colors.outButBorder,
                backgroundColor: sectionType === 'picking' ? colors.butBackground : colors.outButBackground,
              },
            ]}
          >
            <Text style={{ color: sectionType === 'picking' ? colors.butText : colors.outButText, fontWeight: '700' }}>
              Kompletacja
            </Text>
          </Pressable>
        </View>

        {sectionType === 'picking' && (
          <View style={styles.subsectionTabsWrap}>
            {PICKING_SUBSECTIONS.map((item) => {
              const isActive = pickingSubsection === item;

              return (
                <Pressable
                  key={item}
                  onPress={() => setPickingSubsection(item)}
                  style={[
                    styles.subsectionTab,
                    {
                      borderColor: isActive ? colors.butBorder : colors.border,
                      backgroundColor: isActive ? colors.butBackground : colors.cardBackground,
                    },
                  ]}
                >
                  <Text style={{ color: isActive ? colors.butText : colors.text, fontWeight: '700' }}>{item}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
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
                {leaderboard[0] ? formatRate(leaderboard[0].averageRate, sectionType) : 'Brak'}
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
                {sectionType === 'picking'
                  ? `Gdy użytkownicy zapiszą sesje dla podsekcji ${pickingSubsection}, ranking pojawi się tutaj.`
                  : 'Gdy użytkownicy zapiszą sesje w tym miesiącu, ranking pojawi się tutaj.'}
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
                      {formatRate(entry.averageRate, sectionType)}
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
  },
  header: {
    marginBottom: 20,
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  sectionTabsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  sectionTab: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  subsectionTabsWrap: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  subsectionTab: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
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
    marginHorizontal: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
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
    marginHorizontal: 24,
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
    marginHorizontal: 24,
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


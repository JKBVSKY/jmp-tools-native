import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { useColors } from '@/_hooks/useColors';
import ThemedView from '@/components/ThemedView';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LineChart } from 'react-native-chart-kit';
import { Alert } from 'react-native';
import { useAuth } from '@/_context/AuthContext';
import { db } from '@/firebase/config';
import {
  collection,
  query,
  orderBy,
  getDocs,
  deleteDoc,
  doc,
} from 'firebase/firestore';

const { width } = Dimensions.get('window');

// Format date as "15 nov" from startTime (ignores endTime)
const formatDateLabel = (startTimeIso) => {
  const date = new Date(startTimeIso);
  const day = date.getDate();
  const monthNames = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrze', 'paź', 'lis', 'gru'];
  const month = monthNames[date.getMonth()];
  return `${day} ${month}`;
};

const getMonthKey = (dateString) => {
  const d = new Date(dateString);
  const month = d.getMonth();      // 0-11
  const year = d.getFullYear();
  return { month, year, key: `${year}-${month}` };
};

const formatMonthLabel = ({ month, year }) => {
  const monthNames = [
    'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
    'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
  ];
  return `${monthNames[month]} ${year}`;
};

export default function ScoreHistory() {
  const colors = useColors();
  const { user } = useAuth();
  const userId = user?.id;
  const [sessions, setSessions] = useState([]);
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'graph'
  const [refreshing, setRefreshing] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(null); // { month: 0-11, year: 2026 }
  const [loading, setLoading] = useState(true);
  const insets = useSafeAreaInsets();

  // Unique months from all sessions, sorted newest → oldest
  const months = React.useMemo(() => {
    const map = new Map(); // key -> { month, year }
    sessions.forEach((s) => {
      const { month, year, key } = getMonthKey(s.date);
      if (!map.has(key)) {
        map.set(key, { month, year, key });
      }
    });

    // Sort by year/month descending
    return Array.from(map.values()).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });
  }, [sessions]);

  // Ensure currentMonth is always one of available months
  useEffect(() => {
    if (!currentMonth && months.length > 0) {
      setCurrentMonth({ month: months[0].month, year: months[0].year });
    }
  }, [months, currentMonth]);

  // Filter sessions to selected month
  const sessionsForMonth = React.useMemo(() => {
    if (!currentMonth) return [];
    return sessions.filter((s) => {
      const d = new Date(s.date);
      return (
        d.getMonth() === currentMonth.month &&
        d.getFullYear() === currentMonth.year
      );
    });
  }, [sessions, currentMonth]);

  // Calculate summary stats
  const summary = calculateSummary(sessionsForMonth);

  // Load saved sessions from Firestore
  const loadSessions = useCallback(async () => {
    setLoading(true);
    // No user yet → no sessions
    if (!userId) {
      setSessions([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const sessionsRef = collection(db, 'users', userId, 'scoreHistory');
      const q = query(sessionsRef, orderBy('date', 'desc'));
      const snapshot = await getDocs(q);

      const fetchedSessions = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id, // Firestore document id
          ...data,
        };
      });

      setSessions(fetchedSessions);

      // Keep your currentMonth logic
      if (fetchedSessions.length > 0 && !currentMonth) {
        const { month, year } = getMonthKey(fetchedSessions[0].date);
        setCurrentMonth({ month, year });
      }
    } catch (error) {
      console.error('Failed to load sessions from Firestore:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, currentMonth]);

  // Load sessions when screen is focused (every time you navigate to it)
  useFocusEffect(
    useCallback(() => {
      loadSessions();
    }, [loadSessions])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadSessions();
  }, [loadSessions]);

  const formatDate = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const pointsCount = sessionsForMonth.length;
  const chartWidth = Math.max(width, pointsCount * 60);
  // e.g. ~60px per point, tweak as you like
  // Prepare chart data for selected month

  const chartData = {
    labels: sessionsForMonth
      .slice()               // copy
      .reverse()             // keep oldest → newest or as you like
      .map((s) => formatDateLabel(s.date)),
    datasets: [
      {
        data: sessionsForMonth
          .slice()
          .reverse()
          .map((s) => parseFloat(s.palletsRate) || 0),
        color: (opacity = 1) => colors.iconColor,
        strokeWidth: 2,
      },
    ],
  };

  return (
    <ThemedView
      style={[
        styles.container,
        {
          paddingTop: insets.top + 8,     // add some spacing from status bar
          backgroundColor: colors.background,
        },
      ]}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.iconColor} />
            <Text style={[styles.loadingText, { color: colors.text }]}>Ładowanie danych...</Text>
          </View>
        ) : (
          <>
            {/* Header with toggle */}
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.text }]}>Statystyki</Text>

              <View style={styles.toggleContainer}>
                <Pressable
                  onPress={() => setViewMode('table')}
                  style={[
                    styles.toggleButton,
                    { backgroundColor: viewMode === 'table' ? colors.iconColor : colors.cardBackground, borderColor: colors.outButBorder }
                  ]}
                >
                  <MaterialCommunityIcons
                    name="table"
                    size={20}
                    color={viewMode === 'table' ? '#fff' : colors.text}
                  />
                </Pressable>

                <Pressable
                  onPress={() => setViewMode('graph')}
                  style={[
                    styles.toggleButton,
                    { backgroundColor: viewMode === 'graph' ? colors.iconColor : colors.cardBackground, borderColor: colors.outButBorder }
                  ]}
                >
                  <MaterialCommunityIcons
                    name="chart-line"
                    size={20}
                    color={viewMode === 'graph' ? '#fff' : colors.text}
                  />
                </Pressable>
              </View>
            </View>

            {/* Month selector */}
            <View style={[styles.monthSelector, { backgroundColor: colors.cardBackground }]}>
              <Pressable
                onPress={() => {
                  if (!currentMonth || months.length === 0) return;
                  const idx = months.findIndex(
                    (m) => m.month === currentMonth.month && m.year === currentMonth.year
                  );
                  if (idx === -1 || idx === months.length - 1) return; // already oldest
                  const next = months[idx + 1];
                  setCurrentMonth({ month: next.month, year: next.year });
                }}
                style={styles.monthButton}
                disabled={
                  !currentMonth ||
                  months.findIndex(
                    (m) => m.month === currentMonth.month && m.year === currentMonth.year
                  ) === months.length - 1
                }
              >
                <MaterialCommunityIcons
                  name="chevron-left"
                  size={24}
                  color={colors.text}
                />
              </Pressable>

              <Text style={[styles.monthLabel, { color: colors.text }]}>
                {currentMonth ? formatMonthLabel(currentMonth) : 'Brak danych'}
              </Text>

              <Pressable
                onPress={() => {
                  if (!currentMonth || months.length === 0) return;
                  const idx = months.findIndex(
                    (m) => m.month === currentMonth.month && m.year === currentMonth.year
                  );
                  if (idx <= 0) return; // already newest
                  const next = months[idx - 1];
                  setCurrentMonth({ month: next.month, year: next.year });
                }}
                style={styles.monthButton}
                disabled={
                  !currentMonth ||
                  months.findIndex(
                    (m) => m.month === currentMonth.month && m.year === currentMonth.year
                  ) === 0
                }
              >
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={24}
                  color={colors.text}
                />
              </Pressable>
            </View>

            {/* Summary Table - Always visible when sessions exist */}
            {sessionsForMonth.length > 0 && summary && (
              <View style={[styles.summaryContainer, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                <Text style={[styles.summaryTitle, { color: colors.text }]}>Ogólne</Text>

                <View style={styles.summaryGrid}>
                  {/* Total Time */}
                  <View style={[styles.summaryBox, { borderColor: colors.breakLine }]}>
                    <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Czas Ładowania</Text>
                    <Text style={[styles.summaryValue, { color: colors.text }]}>
                      {Math.floor(summary.totalTime / 3600)}h {Math.floor((summary.totalTime % 3600) / 60)}m
                    </Text>
                  </View>

                  {/* Total Pallets */}
                  <View style={[styles.summaryBox, { borderColor: colors.breakLine }]}>
                    <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Załadowane Palety</Text>
                    <Text style={[styles.summaryValue, { color: colors.text }]}>{summary.totalPallets}</Text>
                  </View>

                  {/* Total Trucks */}
                  <View style={[styles.summaryBox, { borderColor: colors.breakLine }]}>
                    <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Załadowane Naczepy</Text>
                    <Text style={[styles.summaryValue, { color: colors.text }]}>{summary.totalTrucks}</Text>
                  </View>

                  {/* Average Rate */}
                  <View style={[styles.summaryBox, { borderColor: colors.breakLine }]}>
                    <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Średnia Miesięczna</Text>
                    <Text style={[styles.summaryValue, { color: colors.text }]}>{summary.averageRate}</Text>
                  </View>
                </View>
              </View>
            )}

            {sessions.length === 0 ? (
              <ScrollView
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />}
                style={{ flex: 1 }}
              >
                <View style={styles.emptyContainer}>
                  <MaterialCommunityIcons name="history" size={64} color={colors.text} />
                  <Text style={[styles.emptyText, { color: colors.text }]}>
                    Brak zapisanych sesji
                  </Text>
                  <Text style={[styles.emptySubtext, { color: colors.text }]}>
                    Zakończ sesję, aby zobaczyć historię.
                  </Text>
                </View>
              </ScrollView>
            ) : (
              <View style={[styles.graphGrid, { flex: 1 }]}>
                {viewMode === 'graph' && sessions.length > 0 && (
                  <View style={styles.chartContainer}>
                    <Text style={[styles.chartTitle, { color: colors.text }]}>
                      Sesje w miesiącu {currentMonth ? formatMonthLabel(currentMonth) : ''}
                    </Text>

                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ paddingRight: 16 }}
                    >
                      <LineChart
                        data={chartData}
                        width={chartWidth}
                        height={220}
                        yAxisSuffix=" pal/h"
                        yLabelsOffset={8}
                        chartConfig={{
                          backgroundColor: colors.cardBackground,
                          backgroundGradientFrom: colors.cardBackground,
                          backgroundGradientTo: colors.cardBackground,
                          decimalPlaces: 1,
                          color: (opacity = 1) => colors.iconColor,
                          labelColor: (opacity = 1) => colors.text,
                          style: {
                            borderRadius: 16,
                          },
                          propsForDots: {
                            r: '6',
                            strokeWidth: '2',
                            stroke: colors.iconColor,
                            fill: colors.iconColor,
                          },
                        }}
                        bezier
                        style={styles.chart}
                      />
                    </ScrollView>
                  </View>
                )}

                {viewMode === 'table' && (
                  <ScrollView
                    style={[styles.tableContainer, { flex: 1 }]}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />}
                  >
                    {/* Table Header */}
                    <View style={[styles.tableHeader, { backgroundColor: colors.cardBackground, borderBottomColor: colors.border }]}>
                      <Text style={[styles.tableHeaderText, { color: colors.text, flex: 1.5 }]}>Data</Text>
                      <Text style={[styles.tableHeaderText, { color: colors.text, flex: 1 }]}>Czas</Text>
                      <Text style={[styles.tableHeaderText, { color: colors.text, flex: 0.8 }]}>Palety</Text>
                      <Text style={[styles.tableHeaderText, { color: colors.text, flex: 0.8 }]}>Naczepy</Text>
                      <Text style={[styles.tableHeaderText, { color: colors.text, flex: 0.8 }]}>Wynik/h</Text>
                      <Text style={[styles.tableHeaderText, { color: colors.text, flex: 0.6 }]}>Usuń</Text>
                    </View>

                    {/* Table Rows */}
                    {sessionsForMonth.map((session, index) => (
                      <View
                        key={session.id}
                        style={[
                          styles.tableRow,
                          {
                            backgroundColor: index % 2 === 0 ? colors.background : colors.cardBackground,
                            borderBottomColor: colors.border
                          }
                        ]}
                      >
                        <Text style={[styles.tableCell, { color: colors.text, flex: 1.5 }]} numberOfLines={2}>
                          {formatDate(session.date)}
                        </Text>
                        <Text style={[styles.tableCell, { color: colors.text, flex: 1 }]}>
                          {formatTime(session.loadingTime)}
                        </Text>
                        <Text style={[styles.tableCell, { color: colors.text, flex: 0.8 }]}>
                          {session.palletsLoaded}
                        </Text>
                        <Text style={[styles.tableCell, { color: colors.text, flex: 0.8 }]}>
                          {session.trucksCount}
                        </Text>
                        <Text style={[styles.tableCell, { color: colors.text, flex: 0.8, fontWeight: '600' }]}>
                          {session.palletsRate.toFixed(1)}
                        </Text>

                        {/* Delete button */}
                        <Pressable
                          onPress={() => {
                            Alert.alert(
                              'Usuń Sesję',
                              'Czy na pewno chcesz usunąć tę sesję?',
                              [
                                {
                                  text: 'Anuluj',
                                  style: 'cancel'
                                },
                                {
                                  text: 'Usuń',
                                  onPress: async () => {
                                    try {
                                      if (!userId) return;

                                      // Delete from Firestore
                                      await deleteDoc(doc(db, 'users', userId, 'scoreHistory', session.id));

                                      // Then update local state
                                      const updatedSessions = sessions.filter((s) => s.id !== session.id);
                                      setSessions(updatedSessions);
                                    } catch (error) {
                                      Alert.alert('Error', 'Failed to delete session');
                                    }
                                  },

                                  style: 'destructive'
                                }
                              ]
                            );
                          }}
                          style={[styles.tableCell, { flex: 0.6, justifyContent: 'center', alignItems: 'center' }]}
                        >
                          <MaterialCommunityIcons name="trash-can-outline" size={18} color="#f44336" />
                        </Pressable>
                      </View>
                    ))}
                  </ScrollView>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </ThemedView>
  );
}

// Outside the component, near the bottom (or top) of the file
export const calculateSummary = (sessionsArray) => {
  if (!sessionsArray || sessionsArray.length === 0) return null;

  const totalTime = sessionsArray.reduce((sum, s) => sum + s.loadingTime, 0);
  const totalPallets = sessionsArray.reduce((sum, s) => sum + s.palletsLoaded, 0);
  const totalTrucks = sessionsArray.reduce((sum, s) => sum + s.trucksCount, 0);
  const averageRate =
    totalTime > 0 ? (totalPallets / (totalTime / 3600)).toFixed(2) : '0.00';

  return { totalTime, totalPallets, totalTrucks, averageRate };
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 32,
    paddingBottom: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 20,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
  },
  toggleContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleButton: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  chartContainer: {
    marginBottom: 20,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  chart: {
    borderRadius: 16,
  },
  tableContainer: {
    flex: 1,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 2,
    borderRadius: 8,
    marginBottom: 4,
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
  },
  tableCell: {
    fontSize: 12,
    textAlign: 'center',
  },
  summaryContainer: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  summaryBox: {
    width: '48%',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
    borderWidth: 1,
  },
  summaryLabel: {
    fontSize: 11,
    marginBottom: 6,
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  graphGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    marginBottom: 16,
  },
  monthButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  monthLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginHorizontal: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
});
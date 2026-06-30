import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, Pressable, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useColors } from '@/_hooks/useColors';
import ThemedView from '@/components/ThemedView';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LineChart } from 'react-native-chart-kit';
import ThemedCard from '@/components/ThemedCard';
import { Alert } from 'react-native';
import { useAuth } from '@/_context/AuthContext';
import { db } from '@/firebase/config';
import { Ionicons } from "@expo/vector-icons";
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
    <ThemedView style={styles.container}>
      <View
        style={{ flex: 1 }}
      // for scrollView
      // contentContainerStyle={styles.scrollContent}
      // showsVerticalScrollIndicator={false}
      // keyboardShouldPersistTaps="handled"
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.iconColor} />
            <Text style={[styles.loadingText, { color: colors.text }]}>Ładowanie danych...</Text>
          </View>
        ) : (
          <>
            {/* Header with toggle */}
            <View style={[styles.header, { backgroundColor: colors.navBackground, paddingTop: insets.top + 8 }]}>
              <Text style={[styles.title, { color: colors.text }]}>Statystyki</Text>
              <Text style={{ color: colors.textSecondary }}>Tutaj możesz zobaczyć swoje statystyki</Text>
            </View>

            {/* Month selector and toggle buttons container*/}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 24,
              paddingBottom: 16,
              backgroundColor: colors.navBackground,
              marginBottom: 16,
            }}>
              {/* Month selector */}
              <View style={styles.monthSelector}>
                <TouchableOpacity
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
                    size={32}
                    color={colors.text}
                  />
                </TouchableOpacity>

                <Text style={[styles.monthLabel, { color: colors.text }]}>
                  {currentMonth ? formatMonthLabel(currentMonth) : 'Brak danych'}
                </Text>

                <TouchableOpacity
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
                    size={32}
                    color={colors.text}
                  />
                </TouchableOpacity>
              </View>
              {/* View mode toggle */}
              <View style={styles.toggleContainer}>
                <TouchableOpacity
                  onPress={() => setViewMode('table')}
                  style={[
                    styles.toggleButton,
                    {
                      backgroundColor: viewMode === 'table' ? colors.butBackground : colors.outButBackground,
                      borderColor: viewMode === 'table' ? colors.butBorder : colors.outButBorder
                    }
                  ]}
                >
                  <MaterialCommunityIcons
                    name="table"
                    size={26}
                    color={viewMode === 'table' ? '#fff' : colors.text}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setViewMode('graph')}
                  style={[
                    styles.toggleButton,
                    {
                      backgroundColor: viewMode === 'graph' ? colors.butBackground : colors.outButBackground,
                      borderColor: viewMode === 'graph' ? colors.butBorder : colors.outButBorder
                    }
                  ]}
                >
                  <MaterialCommunityIcons
                    name="chart-line"
                    size={26}
                    color={viewMode === 'graph' ? '#fff' : colors.text}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Summary Table - Always visible when sessions exist */}
            {sessionsForMonth.length > 0 && summary && (
              <View style={[styles.summaryContainer, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                <Text style={[styles.summaryTitle, { color: colors.text }]}>Podsumowanie miesiąca</Text>
                <Text style={[styles.summarySubtitle, { color: colors.textSecondary }]}>
                  Twoja wydajność w tym miesiącu
                </Text>

                <View style={styles.summaryGrid}>
                  {/* Average Rate */}
                  <ThemedCard style={[styles.summaryBoxWide, { backgroundColor: colors.cardInCardBackground, borderColor: colors.border, }]}>
                    <Ionicons
                      name="flash-outline"
                      size={28}
                      style={[
                        styles.cardIcon,
                        { color: colors.grayIconColor, marginLeft: -4, marginBottom: 4 },
                      ]}
                    />
                    <Text style={[styles.summaryLabel, { color: colors.cardTitle }]}>Średnia Miesięczna</Text>
                    <Text style={[styles.summaryValue, { color: colors.cardValue }]}>{summary.averageRate} pal/h</Text>
                  </ThemedCard>
                  {/* Total Time */}
                  <ThemedCard style={[styles.summaryBox, { backgroundColor: colors.cardInCardBackground, borderColor: colors.border }]}>
                    <Ionicons
                      name="time-outline"
                      size={28}
                      style={[styles.cardIcon, { color: colors.grayIconColor, marginLeft: -4, marginBottom: 4 }]}
                    />
                    <Text style={[styles.summaryLabel, { color: colors.cardTitle}]}>Czas</Text>
                    <Text style={[styles.summaryValue, { color: colors.cardValue }]}>
                      {Math.floor(summary.totalTime / 3600)}h {Math.floor((summary.totalTime % 3600) / 60)}m
                    </Text>
                  </ThemedCard>

                  {/* Total Pallets */}
                  <ThemedCard style={[styles.summaryBox, { backgroundColor: colors.cardInCardBackground, borderColor: colors.border }]}>
                    <Ionicons
                      name="layers-outline"
                      size={28}
                      style={[
                        styles.cardIcon,
                        { color: colors.grayIconColor, marginLeft: -4, marginBottom: 4 },
                      ]}
                    />
                    <Text style={[styles.summaryLabel, { color: colors.cardTitle }]}>Palety</Text>
                    <Text style={[styles.summaryValue, { color: colors.cardValue }]}>{summary.totalPallets}</Text>
                  </ThemedCard>

                  {/* Total Trucks */}
                  <ThemedCard style={[styles.summaryBox, { backgroundColor: colors.cardInCardBackground, borderColor: colors.border }]}>
                    <MaterialCommunityIcons name="truck-check-outline" size={28} style={{ color: colors.grayIconColor, marginLeft: -4, marginBottom: 4 }} />
                    <Text style={[styles.summaryLabel, { color: colors.cardTitle }]}>Naczepy</Text>
                    <Text style={[styles.summaryValue, { color: colors.cardValue }]}>{summary.totalTrucks}</Text>
                  </ThemedCard>

                </View>
              </View>
            )}

            {/* Graph/Table */}
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

                {/* Graph components here */}
                {viewMode === 'graph' && sessions.length > 0 && (
                  <View style={[styles.chartContainer, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                    <Text style={[styles.chartTitle, { color: colors.text }]}>
                      Wykres wydajności
                    </Text>
                    <Text style={[styles.chartSubtitle, { color: colors.textSecondary, marginBottom: 12 }]}>
                      Wydajność palet na godzinę dla każdej sesji w tym miesiącu
                    </Text>

                    <View style={[styles.chartCard, { backgroundColor: colors.cardInCardBackground, borderColor: colors.border }]}>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={{ margin: 16 }}
                      >
                        <LineChart
                          data={chartData}
                          width={chartWidth}
                          height={160}
                          yAxisSuffix=" pal/h"
                          yLabelsOffset={8}
                          chartConfig={{
                            backgroundColor: colors.cardInCardBackground,
                            backgroundGradientFrom: colors.cardInCardBackground,
                            backgroundGradientTo: colors.cardInCardBackground,
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
                  </View>
                )}

                {/* Table components here */}
                {viewMode === 'table' && (
                  <View style={[styles.tableContainer, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                    <Text style={[styles.tableTitle, { color: colors.text }]}>
                      Szczegóły Sesji
                    </Text>
                    <Text style={[styles.tableSubtitle, { color: colors.textSecondary, marginBottom: 12 }]}>
                      Lista wszystkich sesji w tym miesiącu
                    </Text>

                    <View
                      style={[styles.tableCard, { flex: 1, borderColor: colors.border }]}
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
                      <ScrollView style={{
                        marginBottom: 16,
                        borderBottomRadius: 16,
                      }}>
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
                    </View>
                  </View>
                )}
              </View>
            )}
          </>
        )}
      </View>
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
  },
  header: {
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  toggleContainer: {
    flexDirection: 'row',
    gap: 16,
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
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 20,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  chartTitle: {
    marginHorizontal: 8,
    fontSize: 24,
    fontWeight: 'bold',
  },
  chartSubtitle: {
    marginHorizontal: 8,
    marginBottom: 12,
  },
  chartCard: {
    borderRadius: 16,
    padding: 0,
    borderWidth: 1,
  },
  tableContainer: {
    flex: 1,
    marginHorizontal: 24,
    marginBottom: 20,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  tableCard: {
    borderWidth: 1,
    borderRadius: 16,
  },
  tableTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  tableSubtitle: {
    marginBottom: 12,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
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
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 24,
    marginBottom: 20,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  summaryTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  summarySubtitle: {
    marginBottom: 12,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  summaryBox: {
    width: '31%',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  summaryBoxWide: {
    width: '100%',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  summaryLabel: {
    fontSize: 17,
    marginTop: 2,
    marginBottom: 2,
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 18,
    marginTop: 4,
    fontWeight: '800',
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
  },
  monthButton: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
  },
  monthLabel: {
    fontSize: 18,
    fontWeight: '500',
    marginHorizontal: 16,
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
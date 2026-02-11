import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, Pressable, RefreshControl } from 'react-native';
import { useColors } from '../../_hooks/useColors';
import ThemedView from '../../components/ThemedView';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LineChart } from 'react-native-chart-kit';
import { Alert } from 'react-native';

const { width } = Dimensions.get('window');

// Format date as "15 nov" from startTime (ignores endTime)
const formatDateLabel = (startTimeIso) => {
  const date = new Date(startTimeIso);
  const day = date.getDate();
  const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const month = monthNames[date.getMonth()];
  return `${day} ${month}`;
};

export default function ScoreHistory() {
  const colors = useColors();
  const [sessions, setSessions] = useState([]);
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'graph'
  const [refreshing, setRefreshing] = useState(false);

  // Calculate summary stats
  const calculateSummary = () => {
    if (sessions.length === 0) return null;

    const totalTime = sessions.reduce((sum, s) => sum + s.loadingTime, 0);
    const totalPallets = sessions.reduce((sum, s) => sum + s.palletsLoaded, 0);
    const totalTrucks = sessions.reduce((sum, s) => sum + s.trucksCount, 0);
    const averageRate = totalTime > 0 ? (totalPallets / (totalTime / 3600)).toFixed(2) : '0.00';

    return { totalTime, totalPallets, totalTrucks, averageRate };
  };

  const summary = calculateSummary();

  // Load saved sessions from AsyncStorage
  const loadSessions = useCallback(async () => {
    try {
      const savedSessions = await AsyncStorage.getItem('scoreHistory');
      // console.log('Loaded sessions:', savedSessions); // Debug log
      if (savedSessions) {
        const parsed = JSON.parse(savedSessions);
        // Sort by date (newest first)
        setSessions(parsed.sort((a, b) => new Date(b.date) - new Date(a.date)));
      } else {
        setSessions([]);
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setRefreshing(false);
    }
  }, []);

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

  // Prepare chart data
  const chartData = {
    labels: sessions.slice(0, 7).reverse().map((s) => formatDateLabel(s.date)),
    datasets: [
      {
        data: sessions.slice(0, 7).reverse().map(s => parseFloat(s.palletsRate) || 0),
        color: (opacity = 1) => colors.iconColor,
        strokeWidth: 2
      }
    ],
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
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

      {/* Summary Table - Always visible when sessions exist */}
      {sessions.length > 0 && summary && (
        <View style={[styles.summaryContainer, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          <Text style={[styles.summaryTitle, { color: colors.text }]}>Ogólne</Text>

          <View style={styles.summaryGrid}>
            {/* Total Time */}
            <View style={[styles.summaryBox, { borderColor: colors.breakLine }]}>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Całkowity Czas</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>
                {Math.floor(summary.totalTime / 3600)}h {Math.floor((summary.totalTime % 3600) / 60)}m
              </Text>
            </View>

            {/* Total Pallets */}
            <View style={[styles.summaryBox, { borderColor: colors.breakLine }]}>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Całkowita Ilość Palet</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>{summary.totalPallets}</Text>
            </View>

            {/* Total Trucks */}
            <View style={[styles.summaryBox, { borderColor: colors.breakLine }]}>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Wszystkie Naczepy</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>{summary.totalTrucks}</Text>
            </View>

            {/* Average Rate */}
            <View style={[styles.summaryBox, { borderColor: colors.breakLine }]}>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Średnia Ogólna</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>{summary.averageRate}</Text>
            </View>
          </View>
        </View>
      )}

      {sessions.length === 0 ? (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />}
          style={{ flex: 1 }}
          contentContainerStyle={{ flex: 1 }}
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
        <View style={styles.graphGrid}>
          {viewMode === 'graph' && sessions.length > 0 && (
            <View style={styles.chartContainer}>
              <Text style={[styles.chartTitle, { color: colors.text }]}>
                Ostatnie 7 Sesji - Średnia Ilość Palet
              </Text>
              <LineChart
                data={chartData}
                width={width - 40}
                height={220}
                chartConfig={{
                  backgroundColor: colors.cardBackground,
                  backgroundGradientFrom: colors.cardBackground,
                  backgroundGradientTo: colors.cardBackground,
                  decimalPlaces: 1,
                  color: (opacity = 1) => colors.iconColor,
                  labelColor: (opacity = 1) => colors.text,
                  style: {
                    borderRadius: 16
                  },
                  propsForDots: {
                    r: "6",
                    strokeWidth: "2",
                    stroke: colors.iconColor,
                    fill: colors.iconColor
                  }
                }}
                bezier
                style={styles.chart}
              />
            </View>
          )}

          {viewMode === 'table' && (
            <ScrollView
              style={styles.tableContainer}
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
              {sessions.map((session, index) => (
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
                                const updatedSessions = sessions.filter(s => s.id !== session.id);
                                await AsyncStorage.setItem('scoreHistory', JSON.stringify(updatedSessions));
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
    </ThemedView>
  );
}

export const calculateSummary = (sessions) => {
  if (sessions.length === 0) return null;
  const totalTime = sessions.reduce((sum, s) => sum + s.loadingTime, 0);
  const totalPallets = sessions.reduce((sum, s) => sum + s.palletsLoaded, 0);
  const totalTrucks = sessions.reduce((sum, s) => sum + s.trucksCount, 0);
  const averageRate = totalTime > 0 ? (totalPallets / (totalTime / 3600)).toFixed(2) : '0.00';
  return { totalTime, totalPallets, totalTrucks, averageRate };
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
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
});
// app/calculator/Results.jsx
import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors } from '../../_hooks/useColors';
import { useCalculator } from '../../_context/CalculatorContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

export default function Results({
  loadingTime,
  startTime,
  endTime,
  trucksHistory,
  changeMode,
  clearCalculator
}) {
  const colors = useColors();
  const calc = useCalculator();

  const palletsLoaded = trucksHistory.reduce((sum, t) => sum + Number(t.pallets || 0), 0);
  const trucksCount = trucksHistory.length;
  const palletsRate = loadingTime > 0 ? (palletsLoaded / (loadingTime / 3600)).toFixed(2) : "0.00";

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const handleSave = async () => {
    try {
      const sessionData = {
        id: Date.now(),
        date: new Date().toISOString(),
        loadingTime,
        startTime,
        endTime,
        palletsLoaded,
        trucksCount,
        palletsRate: parseFloat(palletsRate),
        trucks: trucksHistory,
      };

      // Get existing scores
      const existingScores = await AsyncStorage.getItem('scoreHistory');
      const scores = existingScores ? JSON.parse(existingScores) : [];

      // Add new score
      scores.push(sessionData);

      // Save back
      await AsyncStorage.setItem('scoreHistory', JSON.stringify(scores));

      Alert.alert('Success', 'Session saved to score history!');

      // Clear calculator state
      await calc.clearState();
      changeMode('init');
    } catch (error) {
      Alert.alert('Error', 'Failed to save session: ' + error.message);
    }
  };

  const handleDiscard = async () => {
    Alert.alert('Discard Session', 'Are you sure?', [
      { text: 'Cancel' },
      {
        text: 'Discard',
        onPress: async () => {
          await calc.clearState();
          changeMode('init');
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollContent}>
        <Text style={[styles.title, { color: colors.text }]}>Session Complete! ✓</Text>

        {/* Stats Cards Section */}
        <View style={styles.statsSection}>
          <View style={styles.statsGrid}>
            {/* Card 1: Elapsed Time */}
            <View style={[styles.statCard, { backgroundColor: colors.cardBackground }]}>
              <View style={styles.cardHeader}>
                <Ionicons name="time-outline" size={24} style={{ color: colors.iconColor }} />
                <Text style={[styles.cardLabel, { color: colors.text }]}>Total Time</Text>
              </View>
              <Text style={[styles.cardValue, { color: colors.text }]}>{formatTime(loadingTime)}</Text>
            </View>

            {/* Card 2: Pallets Loaded */}
            <View style={[styles.statCard, { backgroundColor: colors.cardBackground }]}>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="truck-delivery-outline" size={24} style={{ color: colors.iconColor }} />
                <Text style={[styles.cardLabel, { color: colors.text }]}>Pallets Loaded</Text>
              </View>
              <Text style={[styles.cardValue, { color: colors.text }]}>{palletsLoaded}</Text>
            </View>

            {/* Card 3: Rate (per hour) */}
            <View style={[styles.statCard, { backgroundColor: colors.cardBackground }]}>
              <View style={styles.cardHeader}>
                <Ionicons name="flash-outline" size={24} style={{ color: colors.iconColor }} />
                <Text style={[styles.cardLabel, { color: colors.text }]}>Rate/hour</Text>
              </View>
              <Text style={[styles.cardValue, { color: colors.text }]}>{palletsRate}</Text>
            </View>

            {/* Card 4: Trucks Loaded */}
            <View style={[styles.statCard, { backgroundColor: colors.cardBackground }]}>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="truck-check-outline" size={24} style={{ color: colors.iconColor }} />
                <Text style={[styles.cardLabel, { color: colors.text }]}>Trucks Loaded</Text>
              </View>
              <Text style={[styles.cardValue, { color: colors.text }]}>{trucksCount}</Text>
            </View>
          </View>
        </View>

        {/* Session Details */}
        <View style={[styles.detailsBox, { backgroundColor: colors.cardBackground, borderColor: colors.iconColor }]}>
          <Text style={[styles.detailsTitle, { color: colors.text }]}>Session Details</Text>

          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.text }]}>Started:</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>{formatDate(startTime)}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.text }]}>Ended:</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>{formatDate(endTime)}</Text>
          </View>
        </View>

        <View style={styles.trucksBox}>
          <Text style={[styles.trucksTitle, { color: colors.text }]}>Trucks Summary</Text>
          {trucksHistory.map((truck, idx) => (
            <View key={truck.id} style={[styles.truckRow, { borderBottomColor: colors.breakLine }]}>
              <Text style={[styles.truckNum, { color: colors.text }]}>#{truck.displayId}</Text>
              <Text style={[styles.truckInfo, { color: colors.text }]}>
                {truck.pallets} pallets • Shop {truck.shop} • Gate {truck.gate}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.buttonsContainer}>
        <Pressable
          style={[styles.button, styles.saveButton, { backgroundColor: colors.butBackground }]}
          onPress={handleSave}
        >
          <MaterialCommunityIcons name="content-save" size={20} color={colors.butText} />
          <Text style={[styles.buttonText, { color: colors.butText }]}>Save to History</Text>
        </Pressable>

        <Pressable
          style={[styles.button, styles.discardButton, { backgroundColor: colors.outButBackground, borderColor: colors.outButBorder }]}
          onPress={handleDiscard}
        >
          <MaterialCommunityIcons name="delete" size={20} color={colors.outButText} />
          <Text style={[styles.buttonText, { color: colors.outButText }]}>Discard</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  statsSection: {
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  statCard: {
    width: '48%',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  cardValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  detailsBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
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
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  trucksBox: {
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
    gap: 12,
    marginBottom: 40,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  discardButton: {
    borderWidth: 1,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

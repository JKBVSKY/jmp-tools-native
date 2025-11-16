import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import AdjustTimeModal from "./AdjustTimeModal";
import Clock from "./Clock";
import { useColors } from '../../_hooks/useColors';
import Spacer from "../../components/Spacer";


function getCurrentShift(date = new Date()) {
  const h = date.getHours();
  const m = date.getMinutes();

  // Morning: 06:00 - 12:00
  if ((h > 6 && h < 12) || (h === 6 && m >= 0) || (h === 12 && m === 0)) {
    return "Morning";
  }

  // Afternoon: 12:01 - 21:44
  if ((h > 12 && h < 21) || (h === 12 && m > 0) || (h === 21 && m < 45)) {
    return "Afternoon";
  }

  // Night: 21:45 - 05:59
  return "Night";
}

export default function Init({ changeMode, setStartTime, startTime }) {
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const shift = getCurrentShift();
  const colors = useColors();

  const handleStart = () => {
    changeMode("working");
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Stats Cards Section */}
      <View style={styles.statsSection}>
        <View style={styles.statsGrid}>
          {/* Card 1: Actual time */}
          <View style={[styles.statCard, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="time-outline" size={24} style={{ color: colors.iconColor }} />
              <Text style={[styles.cardLabel, { color: colors.text }]}>Actual time</Text>
            </View>
            <Text style={[styles.cardValue, styles.clock, { color: colors.text }]}>
              <Clock />
            </Text>
          </View>

          {/* Card 2: Choosen time */}
          <View style={[styles.statCard, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="timer-sand" size={24} style={{ color: colors.iconColor }} />
              <Text style={[styles.cardLabel, { color: colors.text }]}>Choosen time</Text>
            </View>
            <Text style={[styles.cardValue, { color: colors.text }]}>{new Date(startTime).toLocaleTimeString()}</Text>
          </View>

          {/* Card 3: Shift */}
          <View style={[styles.statCard, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="work-outline" size={24} style={{ color: colors.iconColor }} />
              <Text style={[styles.cardLabel, { color: colors.text }]}>Shift</Text>
            </View>
            <Text style={[styles.cardValue, { color: colors.text }]}>{shift}</Text>
          </View>

          {/* Card 4: Monthly score */}
          <View style={[styles.statCard, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="stats-chart-outline" size={24} style={{ color: colors.iconColor }} />
              <Text style={[styles.cardLabel, { color: colors.text }]}>Monthly score</Text>
            </View>
            <Text style={[styles.cardValue, { color: colors.text }]}>0</Text>
          </View>
        </View>
      </View>

      <View style={styles.middleContent}>
        <Text style={[styles.shiftText, { color: colors.text }]}>Welcome back, Kuba</Text>
        <Text style={[styles.infoText, { color: colors.text }]}>Please adjust your start time if needed.</Text>
        <Text style={[styles.infoText, { color: colors.text }]}>
          Press "Start Working" when you are ready to begin your shift.
        </Text>
      </View>

      < Spacer height={128} />
      
      {/* Buttons */}
      <View style={styles.buttonsContainer}>
        <TouchableOpacity
          style={[styles.adjustButton, { backgroundColor: colors.outButBackground, borderColor: colors.outButBorder }]}
          onPress={() => setShowAdjustModal(true)}
        >
          <Text style={[styles.adjustButtonText, { color: colors.outButText }]}>Adjust Start Time</Text>
          <Ionicons name="time-outline" size={20} style={{ color: colors.outButText }} />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.startButton, { backgroundColor: colors.butBackground }]} onPress={handleStart}>
          <Ionicons name="play" size={20} color="white" style={[styles.playIcon, { color: colors.butText }]} />
          <Text style={[styles.startButtonText, { color: colors.butText }]}>Start Working</Text>
        </TouchableOpacity>
      </View>

      <AdjustTimeModal
        visible={showAdjustModal}
        onClose={() => setShowAdjustModal(false)}
        onConfirm={(newStartTime) => {
          setStartTime(newStartTime);
          setShowAdjustModal(false);
        }}
        initialTime={startTime}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 32,
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
    color: '#333',
  },
  topDiv: {
    alignItems: 'center',
  },
  clock: {
    fontSize: 48,
  },
  middleContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shiftText: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 16,
  },
  infoText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  bottomDiv: {
    alignItems: 'center',
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  adjustButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    gap: 6,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  adjustButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  startButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    gap: 6,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
  playIcon: {
    marginRight: 4,
  },
});

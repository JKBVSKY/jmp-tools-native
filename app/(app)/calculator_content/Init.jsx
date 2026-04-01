import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import AdjustTimeModal from "./AdjustTimeModal";
import Clock from "./Clock";
import { useColors } from '@/_hooks/useColors';
import Spacer from "@/components/Spacer";
import { calculateSummary } from "@/app/(app)/(tabs)/scoreHistory";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/_context/AuthContext';
import { getAutoForcedFinishTime } from '@/_utils/timeUtils';

export default function Init({ changeMode, setStartTime, startTime, forcedFinishTime, setForcedFinishTime, calcUpdateState }) {
  const [showAdjustStartTimeModal, setShowAdjustStartTimeModal] = useState(false);
  const [showAdjustFinishTimeModal, setShowAdjustFinishTimeModal] = useState(false);
  const colors = useColors();
  const [averageRate, setAverageRate] = useState('0.00');
  const { user } = useAuth();

useEffect(() => {
  // Calculate average rate when component mounts
  const loadAverageRate = async () => {
    try {
      const savedSessions = await AsyncStorage.getItem('scoreHistory');
      if (savedSessions) {
        const sessions = JSON.parse(savedSessions);
        const summary = calculateSummary(sessions);
        if (summary) {
          setAverageRate(summary.averageRate);
        }
      }
    } catch (error) {
      console.error('Failed to load average rate:', error);
    }
  };
  loadAverageRate();
}, []);

  const handleStart = () => {
    calcUpdateState({  // ✅ Use the prop passed from Calculator
      sessionStatus: 'active',
    });
    changeMode("working");
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Stats Cards Section */}
      <View style={styles.statsSection}>
        <View style={[styles.statsGridModern, { backgroundColor: colors.cardBackground }]}> 
          <View style={styles.headerRow}>
            <Ionicons name="settings-outline" size={24} style={{ color: colors.grayIconColor }} />
            <Text style={[styles.headerTitle, { color: colors.text }]}>Ustawienia czasu</Text>
          </View>
          {/* Row 1: Two cards side by side */}
          <View style={styles.row}>
            {/* Card 1: Start time */}
            <TouchableOpacity style={[styles.statCardModern, { backgroundColor: colors.cardInCardBackground }]} onPress={() => setShowAdjustStartTimeModal(true)}>
              <MaterialCommunityIcons name="timer-sand" size={28} style={[styles.cardIcon, { color: colors.grayIconColor }]} />
              <Text style={[styles.cardTitle, { color: colors.cardTitle }]}>Czas rozpoczęcia</Text>
              <Text style={[styles.cardValueModern, { color: colors.cardValue }]}>{new Date(startTime).toLocaleTimeString()}</Text>
            </TouchableOpacity>
            {/* Card 2: Finish time */}
            <TouchableOpacity style={[styles.statCardModern, { backgroundColor: colors.cardInCardBackground }]} onPress={() => setShowAdjustFinishTimeModal(true)}>
              <MaterialCommunityIcons name="timer-off-outline" size={28} style={[styles.cardIcon, { color: colors.grayIconColor }]} />
              <Text style={[styles.cardTitle, { color: colors.cardTitle }]}>Czas zakończenia</Text>
              <Text style={[styles.cardValueModern, { color: colors.cardValue }]}>{forcedFinishTime ? new Date(forcedFinishTime).toLocaleTimeString() : 'Brak'}</Text>
            </TouchableOpacity>
          </View>
          {/* Row 2: One card full width */}
          <View style={styles.row}>
            <View style={[styles.statCardModern, styles.statCardWide, { backgroundColor: colors.cardInCardBackground }]}> 
              <Ionicons name="time-outline" size={28} style={[styles.cardIcon, { color: colors.grayIconColor }]} />
              <Text style={[styles.cardTitle, { color: colors.cardTitle }]}>Aktualny czas</Text>
              <Text style={[styles.cardValueModern, { color: colors.cardValue }]}><Clock /></Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.middleContent}>
        <View style={[styles.middleCard, { backgroundColor: colors.cardBackground }]}>
          <Ionicons name="information-circle-outline" size={28} style={[styles.cardIcon, { color: colors.grayIconColor }]} />
          <Text style={[styles.middleCardTitle, { color: colors.text }]}>Zanim rozpoczniesz</Text>
          <Text style={[styles.middleCardDescription, { color: colors.text }]}>Upewnij się, że czas rozpoczęcia i zakończenia jest poprawny!</Text>
          <TouchableOpacity
            style={[styles.adjustButton, { backgroundColor: colors.outButBackground, borderColor: colors.outButBorder }]}
            onPress={() => setShowAdjustStartTimeModal(true)}
          >
            <Ionicons name="time-outline" size={20} style={{ color: colors.outButText }} />
            <Text style={[styles.adjustButtonText, { color: colors.outButText }]}>Dostosuj Czas</Text>
          </TouchableOpacity>
        </View>
      </View>

      < Spacer height={128} />

      {/* Buttons */}
      <View style={styles.buttonsContainer}>
        <TouchableOpacity
          style={[styles.startButton, { backgroundColor: colors.butBackground, opacity: forcedFinishTime ? 1 : 0.5 }]}
          onPress={handleStart}
          disabled={!forcedFinishTime}
        >
          <Ionicons name="play" size={20} color="white" style={[styles.playIcon, { color: colors.butText }]} />
          <Text style={[styles.startButtonText, { color: colors.butText }]}>Rozpocznij Pracę</Text>
        </TouchableOpacity>
      </View>

      {/* Start Time Modal */}
      <AdjustTimeModal
        visible={showAdjustStartTimeModal}
        onClose={() => setShowAdjustStartTimeModal(false)}
        onConfirm={(newStartTime) => {
          setStartTime(newStartTime);
          setShowAdjustStartTimeModal(false);
        }}
        initialTime={startTime}
        type="start"
      />

      {/* Finish Time Modal */}
      <AdjustTimeModal
        visible={showAdjustFinishTimeModal}
        onClose={() => setShowAdjustFinishTimeModal(false)}
        onConfirm={(newForcedFinishTime) => {
          setForcedFinishTime(newForcedFinishTime);
          setShowAdjustFinishTimeModal(false);
        }}
        initialTime={forcedFinishTime || getAutoForcedFinishTime()}
        type="finish"
        startTime={startTime}  // NEW: Pass startTime for validation
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
  statsGridModern: {
    borderRadius: 16,
    padding: 12,
    gap: 12,
    backgroundColor: '#fff', // fallback, will be overridden
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2, // Added shadow properties to match other cards
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 2,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#222',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 0,
  },
  statCardModern: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#fff', // fallback, will be overridden
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    alignItems: 'flex-start',
    minHeight: 90,
    justifyContent: 'center',
  },
  statCardWide: {
    flex: 1,
    minWidth: 0,
    marginTop: 12,
  },
  cardIcon: {
    marginBottom: 4,
    color: '#e3452d', // fallback, will be overridden
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 2,
    marginTop: 2,
    textAlign: 'left',
  },
  cardValueModern: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'left',
  },
  topDiv: {
    alignItems: 'center',
  },
  middleContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  middleCard: {
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#fff', // fallback, will be overridden
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    alignItems: 'center',
    justifyContent: 'center', // Center content vertically and horizontally
    width: '100%',
    alignSelf: 'stretch', // Ensure it stretches to fit content
    flexGrow: 1, // Allow the card to grow with its content
  },
  middleCardTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 4,
    textAlign: 'center',
  },
  middleCardDescription: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  bottomDiv: {
    alignItems: 'center',
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: 18,
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  adjustButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center', // Ensure content is centered
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    gap: 6,
    height: 48, // Set a fixed height for a normal button appearance
    flexGrow: 0, // Prevent the button from growing excessively
  },
  adjustButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
  startButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    gap: 6,
    height: 48, // Set a fixed height for a normal button appearance
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  playIcon: {
    marginRight: 4,
  },
});

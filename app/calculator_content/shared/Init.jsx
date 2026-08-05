import { Ionicons } from "@expo/vector-icons";
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { calculateSummary } from "../../(tabs)/scoreHistory";
import Spacer from "../../../components/Spacer";
import { useAuth } from '../../../context/AuthContext';
import { useColors } from '../../../hooks/useColors';
import { getAutoForcedFinishTime } from '../../../utils/timeUtils';
import AdjustTimeModal from "./AdjustTimeModal";
import Clock from "./Clock";

const PICKING_SUBSECTIONS = ['P01', 'P02', 'P03', 'P04', 'P05', 'P06', 'P15', 'P21', 'P28'];

export default function Init({
  changeMode,
  setStartTime,
  startTime,
  forcedFinishTime,
  setForcedFinishTime,
  calcUpdateState,
  onStartSession,
  sessionType = 'truck-loading',
  initialPickingSubsection = '',
}) {
  const [showAdjustStartTimeModal, setShowAdjustStartTimeModal] = useState(false);
  const [showAdjustFinishTimeModal, setShowAdjustFinishTimeModal] = useState(false);
  const [selectedPickingSubsection, setSelectedPickingSubsection] = useState(initialPickingSubsection || '');
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [averageRate, setAverageRate] = useState('0.00');
  const { user } = useAuth();

  // Responsive design breakpoints
  const { width } = useWindowDimensions();

  const isSmallPhone = width <= 375;     // iPhone SE-like
  const isPhone = width < 430;
  const isTablet = width >= 768;
  const horizontalPadding = isSmallPhone ? 16 : 24;
  const cardGap = isSmallPhone ? 10 : 16;
  const titleSize = isSmallPhone ? 18 : 22;
  const valueSize = isSmallPhone ? 16 : 20;
  const bodySize = isSmallPhone ? 14 : 16;

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

  useEffect(() => {
    setSelectedPickingSubsection(initialPickingSubsection || '');
  }, [initialPickingSubsection, sessionType]);

  const isPickingSession = sessionType === 'picking';
  const isPickingStartAllowed = !isPickingSession || Boolean(selectedPickingSubsection);

  const handleStart = () => {
    if (isPickingSession && !selectedPickingSubsection) {
      return;
    }

    if (onStartSession) {
      onStartSession({
        initialPickingSubsection: isPickingSession ? selectedPickingSubsection : '',
      });
      return;
    }

    calcUpdateState({  // ✅ Use the prop passed from Calculator
      sessionStatus: 'active',
      subsection: isPickingSession ? selectedPickingSubsection : '',
    });
    changeMode("working");
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Stats Cards Section */}
        <View style={[styles.statsSection, { paddingHorizontal: horizontalPadding }]}>
          <View style={[styles.statsGridModern, { backgroundColor: colors.cardBackground }, isSmallPhone && styles.statsGridSmall]}>
            <View style={styles.headerRow}>
              <Ionicons name="settings-outline" size={24} style={{ color: colors.grayIconColor }} />
              <Text style={[styles.headerTitle, { color: colors.text }]}>Ustawienia czasu</Text>
            </View>
            {/* Row 1: Two cards side by side */}
            <View style={[styles.row, isSmallPhone && styles.statsRowSmall]}>
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

        <View style={[styles.middleContent, { paddingHorizontal: horizontalPadding }]}>
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

            {isPickingSession && (
              <View style={[styles.pickingSectionCard, { backgroundColor: colors.cardInCardBackground, borderColor: colors.border }]}> 
                <Text style={[styles.pickingSectionTitle, { color: colors.cardTitle }]}>Pierwsza podsekcja</Text>
                <Text style={[styles.pickingSectionHint, { color: colors.textSecondary }]}>Wybierz podsekcję, od której zaczynasz pracę.</Text>
                <View style={styles.pickingChipsWrap}>
                  {PICKING_SUBSECTIONS.map((item) => {
                    const isActive = selectedPickingSubsection === item;
                    return (
                      <TouchableOpacity
                        key={item}
                        onPress={() => setSelectedPickingSubsection(item)}
                        style={[
                          styles.pickingChip,
                          {
                            backgroundColor: isActive ? colors.butBackground : colors.inputBackground,
                            borderColor: isActive ? colors.butBackground : colors.border,
                          },
                        ]}
                      >
                        <Text style={[styles.pickingChipText, { color: isActive ? colors.butText : colors.text }]}>{item}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </View>
        </View>

        < Spacer height={128} />
      </ScrollView>

      {/* Buttons */}
      <View style={[styles.buttonsContainer, { backgroundColor: colors.navBackground, borderTopColor: colors.border, paddingBottom: insets.bottom }]}>
        <TouchableOpacity
          style={[styles.startButton, { backgroundColor: colors.butBackground, opacity: (forcedFinishTime && isPickingStartAllowed) ? 1 : 0.5 }]}
          onPress={handleStart}
          disabled={!forcedFinishTime || !isPickingStartAllowed}
        >
          <Ionicons name="play" size={24} color="white" style={[styles.playIcon, { color: colors.butText }]} />
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
    paddingTop: 24,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  statsSection: {
    marginBottom: 24,
  },
  statsGridModern: {
    borderRadius: 16,
    padding: 24,
    gap: 16,
    backgroundColor: '#fff', // fallback, will be overridden
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2, // Added shadow properties to match other cards
  },
  statsGridSmall: {
    flexDirection: 'column',
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
  },
  statsRowSmall: {
    flexDirection: 'column',
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
  pickingSectionCard: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
  },
  pickingSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  pickingSectionHint: {
    fontSize: 13,
    marginTop: 4,
    marginBottom: 8,
  },
  pickingChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pickingChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pickingChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  bottomDiv: {
    alignItems: 'center',
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    paddingTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
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
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  startButtonText: {
    fontSize: 15,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  playIcon: {
    marginRight: 4,
  },
});

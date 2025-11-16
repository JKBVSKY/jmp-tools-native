import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import NewTransportModal from "./NewTransportModal";
import EditTruckModal from "./EditTruckModal";
import PauseModal from "./PauseModal";
import PagerView from "react-native-pager-view";
import { useColors } from '../../_hooks/useColors';
import { getAutoStartTime } from "./utils";
import { useCalculator } from "../../_context/CalculatorContext";
import { Alert } from 'react-native';

const { width } = Dimensions.get('window');

export default function Working({
  changeMode,
  loadingTime,
  startTime,
  endTime,
  setLoadingTime,
  setStartTime,
  setEndTime,
  mode
}) {
  // Use Calculator Context for persistent data
  const calc = useCalculator();

  // Local state only for UI elements (modals, active tab)
  const [activeTab, setActiveTab] = useState(0); // 0 = Monitoring, 1 = History
  const [editingTruck, setEditingTruck] = useState(null);
  const [showNewTransportModal, setShowNewTransportModal] = useState(false);
  const [showPauseModal, setShowPauseModal] = useState(false);

  const colors = useColors();

  // Use trucks data from context
  const trucks = calc.trucks || [];
  const trucksHistory = calc.trucksHistory || [];
  const nextTruckId = calc.nextTruckId || 1;
  const isPaused = calc.isPaused || false;
  const pauseStart = calc.pauseStart || null;
  const totalPausedTime = calc.totalPausedTime || 0;

  const palletsLoaded = trucksHistory.reduce((sum, t) => sum + Number(t.pallets || 0), 0);

  // Add truck function - now updates context
  const addTruck = (truck) => {
    const newTruck = {
      ...truck,
      id: Date.now() + Math.random(),
      displayId: nextTruckId,
      time: truck.time || "—"
    };

    calc.updateState({
      trucks: [newTruck, ...trucks],
      nextTruckId: nextTruckId + 1
    });
  };

  const handleSaveEdit = (updatedTruck) => {
    calc.updateState({
      trucks: trucks.map(t => t.id === updatedTruck.id ? { ...t, ...updatedTruck } : t)
    });
  };

  const handleTruckDone = (truckId) => {
    const truckToRemove = trucks.find(t => t.id === truckId);
    if (truckToRemove) {
      calc.updateState({
        trucks: trucks.filter(t => t.id !== truckId),
        trucksHistory: [{ ...truckToRemove }, ...trucksHistory]
      });
    }
  };

  const handleRemoveHistoryTruck = (truckId) => {
    calc.updateState({
      trucksHistory: trucksHistory.filter(t => t.id !== truckId)
    });
  };

  const handleSaveEditHistory = (updatedTruck) => {
    calc.updateState({
      trucksHistory: trucksHistory.map(t => t.id === updatedTruck.id ? { ...t, ...updatedTruck } : t)
    });
  };

  const handlePauseConfirm = (pauseTimeStr) => {
    const now = new Date();
    const [h, m, s] = pauseTimeStr.split(":").map(Number);
    const chosenPause = new Date(now);
    chosenPause.setHours(h, m, s || 0, 0);
    const pauseStartTime = chosenPause > now ? now : chosenPause;
    const diffMs = now - pauseStartTime;

    const newTotalPaused = totalPausedTime + diffMs;
    const newLoadingTime = Math.floor((Date.now() - startTime - newTotalPaused) / 1000);

    setLoadingTime(newLoadingTime);

    calc.updateState({
      totalPausedTime: newTotalPaused,
      pauseStart: Date.now(),
      isPaused: true,
      mode: 'paused'
    });
  };

  const handleResume = () => {
    if (pauseStart) {
      const newTotalPaused = totalPausedTime + (Date.now() - pauseStart);

      calc.updateState({
        totalPausedTime: newTotalPaused,
        pauseStart: null,
        isPaused: false,
        mode: 'working'
      });
    }
  };

  // Update loadingTime every second
  useEffect(() => {
    if (!startTime || isPaused) return;

    const interval = setInterval(() => {
      setLoadingTime(Math.floor((Date.now() - startTime - totalPausedTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime, totalPausedTime, isPaused, setLoadingTime]);

  // Format seconds as HH:MM:SS
  const formatElapsed = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
  };

  // Calculate palletsRate as palletsLoaded per hour
  const palletsRate =
    loadingTime > 0 ? (palletsLoaded / (loadingTime / 3600)).toFixed(2) : "0.00";

  // Count of trucks loaded
  const trucksLoadedCount = trucksHistory.length;

  // Render truck item
  const renderTruckItem = (truck, isHistory = false) => (
    <View key={truck.id} style={[styles.truckItem, { borderBottomColor: colors.breakLine }]}>
      <Text style={{ marginRight: 8 }}>
        <MaterialCommunityIcons name="truck-outline" size={24} style={{ color: colors.iconColor }} />
      </Text>
      <Text style={[styles.truckId, { color: colors.iconColor }]}>
        #{truck.displayId}
      </Text>

      <View style={[styles.truckInfo, { marginRight: 12 }]}>
        {/* First Row: Shop and Trailer */}
        <View style={{ flexDirection: 'row' }}>
          {/* Left side: Shop */}
          <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', paddingRight: 16 }}>
            <Text style={[styles.truckInfoText, { color: colors.text }]}>Shop:</Text>
            <Text style={[styles.truckInfoText, { color: colors.text }]}>{truck.shop || '—'}</Text>
          </View>

          {/* Right side: Trailer */}
          <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={[styles.truckInfoText, { color: colors.text }]}>Trailer:</Text>
            <Text style={[styles.truckInfoText, { color: colors.text }]}>{truck.trailer || '—'}</Text>
          </View>
        </View>

        {/* Second Row: Gate and Pallets */}
        <View style={{ flexDirection: 'row' }}>
          {/* Left side: Gate */}
          <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', paddingRight: 16 }}>
            <Text style={[styles.truckInfoText, { color: colors.text }]}>Gate:</Text>
            <Text style={[styles.truckInfoText, { color: colors.text }]}>{truck.gate || '—'}</Text>
          </View>

          {/* Right side: Pallets */}
          <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={[styles.truckInfoText, { color: colors.text }]}>Pallets:</Text>
            <Text style={[styles.truckInfoText, { color: colors.text }]}>{truck.pallets || '—'}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.truckActions, { backgroundColor: colors.truckButtons, borderRadius: 8, borderWidth: 1, borderColor: colors.breakLine }]}>
        <TouchableOpacity
          onPress={() => setEditingTruck(truck)}
          style={styles.iconButton}
        >
          <Ionicons name="pencil-outline" size={20} style={{ color: colors.editBut }} />
        </TouchableOpacity>

        {!isHistory && (
          <TouchableOpacity
            onPress={() => handleTruckDone(truck.id)}
            style={[styles.iconButton, { borderLeftColor: colors.breakLine, borderLeftWidth: 1, paddingLeft: 12 }]}
          >
            <Ionicons name="checkmark-outline" size={20} color="#4ade80" />
          </TouchableOpacity>
        )}

        {isHistory && (
          <TouchableOpacity
            onPress={() => handleRemoveHistoryTruck(truck.id)}
            style={[styles.iconButton, { borderLeftColor: colors.breakLine, borderLeftWidth: 1, paddingLeft: 12 }]}
          >
            <Ionicons name="trash-outline" size={20} color="#ef4444" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Stats Cards Section */}
      <View style={styles.statsSection}>
        <View style={styles.statsGrid}>
          {/* Card 1: Elapsed Time */}
          <View style={[styles.statCard, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="time-outline" size={24} style={{ color: colors.iconColor }} />
              <Text style={[styles.cardLabel, { color: colors.text }]}>Elapsed Time</Text>
            </View>
            <Text style={[styles.cardValue, { color: colors.text }]}>
              {loadingTime ? formatElapsed(loadingTime) : "00:00:00"}
            </Text>
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
            <Text style={[styles.cardValue, { color: colors.text }]}>{trucksLoadedCount}</Text>
          </View>
        </View>
      </View>

      {/* Trucks section */}
      <View style={[styles.infoContainer, { backgroundColor: colors.cardBackground }]}>
        <View style={styles.tabHeader}>
          <Text style={[styles.infoTitle, { color: colors.text }]}>
            {activeTab === 0 ? "Current Trucks" : "Completed History"}
          </Text>
          <View style={styles.tabDots}>
            <TouchableOpacity
              style={[styles.tabDot, activeTab === 0 && { backgroundColor: colors.tabDotActive }]}
            />
            <TouchableOpacity
              style={[styles.tabDot, activeTab === 1 && { backgroundColor: colors.tabDotActive }]}
            />
          </View>
        </View>

        <PagerView
          style={{ flex: 1 }}
          initialPage={0}
          onPageSelected={e => setActiveTab(e.nativeEvent.position)}
          pageMargin={16}
        >
          <View key="1" style={{ flex: 1 }}>
            <ScrollView style={[styles.trucksList, { backgroundColor: colors.tListBackground }]} contentContainerStyle={{ flexGrow: 1 }}>
              {trucks.length === 0 ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={[styles.emptyText, { color: colors.text }]}>Please start a new transport.</Text>
                </View>
              ) : (
                trucks.map(truck => renderTruckItem(truck, false))
              )}
            </ScrollView>
          </View>

          <View key="2" style={{ flex: 1 }}>
            <ScrollView style={[styles.trucksList, { backgroundColor: colors.tListBackground }]} contentContainerStyle={{ flexGrow: 1 }}>
              {trucksHistory.length === 0 ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={[styles.emptyText, { color: colors.text }]}>No history yet.</Text>
                </View>
              ) : (
                [...trucksHistory]
                  .sort((a, b) => b.displayId - a.displayId)
                  .map(truck => renderTruckItem(truck, true))
              )}
            </ScrollView>
          </View>
        </PagerView>


      </View>

      {/* Buttons */}
      {isPaused ? (
        // Paused - Resume button ONLY
        <View style={[styles.resumeButtonContainer, { elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 }]}>
          <TouchableOpacity
            style={[styles.btnResume, { backgroundColor: colors.butBackground }]}
            onPress={handleResume}
          >
            <Ionicons name="play" size={20} color={colors.butText} />
            <Text style={[styles.btnResumeText, { color: colors.butText }]}>Resume</Text>
          </TouchableOpacity>
        </View>
      ) : (
        // Working - New, Pause, Finish buttons
        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={[styles.btnOutline, { backgroundColor: colors.outButBackground, borderColor: colors.outButBorder }]}
            onPress={() => setShowNewTransportModal(true)}
          >
            <Ionicons name="add-outline" size={20} color={colors.outButText} />
            <Text style={[styles.btnOutlineText, { color: colors.outButText }]}>New</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btnPrimary, { backgroundColor: colors.butBackground }]}
            onPress={() => setShowPauseModal(true)}
          >
            <Ionicons name="pause-outline" size={20} color={colors.butText} />
            <Text style={[styles.btnPrimaryText, { color: colors.butText }]}>Pause</Text>
          </TouchableOpacity>

          {/* Finish button
          <TouchableOpacity
            style={[styles.btnPrimary, { backgroundColor: colors.butBackground }]}
            onPress={() => {
              setLoadingTime(0);
              setStartTime(getAutoStartTime());
              setEndTime(Date.now());
              setShopNum(0);
              setGateNum(0);
              setTrailerNum(0);
              changeMode('init');
            }}
          >
            <Ionicons name="checkmark-done-outline" size={20} color={colors.butText} />
            <Text style={[styles.btnPrimaryText, { color: colors.butText }]}>Finish</Text>
          </TouchableOpacity> */}
          <TouchableOpacity
            onPress={() => {
              Alert.alert(
                'Finish Session',
                'Are you sure you want to finish this calculation session?',
                [
                  {
                    text: 'Cancel',
                    style: 'cancel'
                  },
                  {
                    text: 'Finish',
                    onPress: () => {
                      setEndTime(Date.now());
                      changeMode('results'); // Show results screen
                    },
                    style: 'destructive'
                  }
                ]
              );
            }}
            style={[styles.btnPrimary, { backgroundColor: colors.butBackground }]}
          >
            <MaterialCommunityIcons name="flag-checkered" size={20} color={colors.butText} />
            <Text style={[styles.btnPrimaryText, { color: colors.butText }]}>Finish</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Modals */}
      <NewTransportModal
        visible={showNewTransportModal}
        onClose={() => setShowNewTransportModal(false)}
        onAdd={addTruck}
      />

      <EditTruckModal
        visible={!!editingTruck}
        truck={editingTruck}
        onClose={() => setEditingTruck(null)}
        onSave={activeTab === 0 ? handleSaveEdit : handleSaveEditHistory}
      />

      <PauseModal
        visible={showPauseModal}
        onClose={() => setShowPauseModal(false)}
        onConfirm={handlePauseConfirm}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 32,
    justifyContent: 'space-between',
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
  infoContainer: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    marginBottom: 16,
  },
  tabHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  infoTitle: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  tabDots: {
    flexDirection: 'row',
    gap: 8,
  },
  tabDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ccc',
  },
  trucksList: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  truckItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
    minHeight: 50,
    borderBottomWidth: 1,
  },
  truckId: {
    fontWeight: '500',
    fontSize: 16,
    color: '#333',
  },
  truckInfo: {
    flex: 1,
    marginLeft: 12,
  },
  truckInfoText: {
    fontSize: 12,
    color: '#555',
  },
  truckActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    padding: 6,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
    paddingVertical: 40,
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  btnOutline: {
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
  btnOutlineText: {
    fontSize: 14,
    fontWeight: '500',
  },
  btnPrimary: {
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
  btnPrimaryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  resumeButtonContainer: {
    width: '100%',
    alignItems: 'stretch',
    borderRadius: 24,
    overflow: 'hidden',
  },
  btnResume: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 24,
    gap: 6,
  },
  btnResumeText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
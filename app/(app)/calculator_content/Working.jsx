import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  Animated,
  Modal,
  TextInput
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import NewTransportModal from "./NewTransportModal";
import EditTruckModal from "./EditTruckModal";
import PauseModal from "./PauseModal";
import AdjustTimeModal from "./AdjustTimeModal";
import { TabView } from 'react-native-tab-view';
import { useColors } from '@/_hooks/useColors';
import { getAutoStartTime } from "./utils";
import { useCalculator } from "@/_context/CalculatorContext";
import { useUserProfile } from "@/_context/UserProfileContext";
import { calculateXPFromScore, calculateLevelFromXP } from "@/constants/LevelSystem";
import { Alert } from 'react-native';
import { PendingXPService } from '@/services/PendingXPService';
import { useBackgroundXP } from '@/_hooks/useBackgroundXP';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase/config';
import NetInfo from '@react-native-community/netinfo';
import { useAppState } from '@/_hooks/useAppState';
import AsyncStorage from '@react-native-async-storage/async-storage'; // To save state
import { XPEarnedNotification } from '@/components/XPEarnedNotification'; // Adjust path if needed

const { width } = Dimensions.get('window');

export default function Working({
  changeMode,
  loadingTime,
  startTime,
  endTime,
  setLoadingTime,
  setStartTime,
  setEndTime,
  mode,
  forcedFinishTime,
  setForcedFinishTime
}) {
  // ============================================================================
  // SECTION 1: ALL HOOKS - CALLED FIRST, NO CONDITIONS
  // ============================================================================

  // Use Calculator Context for persistent data
  const calc = useCalculator();

  // Use User Profile for XP rewards
  const { profile, awardXP } = useUserProfile();

  // Local state only for UI elements (modals, active tab)
  const [activeTab, setActiveTab] = useState(0); // 0 = Monitoring, 1 = History
  const [editingTruck, setEditingTruck] = useState(null);
  const [showNewTransportModal, setShowNewTransportModal] = useState(false);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [expandedTruckId, setExpandedTruckId] = useState(null);
  const [showAdjustFinishTimeModal, setShowAdjustFinishTimeModal] = useState(false);
  const [showPalletsModal, setShowPalletsModal] = useState(false);
  const [palletsInput, setPalletsInput] = useState("");
  const [pendingTruckId, setPendingTruckId] = useState(null);

  // ✅ XP REWARD STATE
  const [currentXPPerMin, setCurrentXPPerMin] = useState(0);
  const [sessionXPEarned, setSessionXPEarned] = useState(0);
  const [showXPFloatingText, setShowXPFloatingText] = useState(false);
  const [floatingXPAmount, setFloatingXPAmount] = useState(0);
  const [leveledUpMessage, setLeveledUpMessage] = useState(null);
  const [lastLevelBeforeSession] = useState(profile?.level || 1);
  const [notificationState, setNotificationState] = useState({ visible: false, xp: 0 });

  // useRef _hooks
  const lastXPRewardTimeRef = useRef(Date.now());
  const floatingAnim = React.useRef(new Animated.Value(0)).current;
  const colors = useColors();
  const xpSaveInProgressRef = useRef(false);
  const palletsRateRef = useRef(palletsRate);
  const checkAndEnforceForcedFinishRef = useRef();
  const palletsInputRef = useRef(null);

  // ✅ USE BACKGROUND XP HOOK
  const { syncPendingXP } = useBackgroundXP(awardXP, true);

  // ✅ Define what should happen when the app goes to the background
  const handleAppGoesToBackground = useCallback(() => {
    console.log('App is going to the background.');
    // Only save state if in a working session
    if (calc.mode === 'working' && !isPaused) {
      const stateToSave = {
        lastXPTime: lastXPRewardTimeRef.current,
        lastPalletsRate: palletsRateRef.current
      };
      AsyncStorage.setItem('lastActiveSessionState', JSON.stringify(stateToSave));
      console.log('Active session state saved.');
    }
  }, [calc.mode, isPaused]); // Dependencies ensure it always has fresh data

  // Function to calculate and award offline progress
  const handleAppComesToForeground = useCallback(async () => {
    console.log("📱 App came to foreground - checking forced finish...");

    // ✅ FIRST: Check if forced finish has occurred
    const wasForcedFinished = await checkAndEnforceForcedFinish();

    if (wasForcedFinished) {
      // ⚠️ IMPORTANT: DO NOT award offline XP when forced finishing!
      console.log("✅ Session was auto-finished. Results will be shown.");

      // Transition to results screen
      setTimeout(() => {
        setEndTime(Date.now());
        changeMode('results'); // Show results directly
      }, 500);

      return;
    }

    if (calc.mode !== 'working' || isPaused) {
      console.log("Not in a working session, skipping offline XP check.");
      return;
    }

    const now = Date.now();
    const forcedFinishTimestamp = calc.timeOfForcedFinish;

    // Safety check: Don't award XP if we're past deadline
    if (forcedFinishTimestamp && now > forcedFinishTimestamp) {
      console.warn("⚠️ We're past the forced finish deadline - skipping offline XP");
      return;
    }

    try {
      const lastSessionStateStr = await AsyncStorage.getItem('lastActiveSessionState');
      if (!lastSessionStateStr) return;

      const lastState = JSON.parse(lastSessionStateStr);
      const { lastXPTime, lastPalletsRate } = lastState;

      const now = Date.now();
      const awayTimeMs = now - lastXPTime;
      const awayTimeMinutes = awayTimeMs / 60000;

      if (awayTimeMinutes < 1) { // Don't award for brief periods away
        console.log("Away for less than a minute, skipping offline award.");
        return;
      }

      const xpPerMin = calculateXPPerMin(lastPalletsRate);

      // ✅ NEW SAFETY: Cap offline XP by deadline
      let offlineXPEarned = Math.floor(awayTimeMinutes * xpPerMin);

      // If there's a forced finish time, only award XP for time BEFORE it
      if (forcedFinishTimestamp && lastXPTime < forcedFinishTimestamp) {
        const allowedMinutes = Math.max(0, (forcedFinishTimestamp - lastXPTime) / 60000);
        offlineXPEarned = Math.floor(allowedMinutes * xpPerMin);

        console.log(`⏰ Capping offline XP by deadline: ${offlineXPEarned} XP`);
      }

      if (xpPerMin > 0) {
        const offlineXPEarned = Math.floor(awayTimeMinutes * xpPerMin);

        if (offlineXPEarned > 0) {
          console.log(`User was away for ${awayTimeMinutes.toFixed(1)} minutes. Awarding ${offlineXPEarned} offline XP.`);

          // Award the XP
          const result = await tryAwardXP(offlineXPEarned);
          setSessionXPEarned(prev => prev + offlineXPEarned);

          // ✅ RESET notification state BEFORE showing new one
          setNotificationState({ visible: false, xp: 0 });

          // ✅ Small delay to let React process the state change
          setTimeout(() => {
            setNotificationState({ visible: true, xp: offlineXPEarned });
          }, 100);

          if (result && result.leveledUp) {
            setLeveledUpMessage(`Welcome back! You leveled up to Level ${result.newLevel} while away!`);
            setTimeout(() => setLeveledUpMessage(null), 5000); // Longer duration for this special message
          }
        }
      }

      // IMPORTANT: Update the last reward time to NOW to prevent double-dipping
      lastXPRewardTimeRef.current = now;

    } catch (error) {
      console.error("Error calculating offline XP:", error);
    } finally {
      await AsyncStorage.removeItem('lastActiveSessionState'); // Clean up
    }
  }, [calc.mode, calc.timeOfForcedFinish, isPaused, checkAndEnforceForcedFinish, tryAwardXP, changeMode,]);

  // ✅ Call the new useAppState hook
  useAppState({
    onForeground: handleAppComesToForeground,
    onBackground: handleAppGoesToBackground,
  });

  // ✅ Initial check on component mount (this is still a good practice)
  useEffect(() => {
    handleAppComesToForeground();
  }, []); // Empty array ensures it only runs once on mount
  // ============================================================================
  // SECTION 2: COMPUTED VALUES & CONTEXT DATA (NOT HOOKS)
  // ============================================================================

  // Use trucks data from context
  const trucks = calc.trucks || [];
  const trucksHistory = calc.trucksHistory || [];
  const nextTruckId = calc.nextTruckId || 1;
  const isPaused = calc.isPaused || false;
  const pauseStart = calc.pauseStart || null;
  const totalPausedTime = calc.totalPausedTime || 0;
  const palletsLoaded = trucksHistory.reduce((sum, t) => sum + Number(t.pallets || 0), 0);
  const palletsRate =
    loadingTime > 0 ? (palletsLoaded / (loadingTime / 3600)).toFixed(2) : "0.00";
  const trucksLoadedCount = trucksHistory.length;
  const levelData = profile ? calculateLevelFromXP(profile.totalXP) : null;
  const xpForNextLevel = profile ? profile.level * 1000 : 1000;
  const levelProgress = levelData ? (levelData.currentXP / xpForNextLevel) * 100 : 0;

  // ============================================================================
  // SECTION 3: ALL useEffect HOOKS - AFTER STATE/REF INITIALIZATION
  // ============================================================================


  // ✅ Calculate XP per minute based on current pallet rate
  useEffect(() => {
    palletsRateRef.current = palletsRate;
    setCurrentXPPerMin(calculateXPPerMin(palletsRateRef.current));
  }, [palletsRate]);

  // ✅ XP CALCULATION - Try Firestore first, cache on failure
  useEffect(() => {
    if (!startTime || isPaused || !profile) return;

    const rewardXPIfNeeded = async () => {
      const now = Date.now();
      const timeSinceLastReward = now - lastXPRewardTimeRef.current;

      // ✅ Calculate XP per min at this moment!
      const xpPerMin = calculateXPPerMin(palletsRateRef.current);

      // Before awarding XP
      if (calc.sessionStatus === 'finalized') {
        console.log("Session already finalized, no XP accrual");
        return 0;  // or reset startTime here
      }

      // Award XP every 60 seconds for testing
      if (timeSinceLastReward >= 60000 && xpPerMin > 0) {
        if (xpSaveInProgressRef.current) {
          console.warn('⚠️ XP save already in progress, skipping...');
          return;
        }

        xpSaveInProgressRef.current = true;
        lastXPRewardTimeRef.current = now;

        try {
          const result = await tryAwardXP(xpPerMin);
          setSessionXPEarned(prev => prev + xpPerMin);

          // Show floating XP
          setFloatingXPAmount(xpPerMin);
          setShowXPFloatingText(true);

          // Animate floating text
          floatingAnim.setValue(0);
          Animated.timing(floatingAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }).start(() => {
            // This is a more reliable way to hide the text after the animation
            setShowXPFloatingText(false);
          });

          // Check if level up
          if (result && result.leveledUp) {
            setLeveledUpMessage(`Leveled up to Level ${result.newLevel}!`); // Simplified message
            setTimeout(() => setLeveledUpMessage(null), 3000);
          }
        } catch (error) {
          console.error('❌ Error in XP loop:', error);
          // Fallback: cache it
          await PendingXPService.recordXPAction(xpPerMin, {
            rate: palletsRate,
            trucksLoaded: trucksLoadedCount,
            timestamp: now,
            reason: 'error',
          });
        } finally {
          xpSaveInProgressRef.current = false;
        }
      }
    };

    // Use a normal function for setInterval!
    const interval = setInterval(() => {
      rewardXPIfNeeded();
    }, 10000);

    return () => clearInterval(interval);
  }, [startTime, isPaused, profile, awardXP]); // ✅ Added awardXP

  // Update loadingTime every second
  useEffect(() => {
    if (!startTime || isPaused) return;

    const interval = setInterval(() => {
      setLoadingTime(Math.floor((Date.now() - startTime - totalPausedTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime, totalPausedTime, isPaused, setLoadingTime]);

  // Update elapsed loading time for each active truck every second
  useEffect(() => {
    if (isPaused || trucks.length === 0) return;

    const interval = setInterval(() => {
      const updatedTrucks = trucks.map(truck => {
        const elapsed = Math.floor((Date.now() - truck.startLoadingTime) / 1000);
        return {
          ...truck,
          elapsedLoadingTime: elapsed
        };
      });
      calc.updateState({
        trucks: updatedTrucks
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [trucks.length, isPaused, calc]);

  // ✅ SIMPLIFIED: Only save remaining unsynced XP on unmount
  useEffect(() => {
    return () => {
      // Component is unmounting
      if (startTime && profile && sessionXPEarned > 0) {
        saveSessionToFirestore();
      }
    };
  }, []); // Empty array - only runs on unmount

  // Place this with your other useEffects
  useEffect(() => {
    checkAndEnforceForcedFinishRef.current = checkAndEnforceForcedFinish;
  }, [checkAndEnforceForcedFinish]); // Dependency array ensures it updates when the function does

  // Focus the pallets input when the modal opens
  useEffect(() => {
  if (showPalletsModal) {
    const timer = setTimeout(() => {
      if (palletsInputRef.current) {
        palletsInputRef.current.focus();
      }
    }, 300); // tweak delay if needed

    return () => clearTimeout(timer);
  }
}, [showPalletsModal]);

  // ============================================================================
  // SECTION 4: HELPER FUNCTIONS & LOGIC
  // ============================================================================


  // Normalize comma/point decimal (e.g. "12,75" → "12.75")
  const normalizeDecimal = (value) => value.replace(",", ".");

  // Validate pallets: 0–50, step 0.25
  const parseAndValidatePallets = (rawValue) => {
    const trimmed = rawValue.trim();

    // 🚫 Empty input is not allowed
    if (!trimmed) {
      return { ok: false, message: "Podaj liczbę palet." };
    }

    const normalized = normalizeDecimal(trimmed);
    const num = Number(normalized);

    if (!Number.isFinite(num)) {
      return { ok: false, message: "Wpisz poprawną liczbę (np. 10.5)." };
    }

    // 🚫 0 is not allowed anymore
    if (num <= 0 || num > 50) {
      return {
        ok: false,
        message: "Liczba palet musi być większa od 0 i nie większa niż 50."
      };
    }

    // Only 0.00, 0.25, 0.50, 0.75 steps
    const scaled = num * 4;
    if (Math.round(scaled) !== scaled) {
      return {
        ok: false,
        message: "Dozwolone są tylko wartości z końcówką .00, .25, .50 lub .75."
      };
    }

    return { ok: true, value: num };
  };


  // ✅ Calculate XP per minute based on current pallet rate
  const calculateXPPerMin = (rate) => {
    return 10;
  };

  // ✅ Check connection BEFORE trying Firestore
  const tryAwardXP = async (xpAmount) => {
    try {
      // Check if online
      const state = await NetInfo.fetch();

      if (!state.isConnected) {
        console.warn('📡 No internet connection - caching XP');
        return null; // Trigger cache fallback
      }
      console.log('📡 Internet connection established - sending to firestore');
      // Online, try Firestore
      const result = await awardXP(xpAmount);
      return result;
    } catch (error) {
      console.error('❌ Error:', error);
      return null;
    }
  };

  const saveSessionToFirestore = async () => {
    try {
      // Check if there's any unsynced XP from errors
      const pending = await PendingXPService.getPendingActions();
      const unsyncedXP = pending
        .filter(a => !a.isSynced)
        .reduce((sum, a) => sum + a.xpAmount, 0);

      if (unsyncedXP > 0) {
        console.log(`💾 Saving ${unsyncedXP} XP from cache (session ending)...`);

        const userRef = doc(db, 'users', profile.userId);
        await updateDoc(userRef, {
          offlineXP: (profile.offlineXP || 0) + unsyncedXP,
          lastOfflineUpdate: Date.now(),
        });

        console.log('✅ Remaining session XP saved to offlineXP');
      }
    } catch (error) {
      console.error('❌ Error saving remaining XP:', error);
    }
  };

  // Format seconds as HH:MM:SS
  const formatElapsed = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
  };

  const formatTruckTime = (seconds) => {
    if (!seconds || seconds < 0) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Add truck function - now updates context
  const addTruck = (truck) => {
    const now = Date.now();
    const newTruck = {
      ...truck,
      id: now + Math.random(),
      displayId: nextTruckId,
      time: truck.time || "—",
      elapsedLoadingTime: 0, // ✅ NEW: Initialize timer
      startLoadingTime: now, // ✅ NEW: Track when truck was added
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

  const finalizeTruckDone = (truck, palletsValue) => {
    if (!truck) return;

    // Calculate final elapsed time
    const finalElapsedTime = truck.elapsedLoadingTime || 0;

    const updatedTruck = {
      ...truck,
      pallets: palletsValue,         // set pallets to chosen value
      palletsInProgress: false,      // mark as finished
      elapsedLoadingTime: finalElapsedTime,
      completedTime: Date.now()
    };

    calc.updateState({
      trucks: trucks.filter((t) => t.id !== truck.id),
      trucksHistory: [updatedTruck, ...trucksHistory],
      palletsInProgress: false       // if this flag is global in calc
    });
  };

  const handleTruckDone = (truckId) => {
    const truckToRemove = trucks.find((t) => t.id === truckId);
    if (!truckToRemove) return;

    // 🚫 If pallets are still in progress, ask for the final number first
    if (calc.palletsInProgress || truckToRemove.palletsInProgress) {
      setPendingTruckId(truckId);
      // Pre-fill with current pallets (if any)
      setPalletsInput(
        truckToRemove.pallets !== undefined && truckToRemove.pallets !== null
          ? String(truckToRemove.pallets)
          : ""
      );
      setShowPalletsModal(true);
      return;
    }

    // ✅ Old behavior when nothing is in progress
    finalizeTruckDone(truckToRemove, truckToRemove.pallets);
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

  const handleConfirmPallets = () => {
    const result = parseAndValidatePallets(palletsInput);

    if (!result.ok) {
      Alert.alert("Nieprawidłowa liczba palet", result.message);
      return;
    }

    const truckToRemove = trucks.find((t) => t.id === pendingTruckId);
    if (!truckToRemove) {
      setShowPalletsModal(false);
      setPendingTruckId(null);
      return;
    }

    finalizeTruckDone(truckToRemove, result.value);

    setShowPalletsModal(false);
    setPendingTruckId(null);
    setPalletsInput("");
  };
  // ============================================================================
  // LOGIC FUNCTIONS FOR AUTOMATIC CALCULATION FINISHER
  // ============================================================================
  /**
   * ✅ CHECK AND ENFORCE FORCED FINISH
   * Called when app comes to foreground
   * Handles 3 scenarios:
   * 1. Not time yet → continue normally
   * 2. Time has passed → force finish with capped time
   * 3. Currently working past deadline → immediate finish
   */

  const checkAndEnforceForcedFinish = useCallback(async () => {
    if (calc.mode !== 'working' || !forcedFinishTime) {
      console.log("Not in working mode or no forced finish time set");
      console.log("Mode:", calc.mode);
      console.log("Forced Finish Time:", forcedFinishTime);
      return false; // Not forced finish scenario
    }

    const now = Date.now();
    const forcedFinishTimestamp = forcedFinishTime;

    // ✅ STEP 1: Determine if we've passed the deadline
    if (now < forcedFinishTimestamp) {
      console.log("⏰ Not yet time for forced finish. Continuing...");
      return false; // Continue normal working
    }

    console.warn("🚨 FORCED FINISH TIME HAS PASSED - Finalizing session...");

    // ✅ STEP 2: Calculate time UP TO the deadline ONLY
    const elapsedUntilDeadline = forcedFinishTimestamp - startTime - totalPausedTime;
    const cappedLoadingTimeSeconds = Math.max(0, Math.floor(elapsedUntilDeadline / 1000));

    console.log(`⏱️ Capped loading time: ${formatElapsed(cappedLoadingTimeSeconds)}`);

    // ✅ STEP 3: Stop all active trucks (they don't count past deadline)
    const finalTrucks = trucks.map(truck => ({
      ...truck,
      // Calculate elapsed time for this truck UP TO deadline
      elapsedLoadingTime: Math.min(
        truck.elapsedLoadingTime || 0,
        Math.floor((forcedFinishTimestamp - truck.startLoadingTime) / 1000)
      )
    }));

    // ✅ STEP 4: Move active trucks to history (mark as auto-finished)
    const autoFinishedTrucks = finalTrucks.map(t => ({
      ...t,
      isAutoFinished: true, // Flag for UI
      completedTime: forcedFinishTimestamp
    }));

    const updatedTrucksHistory = [
      ...autoFinishedTrucks,
      ...trucksHistory
    ];

    // ✅ STEP 5: Update calculator state
    calc.updateState({
      trucks: [], // Clear active trucks
      trucksHistory: updatedTrucksHistory,
      isPaused: false,
      pauseStart: null,
      mode: 'forced-finished', // NEW: Lock state to prevent resume
      sessionStatus: 'finalized',
    });

    // ✅ STEP 6: Set end time and trigger results (NO XP awarded yet)
    setLoadingTime(cappedLoadingTimeSeconds);
    setEndTime(forcedFinishTimestamp);

    return true; // Forced finish was applied
  }, [calc.mode, calc.forcedFinishTime, startTime, totalPausedTime, trucks, trucksHistory]);

  // ============================================================================
  // SECTION 5: RENDER FUNCTIONS (AFTER ALL HOOKS & HELPER FUNCTIONS)
  // ============================================================================

  // Define routes for TabView
  const routes = [
    { key: 'monitoring', title: 'Aktualne transporty' },
    { key: 'history', title: 'Zakończone transporty' },
  ];

  const navigationState = {
    index: activeTab,
    routes,
  };

  const renderScene = ({ route }) => {
    switch (route.key) {
      case 'monitoring':
        return (
          <ScrollView style={[styles.trucksList, { backgroundColor: colors.tListBackground, borderColor: colors.border }]} contentContainerStyle={{ flexGrow: 1 }}>
            {trucks.length === 0 ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={[styles.emptyText, { color: colors.text }]}>Rozpocznij nowy transport.</Text>
              </View>
            ) : (
              trucks.map(truck => renderTruckItem(truck, false))
            )}
          </ScrollView>
        );
      case 'history':
        return (
          <ScrollView style={[styles.trucksList, { backgroundColor: colors.tListBackground, borderColor: colors.border }]} contentContainerStyle={{ flexGrow: 1 }}>
            {trucksHistory.length === 0 ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={[styles.emptyText, { color: colors.text }]}>Brak historii transportów.</Text>
              </View>
            ) : (
              [...trucksHistory]
                .sort((a, b) => b.displayId - a.displayId)
                .map(truck => renderTruckItem(truck, true))
            )}
          </ScrollView>
        );
      default:
        return null;
    }
  };
  // ✅ NEW: Render truck item with collapsible design
  const renderTruckItem = (truck, isHistory = false) => {
    const isExpanded = expandedTruckId === truck.id;
    const elapsedTime = truck.elapsedLoadingTime || 0;

    return (
      <View>
        <View key={truck.id} style={[styles.truckItem, { borderBottomColor: colors.breakLine }]}>
          {/* LEFT SECTION: Truck ID */}
          <View style={[styles.truckIdSection, {
            backgroundColor: colors.cardBackground,
            borderWidth: 2,
            borderColor: colors.border,
          }]}>
            <Text style={{ marginRight: 8 }}>
              <MaterialCommunityIcons name="truck-outline" size={24} style={{ color: colors.iconColor }} />
            </Text>
            <Text style={[styles.truckId, { color: colors.iconColor }]}>#{truck.displayId}</Text>
          </View>

          {/* MIDDLE SECTION: Collapsible Info */}
          <TouchableOpacity
            onPress={() => setExpandedTruckId(isExpanded ? null : truck.id)}
            style={styles.truckInfoSection}
          >
            {/* COLLAPSED VIEW - Always Visible */}
            <View style={styles.compactRow}>
              {/* Shop */}
              <View style={styles.compactField}>
                <Text style={[styles.fieldLabel, { color: colors.text }]}>Sklep:</Text>
                <Text style={[styles.fieldValue, { color: colors.text }]}>{truck.shop || '—'}</Text>
              </View>

              {/* Pallets */}
              <View style={styles.compactField}>
                <Text style={[styles.fieldLabel, { color: colors.text }]}>Palety:</Text>
                <Text
                  style={[
                    styles.fieldValue,
                    { color: truck.pallets ? colors.text : 'red' },
                  ]}
                >
                  {truck.pallets || 'WTRA'}
                </Text>
              </View>

              {/* Expand Icon */}
              <View style={styles.expandIcon}>
                <MaterialCommunityIcons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={colors.text}
                />
              </View>
            </View>


          </TouchableOpacity>

          {/* RIGHT SECTION: Action Buttons */}
          <View style={styles.truckActionsRight}>
            <TouchableOpacity
              onPress={() => setEditingTruck(truck)}
              style={styles.iconButton}
            >
              <MaterialCommunityIcons name="pencil" size={16} color={colors.text} />
            </TouchableOpacity>

            {!isHistory && (
              <TouchableOpacity
                onPress={() => handleTruckDone(truck.id)}
                style={[styles.iconButton, { borderLeftColor: colors.breakLine, borderLeftWidth: 1, paddingLeft: 12 }]}
              >
                <MaterialCommunityIcons name="check" size={16} color={colors.success || '#10b981'} />
              </TouchableOpacity>
            )}

            {isHistory && (
              <TouchableOpacity
                onPress={() => handleRemoveHistoryTruck(truck.id)}
                style={[styles.iconButton, { borderLeftColor: colors.breakLine, borderLeftWidth: 1, paddingLeft: 12 }]}
              >
                <MaterialCommunityIcons name="delete" size={16} color={colors.error || '#ef4444'} />
              </TouchableOpacity>
            )}
          </View>
        </View>
        <View>
          {/* EXPANDED VIEW - Additional Details */}
          {isExpanded && (
            <View style={[styles.expandedDetails, { borderColor: colors.breakLine }]}>
              {/* Gate Row */}
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.text }]}>Brama:</Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>{truck.gate || '—'}</Text>
              </View>

              {/* Trailer Row */}
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.text }]}>Naczepa:</Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>{truck.trailer || '—'}</Text>
              </View>

              {/* Full Elapsed Time Display */}
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.text }]}>Całkowity Czas:</Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>{formatElapsed(elapsedTime)}</Text>
              </View>
            </View>
          )}
        </View>
      </View>
    );
  };

  // ============================================================================
  // SECTION 6: MAIN RENDER
  // ============================================================================

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ✅ XP PROGRESS BAR - TOP OF SCREEN */}
      {profile && (
        <View style={[styles.xpProgressCard, { backgroundColor: colors.cardBackground }]}>
          <View style={styles.xpHeaderRow}>
            <View>
              <Text style={[styles.xpLevel, { color: colors.title }]}>Poziom {profile.level}</Text>
              <Text style={[styles.xpProgressText, { color: colors.text }]}>
                {levelData?.currentXP} / {xpForNextLevel} XP
              </Text>
            </View>
            <View style={[styles.xpRewardBadge, { backgroundColor: colors.butBackground }]}>
              <Ionicons name="star" size={16} color={colors.butText} />
              <Text style={[styles.xpRewardText, { color: colors.butText }]}>+{currentXPPerMin}/min</Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={[styles.progressBarBackground, { backgroundColor: colors.inputBackground, borderColor: colors.border, borderWidth: 1 }]}>
            <View
              style={[
                styles.progressBar,
                {
                  backgroundColor: colors.text,
                  width: `${Math.min(levelProgress, 100)}%`,
                },
              ]}
            />
          </View>

          <Text style={[styles.progressPercentText, { color: colors.textSecondary }]}>
            XP zdobyte w tej sesji: +{sessionXPEarned}
          </Text>
        </View>
      )}

      {/* ADD THE NOTIFICATION COMPONENT HERE */}
      <XPEarnedNotification
        visible={notificationState.visible}
        xpAmount={notificationState.xp}
        onDismiss={() => setNotificationState({ visible: false, xp: 0 })}
      />

      {/* ✅ FLOATING XP TEXT ANIMATION */}
      {showXPFloatingText && (
        <Animated.View
          style={[
            styles.floatingXPText,
            {
              opacity: floatingAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 0],
              }),
              transform: [
                {
                  translateY: floatingAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -60],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={[styles.floatingXPValue, { color: colors.text }]}>+{floatingXPAmount} XP</Text>
        </Animated.View>
      )}

      {/* ✅ LEVEL UP CELEBRATION */}
      {leveledUpMessage && (
        <View style={[styles.levelUpBanner, { backgroundColor: colors.cardBackground }]}>
          <Ionicons name="star" size={24} style={{ color: colors.iconColor }} />
          <Text style={[styles.levelUpText, { color: colors.text }]}>Level Up to {leveledUpMessage}! 🎉</Text>
          <Ionicons name="star" size={24} style={{ color: colors.iconColor }} />
        </View>
      )}

      {/* Stats Cards Section */}
      <View style={styles.statsSection}>
        <View style={styles.statsGrid}>
          {/* Card 1: Elapsed Time */}
          <View style={[styles.statCard, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="time-outline" size={24} style={{ color: colors.iconColor }} />
              <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>Czas Ładowania</Text>
            </View>
            <Text style={[styles.cardValue, { color: colors.text }]}>
              {loadingTime ? formatElapsed(loadingTime) : "00:00:00"}
            </Text>
          </View>

          {/* Card 2: Pallets Loaded */}
          <TouchableOpacity
            style={[styles.statCard, { backgroundColor: colors.cardBackground, width: '22.91%' }]}
            onPress={() => Alert.alert('Palety Załadowane', `${palletsLoaded}`)}
          >
            <View style={styles.cardHeader}>
              <Text style={[styles.cardLabelBadge, { color: colors.textSecondary }]}>Palety</Text>
              <MaterialCommunityIcons name="truck-delivery-outline" size={24} style={{ color: colors.iconColor }} />
            </View>
            <Text style={[styles.cardValue, { color: colors.text }]}>{palletsLoaded}</Text>
          </TouchableOpacity>

          {/* Card 3: Trucks Loaded */}
          <TouchableOpacity
            style={[styles.statCard, { backgroundColor: colors.cardBackground, width: '22.91%' }]}
            onPress={() => Alert.alert('Dostawy załadowane', `${trucksLoadedCount}`)}
          >
            <View style={styles.cardHeader}>
              <Text style={[styles.cardLabelBadge, { color: colors.textSecondary }]}>Dostawy</Text>
              <MaterialCommunityIcons name="truck-check-outline" size={24} style={{ color: colors.iconColor }} />
            </View>
            <Text style={[styles.cardValue, { color: colors.text }]}>{trucksLoadedCount}</Text>
          </TouchableOpacity>

          {/* Card 4: Rate (per hour) */}
          <View style={[styles.statCard, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="flash-outline" size={24} style={{ color: colors.iconColor }} />
              <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>Wynik/godz</Text>
            </View>
            <Text style={[styles.cardValue, { color: colors.text }]}>{palletsRate}</Text>
          </View>

          {/* Card 5: Forced Finish Time */}
          <TouchableOpacity style={[styles.statCard, { backgroundColor: colors.cardBackground }]} onPress={() => setShowAdjustFinishTimeModal(true)}>
            <View style={styles.cardHeader}>
              <Ionicons name="time-outline" size={24} style={{ color: colors.iconColor }} />
              <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>Czas Zakończenia</Text>
            </View>
            <Text style={[styles.cardValue, { color: colors.text }]}>
              {forcedFinishTime
                ? `${new Date(forcedFinishTime).toLocaleTimeString()} (${new Date(forcedFinishTime).getDate()})`
                : 'Brak'}
            </Text>
          </TouchableOpacity>

          {calc.timeOfForcedFinish && (
            <View style={{
              backgroundColor: '#fff3cd',
              borderRadius: 12,
              padding: 12,
              marginBottom: 16,
              borderLeftWidth: 4,
              borderLeftColor: '#ff6b6b'
            }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#cc5200' }}>
                ⏰ Auto-finish at {new Date(calc.timeOfForcedFinish).toLocaleTimeString()}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Trucks section */}
      <View style={[styles.infoContainer, { backgroundColor: colors.cardBackground }]}>
        <View style={styles.tabHeader}>
          <Text style={[styles.infoTitle, { color: colors.text }]}>
            {activeTab === 0 ? "Aktualne transporty" : "Zakończone transporty"}
          </Text>
          <View style={styles.tabDots}>
            <TouchableOpacity
              style={[styles.tabDot, activeTab === 0 ? { backgroundColor: colors.tabDotActive } : { backgroundColor: colors.tabDotInactive }]}
            />
            <TouchableOpacity
              style={[styles.tabDot, activeTab === 1 ? { backgroundColor: colors.tabDotActive } : { backgroundColor: colors.tabDotInactive }]}
            />
          </View>
        </View>

        <TabView
          navigationState={navigationState}
          renderScene={renderScene}
          onIndexChange={setActiveTab}
          renderTabBar={() => null} // Hide default tab bar since using custom dots
          style={{ flex: 1 }}
        />


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
            <Text style={[styles.btnResumeText, { color: colors.butText }]}>Wznów</Text>
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
            <Text style={[styles.btnOutlineText, { color: colors.outButText }]}>Nowy</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btnPrimary, { backgroundColor: colors.butBackground }]}
            onPress={() => setShowPauseModal(true)}
          >
            <Ionicons name="pause-outline" size={20} color={colors.butText} />
            <Text style={[styles.btnPrimaryText, { color: colors.butText }]}>Zatrzymaj</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              Alert.alert(
                'Zakończ Sesję',
                'Czy na pewno chcesz zakończyć tę sesję obliczeniową?',
                [
                  {
                    text: 'Anuluj',
                    style: 'cancel'
                  },
                  {
                    text: 'Zakończ',
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
            <Text style={[styles.btnPrimaryText, { color: colors.butText }]}>Zakończ</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Modals */}
      {/* Pallets in progress → ask for final number */}
      <Modal
        visible={showPalletsModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowPalletsModal(false);
          setPendingTruckId(null);
        }}
      >
        <View style={styles.palletsModalBackdrop}>
          <View style={[styles.palletsModalContent, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.palletsModalTitle, { color: colors.text }]}>
              Podaj liczbę palet!
            </Text>

            <Text style={[styles.palletsModalSubtitle, { color: colors.textSecondary }]}>
              Skończyłeś ładować ten transport, ale nie podałeś liczby palet. Wpisz liczbę palet (np. 12.75) i zatwierdź, aby zakończyć transport.
            </Text>

            <TextInput
              ref={palletsInputRef}
              style={[
                styles.palletsInput,
                { borderColor: colors.border, color: colors.text }
              ]}
              value={palletsInput}
              onChangeText={setPalletsInput}
              keyboardType="decimal-pad"
              placeholder="Np. 12.75"
              placeholderTextColor={colors.textSecondary}
            />

            <View style={styles.palletsButtonsRow}>
              <TouchableOpacity
                onPress={() => {
                  setShowPalletsModal(false);
                  setPendingTruckId(null);
                  setPalletsInput("");
                }}
                style={[
                  styles.btnOutline,
                  {
                    borderColor: colors.outButBorder,
                    backgroundColor: colors.outButBackground
                  }
                ]}
              >
                <Text style={[styles.btnOutlineText, { color: colors.outButText }]}>
                  Anuluj
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleConfirmPallets}
                style={[styles.btnPrimary, { backgroundColor: colors.butBackground }]}
              >
                <Text style={[styles.btnPrimaryText, { color: colors.butText }]}>
                  OK
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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

      <AdjustTimeModal
        visible={showAdjustFinishTimeModal}
        onClose={() => setShowAdjustFinishTimeModal(false)}
        onConfirm={(newForcedFinishTime) => {
          setForcedFinishTime(newForcedFinishTime);
          setShowAdjustFinishTimeModal(false);
        }}
        initialTime={forcedFinishTime}
        type="finish"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 32,
    justifyContent: 'space-between',
  },
  xpProgressCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  xpHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  xpLevel: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  xpProgressText: {
    fontSize: 12,
    marginTop: 4,
  },
  xpRewardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  xpRewardText: {
    fontSize: 13,
    fontWeight: '600',
  },
  progressBarBackground: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
  },
  progressPercentText: {
    fontSize: 11,
    textAlign: 'center',
  },
  floatingXPText: {
    position: 'absolute',
    top: 200,
    alignSelf: 'center',
    zIndex: 1000,
  },
  floatingXPValue: {
    fontSize: 24,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  levelUpBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginBottom: 16,
    borderRadius: 12,
    gap: 10,
  },
  levelUpText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
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
    width: '48.61%',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,  // Android equivalent
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    gap: 8,
  },
  cardLabelBadge: {
    fontSize: 9,
    fontWeight: '600',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  // Truck List Section
  trucksList: {
    borderWidth: 1,
    borderRadius: 12,
  },
  truckItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    minHeight: 60,
    borderBottomWidth: 1,
  },
  truckId: {
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.5,
  },
  truckIdSection: {
    width: 'auto',
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    gap: 2,
    height: 50,
    borderRadius: 10,
    marginRight: 4,
  },
  truckInfoSection: {
    flex: 1,
    marginHorizontal: 8,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 8,
  },
  compactField: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  fieldValue: {
    fontSize: 14,
    fontWeight: '600',
  },

  timeValue: {
    fontSize: 13,
    fontWeight: 'bold',
  },

  expandIcon: {
    padding: 4,
    marginLeft: 4,
  },

  expandedDetails: {
    marginTop: 12,
    paddingLeft: 12,
    paddingRight: 8,
    paddingBottom: 12,
    gap: 10,
    borderBottomWidth: 1,
  },

  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 0,
  },

  detailLabel: {
    fontSize: 12,
    fontWeight: '700',
    flex: 0.4,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    flex: 0.6,
    textAlign: 'right',
  },

  truckActionsRight: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    paddingLeft: 8,
  },
  palletsModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  palletsModalContent: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 16,
    padding: 20,
  },
  palletsModalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  palletsModalSubtitle: {
    fontSize: 13,
    marginBottom: 12,
  },
  palletsInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    marginBottom: 16,
  },
  palletsButtonsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },

});
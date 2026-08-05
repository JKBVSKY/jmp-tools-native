// calculator_content/shared/useTruckLogic.js
import React, { useState, useRef, useEffect } from 'react';
import { Animated, Easing, Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as NavigationBar from 'expo-navigation-bar';

import { PendingXPService } from '../../../services/PendingXPService';
import { db } from '../../../firebase/config';
import { doc, updateDoc } from 'firebase/firestore';

import { useCalculator } from '../../../context/CalculatorContext';
import { useUserProfile } from '../../../context/UserProfileContext';
import { useColors } from '../../../hooks/useColors';
import { calculateLevelFromXP } from '../../../constants/LevelSystem';
import { useSessionEngine } from './useSessionEngine';

// plus any other hooks you need from Working.jsx

export function useTruckLogic({ changeMode, startTime, endTime, sessionTime, setSessionTime, setStartTime, setEndTime, forcedFinishTime, setForcedFinishTime }) {
    const calc = useCalculator();
    const { profile, awardXP } = useUserProfile();
    const isWeb = Platform.OS === 'web';


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
    const [areSessionDetailsVisible, setAreSessionDetailsVisible] = useState(false);

    const [lastLevelBeforeSession] = useState(profile?.level || 1);

    const colors = useColors();
    const detailsAnimation = useRef(new Animated.Value(0)).current;
    const palletsInputRef = useRef(null);

    useEffect(() => {
        if (Platform.OS === 'android') {
            NavigationBar.setBackgroundColorAsync(colors.navBackground);
            NavigationBar.setButtonStyleAsync('light'); // or 'dark'
        }
    }, [colors]);

    const calculateXPPerMin = () => 10;

    const {
        currentXPPerMin,
        sessionXPEarned,
        showXPFloatingText,
        floatingXPAmount,
        leveledUpMessage,
        notificationState,
        setNotificationState,
        floatingAnim,
        handleAppGoesToBackground,
        handleAppComesToForeground,
        checkAndEnforceForcedFinish,
        handlePauseConfirm,
        handleResume,
    } = useSessionEngine({
        calc,
        profile,
        awardXP,
        changeMode,
        startTime,
        setSessionTime,
        forcedFinishTime,
        sessionRate: palletsRate,
        calculateXPPerMin,
        sessionMode: 'working',
        pausedMode: 'paused',
        resultsMode: 'results',
        onForcedFinish: async ({ forcedFinishTimestamp, sessionTimeAtDeadline }) => {
            const finalTrucks = trucks.map(truck => ({
                ...truck,
                elapsedLoadingTime: Math.min(
                    truck.elapsedLoadingTime || 0,
                    Math.floor((forcedFinishTimestamp - truck.startLoadingTime) / 1000)
                )
            }));

            const autoFinishedTrucks = finalTrucks.map(t => ({
                ...t,
                isAutoFinished: true,
                completedTime: forcedFinishTimestamp
            }));

            calc.updateState({
                trucks: [],
                trucksHistory: [...autoFinishedTrucks, ...trucksHistory],
                isPaused: false,
                pauseStart: null,
                mode: 'forced-finished',
                sessionStatus: 'finalized',
            });

            setSessionTime(sessionTimeAtDeadline);
            setEndTime(forcedFinishTimestamp);
        },
        recordPendingXPAction: async (xpAmount, payload) => {
            await PendingXPService.recordXPAction(xpAmount, {
                rate: payload.rate,
                trucksLoaded: trucksLoadedCount,
                timestamp: payload.timestamp,
                reason: payload.reason,
            });
        },
    });

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
        sessionTime > 0 ? (palletsLoaded / (sessionTime / 3600)).toFixed(2) : "0.00";
    const trucksLoadedCount = trucksHistory.length;
    const levelData = profile ? calculateLevelFromXP(profile.totalXP) : null;
    const xpForNextLevel = profile ? profile.level * 1000 : 1000;
    const levelProgress = levelData ? (levelData.currentXP / xpForNextLevel) * 100 : 0;
    const palletsRateGoal = profile?.palletsRateGoal ?? 48;
    const effectiveEndTime = forcedFinishTime || Date.now();
    const activeSessionSeconds = startTime
        ? Math.max(0, Math.floor((effectiveEndTime - startTime - totalPausedTime) / 1000))
        : 0;
    const requiredPalletsByGoal = startTime && effectiveEndTime > startTime
        ? Math.max(0, Math.ceil(palletsRateGoal * (activeSessionSeconds / 3600)))
        : 0;
    const palletsNeeded = requiredPalletsByGoal;
    const palletsLeft = Math.max(0, palletsNeeded - palletsLoaded);
    const isOverGoal = Number(palletsRate) >= palletsRateGoal;
    const goalReachedUntilSeconds = isOverGoal && palletsLoaded > 0
        ? Math.max(0, Math.floor((palletsLoaded / palletsRateGoal) * 3600 - sessionTime))
        : null;

    // ============================================================================
    // SECTION 3: ALL useEffect HOOKS - AFTER STATE/REF INITIALIZATION
    // ============================================================================

    // Cards animation function
    useEffect(() => {
        Animated.timing(detailsAnimation, {
            toValue: areSessionDetailsVisible ? 1 : 0,
            duration: 260,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();
    }, [areSessionDetailsVisible, detailsAnimation]);

    const detailsAnimatedStyle = {
        opacity: detailsAnimation,
        transform: [
            {
                translateY: detailsAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-12, 0],
                }),
            },
        ],
    };

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
    // move over: checkAndEnforceForcedFinish, handleAppComesToForeground, award XP, etc.

    return {
        // context & colors
        calc,
        colors,

        // computed values
        startTime,
        trucks,
        trucksHistory,
        palletsLoaded,
        palletsRate,
        trucksLoadedCount,
        isPaused,
        levelData,
        xpForNextLevel,
        levelProgress,
        sessionTime,
        forcedFinishTime,
        setForcedFinishTime,
        palletsRateGoal,
        palletsNeeded,
        palletsLeft,
        isOverGoal,
        goalReachedUntilSeconds,

        // UI state
        activeTab,
        setActiveTab,
        editingTruck,
        setEditingTruck,
        showPauseModal,
        setShowPauseModal,
        showNewTransportModal,
        setShowNewTransportModal,
        showAdjustFinishTimeModal,
        setShowAdjustFinishTimeModal,
        showPalletsModal,
        setShowPalletsModal,
        palletsInput,
        setPalletsInput,
        pendingTruckId,
        setPendingTruckId,
        expandedTruckId,
        setExpandedTruckId,
        areSessionDetailsVisible,
        setAreSessionDetailsVisible,

        // XP / notification state
        currentXPPerMin,
        sessionXPEarned,
        showXPFloatingText,
        floatingXPAmount,
        leveledUpMessage,
        notificationState,
        setNotificationState,
        floatingAnim,
        detailsAnimatedStyle,

        // handlers
        addTruck,
        handleSaveEdit,
        handleSaveEditHistory,
        handleTruckDone,
        handleRemoveHistoryTruck,
        handlePauseConfirm,
        handleResume,
        handleConfirmPallets,
        formatElapsed,
        formatTruckTime,

        // extras you use in JSX
        profile,
        isWeb,
    };
}
// calculator_content/shared/useWorkingLogic.js
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Animated, Easing, Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as NavigationBar from 'expo-navigation-bar';

import { useAppState } from '@/_hooks/useAppState';
import { PendingXPService } from '@/services/PendingXPService';
import { db } from '@/firebase/config';
import { doc, updateDoc } from 'firebase/firestore';

import { useCalculator } from '@/_context/CalculatorContext';
import { useUserProfile } from '@/_context/UserProfileContext';
import { useColors } from '@/_hooks/useColors';
import { useBackgroundXP } from '@/_hooks/useBackgroundXP';
import { calculateLevelFromXP } from '@/constants/LevelSystem';

// plus any other hooks you need from Working.jsx

export function useWorkingLogic({ changeMode, startTime, endTime, loadingTime, setLoadingTime, setStartTime, setEndTime, forcedFinishTime, setForcedFinishTime }) {
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
    const detailsAnimation = useRef(new Animated.Value(0)).current;

    // before: const palletsRateRef = useRef(palletsRate);
    const palletsRateRef = useRef("0.00");  // or 0, depending on how you parse it

    const checkAndEnforceForcedFinishRef = useRef();
    const palletsInputRef = useRef(null);

    // ✅ USE BACKGROUND XP HOOK
    const { syncPendingXP } = useBackgroundXP(awardXP, true);

    // ✅ Define what should happen when the app goes to the background
    const handleAppGoesToBackground = useCallback(() => {
        console.log('App is going to the background.');
        // Only save state if in a working session
        if (calc.mode === 'working' && !calc.isPaused) {
            const stateToSave = {
                lastXPTime: lastXPRewardTimeRef.current,
                lastPalletsRate: palletsRateRef.current
            };
            AsyncStorage.setItem('lastActiveSessionState', JSON.stringify(stateToSave));
            console.log('Active session state saved.');
        }
    }, [calc.mode, calc.isPaused]); // Dependencies ensure it always has fresh data

    useEffect(() => {
        if (Platform.OS === 'android') {
            NavigationBar.setBackgroundColorAsync(colors.navBackground);
            NavigationBar.setButtonStyleAsync('light'); // or 'dark'
        }
    }, [colors]);

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
        const elapsedUntilDeadline =
            forcedFinishTimestamp - startTime - (calc.totalPausedTime || 0);
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

        lastXPRewardTimeRef.current = forcedFinishTimestamp;
        await AsyncStorage.removeItem('lastActiveSessionState');

        return true; // Forced finish was applied
    }, [calc.mode, calc.forcedFinishTime, startTime, calc.totalPausedTime, calc.trucks, calc.trucksHistory]);

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

    // Function to calculate and award offline progress
    const handleAppComesToForeground = useCallback(async () => {
        console.log("📱 App came to foreground - checking forced finish...");

        // ✅ FIRST: Check if forced finish has occurred
        const wasForcedFinished = await checkAndEnforceForcedFinish();

        if (wasForcedFinished) {
            // ⚠️ IMPORTANT: DO NOT award offline XP when forced finishing!
            console.log("✅ Session was auto-finished. Results will be shown.");

            // Transition to results screen
            changeMode('results');
            return;
        }

        if (calc.mode !== 'working' || calc.isPaused) {
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
            let offlineXPEarned = 0;

            if (xpPerMin > 0) {
                offlineXPEarned = Math.floor(awayTimeMinutes * xpPerMin);

                if (forcedFinishTimestamp && lastXPTime < forcedFinishTimestamp) {
                    const allowedMinutes = Math.max(
                        0,
                        (forcedFinishTimestamp - lastXPTime) / 60000
                    );
                    offlineXPEarned = Math.floor(allowedMinutes * xpPerMin);
                }
            }

            // IMPORTANT: Update the last reward time to NOW to prevent double-dipping
            lastXPRewardTimeRef.current = now;

        } catch (error) {
            console.error("Error calculating offline XP:", error);
        } finally {
            await AsyncStorage.removeItem('lastActiveSessionState'); // Clean up
        }
    }, [calc.mode, calc.timeOfForcedFinish, calc.isPaused, checkAndEnforceForcedFinish, tryAwardXP, changeMode,]);

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
        ? Math.max(0, Math.floor((palletsLoaded / palletsRateGoal) * 3600 - loadingTime))
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
        loadingTime,
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
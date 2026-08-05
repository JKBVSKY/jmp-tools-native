import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

import { useAppState } from '../../../hooks/useAppState';

const defaultCalculateXPPerMin = () => 10;
const noop = () => {};

export function useSessionEngine({
    calc,
    profile,
    awardXP,
    changeMode = noop,
    startTime,
    setSessionTime,
    forcedFinishTime,
    sessionMode = 'working',
    pausedMode = 'paused',
    resultsMode = 'results',
    sessionStorageKey = 'lastActiveSessionState',
    sessionRate = '0.00',
    calculateXPPerMin = defaultCalculateXPPerMin,
    onForcedFinish = noop,
    recordPendingXPAction = noop,
}) {
    const [currentXPPerMin, setCurrentXPPerMin] = useState(0);
    const [sessionXPEarned, setSessionXPEarned] = useState(0);
    const [showXPFloatingText, setShowXPFloatingText] = useState(false);
    const [floatingXPAmount, setFloatingXPAmount] = useState(0);
    const [leveledUpMessage, setLeveledUpMessage] = useState(null);
    const [notificationState, setNotificationState] = useState({ visible: false, xp: 0 });

    const lastXPRewardTimeRef = useRef(Date.now());
    const xpSaveInProgressRef = useRef(false);
    const sessionRateRef = useRef(sessionRate);
    const floatingAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        sessionRateRef.current = sessionRate;
        setCurrentXPPerMin(calculateXPPerMin(sessionRateRef.current));
    }, [sessionRate, calculateXPPerMin]);

    const handleAppGoesToBackground = useCallback(() => {
        if (calc.mode === sessionMode && !calc.isPaused) {
            const stateToSave = {
                lastXPTime: lastXPRewardTimeRef.current,
                lastSessionRate: sessionRateRef.current,
            };

            AsyncStorage.setItem(sessionStorageKey, JSON.stringify(stateToSave));
        }
    }, [calc.mode, calc.isPaused, sessionMode, sessionStorageKey]);

    const tryAwardXP = useCallback(async (xpAmount) => {
        try {
            const state = await NetInfo.fetch();

            if (!state.isConnected) {
                return null;
            }

            return await awardXP(xpAmount);
        } catch (error) {
            console.error('❌ Error awarding XP:', error);
            return null;
        }
    }, [awardXP]);

    const checkAndEnforceForcedFinish = useCallback(async () => {
        if (calc.mode !== sessionMode || !forcedFinishTime) {
            return false;
        }

        const now = Date.now();

        if (now < forcedFinishTime) {
            return false;
        }

        const sessionTimeAtDeadline = Math.max(
            0,
            Math.floor((forcedFinishTime - startTime - (calc.totalPausedTime || 0)) / 1000)
        );

        await onForcedFinish({
            forcedFinishTimestamp: forcedFinishTime,
            sessionTimeAtDeadline,
            now,
        });

        lastXPRewardTimeRef.current = forcedFinishTime;
        await AsyncStorage.removeItem(sessionStorageKey);

        return true;
    }, [
        calc.mode,
        calc.totalPausedTime,
        forcedFinishTime,
        onForcedFinish,
        sessionMode,
        sessionStorageKey,
        startTime,
    ]);

    const handleAppComesToForeground = useCallback(async () => {
        const wasForcedFinished = await checkAndEnforceForcedFinish();

        if (wasForcedFinished) {
            changeMode(resultsMode);
            return;
        }

        if (calc.mode !== sessionMode || calc.isPaused) {
            return;
        }

        const now = Date.now();
        const forcedFinishTimestamp = forcedFinishTime;

        if (forcedFinishTimestamp && now > forcedFinishTimestamp) {
            return;
        }

        try {
            const lastSessionStateStr = await AsyncStorage.getItem(sessionStorageKey);
            if (!lastSessionStateStr) return;

            const lastState = JSON.parse(lastSessionStateStr);
            const { lastXPTime, lastSessionRate } = lastState;

            const awayTimeMs = now - lastXPTime;
            const awayTimeMinutes = awayTimeMs / 60000;

            if (awayTimeMinutes < 1) {
                return;
            }

            const xpPerMin = calculateXPPerMin(lastSessionRate);

            if (xpPerMin > 0) {
                let offlineXPEarned = Math.floor(awayTimeMinutes * xpPerMin);

                if (forcedFinishTimestamp && lastXPTime < forcedFinishTimestamp) {
                    const allowedMinutes = Math.max(
                        0,
                        (forcedFinishTimestamp - lastXPTime) / 60000
                    );
                    offlineXPEarned = Math.floor(allowedMinutes * xpPerMin);
                }

                console.log('📦 Offline XP window calculated:', offlineXPEarned);
            }

            lastXPRewardTimeRef.current = now;
        } catch (error) {
            console.error('Error calculating offline XP:', error);
        } finally {
            await AsyncStorage.removeItem(sessionStorageKey);
        }
    }, [
        calc.isPaused,
        calc.mode,
        forcedFinishTime,
        calculateXPPerMin,
        checkAndEnforceForcedFinish,
        changeMode,
        resultsMode,
        sessionMode,
        sessionStorageKey,
    ]);

    useAppState({
        onForeground: handleAppComesToForeground,
        onBackground: handleAppGoesToBackground,
    });

    useEffect(() => {
        handleAppComesToForeground();
    }, []);

    useEffect(() => {
        if (!startTime || calc.isPaused) return;

        const interval = setInterval(() => {
            setSessionTime(Math.floor((Date.now() - startTime - (calc.totalPausedTime || 0)) / 1000));
        }, 1000);

        return () => clearInterval(interval);
    }, [calc.isPaused, calc.totalPausedTime, setSessionTime, startTime]);

    useEffect(() => {
        if (!startTime || calc.isPaused || !profile) return;

        const rewardXPIfNeeded = async () => {
            const now = Date.now();
            const timeSinceLastReward = now - lastXPRewardTimeRef.current;
            const xpPerMin = calculateXPPerMin(sessionRateRef.current);

            if (calc.sessionStatus === 'finalized') {
                return;
            }

            if (timeSinceLastReward >= 60000 && xpPerMin > 0) {
                if (xpSaveInProgressRef.current) {
                    return;
                }

                xpSaveInProgressRef.current = true;
                lastXPRewardTimeRef.current = now;

                try {
                    const result = await tryAwardXP(xpPerMin);
                    setSessionXPEarned(prev => prev + xpPerMin);

                    setFloatingXPAmount(xpPerMin);
                    setShowXPFloatingText(true);

                    floatingAnim.setValue(0);
                    Animated.timing(floatingAnim, {
                        toValue: 1,
                        duration: 1500,
                        useNativeDriver: true,
                    }).start(() => {
                        setShowXPFloatingText(false);
                    });

                    if (result && result.leveledUp) {
                        setLeveledUpMessage(`Leveled up to Level ${result.newLevel}!`);
                        setTimeout(() => setLeveledUpMessage(null), 3000);
                    }
                } catch (error) {
                    console.error('❌ Error in XP loop:', error);
                    await recordPendingXPAction(xpPerMin, {
                        rate: sessionRateRef.current,
                        timestamp: now,
                        reason: 'error',
                    });
                } finally {
                    xpSaveInProgressRef.current = false;
                }
            }
        };

        const interval = setInterval(() => {
            rewardXPIfNeeded();
        }, 10000);

        return () => clearInterval(interval);
    }, [calc.isPaused, calc.sessionStatus, floatingAnim, profile, recordPendingXPAction, startTime, tryAwardXP]);

    const handlePauseConfirm = useCallback((pauseTimeStr) => {
        const now = new Date();
        const [h, m, s] = pauseTimeStr.split(':').map(Number);
        const chosenPause = new Date(now);
        chosenPause.setHours(h, m, s || 0, 0);
        const pauseStartTime = chosenPause > now ? now : chosenPause;
        const diffMs = now - pauseStartTime;

        const newTotalPaused = (calc.totalPausedTime || 0) + diffMs;
        const newSessionTime = Math.floor((Date.now() - startTime - newTotalPaused) / 1000);

        setSessionTime(newSessionTime);

        calc.updateState({
            totalPausedTime: newTotalPaused,
            pauseStart: Date.now(),
            isPaused: true,
            mode: pausedMode,
        });
    }, [calc, pausedMode, setSessionTime, startTime]);

    const handleResume = useCallback(() => {
        if (calc.pauseStart) {
            const newTotalPaused = (calc.totalPausedTime || 0) + (Date.now() - calc.pauseStart);

            calc.updateState({
                totalPausedTime: newTotalPaused,
                pauseStart: null,
                isPaused: false,
                mode: sessionMode,
            });
        }
    }, [calc, sessionMode]);

    return {
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
    };
}
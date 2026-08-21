import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';

import { useAppState } from '../../../hooks/useAppState';

const noop = () => {};

export function useSessionEngine({
    calc,
    changeMode = noop,
    startTime,
    setSessionTime,
    forcedFinishTime,
    sessionMode = 'working',
    pausedMode = 'paused',
    resultsMode = 'results',
    onForcedFinish = noop,
}) {
    const [notificationState, setNotificationState] = useState({ visible: false, xp: 0 });
    const floatingAnim = useRef(new Animated.Value(0)).current;

    const checkAndEnforceForcedFinish = useCallback(async () => {
        if (calc.mode !== sessionMode || !forcedFinishTime || !startTime) {
            return false;
        }

        const now = Date.now();
        if (now < forcedFinishTime) {
            return false;
        }

        const sessionTimeAtDeadline = Math.max(
            0,
            Math.floor((forcedFinishTime - startTime - (calc.totalPausedTime || 0)) / 1000),
        );

        await onForcedFinish({
            forcedFinishTimestamp: forcedFinishTime,
            sessionTimeAtDeadline,
            now,
        });

        return true;
    }, [calc.mode, calc.totalPausedTime, forcedFinishTime, onForcedFinish, sessionMode, startTime]);

    const handleAppGoesToBackground = useCallback(() => {}, []);

    const handleAppComesToForeground = useCallback(async () => {
        const wasForcedFinished = await checkAndEnforceForcedFinish();
        if (wasForcedFinished) {
            changeMode(resultsMode);
        }
    }, [changeMode, checkAndEnforceForcedFinish, resultsMode]);

    useAppState({
        onForeground: handleAppComesToForeground,
        onBackground: handleAppGoesToBackground,
    });

    useEffect(() => {
        void handleAppComesToForeground();
    }, [handleAppComesToForeground]);

    useEffect(() => {
        if (!startTime || calc.isPaused) return undefined;

        const interval = setInterval(() => {
            setSessionTime(Math.floor((Date.now() - startTime - (calc.totalPausedTime || 0)) / 1000));
        }, 1000);

        return () => clearInterval(interval);
    }, [calc.isPaused, calc.totalPausedTime, setSessionTime, startTime]);

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
        currentXPPerMin: 0,
        sessionXPEarned: 0,
        showXPFloatingText: false,
        floatingXPAmount: 0,
        leveledUpMessage: null,
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

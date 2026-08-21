import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Platform } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';

import { calculateLevelFromXP } from '../../../constants/LevelSystem';
import { useCalculator } from '../../../context/CalculatorContext';
import { useUserProfile } from '../../../context/UserProfileContext';
import { useColors } from '../../../hooks/useColors';
import { appConfirm } from '../../../utils/crossPlatformAlert';
import { useSessionEngine } from '../shared/useSessionEngine';

const noop = () => {};
export const PICKING_SUBSECTIONS = ['P01', 'P02', 'P03', 'P04', 'P05', 'P06', 'P15', 'P21', 'P28'];

const getDefaultSubsectionStats = () => ({
    boxesCount: 0,
    ordersCount: 0,
    sessionTime: 0,
});

const normalizeSubsectionStats = (stats = {}) => ({
    boxesCount: Number(stats.boxesCount || 0),
    ordersCount: Number(stats.ordersCount || 0),
    sessionTime: Number(stats.sessionTime || 0),
});

export function usePickingLogic({
    changeMode = noop,
    startTime,
    endTime,
    sessionTime,
    setSessionTime = noop,
    setStartTime = noop,
    setEndTime = noop,
    forcedFinishTime,
    setForcedFinishTime = noop,
}) {
    const calc = useCalculator();
    const { profile } = useUserProfile();
    const colors = useColors();
    const isWeb = Platform.OS === 'web';
    const [showPauseModal, setShowPauseModal] = useState(false);
    const [boxesInput, setBoxesInput] = useState('');

    const subsection = calc.subsection || '';
    const subsectionGoalsMap = calc.pickingSubsectionGoals || {};
    const subsectionStatsMap = calc.pickingSubsectionStats || {};
    const subsectionStats = normalizeSubsectionStats(
        subsection ? subsectionStatsMap[subsection] : getDefaultSubsectionStats()
    );
    const boxesCount = subsectionStats.boxesCount;
    const ordersCount = subsectionStats.ordersCount;
    const goal = Number(subsection ? subsectionGoalsMap[subsection] ?? 0 : 0);
    const storedSubsectionTime = subsectionStats.sessionTime;
    const activeSubsection = calc.activePickingSubsection;
    const activeSubsectionStart = calc.activePickingStartedAt;
    const activeElapsedSeconds = activeSubsection === subsection && activeSubsectionStart && !calc.isPaused
        ? Math.max(0, Math.floor((Date.now() - activeSubsectionStart) / 1000))
        : 0;
    const pickingTimeValue = storedSubsectionTime + activeElapsedSeconds;
    const boxesRate = pickingTimeValue > 0
        ? Number((boxesCount / (pickingTimeValue / 3600)).toFixed(2))
        : 0;
    const levelData = profile ? calculateLevelFromXP(profile.totalXP) : null;
    const xpForNextLevel = profile ? profile.level * 1000 : 1000;
    const levelProgress = levelData ? (levelData.currentXP / xpForNextLevel) * 100 : 0;

    const isOverGoal = goal > 0 && boxesRate >= goal;
    const boxesRemainingToGoal = useMemo(() => {
        if (!goal || pickingTimeValue <= 0) return 0;
        const expected = Math.ceil(goal * (pickingTimeValue / 3600));
        return Math.max(0, expected - boxesCount);
    }, [goal, pickingTimeValue, boxesCount]);

    const normalizedBoxesInput = boxesInput.replace(',', '.');
    const parsedBoxesInput = Number(normalizedBoxesInput);
    const hasValidSubsection = PICKING_SUBSECTIONS.includes(subsection);
    const isPaused = Boolean(calc.isPaused);
    const isBoxesInputValid =
        normalizedBoxesInput.trim() !== '' &&
        Number.isFinite(parsedBoxesInput) &&
        parsedBoxesInput > 0;
    const canSubmitBoxes = !isPaused && hasValidSubsection && isBoxesInputValid;

    const boxesInputHint = isPaused
        ? 'Dodawanie paczek jest zablokowane podczas pauzy.'
        : !hasValidSubsection
            ? 'Wybierz podsekcję, aby dodać paczki.'
            : normalizedBoxesInput.trim() === ''
                ? 'Wpisz dodatnią liczbę paczek (max 2 miejsca po przecinku).'
                : !isBoxesInputValid
                    ? 'Podaj poprawną dodatnią liczbę (max 2 miejsca po przecinku).'
                    : 'Naciśnij Enter lub Zatwierdź, aby dodać paczki.';

    const applySubsectionTimeDelta = (statsMap, subsectionKey, deltaSeconds) => {
        const normalizedDelta = Math.max(0, Number(deltaSeconds || 0));
        const current = normalizeSubsectionStats(statsMap[subsectionKey] || getDefaultSubsectionStats());

        return {
            ...statsMap,
            [subsectionKey]: {
                ...current,
                sessionTime: current.sessionTime + normalizedDelta,
            },
        };
    };

    const flushActiveSubsectionTime = (timestampMs) => {
        const activeKey = calc.activePickingSubsection;
        const activeStart = calc.activePickingStartedAt;

        if (!activeKey || !activeStart) {
            return {
                nextStatsMap: { ...subsectionStatsMap },
                elapsedSeconds: 0,
            };
        }

        const deltaSeconds = Math.max(0, Math.floor((timestampMs - activeStart) / 1000));

        if (deltaSeconds <= 0) {
            return {
                nextStatsMap: { ...subsectionStatsMap },
                elapsedSeconds: 0,
            };
        }

        return {
            nextStatsMap: applySubsectionTimeDelta({ ...subsectionStatsMap }, activeKey, deltaSeconds),
            elapsedSeconds: deltaSeconds,
        };
    };

    useEffect(() => {
        if (Platform.OS === 'android') {
            NavigationBar.setBackgroundColorAsync(colors.navBackground);
            NavigationBar.setButtonStyleAsync('light');
        }
    }, [colors]);

    const session = useSessionEngine({
        calc,
        changeMode,
        startTime,
        setSessionTime,
        forcedFinishTime,
        sessionMode: 'working',
        pausedMode: 'paused',
        resultsMode: 'results',
        sessionStorageKey: 'pickingSessionState',
        onForcedFinish: async ({ forcedFinishTimestamp, sessionTimeAtDeadline }) => {
            const { nextStatsMap } = flushActiveSubsectionTime(forcedFinishTimestamp);

            calc.updateState({
                mode: 'forced-finished',
                sessionStatus: 'finalized',
                isPaused: false,
                pauseStart: null,
                endTime: forcedFinishTimestamp,
                pickingSubsectionStats: nextStatsMap,
                activePickingStartedAt: null,
            });

            setSessionTime(sessionTimeAtDeadline);
            setEndTime(forcedFinishTimestamp);
        },
    });

    const setSubsection = (nextSubsection) => {
        const normalized = (nextSubsection || '').trim().toUpperCase();
        if (!PICKING_SUBSECTIONS.includes(normalized)) {
            return;
        }

        const isSubsectionChange = normalized !== subsection;

        if (!isSubsectionChange) {
            if (!calc.isPaused && (!calc.activePickingSubsection || !calc.activePickingStartedAt)) {
                calc.updateState({
                    activePickingSubsection: normalized,
                    activePickingStartedAt: Date.now(),
                });
            }
            return;
        }

        const applySubsectionChange = () => {
            const now = Date.now();
            const { nextStatsMap } = !calc.isPaused
                ? flushActiveSubsectionTime(now)
                : { nextStatsMap: { ...subsectionStatsMap } };
            const nextStats = normalizeSubsectionStats(nextStatsMap[normalized] || getDefaultSubsectionStats());

            const nextGoalsMap = { ...subsectionGoalsMap };
            if (typeof nextGoalsMap[normalized] !== 'number') {
                nextGoalsMap[normalized] = 0;
            }
            const nextGoal = Number(nextGoalsMap[normalized] || 0);

            calc.updateState({
                subsection: normalized,
                boxesRateGoal: nextGoal,
                pickingSubsectionGoals: nextGoalsMap,
                boxesCount: nextStats.boxesCount,
                ordersCount: nextStats.ordersCount,
                pickingSubsectionStats: nextStatsMap,
                activePickingSubsection: normalized,
                activePickingStartedAt: calc.isPaused ? null : now,
            });
        };

        if (subsection) {
            appConfirm(
                'Zmiana podsekcji',
                `Czy chcesz zmienić podsekcję na ${normalized}?`,
                applySubsectionChange,
            );
            return;
        }

        applySubsectionChange();

    };

    const handleBoxesInputChange = (value) => {
        const normalized = value.replace(',', '.');
        if (!/^\d*(?:\.\d{0,2})?$/.test(normalized)) {
            return;
        }
        setBoxesInput(normalized);
    };

    const submitBoxesInput = () => {
        if (isPaused) {
            return;
        }

        if (!hasValidSubsection) {
            Alert.alert('Wybierz podsekcję', 'Przed zatwierdzeniem wybierz jedną z dostępnych podsekcji.');
            return;
        }

        const parsed = Number(normalizedBoxesInput);

        if (!Number.isFinite(parsed) || parsed <= 0) {
            Alert.alert('Nieprawidłowa wartość', 'Wpisz dodatnią liczbę paczek (maksymalnie 2 miejsca po przecinku).');
            return;
        }

        const now = Date.now();
        let nextStatsMap = { ...subsectionStatsMap };
        let nextActiveSubsection = calc.activePickingSubsection;
        let nextActiveStartedAt = calc.activePickingStartedAt;

        if (nextActiveSubsection && nextActiveStartedAt && nextActiveSubsection !== subsection) {
            const flushed = flushActiveSubsectionTime(now);
            nextStatsMap = flushed.nextStatsMap;
            nextActiveSubsection = null;
            nextActiveStartedAt = null;
        }

        if (nextActiveSubsection !== subsection || !nextActiveStartedAt) {
            nextActiveSubsection = subsection;
            nextActiveStartedAt = now;
        }

        const current = normalizeSubsectionStats(nextStatsMap[subsection] || getDefaultSubsectionStats());
        const nextSubsectionStats = {
            boxesCount: Number((current.boxesCount + parsed).toFixed(2)),
            ordersCount: current.ordersCount + 1,
            sessionTime: current.sessionTime,
        };

        nextStatsMap = {
            ...nextStatsMap,
            [subsection]: nextSubsectionStats,
        };

        calc.updateState({
            boxesCount: nextSubsectionStats.boxesCount,
            ordersCount: nextSubsectionStats.ordersCount,
            pickingSubsectionStats: nextStatsMap,
            activePickingSubsection: nextActiveSubsection,
            activePickingStartedAt: nextActiveStartedAt,
        });

        setBoxesInput('');
    };

    const updateBoxesCount = (nextBoxesCount) => {
        if (!hasValidSubsection) {
            Alert.alert('Wybierz podsekcję', 'Najpierw wybierz podsekcję, aby edytować liczbę opakowań.');
            return false;
        }

        const numericValue = Number(nextBoxesCount);
        if (!Number.isFinite(numericValue) || numericValue < 0) {
            Alert.alert('Nieprawidłowa wartość', 'Podaj poprawną liczbę opakowań większą lub równą 0.');
            return false;
        }

        const current = normalizeSubsectionStats(subsectionStatsMap[subsection] || getDefaultSubsectionStats());
        const nextSubsectionStats = {
            ...current,
            boxesCount: Number(numericValue.toFixed(2)),
        };

        const nextStatsMap = {
            ...subsectionStatsMap,
            [subsection]: nextSubsectionStats,
        };

        calc.updateState({
            boxesCount: nextSubsectionStats.boxesCount,
            pickingSubsectionStats: nextStatsMap,
        });

        return true;
    };

    const handlePauseConfirm = (pauseTimeStr) => {
        const now = new Date();
        const [h, m, s] = pauseTimeStr.split(':').map(Number);
        const chosenPause = new Date(now);
        chosenPause.setHours(h, m, s || 0, 0);
        const pauseStartTime = chosenPause > now ? now : chosenPause;

        const { nextStatsMap } = flushActiveSubsectionTime(pauseStartTime.getTime());

        calc.updateState({
            pickingSubsectionStats: nextStatsMap,
            activePickingStartedAt: null,
        });

        session.handlePauseConfirm(pauseTimeStr);
    };

    const handleResume = () => {
        session.handleResume();

        if (!calc.activePickingSubsection || calc.activePickingSubsection !== subsection) {
            return;
        }

        calc.updateState({
            activePickingStartedAt: Date.now(),
        });
    };

    const handleFinishSession = () => {
        const now = Date.now();
        const { nextStatsMap } = flushActiveSubsectionTime(now);

        calc.updateState({
            endTime: now,
            mode: 'results',
            pickingSubsectionStats: nextStatsMap,
            activePickingStartedAt: null,
        });
    };

    return {
        ...session,
        calc,
        colors,
        profile,
        isWeb,
        startTime,
        endTime,
        sessionTime,
        subsection,
        boxesCount,
        ordersCount,
        subsectionStatsMap,
        subsectionGoalsMap,
        subsectionTime: pickingTimeValue,
        goal,
        boxesRate,
        isOverGoal,
        boxesRemainingToGoal,
        levelData,
        xpForNextLevel,
        levelProgress,
        boxesInput,
        boxesInputHint,
        isPaused,
        canSubmitBoxes,
        setSessionTime,
        setStartTime,
        setEndTime,
        forcedFinishTime,
        setForcedFinishTime,
        showPauseModal,
        setShowPauseModal,
        pickingSubsections: PICKING_SUBSECTIONS,
        setSubsection,
        handleBoxesInputChange,
        submitBoxesInput,
        updateBoxesCount,
        handlePauseConfirm,
        handleResume,
        handleFinishSession,
    };
}
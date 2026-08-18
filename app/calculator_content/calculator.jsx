import React from 'react';
import { View, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Init from "./shared/Init";
import TruckWorking from './TruckWorking';
import Results from "./shared/Results";
import Picking from './picking/picking';
import PickingResults from './picking/PickingResults';
import { useCalculator } from "../../context/CalculatorContext";
import { getAutoStartTime } from "./shared/utils";
import { useColors } from '../../hooks/useColors';
import { getAutoForcedFinishTime } from '../../utils/timeUtils';

export default function Calculator() {
  const calc = useCalculator();
  const colors = useColors();
  const forcedFinishTime = calc.forcedFinishTime;
  const setForcedFinishTime = (time) => calc.updateState({ forcedFinishTime: time });

  const changeMode = (newMode) => calc.updateState({ mode: newMode });

  const sessionType = calc.sessionType || 'truck-loading';

  const handleStartSession = React.useCallback((config = {}) => {
    const initialPickingSubsection = (config.initialPickingSubsection || '').trim().toUpperCase();
    const hasInitialPickingSubsection = Boolean(initialPickingSubsection);

    const sharedStartState = {
      mode: 'working',
      sessionStatus: 'active',
      endTime: null,
      sessionTime: 0,
      isPaused: false,
      pauseStart: null,
      totalPausedTime: 0,
    };

    if (sessionType === 'picking') {
      const initialStartTimestamp = calc.startTime || Date.now();
      calc.updateState({
        ...sharedStartState,
        boxesCount: 0,
        ordersCount: 0,
        subsection: initialPickingSubsection,
        boxesRateGoal: 0,
        pickingSubsectionGoals: hasInitialPickingSubsection ? { [initialPickingSubsection]: 0 } : {},
        pickingSubsectionStats: {},
        activePickingSubsection: hasInitialPickingSubsection ? initialPickingSubsection : null,
        activePickingStartedAt: hasInitialPickingSubsection ? initialStartTimestamp : null,
        trucks: [],
        trucksHistory: [],
        nextTruckId: 1,
      });
      return;
    }

    calc.updateState({
      ...sharedStartState,
      trucks: [],
      trucksHistory: [],
      nextTruckId: 1,
      boxesCount: 0,
      ordersCount: 0,
      subsection: '',
      boxesRateGoal: 0,
      pickingSubsectionGoals: {},
      pickingSubsectionStats: {},
      activePickingSubsection: null,
      activePickingStartedAt: null,
    });
  }, [calc, sessionType]);

  // This runs when the screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (!calc.isRestored || calc.mode !== 'init') {
        return;
      }

      // Always reset startTime and forcedFinishTime for init mode to refresh based on current time
      const newStartTime = getAutoStartTime();
      const newForcedFinishTime = getAutoForcedFinishTime(newStartTime);
      calc.updateState({
        startTime: newStartTime,
        forcedFinishTime: newForcedFinishTime,
        mode: 'init'
      });

      // Clear finalized sessions
      if (calc.sessionStatus === 'finalized') {
        calc.clearState();
      }
    }, [calc.isRestored, calc.mode, calc.sessionStatus])
  );

  if (!calc.isRestored) {
    return null;
  }

  return (
    <View style={[
      styles.container,
      {
        backgroundColor: colors.background,
      },
    ]}>
      {calc.mode === "init" && (
        <Init
          changeMode={changeMode}
          calcUpdateState={calc.updateState}
          onStartSession={handleStartSession}
          setStartTime={(time) => calc.updateState({ startTime: time })}
          startTime={calc.startTime || getAutoStartTime()}
          forcedFinishTime={forcedFinishTime}
          setForcedFinishTime={setForcedFinishTime}
          sessionType={sessionType}
          initialPickingSubsection={calc.subsection}
        />
      )}

      {(calc.mode === "working" || calc.mode === "paused") && (
        sessionType === 'picking' ? (
          <Picking
            changeMode={changeMode}
            sessionTime={calc.sessionTime}
            startTime={calc.startTime}
            endTime={calc.endTime}
            setSessionTime={(time) => calc.updateState({ sessionTime: time }, { persist: false })}
            setStartTime={(time) => calc.updateState({ startTime: time })}
            setEndTime={(time) => calc.updateState({ endTime: time })}
            forcedFinishTime={forcedFinishTime}
            setForcedFinishTime={setForcedFinishTime}
          />
        ) : (
          <TruckWorking
            changeMode={changeMode}
            sessionTime={calc.sessionTime}
            startTime={calc.startTime}
            endTime={calc.endTime}
            shopNum={calc.shopNum}
            gateNum={calc.gateNum}
            trailerNum={calc.trailerNum}
            setSessionTime={(time) => calc.updateState({ sessionTime: time }, { persist: false })}
            setStartTime={(time) => calc.updateState({ startTime: time })}
            setEndTime={(time) => calc.updateState({ endTime: time })}
            setShopNum={(num) => calc.updateState({ shopNum: num })}
            setGateNum={(num) => calc.updateState({ gateNum: num })}
            setTrailerNum={(num) => calc.updateState({ trailerNum: num })}
            setPalletsRate={() => { }}
            trucks={calc.trucks}
            setTrucks={(trucks) => calc.updateState({ trucks })}
            trucksHistory={calc.trucksHistory}
            setTrucksHistory={(history) => calc.updateState({ trucksHistory: history })}
            isPaused={calc.isPaused}
            setIsPaused={(paused) => calc.updateState({ isPaused: paused })}
            totalPausedTime={calc.totalPausedTime}
            setTotalPausedTime={(time) => calc.updateState({ totalPausedTime: time })}
            mode={calc.mode}
            forcedFinishTime={forcedFinishTime}
            setForcedFinishTime={setForcedFinishTime}
          />
        )
      )}

      {calc.mode === "results" && (
        sessionType === 'picking' ? (
          <PickingResults
            sessionTime={calc.sessionTime}
            startTime={calc.startTime}
            endTime={calc.endTime}
            boxesCount={calc.boxesCount}
            ordersCount={calc.ordersCount}
            subsection={calc.subsection}
            boxesRateGoal={calc.boxesRateGoal}
            pickingSubsectionGoals={calc.pickingSubsectionGoals}
            pickingSubsectionStats={calc.pickingSubsectionStats}
          />
        ) : (
          <Results
            sessionTime={calc.sessionTime}
            startTime={calc.startTime}
            endTime={calc.endTime}
            trucksHistory={calc.trucksHistory}
          />
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
});
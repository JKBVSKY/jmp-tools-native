import React from 'react';
import { View, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Init from "./shared/Init";
import Working from "./Working";
import Results from "./shared/Results";
import { useCalculator } from "@/_context/CalculatorContext";
import { getAutoStartTime } from "./shared/utils";
import { useColors } from '@/_hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAutoForcedFinishTime } from '@/_utils/timeUtils';

export default function Calculator() {
  const calc = useCalculator();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const forcedFinishTime = calc.forcedFinishTime;
  const setForcedFinishTime = (time) => calc.updateState({ forcedFinishTime: time });

  const changeMode = (newMode) => calc.updateState({ mode: newMode });

  // Helper function to check if startTime is from today
  const isStartTimeFromToday = (startTime) => {
    if (!startTime) return false;
    const startDate = new Date(startTime);
    const today = new Date();
    return (
      startDate.getDate() === today.getDate() &&
      startDate.getMonth() === today.getMonth() &&
      startDate.getFullYear() === today.getFullYear()
    );
  };

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
          setStartTime={(time) => calc.updateState({ startTime: time })}
          startTime={calc.startTime || getAutoStartTime()}
          forcedFinishTime={forcedFinishTime}
          setForcedFinishTime={setForcedFinishTime}
        />
      )}

      {(calc.mode === "working" || calc.mode === "paused") && (
        <Working
          changeMode={changeMode}
          loadingTime={calc.loadingTime}
          startTime={calc.startTime}
          endTime={calc.endTime}
          shopNum={calc.shopNum}
          gateNum={calc.gateNum}
          trailerNum={calc.trailerNum}
          setLoadingTime={(time) => calc.updateState({ loadingTime: time })}
          setStartTime={(time) => calc.updateState({ startTime: time })}
          setEndTime={(time) => calc.updateState({ endTime: time })}
          setShopNum={(num) => calc.updateState({ shopNum: num })}
          setGateNum={(num) => calc.updateState({ gateNum: num })}
          setTrailerNum={(num) => calc.updateState({ trailerNum: num })}
          setPalletsRate={() => { }} // placeholder
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
      )}

      {calc.mode === "results" && (
        <Results
          loadingTime={calc.loadingTime}
          startTime={calc.startTime}
          endTime={calc.endTime}
          trucksHistory={calc.trucksHistory}
        />
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
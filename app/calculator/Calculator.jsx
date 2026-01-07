import React, { useState, useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Init from "./Init";
import Working from "./Working";
import Results from "./Results";
import { useCalculator } from "../../_context/CalculatorContext";
import { getAutoStartTime } from "./utils";

export default function Calculator() {
  const [mode, setMode] = useState("init"); // State to manage current mode
  const calc = useCalculator();
  const changeMode = (newMode) => setMode(newMode);
  const [forcedFinishTime, setForcedFinishTime] = useState(null);

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

      // Check if startTime is from today
      if (!isStartTimeFromToday(calc.startTime)) {
        const newStartTime = getAutoStartTime();
        calc.updateState({
          startTime: newStartTime,
          mode: 'init'
        });
      }
    }, [calc.isRestored, calc.mode, calc.startTime])
  );

  if (!calc.isRestored) {
    return null;
  }

  return (
    <View style={styles.container}>
      {calc.mode === "init" && (
        <Init
          changeMode={(newMode) => calc.updateState({ mode: newMode })}
          setStartTime={(time) => calc.updateState({ startTime: time })}
          startTime={calc.startTime || getAutoStartTime()}
          forcedFinishTime={forcedFinishTime}
          setForcedFinishTime={setForcedFinishTime}
        />
      )}

      {(calc.mode === "working" || calc.mode === "paused") && (
        <Working
          changeMode={(newMode) => calc.updateState({ mode: newMode })}
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
          changeMode={(newMode) => calc.updateState({ mode: newMode })}
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
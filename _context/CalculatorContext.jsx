import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CalculatorContext = createContext();

export function CalculatorProvider({ children }) {
  const [state, setState] = useState({
    mode: 'init',
    startTime: null,
    endTime: null,
    loadingTime: 0,
    totalPausedTime: 0,
    isPaused: false,
    pauseStart: null,
    trucks: [],
    trucksHistory: [],
    nextTruckId: 1,
    shopNum: 0,
    gateNum: 0,
    trailerNum: 0,
    isRestored: false, // Track if we've restored from storage
  });

  // Save state to AsyncStorage
  const saveState = async (newState) => {
    try {
      await AsyncStorage.setItem('calculatorState', JSON.stringify(newState));
    } catch (error) {
      console.error('Failed to save calculator state:', error);
    }
  };

  // Restore state from AsyncStorage
  const restoreState = async () => {
    try {
      const savedState = await AsyncStorage.getItem('calculatorState');
      if (savedState) {
        const parsedState = JSON.parse(savedState);
        setState(prev => ({ ...parsedState, isRestored: true }));
        return parsedState;
      }
      setState(prev => ({ ...prev, isRestored: true }));
    } catch (error) {
      console.error('Failed to restore calculator state:', error);
      setState(prev => ({ ...prev, isRestored: true }));
    }
  };

  // Clear calculator state (after saving results)
  const clearState = async () => {
    try {
      await AsyncStorage.removeItem('calculatorState');
      setState({
        mode: 'init',
        startTime: null,
        endTime: null,
        loadingTime: 0,
        totalPausedTime: 0,
        isPaused: false,
        pauseStart: null,
        trucks: [],
        trucksHistory: [],
        nextTruckId: 1,
        shopNum: 0,
        gateNum: 0,
        trailerNum: 0,
        isRestored: true,
      });
    } catch (error) {
      console.error('Failed to clear calculator state:', error);
    }
  };

  // Update state and auto-save
  const updateState = (updates) => {
    setState(prev => {
      const newState = { ...prev, ...updates };
      saveState(newState);
      return newState;
    });
  };

  // Restore state on mount
  useEffect(() => {
    restoreState();
  }, []);

  const value = {
    ...state,
    updateState,
    restoreState,
    clearState,
  };

  return (
    <CalculatorContext.Provider value={value}>
      {children}
    </CalculatorContext.Provider>
  );
}

export function useCalculator() {
  const context = useContext(CalculatorContext);
  if (!context) {
    throw new Error('useCalculator must be used within CalculatorProvider');
  }
  return context;
}

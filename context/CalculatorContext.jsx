import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CalculatorContext = createContext();

export function CalculatorProvider({ children, storageKey = 'calculatorState', type = 'truck-loading' }) {
  const getInitialState = (sessionType = type) => ({
    mode: 'init',
    startTime: null,
    endTime: null,
    sessionTime: 0,
    totalPausedTime: 0,
    isPaused: false,
    pauseStart: null,
    trucks: [],
    trucksHistory: [],
    nextTruckId: 1,
    shopNum: 0,
    gateNum: 0,
    trailerNum: 0,
    forcedFinishTime: null,
    sessionStatus: 'active',
    sessionType,
    // Picking-specific state
    subsection: '',
    boxesCount: 0,
    ordersCount: 0,
    boxesRateGoal: 0,
    pickingSubsectionGoals: {},
    pickingSubsectionStats: {},
    activePickingSubsection: null,
    activePickingStartedAt: null,
    isRestored: false,
  });

  const normalizeStateShape = (rawState = {}) => {
    const next = { ...rawState };

    if (typeof next.sessionTime !== 'number') {
      next.sessionTime = Number(next.loadingTime) || 0;
    }

    if ('loadingTime' in next) {
      delete next.loadingTime;
    }

    if (!next.pickingSubsectionStats || typeof next.pickingSubsectionStats !== 'object' || Array.isArray(next.pickingSubsectionStats)) {
      next.pickingSubsectionStats = {};
    }

    if (!next.pickingSubsectionGoals || typeof next.pickingSubsectionGoals !== 'object' || Array.isArray(next.pickingSubsectionGoals)) {
      next.pickingSubsectionGoals = {};
    }

    if (!('activePickingSubsection' in next)) {
      next.activePickingSubsection = null;
    }

    if (!('activePickingStartedAt' in next)) {
      next.activePickingStartedAt = null;
    }

    return next;
  };

  const [state, setState] = useState({
    ...getInitialState(type),
  });


  // Save state to AsyncStorage
  const saveState = async (newState) => {
    try {
      await AsyncStorage.setItem(storageKey, JSON.stringify(newState));
    } catch (error) {
      console.error('Failed to save calculator state:', error);
    }
  };

  // Restore state from AsyncStorage
  const restoreState = async () => {
    try {
      const savedState = await AsyncStorage.getItem(storageKey);
      if (savedState) {
        const parsedState = JSON.parse(savedState);
        const normalized = normalizeStateShape(parsedState);
        setState(prev => ({ ...prev, ...normalized, isRestored: true }));
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
      await AsyncStorage.removeItem(storageKey);
      setState(prev => ({
        ...getInitialState(prev.sessionType || type),
        sessionStatus: 'cleared',
        isRestored: true,
      }));
    } catch (error) {
      console.error('Failed to clear calculator state:', error);
    }
  };

  // Update state and auto-save
  const updateState = (updates) => {
    setState(prev => {
      const normalizedUpdates = { ...updates };
      if ('loadingTime' in normalizedUpdates && !('sessionTime' in normalizedUpdates)) {
        normalizedUpdates.sessionTime = normalizedUpdates.loadingTime;
      }
      if ('loadingTime' in normalizedUpdates) {
        delete normalizedUpdates.loadingTime;
      }

      const newState = { ...prev, ...normalizedUpdates };
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

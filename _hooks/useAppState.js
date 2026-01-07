// _hooks/useAppState.js
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';// The hook will now accept callbacks as arguments
export const useAppState = ({ onForeground, onBackground }) => {
  // We use a ref to hold the callbacks. This is the key to avoiding stale closures.
  const callbacks = useRef({ onForeground, onBackground });

  // Update the ref's current value on every render to ensure it has the latest callbacks.
  useEffect(() => {
    callbacks.current = { onForeground, onBackground };
  }, [onForeground, onBackground]);

  useEffect(() => {
    // Keep track of the previous state to detect changes.
    let previousAppState = AppState.currentState;

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      // Logic to run when the app comes to the foreground.
      if (
        previousAppState.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // Call the onForeground function from the ref.
        if (callbacks.current.onForeground) {
          callbacks.current.onForeground();
        }
      }
      // Logic to run when the app goes into the background.
      else if (
        previousAppState === 'active' &&
        nextAppState.match(/inactive|background/)
      ) {
        // Call the onBackground function from the ref.
        if (callbacks.current.onBackground) {
          callbacks.current.onBackground();
        }
      }

      // Update the previous state for the next change event.
      previousAppState = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []); // The empty dependency array is correct here, as the ref handles updates.
};

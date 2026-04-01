import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

export const useAppState = ({ onForeground, onBackground }) => {
  const callbacks = useRef({ onForeground, onBackground });

  useEffect(() => {
    callbacks.current = { onForeground, onBackground };
  }, [onForeground, onBackground]);

  useEffect(() => {
    // MOBILE: Use AppState
    if (Platform.OS !== 'web') {
      let previousAppState = AppState.currentState;

      const subscription = AppState.addEventListener('change', (nextAppState) => {
        if (
          previousAppState.match(/inactive|background/) &&
          nextAppState === 'active'
        ) {
          callbacks.current.onForeground?.();
        } else if (
          previousAppState === 'active' &&
          nextAppState.match(/inactive|background/)
        ) {
          callbacks.current.onBackground?.();
        }
        previousAppState = nextAppState;
      });

      return () => subscription.remove();
    }

    // WEB: Use Page Visibility API
    const handleVisibilityChange = () => {
      if (document.hidden) {
        callbacks.current.onBackground?.();
      } else {
        callbacks.current.onForeground?.();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
};
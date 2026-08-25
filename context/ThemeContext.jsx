import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { StorageManager } from '../utils/StorageManager';

const ThemeContext = createContext();

const THEME_STORAGE_KEY = 'theme_mode';

export const ThemeProvider = ({ children }) => {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState('light');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const stored = await StorageManager.getItem(THEME_STORAGE_KEY);
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setThemeModeState(stored);
        } else {
          setThemeModeState('light');
        }
      } catch (error) {
        console.error('Failed to load theme mode:', error);
        setThemeModeState('light');
      } finally {
        setIsLoaded(true);
      }
    };
    loadTheme();
  }, []);

  const setThemeMode = async (mode) => {
    if (mode === 'light' || mode === 'dark' || mode === 'system') {
      setThemeModeState(mode);
      try {
        await StorageManager.setItem(THEME_STORAGE_KEY, mode);
      } catch (error) {
        console.error('Failed to save theme mode:', error);
      }
    }
  };

  const toggleTheme = () => {
    const nextMode = themeMode === 'dark' ? 'light' : 'dark';
    setThemeMode(nextMode);
  };

  let resolvedTheme = 'light';
  if (themeMode === 'system') {
    resolvedTheme = systemScheme === 'dark' ? 'dark' : 'light';
  } else if (themeMode === 'dark') {
    resolvedTheme = 'dark';
  } else {
    resolvedTheme = 'light';
  }

  return (
    <ThemeContext.Provider
      value={{
        theme: resolvedTheme,
        themeMode,
        setThemeMode,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useThemeContext = () => useContext(ThemeContext);

export default ThemeContext;

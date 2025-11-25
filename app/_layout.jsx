import 'react-native-gesture-handler';

import { Stack, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '../_context/AuthContext';
import { ThemeProvider } from '../_context/ThemeContext';
import { UserProfileProvider } from '../_context/UserProfileContext';
import { useUserProfile } from '../_context/UserProfileContext';
import { useEffect, useRef, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { CalculatorProvider } from '../_context/CalculatorContext';
import * as NavigationBar from 'expo-navigation-bar';
import { Colors } from '../constants/Colors';
import { useThemeContext } from '../_context/ThemeContext';
import { AppState, View } from 'react-native';
import { PendingXPService } from '../services/PendingXPService';
import { XPEarnedNotification } from '../components/XPEarnedNotification';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

SplashScreen.preventAutoHideAsync();

// this is _layout from root/app/_layout.jsx
function RootLayoutNav() {
  const { user, isLoading, authLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const { theme } = useThemeContext();
  const { awardXP, isLoading: profileLoading, profile } = useUserProfile(); // ✅ Get profileLoading
  const appStateRef = useRef(AppState.currentState);

  // ✅ NEW: Toast notification state
  const [showXPNotification, setShowXPNotification] = useState(false);
  const [earnedXP, setEarnedXP] = useState(0);

  // ✅ NEW: Flag to prevent duplicate syncs
  const hasInitialSyncedRef = useRef(false);
  const isSyncingRef = useRef(false);

  // Listen for app state changes to sync pending XP
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [profileLoading, authLoading, awardXP, user]);

const handleAppStateChange = async (nextAppState) => {
  if (
    appStateRef.current.match(/inactive|background/) &&
    nextAppState === 'active'
  ) {
    console.log('🔄 App came to foreground...');

    if (profileLoading || authLoading || !user || !awardXP) {
      appStateRef.current = nextAppState;
      return;
    }

    try {
      // ✅ NEW: Check for cached XP first
      const pending = await PendingXPService.getPendingActions();
      const unsyncedXP = pending
        .filter(a => !a.isSynced)
        .reduce((sum, a) => sum + a.xpAmount, 0);

      if (unsyncedXP > 0) {
        console.log(`👻 Found ${unsyncedXP} XP from cache - syncing...`);
        const result = await PendingXPService.syncPendingXP(awardXP);
        if (result && result.synced > 0) {
          console.log(`✅ Synced cached XP: +${result.totalXP}`);
        }
      }

      // ✅ Then check for offline XP
      if (profile && profile.offlineXP > 0) {
        console.log(`💤 Found ${profile.offlineXP} XP from offline`);
        const result = await awardXP(profile.offlineXP);
        if (result) {
          const userRef = doc(db, 'users', profile.userId);
          await updateDoc(userRef, { offlineXP: 0 });
          console.log(`✅ Offline XP awarded: +${profile.offlineXP}`);
          setEarnedXP(profile.offlineXP);
          setShowXPNotification(true);
        }
      }
    } catch (error) {
      console.error('❌ Error syncing on foreground:', error);
    }
  }

  appStateRef.current = nextAppState;
};


// ✅ ONLY sync offline XP (not pending cached XP)
useEffect(() => {
  if (profileLoading || authLoading) {
    return;
  }

  if (!user || !user.id || !awardXP || !profile) {
    return;
  }

  if (hasInitialSyncedRef.current) {
    return;
  }

  console.log('✅ Checking for offline XP...');
  syncOfflineXP();
}, [profileLoading, authLoading, user, awardXP, profile]);

const syncOfflineXP = async () => {
  try {
    isSyncingRef.current = true;

    if (!profile) {
      hasInitialSyncedRef.current = true;
      return;
    }

    // ✅ ONLY check for offline XP (earned while app was closed)
    if (profile.offlineXP && profile.offlineXP > 0) {
      console.log(`💤 Found ${profile.offlineXP} XP earned while offline!`);

      const result = await awardXP(profile.offlineXP);
      if (result) {
        // Clear offline XP
        const userRef = doc(db, 'users', profile.userId);
        await updateDoc(userRef, { offlineXP: 0 });

        console.log(`✅ Offline XP awarded: +${profile.offlineXP}`);
        setEarnedXP(profile.offlineXP);
        setShowXPNotification(true);
      }
    } else {
      console.log('✅ No offline XP');
    }

    hasInitialSyncedRef.current = true;
  } catch (error) {
    console.warn('⚠️ Sync failed:', error);
    hasInitialSyncedRef.current = true;
  } finally {
    isSyncingRef.current = false;
  }
};

  // Set navigation bar color when theme changes
  useEffect(() => {
    const setNavBar = async () => {
      try {
        const navBarColor = Colors[theme].background;
        await NavigationBar.setBackgroundColorAsync(navBarColor);
        await NavigationBar.setButtonStyleAsync(theme === 'dark' ? 'light' : 'dark');
      } catch (error) {
        console.log('Navigation bar customization not supported on this device');
      }
    };
    setNavBar();
  }, [theme]);

  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!user && !inAuthGroup) {
      router.replace('/(auth)/welcome');
    } else if (user && inAuthGroup) {
      router.replace('/(app)');
    }
    SplashScreen.hideAsync();
  }, [user, segments, isLoading]);

  return (
    <View style={{ flex: 1 }}>
      {/* ✅ Notification Toast */}
      <XPEarnedNotification
        xpAmount={earnedXP}
        visible={showXPNotification}
        onDismiss={() => setShowXPNotification(false)}
      />

      {/* Rest of layout */}
      <Stack
        screenOptions={{
          headerShown: false,
          animationEnabled: false,
        }}
      />
    </View>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <ThemeProvider>
          <UserProfileProvider>
            <CalculatorProvider>
              <RootLayoutNav />
            </CalculatorProvider>
          </UserProfileProvider>
        </ThemeProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
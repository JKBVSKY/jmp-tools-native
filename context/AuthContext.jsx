import { createContext, useContext, useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  getReactNativePersistence,
  createUserWithEmailAndPassword,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  deleteUser,
} from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore, doc, deleteDoc, collection, getDocs, writeBatch, setDoc } from 'firebase/firestore';
import { StorageManager } from '../utils/StorageManager';
import { clearUserPushTokenAsync } from '../services/NotificationService';

// Initialize Firebase
const firebaseConfig = {
  apiKey: 'AIzaSyBuNnY9wCtU18GidGUYxURm9lTIRM1uXws',
  authDomain: 'jmp-tools.firebaseapp.com',
  projectId: 'jmp-tools',
  storageBucket: 'jmp-tools.firebasestorage.app',
  messagingSenderId: '401798516907',
  appId: '1:401798516907:web:8ba9bfd393e01c84c6e7ee',
  measurementId: 'G-MSZZN9T73R',
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// IMPORTANT: different init for web vs native
let auth;

if (Platform.OS === 'web') {
  // Web bundle of firebase/auth has its own persistence implementation
  auth = getAuth(app);
} else {
  // Native: use AsyncStorage persistence
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage),
  });
}

export const db = getFirestore(app);

const AuthContext = createContext({});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  const signUp = async (email, password, name) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      // Update user profile with name
      await updateProfile(firebaseUser, { displayName: name });

      // Create initial profile in Firestore
      const userRef = doc(db, 'users', firebaseUser.uid);
      const newProfile = {
        userId: firebaseUser.uid,
        displayName: name || '',
        name: name || '',
        email: email || '',
        level: 1,
        totalXP: 0,
        achievements: [],
        stats: {
          totalTimeWorked: 0,
          palletsLoaded: 0,
          palletsLoadedInSession: 0,
          totalSessions: 0,
          bestScore: 0,
          totalScore: 0,
        },
        lastPalletsUpdateDate: new Date().toDateString(),
        createdAt: new Date().toISOString(),
      };
      await setDoc(userRef, newProfile);

      const userData = {
        id: firebaseUser.uid,
        email: firebaseUser.email,
        name: name,
        isGuest: false,
      };

      setUser(userData);
      setIsGuest(false);

      // Firebase automatically persists this login
      console.log('✅ User signed up and auto-logged in:', email);
      return { success: true };
    } catch (error) {
      let errorMessage = error.message;

      // Friendly error messages
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'Adres e-mail jest już używany. Spróbuj użyć innego adresu.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Hasło jest za słabe. Użyj co najmniej 6 znaków.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Nieprawidłowy adres e-mail.';
      }

      return { success: false, error: errorMessage };
    }
  };

  const signIn = async (email, password) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      const userData = {
        id: firebaseUser.uid,
        email: firebaseUser.email,
        name: firebaseUser.displayName || firebaseUser.email,
        isGuest: false,
      };

      setUser(userData);
      setIsGuest(false);

      // Firebase automatically persists this login
      console.log('✅ User signed in:', email);
      return { success: true };
    } catch (error) {
      let errorMessage = error.message;

      // Friendly error messages
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'Użytkownik nie został znaleziony. Sprawdź swoją pocztę e-mail.';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Niewłaściwe hasło. Spróbuj ponownie.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Nieprawidłowy adres e-mail.';
      }

      return { success: false, error: errorMessage };
    }
  };

  // KEY: This function checks if user is already logged in (persistent login)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          const userData = {
            id: firebaseUser.uid,
            email: firebaseUser.email,
            name: firebaseUser.displayName || firebaseUser.email || 'Gość',
            isGuest: firebaseUser.isAnonymous,
          };

          setUser(userData);
          setIsGuest(firebaseUser.isAnonymous);

          await StorageManager.setItem('user', JSON.stringify(userData));
          await StorageManager.setItem('isGuest', firebaseUser.isAnonymous ? 'true' : 'false');
        } else {
          setUser(null);
          setIsGuest(false);

          await StorageManager.removeItem('user');
          await StorageManager.removeItem('isGuest');
        }
      } catch (error) {
        console.error('Auth restore error:', error);
        setUser(null);
        setIsGuest(false);
      } finally {
        setIsLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const continueAsGuest = async () => {
    try {
      const userCredential = await signInAnonymously(auth);
      const firebaseUser = userCredential.user;

      const guestUser = {
        id: firebaseUser.uid,
        email: firebaseUser.email,
        name: firebaseUser.displayName || 'Gość',
        isGuest: true,
      };

      setUser(guestUser);
      setIsGuest(true);

      await StorageManager.setItem('user', JSON.stringify(guestUser));
      await StorageManager.setItem('isGuest', 'true');

      console.log('✅ Continuing as anonymous Firebase user:', firebaseUser.uid);
      return { success: true };
    } catch (error) {
      console.error('Error starting anonymous session:', error);
      return { success: false, error: error.message };
    }
  };

  const signOut = async () => {
    try {
      const currentUserId = user?.id;

      if (currentUserId) {
        try {
          await clearUserPushTokenAsync(currentUserId);
        } catch (error) {
          console.error('Failed to clear push token on sign out:', error);
        }
      }

      await firebaseSignOut(auth);
      setUser(null);
      setIsGuest(false);

      // Clear stored data
      await StorageManager.removeItem('isGuest');
      await StorageManager.removeItem('user');

      console.log('✅ Signed out');

      return { success: true };
    } catch (error) {
      console.error('Error signing out:', error);
      return { success: false, error: error.message };
    }
  };

  const deleteAccount = async () => {
    try {
      const currentUser = auth.currentUser;
      const currentUserId = user?.id || currentUser?.uid;

      if (!currentUserId) {
        return { success: false, error: 'Nie znaleziono aktywnej sesji użytkownika.' };
      }

      // 1. Delete Firestore data related to user
      try {
        const subcollections = ['scoreHistory', 'scheduleItems', 'palletMappings'];
        for (const subcol of subcollections) {
          const snapshot = await getDocs(collection(db, 'users', currentUserId, subcol));
          if (!snapshot.empty) {
            const batch = writeBatch(db);
            snapshot.docs.forEach((docItem) => {
              batch.delete(doc(db, 'users', currentUserId, subcol, docItem.id));
            });
            await batch.commit();
          }
        }

        // Delete main user document
        await deleteDoc(doc(db, 'users', currentUserId));
      } catch (firestoreError) {
        console.error('Error deleting user Firestore data:', firestoreError);
      }

      // 2. Clear push token
      try {
        await clearUserPushTokenAsync(currentUserId);
      } catch (error) {
        console.error('Failed to clear push token on account deletion:', error);
      }

      // 3. Delete Firebase Auth user
      if (currentUser) {
        await deleteUser(currentUser);
      }

      // 4. Reset local state and storage
      setUser(null);
      setIsGuest(false);
      await StorageManager.removeItem('isGuest');
      await StorageManager.removeItem('user');

      console.log('✅ Account and associated data deleted successfully');
      return { success: true };
    } catch (error) {
      console.error('Error deleting account:', error);
      if (error.code === 'auth/requires-recent-login') {
        return {
          success: false,
          error: 'Ta operacja wymaga ponownego zalogowania ze względów bezpieczeństwa. Zaloguj się ponownie i spróbuj jeszcze raz.',
        };
      }
      return { success: false, error: error.message || 'Nie udało się usunąć konta.' };
    }
  };

  const updateUserName = (newName) => {
    setUser((prev) =>
      prev
        ? {
          ...prev,
          name: newName,
        }
        : prev
    );
  };

  const value = {
    user,
    isLoading,
    isGuest,
    signIn,
    signUp,
    signOut,
    continueAsGuest,
    updateUserName,
    deleteAccount,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
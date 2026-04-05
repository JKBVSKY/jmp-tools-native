import { createContext, useContext, useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  getReactNativePersistence,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore } from 'firebase/firestore';
import { StorageManager } from '@/_utils/StorageManager';

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

const app = initializeApp(firebaseConfig);

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

  // KEY: Automatically check persistent login on app start
  useEffect(() => {
    loadSession();
  }, []);

  const signUp = async (email, password, name) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      // Update user profile with name
      await updateProfile(firebaseUser, { displayName: name });

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
  const loadSession = async () => {
    try {
      console.log('🔄 Checking for persistent login session...');
      // Firebase's onAuthStateChanged automatically handles persistent login
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          // User is logged in - Firebase automatically restored the session!
          const userData = {
            id: firebaseUser.uid,
            email: firebaseUser.email,
            name: firebaseUser.displayName || firebaseUser.email,
            isGuest: false,
          };

          setUser(userData);
          setIsGuest(false);

          // Also store in StorageManager for extra safety
          await StorageManager.setItem('user', JSON.stringify(userData));

          console.log('✅ User auto-logged in:', userData.email); // DEBUG
        } else {
          // Check if guest mode was saved
          const guestMode = await StorageManager.getItem('isGuest');

          if (guestMode === 'true') {
            const guestUser = {
              id: await StorageManager.getItem('guestId'),
              name: 'Gość',
              isGuest: true,
            };

            setUser(guestUser);
            setIsGuest(true);
            console.log('✅ Guest mode restored'); // DEBUG
          } else {
            console.log('❌ No user or guest session found'); // DEBUG
          }
        }

        setIsLoading(false);
      });

      return unsubscribe;
    } catch (error) {
      console.error('Error loading session:', error);
      setIsLoading(false);
    }
  };

  const continueAsGuest = async () => {
    const guestId = `guest_${Date.now()}`;
    const guestUser = {
      id: guestId,
      name: 'Gość',
      isGuest: true,
    };

    setUser(guestUser);
    setIsGuest(true);

    // Save guest mode
    await StorageManager.setItem('guestId', guestId);
    await StorageManager.setItem('isGuest', 'true');
    console.log('✅ Continuing as guest');
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setUser(null);
      setIsGuest(false);

      // Clear stored data
      await StorageManager.removeItem('guestId');
      await StorageManager.removeItem('isGuest');
      await StorageManager.removeItem('user');

      console.log('✅ Signed out');
      
      return { success: true };
    } catch (error) {
      console.error('Error signing out:', error);
      return { success: false, error: error.message };
    }
  };

  const value = {
    user,
    isLoading,
    isGuest,
    signIn,
    signUp,
    signOut,
    continueAsGuest,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
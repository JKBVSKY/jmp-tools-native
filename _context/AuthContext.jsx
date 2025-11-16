import { createContext, useContext, useState, useEffect } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';

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
const auth = getAuth(app);

const AuthContext = createContext({});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  // Load saved session on app start
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

      return { success: true };
    } catch (error) {
      let errorMessage = error.message;

      // Friendly error messages
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'Email already in use. Please try another email.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Use at least 6 characters.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address.';
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

      return { success: true };
    } catch (error) {
      let errorMessage = error.message;

      // Friendly error messages
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'User not found. Please check your email.';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password. Please try again.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address.';
      }

      return { success: false, error: errorMessage };
    }
  };

  const loadSession = async () => {
    try {
      // Check if user is logged in via Firebase
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          // User is logged in
          const userData = {
            id: firebaseUser.uid,
            email: firebaseUser.email,
            name: firebaseUser.displayName || firebaseUser.email,
            isGuest: false,
          };
          setUser(userData);
          setIsGuest(false);
        } else {
          // Check if guest mode was saved
          const guestMode = Platform.OS === 'web'
            ? localStorage.getItem('isGuest')
            : await SecureStore.getItemAsync('isGuest');

          if (guestMode === 'true') {
            const guestUser = {
              id: Platform.OS === 'web'
                ? localStorage.getItem('guestId')
                : await SecureStore.getItemAsync('guestId'),
              name: 'Guest User',
              isGuest: true,
            };
            setUser(guestUser);
            setIsGuest(true);
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
      name: 'Guest User',
      isGuest: true,
    };

    setUser(guestUser);
    setIsGuest(true);

    // Save guest mode
    if (Platform.OS === 'web') {
      localStorage.setItem('guestId', guestId);
      localStorage.setItem('isGuest', 'true');
    } else {
      await SecureStore.setItemAsync('guestId', guestId);
      await SecureStore.setItemAsync('isGuest', 'true');
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setUser(null);
      setIsGuest(false);

      if (Platform.OS === 'web') {
        localStorage.removeItem('guestId');
        localStorage.removeItem('isGuest');
      } else {
        await SecureStore.deleteItemAsync('guestId');
        await SecureStore.deleteItemAsync('isGuest');
      }
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isGuest,
        signIn,
        signUp,
        signOut,
        continueAsGuest,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

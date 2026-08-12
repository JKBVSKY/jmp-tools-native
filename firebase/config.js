import { getApp, getApps, initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

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
export const db = getFirestore(app);

export default app;

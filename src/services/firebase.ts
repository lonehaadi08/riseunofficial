import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence, getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyDXfLXB1GdOG8uZYSPwzOctkgJAlWX0GZA",
  authDomain: "digikashmiri.firebaseapp.com",
  projectId: "digikashmiri",
  storageBucket: "digikashmiri.firebasestorage.app",
  messagingSenderId: "788359622246",
  appId: "1:788359622246:web:0f89ad2600e95df13bc7a7"
};

export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// This setup properly persists your login state and silences the warning!
let authInstance;
if (getApps().length === 0) {
  authInstance = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
} else {
  authInstance = getAuth(app);
}

export const auth = authInstance;
export const db = getFirestore(app);
export const storage = getStorage(app);
/**
 * Firebase SDK initialization for VolunteerAI.
 * Reads all config from Vite environment variables — no hardcoded values.
 */
import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  collection,
  connectFirestoreEmulator,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Prevent duplicate app initialization during hot-reload
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const db = getFirestore(app);

// Use Firestore emulator in development if configured
if (import.meta.env.DEV && import.meta.env.VITE_USE_FIRESTORE_EMULATOR === 'true') {
  connectFirestoreEmulator(db, 'localhost', 8080);
}

/** Collection references — single source of truth for all Firestore paths */
export const COLLECTIONS = {
  zones: collection(db, 'zones'),
  alerts: collection(db, 'alerts'),
  translations: collection(db, 'translations'),
};

export default app;

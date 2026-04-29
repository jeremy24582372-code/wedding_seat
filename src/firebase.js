import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

// Firebase config — values injected from .env (VITE_ prefix required by Vite)
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL:       import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

/**
 * Guard against missing VITE_FIREBASE_DATABASE_URL (e.g. GitHub Secrets not set).
 * getDatabase() throws a FIREBASE FATAL ERROR when databaseURL is undefined,
 * which crashes the entire JS bundle and produces a white screen.
 * By exporting null here, all Firebase hooks detect the missing config and
 * fall back to local-only mode instead of crashing.
 */
let db = null;

if (firebaseConfig.databaseURL) {
  try {
    const app = initializeApp(firebaseConfig);
    db = getDatabase(app);
  } catch (err) {
    console.error('[firebase] Failed to initialise Firebase SDK:', err);
  }
} else {
  console.warn(
    '[firebase] VITE_FIREBASE_DATABASE_URL is not set — running in local-only mode.\n' +
    'Add the Firebase Secrets to GitHub repository settings to enable sync.'
  );
}

/** Realtime Database instance — null when Firebase is unconfigured */
export { db };

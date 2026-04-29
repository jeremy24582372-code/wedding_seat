import { useEffect, useCallback, useRef } from 'react';
import { ref, set, get, onValue, off } from 'firebase/database';
import { db } from '../firebase';

const FIREBASE_ROOT = 'wedding-seating';

/**
 * Low-level Firebase RTDB helpers.
 * Provides read, write, and real-time listener utilities for the seating app.
 */

/** Write the full app state to Firebase */
export async function saveStateToFirebase(state) {
  await set(ref(db, FIREBASE_ROOT), {
    guests:             state.guests,
    tables:             state.tables,
    tablePositions:     state.tablePositions ?? {},
    unassignedGuestIds: state.unassignedGuestIds ?? [],   // ← was missing, caused pool to vanish after Firebase sync
    lastSaved:          new Date().toISOString(),
  });
}

/** Read the full app state from Firebase once (non-reactive) */
export async function loadStateFromFirebase() {
  const snapshot = await get(ref(db, FIREBASE_ROOT));
  return snapshot.exists() ? snapshot.val() : null;
}

/**
 * Subscribe to real-time Firebase state changes.
 * @param {function} onStateChange  Called with the latest state on every change
 * @returns {function} unsubscribe function
 */
export function subscribeToState(onStateChange) {
  const stateRef = ref(db, FIREBASE_ROOT);
  onValue(stateRef, (snapshot) => {
    onStateChange(snapshot.exists() ? snapshot.val() : null);
  });
  return () => off(stateRef);
}

/**
 * Sync current seating state back to Google Sheets via Apps Script POST endpoint.
 * The Apps Script must expose a doPost() handler.
 *
 * @param {Object} state   Full app state (guests + tables)
 * @param {string} sheetsUrl  The Apps Script exec URL from VITE_SHEETS_URL
 * @returns {{ success: boolean, error?: string }}
 */
export async function syncToGoogleSheets(state, sheetsUrl) {
  if (!sheetsUrl) {
    return { success: false, error: '尚未設定 VITE_SHEETS_URL' };
  }

  // Build a lookup: tableId → tableLabel
  const tableLabelMap = {};
  (state.tables ?? []).forEach(t => { tableLabelMap[t.id] = t.label; });

  // Build payload: only sync manually-added guests back to Sheets.
  // Guests imported from Sheets (source === 'import') are skipped to avoid
  // overwriting the original spreadsheet data with potentially stale copies.
  const payload = (state.guests ?? [])
    .filter(g => g.source !== 'import')
    .map(g => ({
      name:       g.name,
      category:   g.category,
      diet:       g.diet || '',
      tableLabel: g.tableId ? (tableLabelMap[g.tableId] ?? '') : '',
    }));

  try {
    // Apps Script CORS workaround: use no-cors mode, no response body expected
    await fetch(sheetsUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'text/plain' }, // avoid preflight with text/plain
      body:    JSON.stringify(payload),
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * React hook: subscribes to Firebase state on mount, unsubscribes on unmount.
 * @param {function} onStateChange  Callback invoked with the latest Firebase state
 */
export function useFirebaseListener(onStateChange) {
  const callbackRef = useRef(onStateChange);
  callbackRef.current = onStateChange;

  useEffect(() => {
    const unsubscribe = subscribeToState((data) => callbackRef.current(data));
    return unsubscribe;
  }, []); // only run once — stableRef handles callback updates
}

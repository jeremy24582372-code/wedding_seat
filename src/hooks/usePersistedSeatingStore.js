import { useCallback, useEffect, useRef, useState } from 'react';
import { db } from '../firebase';
import { saveStateToFirebase, useFirebaseListener } from './useFirebase';
import { normalizeSeatingStateFromFirebase } from '../utils/seatingIntegrity';
import { AUTOSAVE_DEBOUNCE_MS, buildInitialState } from '../utils/seatingStateCore';

export function usePersistedSeatingStore() {
  const [state, setStateRaw] = useState(buildInitialState);
  const stateRef = useRef(state);
  const saveTimer = useRef(null);
  const pendingState = useRef(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const flushToFirebase = useCallback(() => {
    if (saveTimer.current && pendingState.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
      saveStateToFirebase(pendingState.current).catch(err =>
        console.error('[useSeatingState] Firebase flush failed:', err)
      );
      pendingState.current = null;
    }
  }, []);

  const scheduleFirebaseSave = useCallback((next) => {
    pendingState.current = next;

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveStateToFirebase(next).catch(err =>
        console.error('[useSeatingState] Firebase save failed:', err)
      );
      saveTimer.current = null;
      pendingState.current = null;
    }, AUTOSAVE_DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') flushToFirebase(); };
    const onUnload = () => flushToFirebase();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      flushToFirebase();
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [flushToFirebase]);

  const setState = useCallback((valueOrUpdater) => {
    const prev = stateRef.current;
    const next = typeof valueOrUpdater === 'function' ? valueOrUpdater(prev) : valueOrUpdater;

    if (Object.is(next, prev)) return next;

    stateRef.current = next;
    scheduleFirebaseSave(next);
    setStateRaw(next);
    return next;
  }, [scheduleFirebaseSave]);

  const [fbReady, setFbReady] = useState(() => !db);

  useFirebaseListener((fbData) => {
    if (!fbData) {
      setFbReady(true);
      return;
    }

    const localLastSaved = stateRef.current.lastSaved;
    const remoteLastSaved = fbData.lastSaved ?? null;
    if (
      localLastSaved &&
      remoteLastSaved &&
      new Date(remoteLastSaved) < new Date(localLastSaved)
    ) {
      setFbReady(true);
      return;
    }

    const nextState = normalizeSeatingStateFromFirebase(fbData);

    stateRef.current = nextState;
    setStateRaw(nextState);
    setFbReady(true);
  });

  return {
    state,
    stateRef,
    setState,
    fbReady,
  };
}

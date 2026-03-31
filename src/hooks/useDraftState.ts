import { useState, useEffect, useRef, useCallback } from 'react';
import { readDraft, writeDraft, clearDraft } from '@/lib/draftStorage';

interface UseDraftStateOptions<T> {
  key: string;
  version: number;
  /** Debounce interval in ms (default 800) */
  debounce?: number;
  /** Only restore if the draft passes this check */
  isValid?: (data: T) => boolean;
}

/**
 * Persists component state to IndexedDB/localStorage so progress
 * survives screen-off, app switch and page reload.
 *
 * Returns:
 *  - `state`: the current value
 *  - `setState`: setter (also triggers debounced persist)
 *  - `clearState`: wipes the draft
 *  - `restored`: true once initial load from storage is complete
 *  - `hadDraft`: true if a meaningful draft was found on mount
 */
export function useDraftState<T>(
  initialState: T | (() => T),
  options: UseDraftStateOptions<T>,
) {
  const { key, version, debounce = 800, isValid } = options;
  const [state, setStateRaw] = useState<T>(initialState);
  const [restored, setRestored] = useState(false);
  const [hadDraft, setHadDraft] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef<T>(state);
  const mountedRef = useRef(true);

  // Keep ref in sync
  stateRef.current = state;

  // ── Restore on mount ─────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    void readDraft<T>(key, version).then((draft) => {
      if (!active) return;
      if (draft && (!isValid || isValid(draft))) {
        setStateRaw(draft);
        setHadDraft(true);
      }
      setRestored(true);
    });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version]);

  // ── Save on visibility-hidden (screen off / app switch) ──────────
  useEffect(() => {
    const onVisChange = () => {
      if (document.visibilityState === 'hidden') {
        void writeDraft(key, stateRef.current, version);
      }
    };
    const onBeforeUnload = () => {
      void writeDraft(key, stateRef.current, version);
    };
    document.addEventListener('visibilitychange', onVisChange);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', onVisChange);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [key, version]);

  // ── Cleanup on unmount ───────────────────────────────────────────
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      // Persist one last time on unmount
      void writeDraft(key, stateRef.current, version);
    };
  }, [key, version]);

  // ── Debounced setter ─────────────────────────────────────────────
  const setState = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStateRaw((prev) => {
        const next = typeof value === 'function' ? (value as (prev: T) => T)(prev) : value;
        stateRef.current = next;

        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          void writeDraft(key, stateRef.current, version);
        }, debounce);

        return next;
      });
    },
    [key, version, debounce],
  );

  const clearState = useCallback(async () => {
    await clearDraft(key);
    setHadDraft(false);
  }, [key]);

  return { state, setState, clearState, restored, hadDraft } as const;
}

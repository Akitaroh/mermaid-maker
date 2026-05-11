/**
 * React hook wrapper for BoardPersistence.
 * 設計: ../../../50_Mission/MermaidMaker/Arrow-BoardPersistence.md
 */

import { useEffect, useRef, useState } from 'react';
import {
  createBoardPersistence,
  type BoardPersistence,
} from './board-persistence.js';
import type { BoardStore } from './board-store.js';

export type UseBoardPersistenceOptions = {
  store: BoardStore;
  sessionId: string | null;
  writeDebounceMs?: number;
};

export type UseBoardPersistenceResult = {
  /** True after the initial restore (or no-op when no session). */
  ready: boolean;
  /** True if state was actually loaded from storage. */
  restored: boolean;
};

export function useBoardPersistence({
  store,
  sessionId,
  writeDebounceMs,
}: UseBoardPersistenceOptions): UseBoardPersistenceResult {
  const [restored, setRestored] = useState(false);
  const [ready, setReady] = useState(false);
  const persistenceRef = useRef<BoardPersistence | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setReady(true);
      setRestored(false);
      return;
    }
    const p = createBoardPersistence({
      store,
      sessionId,
      writeDebounceMs,
    });
    persistenceRef.current = p;
    setRestored(p.restored);
    setReady(true);
    return () => {
      p.dispose();
      persistenceRef.current = null;
      setReady(false);
    };
  }, [store, sessionId, writeDebounceMs]);

  return { ready, restored };
}

/**
 * React hook for subscribing to BoardStore.
 * 設計: ../../../50_Mission/MermaidMaker/Atom-BoardStore.md
 */

import { useSyncExternalStore } from 'react';
import type { BoardStore, BoardStoreState } from './board-store.js';

export function useBoardStore<T>(
  store: BoardStore,
  selector: (state: BoardStoreState) => T
): T {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getState())
  );
}

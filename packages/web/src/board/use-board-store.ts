/**
 * React hooks for subscribing to BoardStore.
 *
 * IMPORTANT: useSyncExternalStore caches the result by referential equality.
 * If you pass an inline selector that builds a new object every call, you'll
 * trigger an infinite re-render loop. Use the dedicated narrow hooks below
 * (useBoardStoreState / useActiveBoardId / useActiveBoardText / useBoardList)
 * which return either the raw state reference or primitives.
 *
 * 設計: ../../../50_Mission/MermaidMaker/Atom-BoardStore.md
 */

import { useMemo, useSyncExternalStore } from 'react';
import type { BoardStore, BoardStoreState } from './board-store.js';

/** Subscribe to the entire state. Stable reference between notifications. */
export function useBoardStoreState(store: BoardStore): BoardStoreState {
  return useSyncExternalStore(
    store.subscribe,
    store.getState,
    store.getState
  );
}

/** Active board id, primitive — safe selector. */
export function useActiveBoardId(store: BoardStore): string | null {
  return useSyncExternalStore(
    store.subscribe,
    () => store.getState().activeBoardId,
    () => store.getState().activeBoardId
  );
}

/** Mermaid text of the currently active board (or '' if none). */
export function useActiveBoardText(store: BoardStore): string {
  return useSyncExternalStore(
    store.subscribe,
    () => {
      const s = store.getState();
      return s.activeBoardId
        ? (s.boards[s.activeBoardId]?.mermaid ?? '')
        : '';
    },
    () => {
      const s = store.getState();
      return s.activeBoardId
        ? (s.boards[s.activeBoardId]?.mermaid ?? '')
        : '';
    }
  );
}

/**
 * List of board ids (sorted insertion order). Returns the same reference when
 * the set of ids has not changed (identity-stable).
 */
export function useBoardList(store: BoardStore): string[] {
  const state = useBoardStoreState(store);
  return useMemo(
    () => Object.keys(state.boards),
    // boards object identity changes only when membership/content changes,
    // and we only care about ids. Re-derive when boards reference changes.
    [state.boards]
  );
}

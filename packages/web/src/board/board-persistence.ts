/**
 * Arrow-BoardPersistence
 *
 * Connect Atom-BoardStore ↔ window.localStorage (per-session key).
 * - On creation: read storage and replay into store via setAll
 * - On store change: debounced write to storage
 *
 * 設計: ../../../50_Mission/MermaidMaker/Arrow-BoardPersistence.md
 */

import type { BoardStore } from './board-store.js';

const STORAGE_PREFIX = 'mm_session_';
const SCHEMA_VERSION = 1;

type StoredShape = {
  version: number;
  boards: Record<string, string>;
  activeBoardId: string | null;
};

export type BoardPersistenceOptions = {
  store: BoardStore;
  sessionId: string;
  /** debounce ms for outgoing localStorage writes (default 500) */
  writeDebounceMs?: number;
  /** Override for tests */
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  timers?: {
    setTimeout: typeof setTimeout;
    clearTimeout: typeof clearTimeout;
  };
};

export type BoardPersistence = {
  dispose(): void;
  /** Returns true if anything was loaded from storage at construction. */
  restored: boolean;
};

function storageKey(sessionId: string): string {
  return `${STORAGE_PREFIX}${sessionId}`;
}

export function createBoardPersistence(
  opts: BoardPersistenceOptions
): BoardPersistence {
  const debounceMs = opts.writeDebounceMs ?? 500;
  const storage =
    opts.storage ??
    (typeof window !== 'undefined' ? window.localStorage : undefined);
  const _setTimeout = opts.timers?.setTimeout ?? setTimeout;
  const _clearTimeout = opts.timers?.clearTimeout ?? clearTimeout;
  const key = storageKey(opts.sessionId);

  let restored = false;
  let disposed = false;
  let pendingTimer: ReturnType<typeof setTimeout> | null = null;

  // ─── Restore on construction ───────────────────────────────────────
  if (storage) {
    try {
      const raw = storage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as StoredShape;
        if (parsed && parsed.version === SCHEMA_VERSION && parsed.boards) {
          opts.store.setAll(parsed.boards, parsed.activeBoardId ?? null);
          restored = true;
        }
      }
    } catch (e) {
      console.warn('[BoardPersistence] failed to restore:', e);
    }
  }

  // ─── Subscribe and write on change ─────────────────────────────────
  function flushWrite() {
    if (disposed || !storage) return;
    pendingTimer = null;
    try {
      const state = opts.store.getState();
      const shape: StoredShape = {
        version: SCHEMA_VERSION,
        boards: Object.fromEntries(
          Object.values(state.boards).map((b) => [b.id, b.mermaid])
        ),
        activeBoardId: state.activeBoardId,
      };
      storage.setItem(key, JSON.stringify(shape));
    } catch (e) {
      console.warn('[BoardPersistence] failed to write:', e);
    }
  }

  function scheduleWrite() {
    if (disposed) return;
    if (pendingTimer) _clearTimeout(pendingTimer);
    pendingTimer = _setTimeout(flushWrite, debounceMs);
  }

  const unsubscribe = opts.store.subscribe(() => {
    if (disposed) return;
    scheduleWrite();
  });

  return {
    restored,
    dispose() {
      if (disposed) return;
      disposed = true;
      unsubscribe();
      if (pendingTimer) {
        _clearTimeout(pendingTimer);
        pendingTimer = null;
      }
    },
  };
}

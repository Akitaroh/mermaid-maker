/**
 * Arrow-SessionBridge
 *
 * Connect Atom-WSClient ↔ Atom-BoardStore.
 * - server msg → store update
 * - store change → debounced send (with loop suppression)
 *
 * 設計: ../../../50_Mission/MermaidMaker/Arrow-SessionBridge.md
 */

import type { WSClient } from '../ws/ws-client.js';
import type { BoardStore } from '../board/board-store.js';

export type SessionBridgeOptions = {
  client: WSClient;
  store: BoardStore;
  /** debounce ms for outgoing update_board (default 300) */
  outgoingDebounceMs?: number;
  /** Override timer functions for testing */
  timers?: {
    setTimeout: typeof setTimeout;
    clearTimeout: typeof clearTimeout;
  };
};

export type SessionBridge = {
  dispose(): void;
};

export function createSessionBridge(opts: SessionBridgeOptions): SessionBridge {
  const debounceMs = opts.outgoingDebounceMs ?? 300;
  const _setTimeout = opts.timers?.setTimeout ?? setTimeout;
  const _clearTimeout = opts.timers?.clearTimeout ?? clearTimeout;

  // Per-board "last value we saw originating from server".
  // Used to suppress echoing the same value back as update_board.
  const lastSeenFromServer = new Map<string, string>();
  const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();
  let disposed = false;

  // ─── Incoming: server → store ──────────────────────────────────────
  const unsubscribeMsg = opts.client.onServerMessage((msg) => {
    if (disposed) return;
    switch (msg.type) {
      case 'set_board':
      case 'create_board':
        lastSeenFromServer.set(msg.boardId, msg.mermaid);
        opts.store.upsertBoard(msg.boardId, msg.mermaid);
        break;
      case 'focus_board':
        opts.store.setActive(msg.boardId);
        break;
      case 'sync_request': {
        const state = opts.store.getState();
        const boardsRecord: Record<string, string> = {};
        for (const [id, b] of Object.entries(state.boards)) {
          boardsRecord[id] = b.mermaid;
          // Treat server-known snapshot as "seen from server" so the
          // immediate following store notification doesn't echo back.
          lastSeenFromServer.set(id, b.mermaid);
        }
        opts.client.send({
          type: 'sync_state',
          boards: boardsRecord,
          activeBoardId: state.activeBoardId,
        });
        break;
      }
      default: {
        // Exhaustiveness check — shape changes will trip the compiler
        const _: never = msg;
        void _;
      }
    }
  });

  // ─── Outgoing: store → server ──────────────────────────────────────
  // Schedule a debounced send for boardId. The actual mermaid value is
  // re-read from the store at fire time (debounce coalesces rapid changes).
  function scheduleSend(boardId: string) {
    const existing = pendingTimers.get(boardId);
    if (existing) _clearTimeout(existing);
    const t = _setTimeout(() => {
      pendingTimers.delete(boardId);
      const fresh = opts.store.getState().boards[boardId];
      if (!fresh) return;
      if (lastSeenFromServer.get(boardId) === fresh.mermaid) return;
      opts.client.send({
        type: 'update_board',
        boardId,
        mermaid: fresh.mermaid,
      });
      lastSeenFromServer.set(boardId, fresh.mermaid);
    }, debounceMs);
    pendingTimers.set(boardId, t);
  }

  const unsubscribeStore = opts.store.subscribe(() => {
    if (disposed) return;
    const { boards } = opts.store.getState();
    for (const [id, board] of Object.entries(boards)) {
      // Skip boards whose current value matches what server gave us last.
      if (lastSeenFromServer.get(id) === board.mermaid) continue;
      scheduleSend(id);
    }
  });

  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      unsubscribeMsg();
      unsubscribeStore();
      for (const t of pendingTimers.values()) _clearTimeout(t);
      pendingTimers.clear();
      lastSeenFromServer.clear();
    },
  };
}

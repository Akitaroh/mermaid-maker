/**
 * Atom-BoardStore
 *
 * Session 内に複数 Board（= Mermaid テキスト1枚）を保持する observable store。
 * 設計: ../../../50_Mission/MermaidMaker/Atom-BoardStore.md
 */

export type Board = {
  id: string;
  mermaid: string;
};

export type BoardStoreState = {
  boards: Record<string, Board>;
  activeBoardId: string | null;
};

export type BoardStore = {
  getState(): BoardStoreState;
  subscribe(listener: () => void): () => void;
  upsertBoard(id: string, mermaid: string): void;
  removeBoard(id: string): void;
  setActive(id: string): void;
  setAll(boards: Record<string, string>, activeId: string | null): void;
};

export function createBoardStore(initial?: BoardStoreState): BoardStore {
  let state: BoardStoreState = initial ?? {
    boards: {},
    activeBoardId: null,
  };
  const listeners = new Set<() => void>();

  function notify() {
    for (const l of listeners) {
      try {
        l();
      } catch (e) {
        console.error('[BoardStore] listener error:', e);
      }
    }
  }

  return {
    getState() {
      return state;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    upsertBoard(id, mermaid) {
      const existing = state.boards[id];
      if (existing && existing.mermaid === mermaid) {
        // No-op for identical content (avoid React re-render)
        return;
      }
      const isNew = !existing;
      state = {
        boards: { ...state.boards, [id]: { id, mermaid } },
        activeBoardId:
          state.activeBoardId === null && isNew ? id : state.activeBoardId,
      };
      notify();
    },

    removeBoard(id) {
      if (!state.boards[id]) return;
      const { [id]: _removed, ...rest } = state.boards;
      let newActive = state.activeBoardId;
      if (state.activeBoardId === id) {
        const remaining = Object.keys(rest);
        newActive = remaining.length > 0 ? remaining[0]! : null;
      }
      state = { boards: rest, activeBoardId: newActive };
      notify();
    },

    setActive(id) {
      if (!state.boards[id]) {
        console.warn('[BoardStore] setActive: unknown board id:', id);
        return;
      }
      if (state.activeBoardId === id) return;
      state = { ...state, activeBoardId: id };
      notify();
    },

    setAll(boards, activeId) {
      const newBoards: Record<string, Board> = {};
      for (const [id, mermaid] of Object.entries(boards)) {
        newBoards[id] = { id, mermaid };
      }
      const validActive =
        activeId !== null && newBoards[activeId] ? activeId : null;
      state = { boards: newBoards, activeBoardId: validActive };
      notify();
    },
  };
}

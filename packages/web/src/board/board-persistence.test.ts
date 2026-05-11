import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBoardPersistence } from './board-persistence.js';
import { createBoardStore } from './board-store.js';

function memStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    raw: map,
  };
}

describe('createBoardPersistence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('restores from storage when key exists with valid JSON', () => {
    const storage = memStorage();
    storage.raw.set(
      'mm_session_abc',
      JSON.stringify({
        version: 1,
        boards: { deps: 'graph LR\nA-->B' },
        activeBoardId: 'deps',
      })
    );
    const store = createBoardStore();
    const p = createBoardPersistence({
      store,
      sessionId: 'abc',
      storage,
    });
    expect(p.restored).toBe(true);
    expect(store.getState()).toEqual({
      boards: { deps: { id: 'deps', mermaid: 'graph LR\nA-->B' } },
      activeBoardId: 'deps',
    });
  });

  it('skips restore when key does not exist', () => {
    const storage = memStorage();
    const store = createBoardStore();
    const p = createBoardPersistence({
      store,
      sessionId: 'abc',
      storage,
    });
    expect(p.restored).toBe(false);
    expect(store.getState()).toEqual({ boards: {}, activeBoardId: null });
  });

  it('skips restore when stored JSON is invalid', () => {
    const storage = memStorage();
    storage.raw.set('mm_session_abc', '{not json{');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const store = createBoardStore();
    const p = createBoardPersistence({ store, sessionId: 'abc', storage });
    expect(p.restored).toBe(false);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('skips restore when version mismatches', () => {
    const storage = memStorage();
    storage.raw.set(
      'mm_session_abc',
      JSON.stringify({ version: 999, boards: { x: 'g' }, activeBoardId: 'x' })
    );
    const store = createBoardStore();
    const p = createBoardPersistence({ store, sessionId: 'abc', storage });
    expect(p.restored).toBe(false);
    expect(store.getState().boards).toEqual({});
  });

  it('writes to storage on store change after debounce', async () => {
    const storage = memStorage();
    const store = createBoardStore();
    createBoardPersistence({
      store,
      sessionId: 'abc',
      storage,
      writeDebounceMs: 100,
    });
    store.upsertBoard('deps', 'g1');
    expect(storage.raw.get('mm_session_abc')).toBeUndefined();
    await vi.advanceTimersByTimeAsync(100);
    const written = JSON.parse(storage.raw.get('mm_session_abc')!);
    expect(written).toEqual({
      version: 1,
      boards: { deps: 'g1' },
      activeBoardId: 'deps',
    });
  });

  it('debounces multiple rapid changes into one write', async () => {
    const storage = memStorage();
    const store = createBoardStore();
    createBoardPersistence({
      store,
      sessionId: 'abc',
      storage,
      writeDebounceMs: 100,
    });
    const writeSpy = vi.spyOn(storage, 'setItem');
    store.upsertBoard('deps', 'g1');
    store.upsertBoard('deps', 'g2');
    store.upsertBoard('deps', 'g3');
    await vi.advanceTimersByTimeAsync(100);
    expect(writeSpy).toHaveBeenCalledTimes(1);
    const written = JSON.parse(storage.raw.get('mm_session_abc')!);
    expect(written.boards).toEqual({ deps: 'g3' });
  });

  it('persists multiple boards', async () => {
    const storage = memStorage();
    const store = createBoardStore();
    createBoardPersistence({
      store,
      sessionId: 'abc',
      storage,
      writeDebounceMs: 50,
    });
    store.upsertBoard('a', 'ga');
    store.upsertBoard('b', 'gb');
    store.setActive('b');
    await vi.advanceTimersByTimeAsync(50);
    const written = JSON.parse(storage.raw.get('mm_session_abc')!);
    expect(written).toEqual({
      version: 1,
      boards: { a: 'ga', b: 'gb' },
      activeBoardId: 'b',
    });
  });

  it('round-trip: write then re-mount restores same state', async () => {
    const storage = memStorage();
    // Phase 1: write
    const a = createBoardStore();
    const aP = createBoardPersistence({
      store: a,
      sessionId: 'abc',
      storage,
      writeDebounceMs: 50,
    });
    a.upsertBoard('deps', 'graph LR\nA-->B');
    await vi.advanceTimersByTimeAsync(50);
    aP.dispose();

    // Phase 2: re-mount and restore
    const b = createBoardStore();
    const bP = createBoardPersistence({
      store: b,
      sessionId: 'abc',
      storage,
    });
    expect(bP.restored).toBe(true);
    expect(b.getState().boards.deps?.mermaid).toBe('graph LR\nA-->B');
  });

  it('different sessionId uses different storage keys', async () => {
    const storage = memStorage();
    const a = createBoardStore();
    const b = createBoardStore();
    createBoardPersistence({
      store: a,
      sessionId: 'aaa',
      storage,
      writeDebounceMs: 50,
    });
    createBoardPersistence({
      store: b,
      sessionId: 'bbb',
      storage,
      writeDebounceMs: 50,
    });
    a.upsertBoard('x', 'A');
    b.upsertBoard('x', 'B');
    await vi.advanceTimersByTimeAsync(50);
    expect(storage.raw.has('mm_session_aaa')).toBe(true);
    expect(storage.raw.has('mm_session_bbb')).toBe(true);
    expect(storage.raw.get('mm_session_aaa')).not.toBe(
      storage.raw.get('mm_session_bbb')
    );
  });

  it('dispose stops further writes', async () => {
    const storage = memStorage();
    const store = createBoardStore();
    const p = createBoardPersistence({
      store,
      sessionId: 'abc',
      storage,
      writeDebounceMs: 50,
    });
    store.upsertBoard('a', 'g');
    await vi.advanceTimersByTimeAsync(50);
    expect(storage.raw.size).toBe(1);
    p.dispose();
    store.upsertBoard('b', 'g2');
    await vi.advanceTimersByTimeAsync(100);
    // Storage should still only have the value before dispose.
    const written = JSON.parse(storage.raw.get('mm_session_abc')!);
    expect(written.boards).toEqual({ a: 'g' });
  });

  it('dispose clears pending write timer', async () => {
    const storage = memStorage();
    const store = createBoardStore();
    const p = createBoardPersistence({
      store,
      sessionId: 'abc',
      storage,
      writeDebounceMs: 100,
    });
    store.upsertBoard('a', 'g');
    p.dispose();
    await vi.advanceTimersByTimeAsync(100);
    expect(storage.raw.size).toBe(0);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { createBoardStore } from './board-store.js';

describe('BoardStore', () => {
  it('starts with empty boards and null active', () => {
    const s = createBoardStore();
    expect(s.getState()).toEqual({ boards: {}, activeBoardId: null });
  });

  it('upsertBoard adds a new board and sets it active when no active exists', () => {
    const s = createBoardStore();
    s.upsertBoard('deps', 'graph LR\nA-->B');
    expect(s.getState()).toEqual({
      boards: { deps: { id: 'deps', mermaid: 'graph LR\nA-->B' } },
      activeBoardId: 'deps',
    });
  });

  it('subsequent upsertBoard does NOT change activeBoardId', () => {
    const s = createBoardStore();
    s.upsertBoard('deps', 'g');
    s.upsertBoard('arch', 'g2');
    expect(s.getState().activeBoardId).toBe('deps');
    expect(Object.keys(s.getState().boards)).toEqual(['deps', 'arch']);
  });

  it('upsertBoard with same content is a no-op (no notify)', () => {
    const s = createBoardStore();
    s.upsertBoard('a', 'g');
    const listener = vi.fn();
    s.subscribe(listener);
    s.upsertBoard('a', 'g');
    expect(listener).not.toHaveBeenCalled();
  });

  it('upsertBoard updates existing board content and notifies', () => {
    const s = createBoardStore();
    s.upsertBoard('a', 'g');
    const listener = vi.fn();
    s.subscribe(listener);
    s.upsertBoard('a', 'g2');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(s.getState().boards['a']!.mermaid).toBe('g2');
  });

  it('setActive switches active and notifies', () => {
    const s = createBoardStore();
    s.upsertBoard('a', 'g');
    s.upsertBoard('b', 'g2');
    const listener = vi.fn();
    s.subscribe(listener);
    s.setActive('b');
    expect(s.getState().activeBoardId).toBe('b');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('setActive with same id is a no-op', () => {
    const s = createBoardStore();
    s.upsertBoard('a', 'g');
    const listener = vi.fn();
    s.subscribe(listener);
    s.setActive('a');
    expect(listener).not.toHaveBeenCalled();
  });

  it('setActive with unknown id warns and is a no-op', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const s = createBoardStore();
    s.upsertBoard('a', 'g');
    s.setActive('ghost');
    expect(s.getState().activeBoardId).toBe('a');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('removeBoard drops board and reassigns active when needed', () => {
    const s = createBoardStore();
    s.upsertBoard('a', 'g');
    s.upsertBoard('b', 'g2');
    s.removeBoard('a');
    expect(s.getState().boards).toEqual({ b: { id: 'b', mermaid: 'g2' } });
    expect(s.getState().activeBoardId).toBe('b');
  });

  it('removeBoard last board sets active to null', () => {
    const s = createBoardStore();
    s.upsertBoard('a', 'g');
    s.removeBoard('a');
    expect(s.getState()).toEqual({ boards: {}, activeBoardId: null });
  });

  it('removeBoard non-active does not change active', () => {
    const s = createBoardStore();
    s.upsertBoard('a', 'g');
    s.upsertBoard('b', 'g2');
    s.removeBoard('b');
    expect(s.getState().activeBoardId).toBe('a');
  });

  it('removeBoard unknown id is silent no-op', () => {
    const s = createBoardStore();
    expect(() => s.removeBoard('ghost')).not.toThrow();
  });

  it('setAll replaces everything wholesale', () => {
    const s = createBoardStore();
    s.upsertBoard('old', 'x');
    s.setAll({ deps: 'g1', arch: 'g2' }, 'arch');
    expect(s.getState()).toEqual({
      boards: {
        deps: { id: 'deps', mermaid: 'g1' },
        arch: { id: 'arch', mermaid: 'g2' },
      },
      activeBoardId: 'arch',
    });
  });

  it('setAll with invalid activeId falls back to null', () => {
    const s = createBoardStore();
    s.setAll({ a: 'g' }, 'ghost');
    expect(s.getState().activeBoardId).toBeNull();
  });

  it('setAll triggers exactly one notification', () => {
    const s = createBoardStore();
    const listener = vi.fn();
    s.subscribe(listener);
    s.setAll({ a: 'g', b: 'g2' }, 'a');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('subscribe returns an unsubscribe function', () => {
    const s = createBoardStore();
    const listener = vi.fn();
    const unsub = s.subscribe(listener);
    s.upsertBoard('a', 'g');
    expect(listener).toHaveBeenCalledTimes(1);
    unsub();
    s.upsertBoard('b', 'g2');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('listener throwing does not break others', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const s = createBoardStore();
    const good = vi.fn();
    s.subscribe(() => {
      throw new Error('boom');
    });
    s.subscribe(good);
    s.upsertBoard('a', 'g');
    expect(good).toHaveBeenCalled();
    err.mockRestore();
  });
});

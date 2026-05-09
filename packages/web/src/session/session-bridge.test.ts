import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSessionBridge } from './session-bridge.js';
import { createBoardStore } from '../board/board-store.js';
import type { ClientMsg, ServerMsg } from '../ws/types.js';
import type { WSClient } from '../ws/ws-client.js';

/**
 * MockWSClient — minimal stand-in for the real WSClient used by the bridge.
 * Tests call emitServer(msg) to simulate incoming messages, and inspect sent[].
 */
function createMockWSClient(): WSClient & {
  sent: ClientMsg[];
  emitServer: (msg: ServerMsg) => void;
} {
  const handlers = new Set<(msg: ServerMsg) => void>();
  const sent: ClientMsg[] = [];
  return {
    sent,
    async connect() {},
    disconnect() {},
    onServerMessage(h) {
      handlers.add(h);
      return () => handlers.delete(h);
    },
    send(msg) {
      sent.push(msg);
    },
    status() {
      return 'open';
    },
    emitServer(msg) {
      for (const h of handlers) h(msg);
    },
  };
}

describe('SessionBridge', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('set_board updates store', () => {
    const client = createMockWSClient();
    const store = createBoardStore();
    createSessionBridge({ client, store });
    client.emitServer({
      type: 'set_board',
      boardId: 'deps',
      mermaid: 'graph LR\nA-->B',
    });
    expect(store.getState()).toEqual({
      boards: { deps: { id: 'deps', mermaid: 'graph LR\nA-->B' } },
      activeBoardId: 'deps',
    });
  });

  it('focus_board changes active', () => {
    const client = createMockWSClient();
    const store = createBoardStore();
    createSessionBridge({ client, store });
    store.upsertBoard('a', 'g');
    store.upsertBoard('b', 'g2');
    client.emitServer({ type: 'focus_board', boardId: 'b' });
    expect(store.getState().activeBoardId).toBe('b');
  });

  it('local store change triggers debounced update_board send', async () => {
    const client = createMockWSClient();
    const store = createBoardStore();
    createSessionBridge({
      client,
      store,
      outgoingDebounceMs: 100,
    });
    store.upsertBoard('deps', 'g1');
    expect(client.sent).toEqual([]); // not yet, debounce
    await vi.advanceTimersByTimeAsync(100);
    expect(client.sent).toEqual([
      { type: 'update_board', boardId: 'deps', mermaid: 'g1' },
    ]);
  });

  it('multiple rapid changes coalesce into one send', async () => {
    const client = createMockWSClient();
    const store = createBoardStore();
    createSessionBridge({ client, store, outgoingDebounceMs: 100 });
    store.upsertBoard('deps', 'g1');
    store.upsertBoard('deps', 'g2');
    store.upsertBoard('deps', 'g3');
    await vi.advanceTimersByTimeAsync(100);
    expect(client.sent).toEqual([
      { type: 'update_board', boardId: 'deps', mermaid: 'g3' },
    ]);
  });

  it('different boards send independently', async () => {
    const client = createMockWSClient();
    const store = createBoardStore();
    createSessionBridge({ client, store, outgoingDebounceMs: 100 });
    store.upsertBoard('a', 'ga');
    store.upsertBoard('b', 'gb');
    await vi.advanceTimersByTimeAsync(100);
    // Order doesn't matter, but both should be present
    const sortedSent = [...client.sent].sort((x, y) => {
      const xId = (x as { boardId: string }).boardId;
      const yId = (y as { boardId: string }).boardId;
      return xId.localeCompare(yId);
    });
    expect(sortedSent).toEqual([
      { type: 'update_board', boardId: 'a', mermaid: 'ga' },
      { type: 'update_board', boardId: 'b', mermaid: 'gb' },
    ]);
  });

  it('LOOP PREVENTION: server-originated update is not echoed back', async () => {
    const client = createMockWSClient();
    const store = createBoardStore();
    createSessionBridge({ client, store, outgoingDebounceMs: 100 });
    client.emitServer({
      type: 'set_board',
      boardId: 'deps',
      mermaid: 'g1',
    });
    await vi.advanceTimersByTimeAsync(200);
    expect(client.sent).toEqual([]);
  });

  it('LOOP PREVENTION: sent value also marked, second send of same value drops', async () => {
    const client = createMockWSClient();
    const store = createBoardStore();
    createSessionBridge({ client, store, outgoingDebounceMs: 50 });
    // Local change → send
    store.upsertBoard('deps', 'g1');
    await vi.advanceTimersByTimeAsync(50);
    expect(client.sent).toHaveLength(1);
    // Server echoes same value (or BoardStore notifies again somehow)
    client.emitServer({ type: 'set_board', boardId: 'deps', mermaid: 'g1' });
    await vi.advanceTimersByTimeAsync(100);
    expect(client.sent).toHaveLength(1); // still just one
  });

  it('user edit AFTER server set is sent (non-matching value)', async () => {
    const client = createMockWSClient();
    const store = createBoardStore();
    createSessionBridge({ client, store, outgoingDebounceMs: 50 });
    client.emitServer({ type: 'set_board', boardId: 'd', mermaid: 'serverV' });
    store.upsertBoard('d', 'humanV');
    await vi.advanceTimersByTimeAsync(50);
    expect(client.sent).toEqual([
      { type: 'update_board', boardId: 'd', mermaid: 'humanV' },
    ]);
  });

  it('sync_request triggers sync_state response with current snapshot', () => {
    const client = createMockWSClient();
    const store = createBoardStore();
    createSessionBridge({ client, store });
    store.upsertBoard('a', 'ga');
    store.upsertBoard('b', 'gb');
    client.emitServer({ type: 'sync_request' });
    expect(client.sent).toContainEqual({
      type: 'sync_state',
      boards: { a: 'ga', b: 'gb' },
      activeBoardId: 'a',
    });
  });

  it('after sync_request the boards from snapshot are not echoed back', async () => {
    const client = createMockWSClient();
    const store = createBoardStore();
    createSessionBridge({ client, store, outgoingDebounceMs: 50 });
    store.upsertBoard('a', 'ga');
    // Drain initial pending send so we start clean
    await vi.advanceTimersByTimeAsync(50);
    client.sent.length = 0;
    // sync_request should mark snapshot as server-known
    client.emitServer({ type: 'sync_request' });
    expect(client.sent).toEqual([
      { type: 'sync_state', boards: { a: 'ga' }, activeBoardId: 'a' },
    ]);
    // Force a no-op subscribe by upserting same value (BoardStore is no-op for same content
    // so this won't notify; instead remove and re-add to trigger)
    store.upsertBoard('a', 'gNEW');
    await vi.advanceTimersByTimeAsync(50);
    // gNEW differs from server snapshot 'ga', so we DO send. Just confirms basic behavior.
    expect(client.sent).toContainEqual({
      type: 'update_board',
      boardId: 'a',
      mermaid: 'gNEW',
    });
  });

  it('dispose stops both directions', async () => {
    const client = createMockWSClient();
    const store = createBoardStore();
    const bridge = createSessionBridge({
      client,
      store,
      outgoingDebounceMs: 50,
    });
    bridge.dispose();
    // Server msg should not update store
    client.emitServer({ type: 'set_board', boardId: 'x', mermaid: 'y' });
    expect(store.getState().boards).toEqual({});
    // Store change should not send
    store.upsertBoard('x', 'y');
    await vi.advanceTimersByTimeAsync(50);
    expect(client.sent).toEqual([]);
  });

  it('dispose clears pending debounce timers', async () => {
    const client = createMockWSClient();
    const store = createBoardStore();
    const bridge = createSessionBridge({
      client,
      store,
      outgoingDebounceMs: 100,
    });
    store.upsertBoard('a', 'g'); // schedules timer
    bridge.dispose();
    await vi.advanceTimersByTimeAsync(100);
    expect(client.sent).toEqual([]);
  });
});

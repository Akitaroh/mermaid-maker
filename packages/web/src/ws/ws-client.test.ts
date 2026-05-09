// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWSClient } from './ws-client.js';
import type { ServerMsg } from './types.js';

/**
 * MockWebSocket — minimal stand-in for the browser WebSocket API.
 * Tests drive the connection lifecycle by calling triggerOpen/Message/Close manually.
 */
class MockWebSocket {
  static instances: MockWebSocket[] = [];

  url: string;
  readyState = 0; // CONNECTING
  onopen: (() => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  sent: string[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close(_code?: number, _reason?: string) {
    this.readyState = 3; // CLOSED
    queueMicrotask(() => {
      this.onclose?.(new CloseEvent('close', { wasClean: true, code: 1000 }));
    });
  }

  triggerOpen() {
    this.readyState = 1;
    this.onopen?.();
  }

  triggerMessage(data: unknown) {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(data) }));
  }

  triggerRawMessage(raw: string) {
    this.onmessage?.(new MessageEvent('message', { data: raw }));
  }

  triggerClose(wasClean = false) {
    this.readyState = 3;
    this.onclose?.(new CloseEvent('close', { wasClean, code: 1006 }));
  }
}

describe('WSClient', () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('connect resolves on open and reaches "open" status', async () => {
    const client = createWSClient({
      url: 'ws://localhost:1234',
      sessionId: 'sess1',
      WebSocketImpl: MockWebSocket as unknown as typeof WebSocket,
    });
    const p = client.connect();
    expect(client.status()).toBe('connecting');
    MockWebSocket.instances[0]!.triggerOpen();
    await p;
    expect(client.status()).toBe('open');
  });

  it('builds URL with session query param', () => {
    const client = createWSClient({
      url: 'ws://localhost:1234',
      sessionId: 'abc 123',
      WebSocketImpl: MockWebSocket as unknown as typeof WebSocket,
    });
    void client.connect();
    expect(MockWebSocket.instances[0]!.url).toBe(
      'ws://localhost:1234?session=abc%20123'
    );
  });

  it('dispatches parsed ServerMsg to registered handlers', async () => {
    const client = createWSClient({
      url: 'ws://x',
      sessionId: 's',
      WebSocketImpl: MockWebSocket as unknown as typeof WebSocket,
    });
    const received: ServerMsg[] = [];
    client.onServerMessage((msg) => received.push(msg));
    const p = client.connect();
    MockWebSocket.instances[0]!.triggerOpen();
    await p;
    MockWebSocket.instances[0]!.triggerMessage({
      type: 'set_board',
      boardId: 'deps',
      mermaid: 'graph LR\nA-->B',
    });
    expect(received).toEqual([
      { type: 'set_board', boardId: 'deps', mermaid: 'graph LR\nA-->B' },
    ]);
  });

  it('ignores invalid JSON without throwing', async () => {
    const client = createWSClient({
      url: 'ws://x',
      sessionId: 's',
      WebSocketImpl: MockWebSocket as unknown as typeof WebSocket,
    });
    const received: ServerMsg[] = [];
    client.onServerMessage((msg) => received.push(msg));
    const p = client.connect();
    MockWebSocket.instances[0]!.triggerOpen();
    await p;
    expect(() =>
      MockWebSocket.instances[0]!.triggerRawMessage('not json{')
    ).not.toThrow();
    expect(received).toEqual([]);
  });

  it('unsubscribe removes handler', async () => {
    const client = createWSClient({
      url: 'ws://x',
      sessionId: 's',
      WebSocketImpl: MockWebSocket as unknown as typeof WebSocket,
    });
    const received: ServerMsg[] = [];
    const unsub = client.onServerMessage((msg) => received.push(msg));
    const p = client.connect();
    MockWebSocket.instances[0]!.triggerOpen();
    await p;
    unsub();
    MockWebSocket.instances[0]!.triggerMessage({
      type: 'sync_request',
    });
    expect(received).toEqual([]);
  });

  it('one handler throwing does not block others', async () => {
    const client = createWSClient({
      url: 'ws://x',
      sessionId: 's',
      WebSocketImpl: MockWebSocket as unknown as typeof WebSocket,
    });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const received: ServerMsg[] = [];
    client.onServerMessage(() => {
      throw new Error('boom');
    });
    client.onServerMessage((msg) => received.push(msg));
    const p = client.connect();
    MockWebSocket.instances[0]!.triggerOpen();
    await p;
    MockWebSocket.instances[0]!.triggerMessage({ type: 'sync_request' });
    expect(received).toEqual([{ type: 'sync_request' }]);
    errSpy.mockRestore();
  });

  it('send serializes and pushes through socket when open', async () => {
    const client = createWSClient({
      url: 'ws://x',
      sessionId: 's',
      WebSocketImpl: MockWebSocket as unknown as typeof WebSocket,
    });
    const p = client.connect();
    MockWebSocket.instances[0]!.triggerOpen();
    await p;
    client.send({
      type: 'update_board',
      boardId: 'deps',
      mermaid: 'graph LR\nA-->B',
    });
    expect(MockWebSocket.instances[0]!.sent).toEqual([
      JSON.stringify({
        type: 'update_board',
        boardId: 'deps',
        mermaid: 'graph LR\nA-->B',
      }),
    ]);
  });

  it('send while not open is dropped (no throw)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const client = createWSClient({
      url: 'ws://x',
      sessionId: 's',
      WebSocketImpl: MockWebSocket as unknown as typeof WebSocket,
    });
    expect(() =>
      client.send({ type: 'update_board', boardId: 'a', mermaid: '' })
    ).not.toThrow();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('reconnects on unclean close with backoff', async () => {
    const client = createWSClient({
      url: 'ws://x',
      sessionId: 's',
      WebSocketImpl: MockWebSocket as unknown as typeof WebSocket,
      initialReconnectDelayMs: 100,
      maxReconnectDelayMs: 1000,
    });
    const p = client.connect();
    MockWebSocket.instances[0]!.triggerOpen();
    await p;

    // Server drops connection unexpectedly
    MockWebSocket.instances[0]!.triggerClose(false);
    expect(client.status()).toBe('connecting');
    expect(MockWebSocket.instances).toHaveLength(1);

    // After 100ms, reconnect attempt #1
    await vi.advanceTimersByTimeAsync(100);
    expect(MockWebSocket.instances).toHaveLength(2);
    MockWebSocket.instances[1]!.triggerOpen();
    expect(client.status()).toBe('open');

    // Drop again, attempt #2 with 200ms (initial * 2^1 since attempt counter
    // was reset on successful open then incremented on this drop)
    MockWebSocket.instances[1]!.triggerClose(false);
    await vi.advanceTimersByTimeAsync(100);
    expect(MockWebSocket.instances).toHaveLength(3);
  });

  it('disconnect prevents further reconnect', async () => {
    const client = createWSClient({
      url: 'ws://x',
      sessionId: 's',
      WebSocketImpl: MockWebSocket as unknown as typeof WebSocket,
      initialReconnectDelayMs: 50,
    });
    const p = client.connect();
    MockWebSocket.instances[0]!.triggerOpen();
    await p;

    client.disconnect();
    expect(client.status()).toBe('closed');

    // Even if more time passes, no new instance
    await vi.advanceTimersByTimeAsync(1000);
    expect(MockWebSocket.instances).toHaveLength(1);
  });
});

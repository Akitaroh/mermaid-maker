/**
 * Atom-WSClient
 *
 * MM タブが MCP server と双方向同期するための WebSocket クライアント。
 * 設計: ../../../50_Mission/MermaidMaker/Atom-WSClient.md
 */

import type { ClientMsg, ServerMsg, WSStatus } from './types.js';

export type WSClientOptions = {
  url: string;
  sessionId: string;
  /** Override for tests — defaults to global WebSocket */
  WebSocketImpl?: typeof WebSocket;
  /** Initial reconnect delay in ms (default 1000) */
  initialReconnectDelayMs?: number;
  /** Max reconnect delay in ms (default 30000) */
  maxReconnectDelayMs?: number;
};

export type WSClient = {
  connect(): Promise<void>;
  disconnect(): void;
  onServerMessage(handler: (msg: ServerMsg) => void): () => void;
  send(msg: ClientMsg): void;
  status(): WSStatus;
};

export function createWSClient(opts: WSClientOptions): WSClient {
  const WS = opts.WebSocketImpl ?? globalThis.WebSocket;
  const fullUrl = `${opts.url}?session=${encodeURIComponent(opts.sessionId)}`;
  const initialDelay = opts.initialReconnectDelayMs ?? 1000;
  const maxDelay = opts.maxReconnectDelayMs ?? 30000;

  let ws: WebSocket | null = null;
  let currentStatus: WSStatus = 'closed';
  let reconnectAttempt = 0;
  let intentionallyClosed = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  const handlers = new Set<(msg: ServerMsg) => void>();

  function setStatus(s: WSStatus) {
    currentStatus = s;
  }

  function dispatch(msg: ServerMsg) {
    for (const h of handlers) {
      try {
        h(msg);
      } catch (e) {
        // Don't let one handler break others
        console.error('[WSClient] handler error:', e);
      }
    }
  }

  function clearReconnectTimer() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function scheduleReconnect() {
    if (intentionallyClosed) return;
    clearReconnectTimer();
    const delay = Math.min(
      initialDelay * Math.pow(2, reconnectAttempt),
      maxDelay
    );
    reconnectAttempt += 1;
    setStatus('connecting');
    reconnectTimer = setTimeout(() => {
      void connectInternal();
    }, delay);
  }

  function connectInternal(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        setStatus('connecting');
        ws = new WS(fullUrl);
      } catch (e) {
        setStatus('closed');
        scheduleReconnect();
        reject(e);
        return;
      }

      ws.onopen = () => {
        setStatus('open');
        reconnectAttempt = 0;
        resolve();
      };

      ws.onmessage = (ev: MessageEvent) => {
        let parsed: ServerMsg;
        try {
          parsed = JSON.parse(String(ev.data));
        } catch (e) {
          console.error('[WSClient] invalid JSON:', ev.data);
          return;
        }
        dispatch(parsed);
      };

      ws.onerror = () => {
        // onclose will follow; handle reconnect there.
      };

      ws.onclose = (ev: CloseEvent) => {
        setStatus('closed');
        ws = null;
        if (!intentionallyClosed && !ev.wasClean) {
          scheduleReconnect();
        }
      };
    });
  }

  return {
    async connect() {
      intentionallyClosed = false;
      reconnectAttempt = 0;
      await connectInternal();
    },
    disconnect() {
      intentionallyClosed = true;
      clearReconnectTimer();
      if (ws) {
        try {
          ws.close(1000, 'client disconnect');
        } catch {
          // ignore
        }
      }
      ws = null;
      setStatus('closed');
    },
    onServerMessage(handler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    send(msg) {
      if (!ws || currentStatus !== 'open') {
        console.warn('[WSClient] send while not open, dropping message:', msg);
        return;
      }
      ws.send(JSON.stringify(msg));
    },
    status() {
      return currentStatus;
    },
  };
}

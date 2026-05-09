/**
 * React hook wrapper for SessionBridge.
 *
 * Connects WSClient + BoardStore for the lifetime of the calling component
 * when a sessionId is present; otherwise no-op.
 *
 * 設計: ../../../50_Mission/MermaidMaker/Arrow-SessionBridge.md
 */

import { useEffect, useState } from 'react';
import { createWSClient } from '../ws/ws-client.js';
import type { WSStatus } from '../ws/types.js';
import { createSessionBridge } from './session-bridge.js';
import type { BoardStore } from '../board/board-store.js';

export type UseSessionBridgeOptions = {
  /** Base ws url, e.g. ws://localhost:7331 */
  url: string;
  sessionId: string | null;
  store: BoardStore;
  outgoingDebounceMs?: number;
};

export type UseSessionBridgeResult = {
  status: WSStatus;
  sessionId: string | null;
};

export function useSessionBridge({
  url,
  sessionId,
  store,
  outgoingDebounceMs,
}: UseSessionBridgeOptions): UseSessionBridgeResult {
  const [status, setStatus] = useState<WSStatus>('closed');

  useEffect(() => {
    if (!sessionId) {
      setStatus('closed');
      return;
    }
    const client = createWSClient({ url, sessionId });
    const bridge = createSessionBridge({
      client,
      store,
      outgoingDebounceMs,
    });
    setStatus('connecting');
    let cancelled = false;
    void client
      .connect()
      .then(() => {
        if (!cancelled) setStatus('open');
      })
      .catch(() => {
        if (!cancelled) setStatus('closed');
      });
    return () => {
      cancelled = true;
      bridge.dispose();
      client.disconnect();
      setStatus('closed');
    };
  }, [url, sessionId, store, outgoingDebounceMs]);

  return { status, sessionId };
}

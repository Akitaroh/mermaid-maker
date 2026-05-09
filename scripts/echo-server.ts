/**
 * Phase 5.4 動作検証用の最小 echo server.
 *
 * NOT the production WSRelay (Phase 6 で実装する @akitaroh/mermaid-mcp の中身).
 * 2タブ間の同期検証だけが目的。MCPプロトコルは話さない。
 *
 * 実装:
 *   - port (default 7331) で WebSocket server を立てる
 *   - クライアントは ?session=xxx で接続
 *   - 同 session の他クライアントへ broadcast:
 *     - update_board → set_board に変換して broadcast
 *     - sync_state   → 各 board を set_board で broadcast
 *   - 新規接続時は session のキャッシュを set_board で初期投入
 *
 * Usage:
 *   pnpm echo                # default port 7331
 *   PORT=9000 pnpm echo
 */

import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'node:http';

const PORT = Number(process.env.PORT ?? 7331);

type SessionState = {
  clients: Set<WebSocket>;
  boards: Map<string, string>;
  activeBoardId: string | null;
};

const sessions = new Map<string, SessionState>();

function getSession(id: string): SessionState {
  let s = sessions.get(id);
  if (!s) {
    s = { clients: new Set(), boards: new Map(), activeBoardId: null };
    sessions.set(id, s);
  }
  return s;
}

function broadcast(
  session: SessionState,
  except: WebSocket,
  payload: unknown
) {
  const data = JSON.stringify(payload);
  for (const c of session.clients) {
    if (c === except) continue;
    if (c.readyState === c.OPEN) c.send(data);
  }
}

function parseSessionId(req: IncomingMessage): string | null {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const id = url.searchParams.get('session');
  if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) return null;
  return id;
}

const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (ws, req) => {
  const sessionId = parseSessionId(req);
  if (!sessionId) {
    console.warn('[echo] reject: missing/invalid session');
    ws.close(1008, 'missing session');
    return;
  }
  const session = getSession(sessionId);
  session.clients.add(ws);
  console.log(
    `[echo] connect session=${sessionId} clients=${session.clients.size}`
  );

  // Seed the new client with whatever we have cached.
  for (const [boardId, mermaid] of session.boards) {
    ws.send(JSON.stringify({ type: 'set_board', boardId, mermaid }));
  }
  if (session.activeBoardId) {
    ws.send(
      JSON.stringify({ type: 'focus_board', boardId: session.activeBoardId })
    );
  }

  ws.on('message', (raw) => {
    let msg: unknown;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      console.warn('[echo] invalid JSON dropped');
      return;
    }
    if (typeof msg !== 'object' || msg === null || !('type' in msg)) return;
    const m = msg as { type: string; [k: string]: unknown };

    if (m.type === 'update_board' && typeof m.boardId === 'string' &&
        typeof m.mermaid === 'string') {
      session.boards.set(m.boardId, m.mermaid);
      if (!session.activeBoardId) session.activeBoardId = m.boardId;
      broadcast(session, ws, {
        type: 'set_board',
        boardId: m.boardId,
        mermaid: m.mermaid,
      });
    } else if (m.type === 'sync_state' && typeof m.boards === 'object' &&
               m.boards !== null) {
      const incoming = m.boards as Record<string, string>;
      for (const [bid, mermaid] of Object.entries(incoming)) {
        session.boards.set(bid, mermaid);
        broadcast(session, ws, { type: 'set_board', boardId: bid, mermaid });
      }
      if (typeof m.activeBoardId === 'string') {
        session.activeBoardId = m.activeBoardId;
        broadcast(session, ws, {
          type: 'focus_board',
          boardId: m.activeBoardId,
        });
      }
    } else {
      console.warn('[echo] unknown message type:', m.type);
    }
  });

  ws.on('close', () => {
    session.clients.delete(ws);
    console.log(
      `[echo] close   session=${sessionId} clients=${session.clients.size}`
    );
    if (session.clients.size === 0) {
      // Keep the boards cache around for a bit in case the user reconnects?
      // For MVP we drop immediately.
      sessions.delete(sessionId);
    }
  });
});

console.log(`[echo] WebSocket server listening on ws://localhost:${PORT}`);
console.log(`[echo] open two tabs at http://localhost:5173/?session=test`);

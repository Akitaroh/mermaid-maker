/**
 * Atom-WSRelay
 *
 * localhost で動く WebSocket server。MCPTools と MM web タブを中継する。
 * 設計: ../../../../50_Mission/MermaidMaker/Atom-WSRelay.md
 */

import { WebSocketServer, WebSocket, type RawData } from 'ws';
import { IncomingMessage } from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomBytes } from 'node:crypto';
import type { ServerMsg, ClientMsg } from './types.js';

export type WSRelayOptions = {
  /** Bind port. 0 = OS-assigned (default). Override with env or arg. */
  port?: number;
  /** Bind host. Default '127.0.0.1' for safety. */
  host?: string;
};

export type WSRelayStartResult = {
  port: number;
  url: string;
};

export type Session = {
  id: string;
  boards: Map<string, string>;
  activeBoardId: string | null;
  clients: Set<WebSocket>;
};

type EditWaiter = (mermaid: string) => void;

export class WSRelay {
  private wss: WebSocketServer | null = null;
  private readonly sessions = new Map<string, Session>();
  /** key = `${sessionId}:${boardId}`, value = waiter callbacks */
  private readonly editWaiters = new Map<string, EditWaiter[]>();
  private readonly opts: Required<WSRelayOptions>;

  constructor(opts: WSRelayOptions = {}) {
    this.opts = {
      port: opts.port ?? 0,
      host: opts.host ?? '127.0.0.1',
    };
  }

  // ─── Lifecycle ────────────────────────────────────────────────────

  start(): Promise<WSRelayStartResult> {
    return new Promise((resolve, reject) => {
      const wss = new WebSocketServer({
        port: this.opts.port,
        host: this.opts.host,
      });
      this.wss = wss;

      wss.on('listening', () => {
        const addr = wss.address() as AddressInfo;
        const port = addr.port;
        resolve({
          port,
          url: `ws://${this.opts.host}:${port}`,
        });
      });
      wss.on('error', (err) => reject(err));
      wss.on('connection', (ws, req) => this.onConnection(ws, req));
    });
  }

  async stop(): Promise<void> {
    if (!this.wss) return;
    const wss = this.wss;
    this.wss = null;
    // Close all client sockets first
    for (const session of this.sessions.values()) {
      for (const c of session.clients) {
        try {
          c.close(1001, 'server stopping');
        } catch {
          /* ignore */
        }
      }
    }
    this.sessions.clear();
    // Reject any waiting waiters
    for (const list of this.editWaiters.values()) {
      // We resolve with empty string? No — let them time out via their own
      // mechanism. Just clear so no further resolves happen.
    }
    this.editWaiters.clear();
    await new Promise<void>((resolve) => {
      wss.close(() => resolve());
    });
  }

  // ─── Session API (called by MCPTools) ──────────────────────────────

  createSession(): string {
    const id = newSessionId();
    this.sessions.set(id, {
      id,
      boards: new Map(),
      activeBoardId: null,
      clients: new Set(),
    });
    return id;
  }

  getSession(id: string): Session | null {
    return this.sessions.get(id) ?? null;
  }

  hasSession(id: string): boolean {
    return this.sessions.has(id);
  }

  destroySession(id: string): void {
    const s = this.sessions.get(id);
    if (!s) return;
    for (const c of s.clients) {
      try {
        c.close(1000, 'session destroyed');
      } catch {
        /* ignore */
      }
    }
    this.sessions.delete(id);
    // Cancel any waiters for this session.
    for (const key of [...this.editWaiters.keys()]) {
      if (key.startsWith(`${id}:`)) this.editWaiters.delete(key);
    }
  }

  /** Upsert a board's content. Broadcasts set_board to all session clients. */
  upsertBoard(sessionId: string, boardId: string, mermaid: string): void {
    const s = this.sessions.get(sessionId);
    if (!s) throw new Error(`unknown session: ${sessionId}`);
    s.boards.set(boardId, mermaid);
    if (s.activeBoardId === null) s.activeBoardId = boardId;
    this.broadcast(s, null, { type: 'set_board', boardId, mermaid });
  }

  setActiveBoard(sessionId: string, boardId: string): void {
    const s = this.sessions.get(sessionId);
    if (!s) throw new Error(`unknown session: ${sessionId}`);
    if (!s.boards.has(boardId)) {
      throw new Error(`unknown boardId: ${boardId}`);
    }
    s.activeBoardId = boardId;
    this.broadcast(s, null, { type: 'focus_board', boardId });
  }

  getCurrentBoard(sessionId: string, boardId?: string): string | null {
    const s = this.sessions.get(sessionId);
    if (!s) return null;
    const id = boardId ?? s.activeBoardId;
    if (!id) return null;
    return s.boards.get(id) ?? null;
  }

  listBoards(sessionId: string): {
    boards: string[];
    active: string | null;
  } | null {
    const s = this.sessions.get(sessionId);
    if (!s) return null;
    return { boards: [...s.boards.keys()], active: s.activeBoardId };
  }

  /**
   * Wait for the next update_board on (sessionId, boardId). Resolves with the
   * new mermaid value. Rejects on timeout.
   */
  waitForEdit(
    sessionId: string,
    boardId: string,
    timeoutMs: number
  ): Promise<string> {
    const key = `${sessionId}:${boardId}`;
    return new Promise<string>((resolve, reject) => {
      const list = this.editWaiters.get(key) ?? [];
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        const cur = this.editWaiters.get(key);
        if (cur) {
          const filtered = cur.filter((f) => f !== handler);
          if (filtered.length === 0) this.editWaiters.delete(key);
          else this.editWaiters.set(key, filtered);
        }
        reject(new Error(`waitForEdit timeout (${timeoutMs}ms)`));
      }, timeoutMs);
      const handler: EditWaiter = (mermaid) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(mermaid);
      };
      list.push(handler);
      this.editWaiters.set(key, list);
    });
  }

  // ─── Internal: connection / message handling ────────────────────────

  private onConnection(ws: WebSocket, req: IncomingMessage): void {
    const sessionId = parseSessionId(req);
    if (!sessionId) {
      ws.close(1008, 'missing or invalid session');
      return;
    }
    if (!this.checkOrigin(req)) {
      ws.close(1008, 'origin not allowed');
      return;
    }
    const session = this.sessions.get(sessionId);
    if (!session) {
      ws.close(1008, 'unknown session — call createSession first');
      return;
    }
    session.clients.add(ws);

    // Seed the new client with the current board snapshot.
    for (const [boardId, mermaid] of session.boards) {
      ws.send(JSON.stringify({ type: 'set_board', boardId, mermaid }));
    }
    if (session.activeBoardId) {
      ws.send(
        JSON.stringify({
          type: 'focus_board',
          boardId: session.activeBoardId,
        })
      );
    }

    ws.on('message', (raw: RawData) => this.onMessage(session, ws, raw));
    ws.on('close', () => {
      session.clients.delete(ws);
    });
  }

  private onMessage(session: Session, ws: WebSocket, raw: RawData): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('type' in (parsed as object))
    ) {
      return;
    }
    const msg = parsed as ClientMsg;

    if (msg.type === 'update_board') {
      session.boards.set(msg.boardId, msg.mermaid);
      if (!session.activeBoardId) session.activeBoardId = msg.boardId;
      // Resolve any waiters for this board.
      const key = `${session.id}:${msg.boardId}`;
      const list = this.editWaiters.get(key);
      if (list) {
        this.editWaiters.delete(key);
        for (const fn of list) {
          try {
            fn(msg.mermaid);
          } catch {
            /* ignore */
          }
        }
      }
      // Broadcast to other clients in the same session (multi-tab parity).
      this.broadcast(session, ws, {
        type: 'set_board',
        boardId: msg.boardId,
        mermaid: msg.mermaid,
      });
    } else if (msg.type === 'sync_state') {
      for (const [boardId, mermaid] of Object.entries(msg.boards)) {
        session.boards.set(boardId, mermaid);
        this.broadcast(session, ws, {
          type: 'set_board',
          boardId,
          mermaid,
        });
      }
      if (msg.activeBoardId) {
        session.activeBoardId = msg.activeBoardId;
        this.broadcast(session, ws, {
          type: 'focus_board',
          boardId: msg.activeBoardId,
        });
      }
    }
  }

  private broadcast(
    session: Session,
    except: WebSocket | null,
    payload: ServerMsg
  ): void {
    const data = JSON.stringify(payload);
    for (const c of session.clients) {
      if (c === except) continue;
      if (c.readyState === c.OPEN) c.send(data);
    }
  }

  private checkOrigin(req: IncomingMessage): boolean {
    const origin = req.headers.origin;
    // Connections without an Origin header (e.g. Node ws clients in tests)
    // are allowed since we already bind to 127.0.0.1.
    if (!origin) return true;
    try {
      const u = new URL(origin);
      return (
        u.hostname === 'localhost' ||
        u.hostname === '127.0.0.1' ||
        u.hostname === '[::1]'
      );
    } catch {
      return false;
    }
  }
}

// ─── helpers ──────────────────────────────────────────────────────────

function newSessionId(): string {
  // 12 random bytes → 16-char base64url. URL/path safe.
  return randomBytes(12).toString('base64url');
}

function parseSessionId(req: IncomingMessage): string | null {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const id = url.searchParams.get('session');
  if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) return null;
  return id;
}

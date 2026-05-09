import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { WSRelay } from './ws-relay.js';

let relay: WSRelay;
let url: string;

beforeEach(async () => {
  relay = new WSRelay({ port: 0 });
  const r = await relay.start();
  url = r.url;
});

afterEach(async () => {
  await relay.stop();
});

/**
 * Connect and start buffering messages immediately. The buffer is exposed
 * via __buffer; tests should consume it via takeBuffered() to avoid races
 * between seed messages and listener attachment.
 */
type BufferedWS = WebSocket & {
  __buffer: unknown[];
  __waitFor: (n: number, timeoutMs?: number) => Promise<unknown[]>;
};

function connect(sessionId: string): Promise<BufferedWS> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${url}?session=${sessionId}`) as BufferedWS;
    const buf: unknown[] = [];
    ws.__buffer = buf;
    ws.on('message', (data: import('ws').RawData) => {
      try {
        buf.push(JSON.parse(data.toString()));
      } catch {
        /* ignore */
      }
    });
    ws.__waitFor = (n, timeoutMs = 1000) =>
      new Promise((res, rej) => {
        const start = Date.now();
        const tick = () => {
          if (buf.length >= n) return res(buf.slice(0, n));
          if (Date.now() - start > timeoutMs)
            return rej(new Error(`only got ${buf.length}/${n}`));
          setTimeout(tick, 10);
        };
        tick();
      });
    ws.once('open', () => resolve(ws));
    ws.once('error', reject);
    ws.once('close', (code) => {
      if (code !== 1000 && code !== 1001 && buf.length === 0) {
        reject(new Error(`closed with ${code}`));
      }
    });
  });
}

async function nextMessage(ws: BufferedWS): Promise<unknown> {
  const before = ws.__buffer.length;
  // Wait for one new message past the current buffer length.
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      if (ws.__buffer.length > before) return resolve(ws.__buffer[before]);
      if (Date.now() - start > 1000)
        return reject(new Error('nextMessage timeout'));
      setTimeout(tick, 10);
    };
    tick();
  });
}

describe('WSRelay', () => {
  it('start returns a usable url with assigned port', async () => {
    expect(url).toMatch(/^ws:\/\/127\.0\.0\.1:\d+$/);
  });

  it('rejects connection for unknown session', async () => {
    const result = await new Promise<{ closed: boolean; code?: number }>(
      (resolve) => {
        const ws = new WebSocket(`${url}?session=ghost`);
        ws.on('close', (code) => resolve({ closed: true, code }));
        ws.on('error', () => {
          /* ignore - close will follow */
        });
      }
    );
    expect(result.closed).toBe(true);
  });

  it('createSession + connect + receive seeded boards', async () => {
    const sid = relay.createSession();
    relay.upsertBoard(sid, 'deps', 'graph LR\nA-->B');
    const ws = await connect(sid);
    const msgs = await ws.__waitFor(2);
    expect(msgs).toContainEqual({
      type: 'set_board',
      boardId: 'deps',
      mermaid: 'graph LR\nA-->B',
    });
    expect(msgs).toContainEqual({ type: 'focus_board', boardId: 'deps' });
    ws.close();
  });

  it('upsertBoard broadcasts set_board to existing clients', async () => {
    const sid = relay.createSession();
    const ws = await connect(sid);
    relay.upsertBoard(sid, 'arch', 'graph TD\nX-->Y');
    const msg = await nextMessage(ws);
    expect(msg).toEqual({
      type: 'set_board',
      boardId: 'arch',
      mermaid: 'graph TD\nX-->Y',
    });
    ws.close();
  });

  it('client update_board broadcasts to OTHER clients in same session', async () => {
    const sid = relay.createSession();
    const a = await connect(sid);
    const b = await connect(sid);
    a.send(
      JSON.stringify({
        type: 'update_board',
        boardId: 'deps',
        mermaid: 'humanV',
      })
    );
    const msg = await nextMessage(b);
    expect(msg).toEqual({
      type: 'set_board',
      boardId: 'deps',
      mermaid: 'humanV',
    });
    a.close();
    b.close();
  });

  it('waitForEdit resolves on next update_board', async () => {
    const sid = relay.createSession();
    const ws = await connect(sid);
    const editPromise = relay.waitForEdit(sid, 'deps', 1000);
    setTimeout(
      () =>
        ws.send(
          JSON.stringify({
            type: 'update_board',
            boardId: 'deps',
            mermaid: 'edited',
          })
        ),
      50
    );
    const got = await editPromise;
    expect(got).toBe('edited');
    ws.close();
  });

  it('waitForEdit times out when no edit comes', async () => {
    const sid = relay.createSession();
    await expect(relay.waitForEdit(sid, 'deps', 100)).rejects.toThrow(/timeout/);
  });

  it('multiple waitForEdit on same board all resolve on edit', async () => {
    const sid = relay.createSession();
    const ws = await connect(sid);
    const p1 = relay.waitForEdit(sid, 'deps', 1000);
    const p2 = relay.waitForEdit(sid, 'deps', 1000);
    setTimeout(
      () =>
        ws.send(
          JSON.stringify({
            type: 'update_board',
            boardId: 'deps',
            mermaid: 'v',
          })
        ),
      50
    );
    const [a, b] = await Promise.all([p1, p2]);
    expect(a).toBe('v');
    expect(b).toBe('v');
    ws.close();
  });

  it('listBoards reflects current state', async () => {
    const sid = relay.createSession();
    relay.upsertBoard(sid, 'a', 'g');
    relay.upsertBoard(sid, 'b', 'g2');
    expect(relay.listBoards(sid)).toEqual({
      boards: ['a', 'b'],
      active: 'a',
    });
    relay.setActiveBoard(sid, 'b');
    expect(relay.listBoards(sid)?.active).toBe('b');
  });

  it('getCurrentBoard returns active by default', async () => {
    const sid = relay.createSession();
    relay.upsertBoard(sid, 'deps', 'graph LR');
    expect(relay.getCurrentBoard(sid)).toBe('graph LR');
    expect(relay.getCurrentBoard(sid, 'deps')).toBe('graph LR');
    expect(relay.getCurrentBoard(sid, 'ghost')).toBeNull();
  });

  it('destroySession closes clients and clears state', async () => {
    const sid = relay.createSession();
    const ws = await connect(sid);
    const closed = new Promise<void>((resolve) => ws.once('close', () => resolve()));
    relay.destroySession(sid);
    await closed;
    expect(relay.hasSession(sid)).toBe(false);
  });
});

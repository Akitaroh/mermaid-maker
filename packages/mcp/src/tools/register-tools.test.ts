import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WSRelay } from '../relay/ws-relay.js';
import { registerAllTools } from './register-tools.js';

/**
 * Mock McpServer that captures registered tools so we can invoke them
 * directly without spinning up a real MCP transport.
 */
type RegisteredTool = {
  name: string;
  config: { description?: string; inputSchema?: unknown };
  // The handler signature mirrors the SDK's tool callback shape closely
  // enough for our usage; tests pass plain JS objects matching the schema.
  handler: (args: Record<string, unknown>) => Promise<{
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  }>;
};

function createMockServer() {
  const tools: Record<string, RegisteredTool> = {};
  const fakeServer = {
    registerTool(name: string, config: unknown, handler: unknown) {
      tools[name] = {
        name,
        config: config as RegisteredTool['config'],
        handler: handler as RegisteredTool['handler'],
      };
    },
  };
  return {
    server: fakeServer as unknown as Parameters<typeof registerAllTools>[0],
    invoke: async (name: string, args: Record<string, unknown> = {}) => {
      const t = tools[name];
      if (!t) throw new Error(`tool not registered: ${name}`);
      const r = await t.handler(args);
      const text = r.content.map((c) => c.text).join('\n');
      try {
        return { result: r, json: JSON.parse(text) };
      } catch {
        return { result: r, json: text };
      }
    },
    has: (name: string) => name in tools,
    listToolNames: () => Object.keys(tools),
  };
}

let relay: WSRelay;
let mock: ReturnType<typeof createMockServer>;

beforeEach(async () => {
  relay = new WSRelay({ port: 0 });
  await relay.start();
  mock = createMockServer();
  registerAllTools(mock.server, {
    relay,
    baseSessionUrl: 'http://localhost:5173',
  });
});

afterEach(async () => {
  await relay.stop();
});

describe('registerAllTools', () => {
  it('registers all expected tool names', () => {
    expect(mock.listToolNames().sort()).toEqual(
      [
        'mermaid_show',
        'mermaid_get_current',
        'mermaid_wait_for_edit',
        'mermaid_list_boards',
        'mermaid_focus_board',
        'mermaid_parse',
        'mermaid_list_nodes',
        'mermaid_list_edges',
        'mermaid_find_path',
        'mermaid_neighbors',
        'mermaid_validate',
        'mermaid_graph_stats',
      ].sort()
    );
  });
});

describe('Group A: Shared Canvas tools', () => {
  it('mermaid_show creates a session and returns a sessionUrl on first call', async () => {
    const { json } = await mock.invoke('mermaid_show', {
      text: 'graph LR\nA-->B',
    });
    expect(json.ok).toBe(true);
    expect(json.boardId).toBe('default');
    expect(json.sessionUrl).toMatch(
      /^http:\/\/localhost:5173\?session=[A-Za-z0-9_-]+$/
    );
  });

  it('mermaid_show with explicit board uses that id', async () => {
    const { json } = await mock.invoke('mermaid_show', {
      text: 'graph LR\nA-->B',
      board: 'deps',
    });
    expect(json.boardId).toBe('deps');
  });

  it('mermaid_get_current returns the latest text', async () => {
    await mock.invoke('mermaid_show', {
      text: 'graph LR\nA-->B',
      board: 'deps',
    });
    const { json } = await mock.invoke('mermaid_get_current', {
      board: 'deps',
    });
    expect(json).toEqual({
      boardId: 'deps',
      mermaid: 'graph LR\nA-->B',
    });
  });

  it('mermaid_get_current without active session returns error', async () => {
    const { result } = await mock.invoke('mermaid_get_current', {});
    expect(result.isError).toBe(true);
  });

  it('mermaid_list_boards reflects current state', async () => {
    await mock.invoke('mermaid_show', { text: 'g', board: 'a' });
    await mock.invoke('mermaid_show', { text: 'g2', board: 'b' });
    const { json } = await mock.invoke('mermaid_list_boards', {});
    expect(json.boards.sort()).toEqual(['a', 'b']);
    expect(json.active).toBe('a');
  });

  it('mermaid_focus_board switches active', async () => {
    await mock.invoke('mermaid_show', { text: 'g', board: 'a' });
    await mock.invoke('mermaid_show', { text: 'g2', board: 'b' });
    await mock.invoke('mermaid_focus_board', { board: 'b' });
    const { json } = await mock.invoke('mermaid_list_boards', {});
    expect(json.active).toBe('b');
  });

  it('mermaid_focus_board on unknown board returns error', async () => {
    await mock.invoke('mermaid_show', { text: 'g', board: 'a' });
    const { result } = await mock.invoke('mermaid_focus_board', {
      board: 'ghost',
    });
    expect(result.isError).toBe(true);
  });
});

describe('Group B: Query tools', () => {
  const text = 'graph LR\nA-->B\nB-->C';

  it('mermaid_parse returns nodes/edges', async () => {
    const { json } = await mock.invoke('mermaid_parse', { text });
    expect(json.ok).toBe(true);
    expect(json.nodes).toHaveLength(3);
    expect(json.edges).toHaveLength(2);
  });

  it('mermaid_parse on bad input returns ok=false', async () => {
    const { json } = await mock.invoke('mermaid_parse', { text: 'invalid!!' });
    expect(json.ok).toBe(false);
  });

  it('mermaid_list_nodes', async () => {
    const { json } = await mock.invoke('mermaid_list_nodes', { text });
    expect(json.nodes.map((n: { id: string }) => n.id).sort()).toEqual([
      'A',
      'B',
      'C',
    ]);
  });

  it('mermaid_list_edges', async () => {
    const { json } = await mock.invoke('mermaid_list_edges', { text });
    expect(json.edges).toEqual([
      { from: 'A', to: 'B' },
      { from: 'B', to: 'C' },
    ]);
  });

  it('mermaid_find_path returns path', async () => {
    const { json } = await mock.invoke('mermaid_find_path', {
      text,
      from: 'A',
      to: 'C',
    });
    expect(json.paths).toEqual([['A', 'B', 'C']]);
    expect(json.truncated).toBe(false);
  });

  it('mermaid_neighbors returns in/out', async () => {
    const { json } = await mock.invoke('mermaid_neighbors', {
      text,
      nodeId: 'B',
    });
    expect(json).toEqual({ in: ['A'], out: ['C'] });
  });

  it('mermaid_validate clean graph', async () => {
    const { json } = await mock.invoke('mermaid_validate', { text });
    expect(json.valid).toBe(true);
    expect(json.errors).toEqual([]);
  });

  it('mermaid_graph_stats', async () => {
    const { json } = await mock.invoke('mermaid_graph_stats', { text });
    expect(json).toEqual({
      nodeCount: 3,
      edgeCount: 2,
      isConnected: true,
    });
  });

  it('parse failure in query tool returns isError', async () => {
    const { result } = await mock.invoke('mermaid_list_nodes', {
      text: 'not valid mermaid here !!',
    });
    expect(result.isError).toBe(true);
  });
});

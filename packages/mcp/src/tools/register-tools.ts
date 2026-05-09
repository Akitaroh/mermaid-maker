/**
 * Atom-MCPTools
 *
 * Register MCP tools onto an McpServer instance.
 * 設計: ../../../../50_Mission/MermaidMaker/Atom-MCPTools.md
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import {
  parseMermaid,
  listNodes,
  listEdges,
  findPath,
  neighbors,
  validate,
  graphStats,
} from '@akitaroh/mermaid-core';
import type { Graph } from '@akitaroh/mermaid-core';
import type { WSRelay } from '../relay/ws-relay.js';

export type ToolsContext = {
  relay: WSRelay;
  /** Base URL of the web canvas (without query). */
  baseSessionUrl: string;
};

/**
 * Mutable per-process state. The MCP server runs as a single agent context,
 * so one session ID is enough for MVP (multi-session is Phase 7+).
 */
type SessionState = {
  sessionId: string | null;
};

function jsonResult(value: unknown): CallToolResult {
  return {
    content: [
      { type: 'text', text: JSON.stringify(value, null, 2) },
    ],
  };
}

function errorResult(message: string): CallToolResult {
  return {
    content: [{ type: 'text', text: `Error: ${message}` }],
    isError: true,
  };
}

export function registerAllTools(server: McpServer, ctx: ToolsContext): void {
  const state: SessionState = { sessionId: null };
  registerSharedCanvasTools(server, ctx, state);
  registerQueryTools(server);
}

// ─────────────────────────────────────────────────────────────────
// Group A: Shared Canvas Tools
// ─────────────────────────────────────────────────────────────────

export function registerSharedCanvasTools(
  server: McpServer,
  ctx: ToolsContext,
  state: SessionState
): void {
  function ensureSession(): string {
    if (state.sessionId && ctx.relay.hasSession(state.sessionId)) {
      return state.sessionId;
    }
    state.sessionId = ctx.relay.createSession();
    return state.sessionId;
  }

  function sessionUrl(sessionId: string): string {
    return `${ctx.baseSessionUrl}?session=${sessionId}`;
  }

  // mermaid_show
  server.registerTool(
    'mermaid_show',
    {
      description: [
        "Display a Mermaid diagram on the user's shared canvas (a browser tab",
        "that the user has opened). Use this whenever you generate or update",
        "a Mermaid diagram so the user can see and edit it.",
        "",
        "First call returns a sessionUrl — show it to the user and ask them",
        "to open it. Subsequent calls update the existing tab in place.",
        "",
        "Use `board` to keep multiple diagrams in the same session (e.g.",
        "'deps', 'arch', 'flow'). Omit `board` to update the active one.",
      ].join(' '),
      inputSchema: {
        text: z.string().describe('The Mermaid source text to display.'),
        board: z
          .string()
          .optional()
          .describe(
            'Board id (e.g. "deps"). Omit to use/create the active board.'
          ),
      },
    },
    async ({ text, board }) => {
      const sessionId = ensureSession();
      const targetBoard =
        board ??
        ctx.relay.listBoards(sessionId)?.active ??
        'default';
      try {
        ctx.relay.upsertBoard(sessionId, targetBoard, text);
      } catch (e) {
        return errorResult((e as Error).message);
      }
      return jsonResult({
        ok: true,
        sessionUrl: sessionUrl(sessionId),
        boardId: targetBoard,
        message:
          state.sessionId === sessionId
            ? 'Updated. If the user has not opened the canvas yet, share sessionUrl.'
            : 'New session.',
      });
    }
  );

  // mermaid_get_current
  server.registerTool(
    'mermaid_get_current',
    {
      description: [
        "Get the current Mermaid text from the shared canvas (the version",
        "the user has after their edits). Pass `board` for a specific board,",
        "or omit for the active one.",
      ].join(' '),
      inputSchema: {
        board: z.string().optional(),
      },
    },
    async ({ board }) => {
      if (!state.sessionId) {
        return errorResult(
          'No active session. Call mermaid_show first to create one.'
        );
      }
      const sid = state.sessionId;
      const targetBoard = board ?? ctx.relay.listBoards(sid)?.active;
      if (!targetBoard) {
        return errorResult('No active board.');
      }
      const mermaid = ctx.relay.getCurrentBoard(sid, targetBoard);
      if (mermaid === null) {
        return errorResult(`Board '${targetBoard}' not found.`);
      }
      return jsonResult({ boardId: targetBoard, mermaid });
    }
  );

  // mermaid_wait_for_edit
  server.registerTool(
    'mermaid_wait_for_edit',
    {
      description: [
        "Block until the user edits a board, then return the new Mermaid",
        "text. Useful when you want the user to make changes before you",
        "continue the conversation. Times out after `timeoutSec` (default 600).",
      ].join(' '),
      inputSchema: {
        board: z.string().optional(),
        timeoutSec: z.number().int().positive().optional(),
      },
    },
    async ({ board, timeoutSec }) => {
      if (!state.sessionId) {
        return errorResult(
          'No active session. Call mermaid_show first.'
        );
      }
      const sid = state.sessionId;
      const targetBoard = board ?? ctx.relay.listBoards(sid)?.active;
      if (!targetBoard) {
        return errorResult('No active board.');
      }
      const ms = (timeoutSec ?? 600) * 1000;
      try {
        const updated = await ctx.relay.waitForEdit(sid, targetBoard, ms);
        return jsonResult({ boardId: targetBoard, mermaid: updated });
      } catch (e) {
        return errorResult((e as Error).message);
      }
    }
  );

  // mermaid_list_boards
  server.registerTool(
    'mermaid_list_boards',
    {
      description: 'List all boards in the current session and which is active.',
      inputSchema: {},
    },
    async () => {
      if (!state.sessionId) {
        return jsonResult({ boards: [], active: null });
      }
      const r = ctx.relay.listBoards(state.sessionId);
      return jsonResult(r ?? { boards: [], active: null });
    }
  );

  // mermaid_focus_board
  server.registerTool(
    'mermaid_focus_board',
    {
      description:
        "Switch the user's view to a specific board. Useful for guiding attention.",
      inputSchema: {
        board: z.string(),
      },
    },
    async ({ board }) => {
      if (!state.sessionId) {
        return errorResult('No active session.');
      }
      try {
        ctx.relay.setActiveBoard(state.sessionId, board);
      } catch (e) {
        return errorResult((e as Error).message);
      }
      return jsonResult({ ok: true, active: board });
    }
  );
}

// ─────────────────────────────────────────────────────────────────
// Group B: Query Tools (pure, no shared state)
// ─────────────────────────────────────────────────────────────────

export function registerQueryTools(server: McpServer): void {
  function parseOrFail(
    text: string
  ):
    | { ok: true; graph: Graph }
    | { ok: false; result: CallToolResult } {
    const r = parseMermaid(text);
    if (!r.ok) {
      return {
        ok: false,
        result: errorResult(
          `Parse failed${r.error.line ? ` at line ${r.error.line}` : ''}: ${r.error.message}`
        ),
      };
    }
    return { ok: true, graph: r.graph };
  }

  server.registerTool(
    'mermaid_parse',
    {
      description:
        'Parse Mermaid text into structured AST. Returns nodes/edges/direction. Use to verify syntax or inspect structure.',
      inputSchema: { text: z.string() },
    },
    async ({ text }) => {
      const r = parseMermaid(text);
      if (!r.ok) {
        return jsonResult({
          ok: false,
          error: r.error,
        });
      }
      return jsonResult({
        ok: true,
        direction: r.graph.direction,
        nodes: r.graph.nodes,
        edges: r.graph.edges,
      });
    }
  );

  server.registerTool(
    'mermaid_list_nodes',
    {
      description: 'List all nodes in the diagram with id, label, shape.',
      inputSchema: { text: z.string() },
    },
    async ({ text }) => {
      const r = parseOrFail(text);
      if (!r.ok) return r.result;
      return jsonResult({ nodes: listNodes(r.graph) });
    }
  );

  server.registerTool(
    'mermaid_list_edges',
    {
      description: 'List all edges (from, to, label).',
      inputSchema: { text: z.string() },
    },
    async ({ text }) => {
      const r = parseOrFail(text);
      if (!r.ok) return r.result;
      return jsonResult({ edges: listEdges(r.graph) });
    }
  );

  server.registerTool(
    'mermaid_find_path',
    {
      description: [
        'Find all paths from one node to another. Returns paths as arrays',
        "of node ids. Cycles are handled (no node visited twice). Use this",
        "instead of trying to read paths from a rendered image.",
      ].join(' '),
      inputSchema: {
        text: z.string(),
        from: z.string(),
        to: z.string(),
        maxPaths: z.number().int().positive().optional(),
      },
    },
    async ({ text, from, to, maxPaths }) => {
      const r = parseOrFail(text);
      if (!r.ok) return r.result;
      const found = findPath(
        r.graph,
        from,
        to,
        maxPaths !== undefined ? { maxPaths } : {}
      );
      return jsonResult(found);
    }
  );

  server.registerTool(
    'mermaid_neighbors',
    {
      description: 'Incoming and outgoing neighbors of a node.',
      inputSchema: { text: z.string(), nodeId: z.string() },
    },
    async ({ text, nodeId }) => {
      const r = parseOrFail(text);
      if (!r.ok) return r.result;
      return jsonResult(neighbors(r.graph, nodeId));
    }
  );

  server.registerTool(
    'mermaid_validate',
    {
      description:
        'Check structural validity. Returns errors (duplicate_node, unknown_node) and warnings (isolated_node).',
      inputSchema: { text: z.string() },
    },
    async ({ text }) => {
      const r = parseOrFail(text);
      if (!r.ok) return r.result;
      return jsonResult(validate(r.graph));
    }
  );

  server.registerTool(
    'mermaid_graph_stats',
    {
      description:
        'Quick counts and weak-connectivity check (treated as undirected).',
      inputSchema: { text: z.string() },
    },
    async ({ text }) => {
      const r = parseOrFail(text);
      if (!r.ok) return r.result;
      return jsonResult(graphStats(r.graph));
    }
  );
}

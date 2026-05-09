/**
 * WebSocket message types shared between MM web (client) and MCP server (relay).
 * See ../../../50_Mission/MermaidMaker/Atom-WSClient.md / Atom-WSRelay.md for design.
 */

export type ServerMsg =
  | { type: 'set_board'; boardId: string; mermaid: string }
  | { type: 'create_board'; boardId: string; mermaid: string }
  | { type: 'focus_board'; boardId: string }
  | { type: 'sync_request' };

export type ClientMsg =
  | { type: 'update_board'; boardId: string; mermaid: string }
  | {
      type: 'sync_state';
      boards: Record<string, string>;
      activeBoardId: string | null;
    };

export type WSStatus = 'connecting' | 'open' | 'closed';

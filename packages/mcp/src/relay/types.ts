/**
 * WebSocket message types — must stay in sync with packages/web/src/ws/types.ts
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

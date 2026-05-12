# @akitaroh/mermaid-mcp

> **MCP server that lets AI agents and humans share a Mermaid canvas.**
> The AI calls `mermaid_show(text)`; you open the URL it prints; you both see and edit the same diagram in real time.

[![npm](https://img.shields.io/npm/v/@akitaroh/mermaid-mcp.svg)](https://www.npmjs.com/package/@akitaroh/mermaid-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../../LICENSE)

Built on top of [MermaidMaker](https://github.com/Akitaroh/mermaid-maker), a general-purpose bidirectional Mermaid text ↔ GUI editor.

---

## Why this exists

Asking an AI to "show me the dependency graph" usually produces:

- A Mermaid code block you have to render somewhere yourself, **or**
- A vague prose description, **or**
- An image the AI can't read back accurately

This MCP gives the AI two new abilities:

1. **Display a diagram on a canvas the human can edit.** `mermaid_show(text)` returns a `sessionUrl`. The user opens it in a browser and sees the diagram with full GUI editing — drag nodes, change shapes, edit labels.
2. **Read the human's edits back as structured text and queryable structure.** `mermaid_get_current()`, `mermaid_find_path(text, from, to)`, `mermaid_list_nodes(text)`, etc.

The result: AI and human both see the **same** diagram, edit it back and forth, and the AI can reason about it structurally instead of guessing from an image.

---

## Quick start

### 1. Add to your MCP config

For Claude Code (`~/.claude.json` or project `.mcp.json`):

```json
{
  "mcpServers": {
    "mermaid": {
      "command": "npx",
      "args": ["-y", "@akitaroh/mermaid-mcp"]
    }
  }
}
```

That's it. No separate web server, no `pnpm dev`, no port management — the server bundles its own web canvas and serves HTTP + WebSocket on a single auto-assigned localhost port.

### 2. Restart your MCP client

Restart Claude Code (or use `/mcp` to reload).

### 3. Ask the AI to draw something

> "Show me the architecture of this codebase as a Mermaid graph."

The AI will call `mermaid_show(...)` and reply with a URL like `http://127.0.0.1:61502?session=abc123`. Open it in a browser. You'll see the diagram with text on the left, draggable canvas on the right.

### 4. Edit, and the AI can see your changes

Move nodes, add new ones, fix labels. When the AI calls `mermaid_get_current()` next, it gets your edited Mermaid text back — including positions and shape changes.

---

## What's in the toolkit

### Shared canvas tools (require an active browser tab)

| Tool | Purpose |
|---|---|
| `mermaid_show(text, board?)` | Display a diagram (creates a session on first call, returns the URL) |
| `mermaid_get_current(board?)` | Read the current text from the human's canvas |
| `mermaid_wait_for_edit(board?, timeoutSec?)` | Block until the human edits (handy mid-conversation) |
| `mermaid_list_boards()` | List all boards in the active session |
| `mermaid_focus_board(board)` | Switch the human's view to a specific board |

Multiple boards per session let you keep `deps`, `arch`, `flow` etc. side by side.

### Pure structural query (no canvas required)

| Tool | Purpose |
|---|---|
| `mermaid_parse(text)` | Parse to structured AST (nodes, edges, direction) |
| `mermaid_list_nodes(text)` | All nodes with id / label / shape |
| `mermaid_list_edges(text)` | All edges with from / to / label |
| `mermaid_find_path(text, from, to, maxPaths?)` | All paths between two nodes (cycle-safe) |
| `mermaid_neighbors(text, nodeId)` | Incoming + outgoing neighbors |
| `mermaid_validate(text)` | Errors (`duplicate_node`, `unknown_node`) + warnings (`isolated_node`) |
| `mermaid_graph_stats(text)` | Node/edge counts + weak connectivity |

These let the AI **reason about structure without rendering**. Far more reliable than asking an AI to "look at the image and tell me the path from A to E".

---

## Configuration

| Env var | Default | What it does |
|---|---|---|
| `MERMAID_MCP_PORT` | `0` (OS-assigned) | Pin the HTTP+WS port to a specific number |
| `MM_WEB_URL` | `http://localhost:5173` (only used if embedded web is missing) | Point at an external web canvas instead of the bundled one. Set to `http://localhost:5173` and run `pnpm dev` if you want HMR while hacking on the web app |
| `MM_WEB_ROOT` | `<bin dir>/web` | Override the embedded web root (rarely needed) |

---

## Supported diagram syntax

The bundled parser currently handles the **`graph LR` / `graph TD`** subset of Mermaid:

- Node shapes: `circle ((label))`, `doubleCircle (((label)))`, `box [label]`, `rounded (label)`
- Edges: `A --> B`, `A -->|label| B`
- Self-loops, parallel edges, edge shape switching, control-point dragging — all preserved via Mermaid metadata comments (`%% mm-pos:`, `%% mm-edge-shape:`, `%% mm-edge-ctrl:`)

Supporting the full Mermaid syntax (sequence, class, state, ER, gantt, etc.) is on the roadmap.

---

## How it works

```
┌────────────────────┐                  ┌────────────────────────┐
│ AI (Claude etc.)   │ ←── stdio MCP ──→│  mermaid-mcp process   │
│   tool calls       │                  │   ├ http.Server         │
│                    │                  │   │   serves dist/web/  │
└────────────────────┘                  │   ├ WSRelay (attached)  │
                                        │   └ session/board mgmt │
                                        └─────┬──────────────────┘
                                              │ ws + http
                                              │ same localhost port
                                              ▼
                                        ┌──────────────────┐
                                        │ Browser tab      │
                                        │ (MM web canvas)  │
                                        │  ←── human edits │
                                        └──────────────────┘
```

- One Node process runs the MCP server, an HTTP file server (for the web canvas), and a WebSocket relay — all on a single OS-assigned port.
- The browser tab connects via `ws://<same-host>` and stays in sync with the AI through `set_board` / `update_board` / `focus_board` messages.
- Edits are persisted to the browser's `localStorage` per-session, so closing the tab and reopening the URL restores the diagram.

---

## License

MIT © akitaroh

See the [main repository](https://github.com/Akitaroh/mermaid-maker) for source, design docs, and the broader MermaidMaker family.

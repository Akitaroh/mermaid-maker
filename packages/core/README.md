# @akitaroh/mermaid-core

> Pure-logic core for [MermaidMaker](https://github.com/Akitaroh/mermaid-maker). Browser/Node-neutral, zero runtime deps.

[![npm](https://img.shields.io/npm/v/@akitaroh/mermaid-core.svg)](https://www.npmjs.com/package/@akitaroh/mermaid-core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

This package powers both the [MermaidMaker web editor](https://mermaid-maker.vercel.app) and the [`@akitaroh/mermaid-mcp`](../mcp) MCP server. It contains everything that doesn't touch the DOM or Node-specific APIs.

---

## What's in here

```ts
import {
  // Parser / Emitter
  parseMermaid,            // text -> AST + positions + edge metadata
  emitMermaid,             // AST + positions -> text (with %% mm-pos comments)

  // AST types
  type Graph, type Node, type Edge,
  type NodeShape, type EdgeShape,
  type PositionMap, type EdgeControlMap, type EdgeShapeMap,
  emptyGraph,

  // Graph CRUD (immutable helpers)
  addNode, addEdge, removeNode, removeEdge, updateNodeLabel,
  updateNodeShape, updateEdgeLabel, /* ... */

  // Position metadata helpers
  parsePositionLike, formatPositionLike,

  // Edge routing (parallel-edge offset for canvas rendering)
  computeEdgeOffsets,

  // Structural query (Phase 6)
  listNodes, listEdges, neighbors,
  findPath,                // DFS, cycle-safe, maxPaths cap
  validate,                // duplicate_node / unknown_node / isolated_node
  graphStats,              // counts + weak connectivity
} from '@akitaroh/mermaid-core';
```

## Supported Mermaid syntax

Currently the **`graph LR` / `graph TD`** subset:

- Node shapes: `((label))` / `(((label)))` / `[label]` / `(label)`
- Edges: `A --> B` / `A -->|label| B`
- Self-loops, parallel edges
- Position / shape / control-point metadata via `%% mm-*` comments

Full Mermaid syntax (sequence, class, state, ER, etc.) is on the roadmap.

## Why use this directly

Most users want the higher-level packages:

- [`@akitaroh/mermaid-mcp`](../mcp) — MCP server (AI integration)
- The MermaidMaker web editor (humans editing diagrams)

But if you're building a tool that needs **structural reasoning over Mermaid text** — e.g. a static analysis tool, a custom renderer, or another MCP — this is the lightweight kernel to embed. Pure functions, no I/O, no DOM, no Node-specific APIs.

## License

MIT © akitaroh

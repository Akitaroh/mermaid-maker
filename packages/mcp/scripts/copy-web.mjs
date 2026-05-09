#!/usr/bin/env node
/**
 * Copy the built web SPA into packages/mcp/dist/web/ so the MCP server can
 * serve it from a single process at runtime.
 *
 * Run as part of `pnpm --filter @akitaroh/mermaid-mcp build`.
 */

import { cp, rm, stat } from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, '..'); // packages/mcp
const SRC = path.resolve(ROOT, '../web/dist');
const DEST = path.resolve(ROOT, 'dist/web');

try {
  const st = await stat(SRC);
  if (!st.isDirectory()) {
    console.error(`[copy-web] source is not a directory: ${SRC}`);
    process.exit(1);
  }
} catch {
  console.error(
    `[copy-web] web build not found at ${SRC}. ` +
      `Run \`pnpm --filter @akitaroh/mermaid-maker-web build\` first.`
  );
  process.exit(1);
}

await rm(DEST, { recursive: true, force: true });
await cp(SRC, DEST, { recursive: true });
console.log(`[copy-web] copied ${SRC} → ${DEST}`);

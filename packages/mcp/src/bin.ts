#!/usr/bin/env node
/**
 * MCP server CLI entry.
 * 設計: ../../50_Mission/MermaidMaker/Atom-MCPTools.md (＋WSRelay)
 *
 * Usage:
 *   npx @akitaroh/mermaid-mcp           (after publish)
 *   pnpm --filter @akitaroh/mermaid-mcp start
 *
 * Phase 8.1: HTTP (web canvas) + WS (relay) を同 port で serve、
 * MCP は stdio 経由。「localhost を別途立ち上げる」摩擦が消える。
 *
 * env:
 *   MERMAID_MCP_PORT  HTTP+WS 共通 port (default 7331)
 *   MM_WEB_URL        外部 web ホスト指定（embedded を使わず Vercel 等を使う場合）
 *   MM_WEB_ROOT       embedded web root override (default: dirname(__filename)/web)
 */

import * as http from 'node:http';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as fs from 'node:fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { WSRelay } from './relay/ws-relay.js';
import { registerAllTools } from './tools/register-tools.js';
import { createStaticHandler } from './static/serve-static.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const port = process.env.MERMAID_MCP_PORT
    ? Number(process.env.MERMAID_MCP_PORT)
    : 7331;
  const externalWebUrl = process.env.MM_WEB_URL;

  // Resolve embedded web root. After build, web is copied to ./web/ next to bin.js.
  // In dev (tsx), this points to packages/mcp/src/web which won't exist; that's
  // OK as long as MM_WEB_URL is set.
  const webRoot =
    process.env.MM_WEB_ROOT ?? path.resolve(__dirname, 'web');
  const haveEmbeddedWeb = fs.existsSync(path.join(webRoot, 'index.html'));

  // Decide what URL to give to AI as the canvas base.
  const baseSessionUrl =
    externalWebUrl ??
    (haveEmbeddedWeb ? `http://127.0.0.1:${port}` : `http://localhost:5173`);

  // ─── HTTP server (only if we'll embed web) ────────────────────────
  let httpServer: http.Server | null = null;
  if (!externalWebUrl) {
    if (!haveEmbeddedWeb) {
      console.error(
        `[mermaid-mcp] WARN: embedded web not found at ${webRoot}.\n` +
          `              Falling back to external URL ${baseSessionUrl}.\n` +
          `              Run \`pnpm dev\` separately, or set MM_WEB_URL.`
      );
    } else {
      const handler = createStaticHandler({ root: webRoot });
      httpServer = http.createServer(handler);
      await new Promise<void>((resolve, reject) => {
        httpServer!.once('listening', () => resolve());
        httpServer!.once('error', reject);
        httpServer!.listen(port, '127.0.0.1');
      });
      console.error(
        `[mermaid-mcp] HTTP web canvas: http://127.0.0.1:${port}`
      );
    }
  }

  // ─── WebSocket relay (attached to HTTP server if we have one) ─────
  const relay = new WSRelay(
    httpServer
      ? { httpServer }
      : { port, host: '127.0.0.1' }
  );
  const { url: wsUrl } = await relay.start();
  console.error(`[mermaid-mcp] WSRelay:        ${wsUrl}`);
  console.error(`[mermaid-mcp] Web canvas base: ${baseSessionUrl}`);

  // ─── MCP server on stdio ───────────────────────────────────────────
  const server = new McpServer({
    name: 'mermaid-mcp',
    version: '0.2.0-dev',
  });

  registerAllTools(server, { relay, baseSessionUrl });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[mermaid-mcp] MCP server ready on stdio.');

  // Graceful shutdown
  const shutdown = async () => {
    console.error('[mermaid-mcp] shutting down…');
    try {
      await server.close();
    } catch {
      /* ignore */
    }
    try {
      await relay.stop();
    } catch {
      /* ignore */
    }
    if (httpServer) {
      await new Promise<void>((resolve) =>
        httpServer!.close(() => resolve())
      );
    }
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[mermaid-mcp] fatal:', err);
  process.exit(1);
});

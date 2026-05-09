#!/usr/bin/env node
/**
 * MCP server CLI entry.
 * 設計: ../../50_Mission/MermaidMaker/Atom-MCPTools.md (＋WSRelay)
 *
 * Usage:
 *   pnpm --filter @akitaroh/mermaid-mcp start
 *   npx @akitaroh/mermaid-mcp           (after publish)
 *
 * Connects via stdio for MCP. WSRelay listens on a localhost port for the
 * web canvas to attach (URL printed to stderr at startup).
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { WSRelay } from './relay/ws-relay.js';
import { registerAllTools } from './tools/register-tools.js';

async function main() {
  const port = process.env.MERMAID_MCP_PORT
    ? Number(process.env.MERMAID_MCP_PORT)
    : 0;
  const baseSessionUrl =
    process.env.MM_WEB_URL ?? 'http://localhost:5173';

  const relay = new WSRelay({ port });
  const { url, port: actualPort } = await relay.start();

  // stderr only — stdout is reserved for MCP protocol over stdio.
  console.error(`[mermaid-mcp] WSRelay listening on ${url}`);
  console.error(`[mermaid-mcp] Web canvas base: ${baseSessionUrl}`);
  console.error(`[mermaid-mcp] Set MERMAID_MCP_PORT=${actualPort} to pin.`);

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
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[mermaid-mcp] fatal:', err);
  process.exit(1);
});

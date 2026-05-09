/**
 * Minimal static file server for the embedded MM web canvas.
 * Serves files from a root directory with SPA fallback to index.html.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

function mimeOf(p: string): string {
  return MIME[path.extname(p).toLowerCase()] ?? 'application/octet-stream';
}

export type ServeStaticOptions = {
  /** Absolute path to the directory containing the built web assets. */
  root: string;
};

export function createStaticHandler(opts: ServeStaticOptions) {
  const root = path.resolve(opts.root);

  function serveFile(filePath: string, res: ServerResponse) {
    const stream = fs.createReadStream(filePath);
    stream.on('error', () => {
      res.writeHead(500, { 'content-type': 'text/plain' });
      res.end('internal error');
    });
    res.writeHead(200, { 'content-type': mimeOf(filePath) });
    stream.pipe(res);
  }

  function serveIndex(res: ServerResponse) {
    serveFile(path.join(root, 'index.html'), res);
  }

  return function handle(req: IncomingMessage, res: ServerResponse) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405).end('method not allowed');
      return;
    }
    let url: URL;
    try {
      url = new URL(req.url ?? '/', 'http://localhost');
    } catch {
      res.writeHead(400).end('bad url');
      return;
    }

    const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
    const filePath = path.join(root, decodeURIComponent(pathname));
    // Defense in depth: refuse path traversal outside the web root.
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(root + path.sep) && resolved !== root) {
      res.writeHead(403).end('forbidden');
      return;
    }
    fs.stat(resolved, (err, stat) => {
      if (err || !stat.isFile()) {
        // SPA fallback to index.html for unknown routes.
        return serveIndex(res);
      }
      serveFile(resolved, res);
    });
  };
}

/** Production SPA/static-file fallback, kept outside API route assembly. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Hono } from 'hono';
import { getHomeDir } from '../lib/paths.js';

const mimeTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2',
};

export function registerStaticFallback(app: Hono): void {
  const staticDir = [
    path.join(getHomeDir(), 'web'),
    path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'web'),
  ].find(dir => fs.existsSync(path.join(dir, 'index.html')));
  if (!staticDir) return;

  app.get('*', c => {
    if (c.req.path.startsWith('/api/')) return c.json({ error: 'Not found' }, 404);
    const filePath = path.join(staticDir, c.req.path);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return new Response(fs.readFileSync(filePath), {
        headers: { 'Content-Type': mimeTypes[path.extname(filePath)] ?? 'application/octet-stream' },
      });
    }
    return new Response(fs.readFileSync(path.join(staticDir, 'index.html')), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  });
}

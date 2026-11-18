#!/usr/bin/env node
/**
 * Local static server for dist/ (or public/) with mandatory COOP/COEP headers
 * so SharedArrayBuffer and window.crossOriginIsolated are active.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const serveDir = fs.existsSync(distDir) ? distDir : rootDir;
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '127.0.0.1';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.3dsx': 'application/octet-stream',
  '.3ds': 'application/octet-stream',
  '.cci': 'application/octet-stream',
  '.cxi': 'application/octet-stream',
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const isUnisolatedEditorialPage = urlPath === '/sobre.html' || urlPath === '/sobre';

  if (isUnisolatedEditorialPage) {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  } else {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');

  let resolvedUrl = urlPath;
  if (resolvedUrl === '/') resolvedUrl = '/index.html';
  else if (resolvedUrl === '/sobre') resolvedUrl = '/sobre.html';
  let filePath = path.normalize(path.join(serveDir, resolvedUrl));

  if (!filePath.startsWith(serveDir)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-cache' });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  fs.createReadStream(filePath).pipe(res);
});

server.listen(port, host, () => {
  console.log(`Serving ${serveDir} at http://${host}:${port} (COOP+COEP enabled)`);
});

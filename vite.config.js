import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));

function computeWasmBuildHash() {
  const hash = crypto.createHash('sha256');
  let hashedFiles = 0;
  for (const relPath of ['public/wasm/Panda3DS.wasm', 'public/wasm/Panda3DS.js']) {
    const absPath = path.join(ROOT_DIR, relPath);
    if (fs.existsSync(absPath)) {
      hash.update(fs.readFileSync(absPath));
      hashedFiles += 1;
    }
  }
  return hashedFiles > 0 ? hash.digest('hex').slice(0, 12) : 'dev';
}

const COOP_COEP_HEADERS = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

function wasmHeadersPlugin() {
  const applyHeaders = (req, res) => {
    const cleanUrl = (req.url || '/').split('?')[0];
    if (cleanUrl === '/sobre.html' || cleanUrl === '/sobre') {
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
      return;
    }
    for (const [key, value] of Object.entries(COOP_COEP_HEADERS)) {
      res.setHeader(key, value);
    }
    if (cleanUrl.endsWith('.wasm')) {
      res.setHeader('Content-Type', 'application/wasm');
    }
  };

  return {
    name: 'coop-coep-and-wasm-mime',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        applyHeaders(req, res);
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        applyHeaders(req, res);
        next();
      });
    },
  };
}

export default defineConfig({
  define: {
    __WASM_BUILD_HASH__: JSON.stringify(computeWasmBuildHash()),
  },
  plugins: [wasmHeadersPlugin()],
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: 'index.html',
        sobre: 'sobre.html',
      },
      output: {
        manualChunks: {
          three: ['three'],
          jszip: ['jszip'],
        },
      },
    },
  },
});

import { defineConfig } from 'vite';

const COOP_COEP_HEADERS = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

function wasmHeadersPlugin() {
  return {
    name: 'coop-coep-and-wasm-mime',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        for (const [key, value] of Object.entries(COOP_COEP_HEADERS)) {
          res.setHeader(key, value);
        }
        if (req.url && req.url.split('?')[0].endsWith('.wasm')) {
          res.setHeader('Content-Type', 'application/wasm');
        }
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        for (const [key, value] of Object.entries(COOP_COEP_HEADERS)) {
          res.setHeader(key, value);
        }
        if (req.url && req.url.split('?')[0].endsWith('.wasm')) {
          res.setHeader('Content-Type', 'application/wasm');
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [wasmHeadersPlugin()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    headers: COOP_COEP_HEADERS,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    headers: COOP_COEP_HEADERS,
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          jszip: ['jszip'],
        },
      },
    },
  },
});

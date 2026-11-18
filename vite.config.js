import { defineConfig } from 'vite';

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

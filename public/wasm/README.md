# Panda3DS WebAssembly Artifacts (`public/wasm/`)

This directory holds the WebAssembly runtime artifacts loaded dynamically by `src/emulator.js`:

- `Panda3DS.js`
- `Panda3DS.wasm`
- `Panda3DS.worker.js`

Currently populated with a ready-to-run Panda3DS WebAssembly runtime (ARM interpreter + OpenGL ES / WebGL2 SDL2 build). To rebuild from source via Emscripten against a custom WASM-patched fork, run:

```bash
bash scripts/build-wasm.sh
```

# Panda3DS WebAssembly Artifacts (`public/wasm/`)

This directory holds the WebAssembly runtime artifacts loaded dynamically by `src/emulator.js`:

- `Panda3DS.js`
- `Panda3DS.wasm`
- `Panda3DS.worker.js`

Built directly from source (`wheremyfoodat/Panda3DS` + `wasm-patches/` ARM11/Thumb/VFPv2/CP15 DynCom interpreter + Emscripten WebGL2/SDL2/IDBFS/pthreads patches). To rebuild from scratch:

```bash
bash scripts/build-wasm.sh
```

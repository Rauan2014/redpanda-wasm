[Português (PT-BR)](README.md) | **English**

# Panda3DS Web — Nintendo 3DS HOME Menu

Nintendo 3DS emulator running 100% in the browser (client-side via WebAssembly and WebGL2), featuring a front-end inspired by the Nintendo 3DS HOME Menu and ready for static deployment on Vercel.

## Project Structure

- `scripts/build-wasm.sh`: Automated script to verify/install portable CMake and `emsdk`, clone `wheremyfoodat/Panda3DS` and the ARM DynCom sources (`azahar`), apply the patches in `wasm-patches/` (ARM11v6K/Thumb/VFPv2/CP15 interpreter, WebGL2 ES 3.00, `emscripten_set_main_loop_arg`, pthreads, and IDBFS), and compile `Panda3DS.js`, `Panda3DS.wasm`, and `Panda3DS.worker.js` into `public/wasm/`.
- `wasm-patches/`: C++/CMake overlay (`cpu_dyncom`, `arm_dyncom` shim, `apply.py`) that ports Panda3DS to WebAssembly with a full ARM11 interpreter.
- `scripts/serve.mjs`: Local static server for `dist/` with COOP/COEP headers and `application/wasm` MIME type.
- `public/wasm/`: WebAssembly artifacts of the Panda3DS core (`Panda3DS.js`, `Panda3DS.wasm`, `Panda3DS.worker.js`).
- `public/roms/`: Contains `blockblast.3dsx` (214 KB, Zlib open-source homebrew `TheFilipcom4607/BlockBlast-3DS`) as a preloaded demo ROM ready to play on both screens.
- `src/`: Modular front-end built with Vite + Three.js + JSZip (`main.js`, `cartridge3d.js`, `emulator.js`, `saves.js`, `romParser.js`, `audio.js`, `styles.css`).
- `vercel.json`: Configures `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` on all routes to enable `SharedArrayBuffer` (`window.crossOriginIsolated === true`).

## Development and Build

```bash
npm install
npm run dev      # Local Vite server with COOP/COEP
npm run build    # Static build in dist/
npm run serve    # Test dist/ locally with COOP/COEP headers
```

## Emulator Controls

- **Arrow Keys / WASD**: D-Pad / Circle Pad
- **`L` / `K` / `O` / `I`**: `A` / `B` / `X` / `Y` buttons
- **`Enter` / `Backspace`**: `START` / `SELECT`
- **Mouse / Touch on Bottom Screen**: 3DS Touchscreen
- **`.3ds` / `.cci` / `.cxi` ROMs**: Use **decrypted** ROMs (or `.3dsx` homebrew).

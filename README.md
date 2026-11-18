# Panda3DS Web — Nintendo 3DS HOME Menu

Emulador de Nintendo 3DS rodando 100% no navegador (client-side via WebAssembly e WebGL2), com front-end inspirado no HOME Menu do Nintendo 3DS e configuração pronta para deploy estático na Vercel.

## Estrutura do Projeto

- `scripts/build-wasm.sh`: Script automatizado para verificar/instalar o `emsdk`, clonar `wheremyfoodat/Panda3DS` (`--recursive`), configurar via `emcmake cmake` com flags WebGL2/SDL2/pthreads/IDBFS e copiar `.js`, `.wasm` e `.worker.js` para `public/wasm/`.
- `scripts/serve.mjs`: Servidor estático local para `dist/` com headers COOP/COEP e MIME `application/wasm`.
- `public/wasm/`: Artefatos WebAssembly do núcleo Panda3DS (`Panda3DS.js`, `Panda3DS.wasm`, `Panda3DS.worker.js`).
- `public/roms/`: Contém `flappy.3dsx` (481 KB, homebrew open-source MIT `MillKeny/flappy`) como ROM demo pré-carregada pronta para jogar.
- `src/`: Front-end modular em Vite + Three.js + JSZip (`main.js`, `cartridge3d.js`, `emulator.js`, `saves.js`, `romParser.js`, `audio.js`, `styles.css`).
- `vercel.json`: Configura `Cross-Origin-Opener-Policy: same-origin` e `Cross-Origin-Embedder-Policy: require-corp` em todas as rotas para habilitar `SharedArrayBuffer` (`window.crossOriginIsolated === true`).

## Desenvolvimento e Build

```bash
npm install
npm run dev      # Servidor local Vite com COOP/COEP
npm run build    # Build estático em dist/
npm run serve    # Testa dist/ localmente com headers COOP/COEP
```

## Controles do Emulador

- **Setas / WASD**: D-Pad / Circle Pad
- **`L` / `K` / `O` / `I`**: Botões `A` / `B` / `X` / `Y`
- **`Enter` / `Backspace`**: `START` / `SELECT`
- **Mouse / Toque na Tela Inferior**: Touchscreen do 3DS
- **ROMs `.3ds` / `.cci` / `.cxi`**: Utilize ROMs **descriptografadas** (ou `.3dsx` homebrew).

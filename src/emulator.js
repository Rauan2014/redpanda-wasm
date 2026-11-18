/**
 * Emscripten Panda3DS Runtime Bridge:
 * - Dynamically loads /wasm/Panda3DS.js
 * - Mounts IDBFS on /user and restores IndexedDB state via FS.syncfs(true)
 * - Writes ROM bytes to /roms/<file> via FS.writeFile and runs Module.callMain
 * - Mirrors the hidden 400x480 WebGL2 framebuffer onto the 400x240 Top and 320x240 Bottom canvases
 * - Forwards Bottom Screen pointer drags/clicks as SDL2 mouse events
 */

const SYNC_INTERVAL_MS = 5000;

const KEYCODE_MAP = {
  ArrowUp: { keyCode: 38, code: 'ArrowUp' },
  ArrowDown: { keyCode: 40, code: 'ArrowDown' },
  ArrowLeft: { keyCode: 37, code: 'ArrowLeft' },
  ArrowRight: { keyCode: 39, code: 'ArrowRight' },
  Enter: { keyCode: 13, code: 'Enter' },
  Backspace: { keyCode: 8, code: 'Backspace' },
  l: { keyCode: 76, code: 'KeyL' },
  k: { keyCode: 75, code: 'KeyK' },
  o: { keyCode: 79, code: 'KeyO' },
  i: { keyCode: 73, code: 'KeyI' },
  q: { keyCode: 81, code: 'KeyQ' },
  p: { keyCode: 80, code: 'KeyP' },
  w: { keyCode: 87, code: 'KeyW' },
  s: { keyCode: 83, code: 'KeyS' },
  a: { keyCode: 65, code: 'KeyA' },
  d: { keyCode: 68, code: 'KeyD' },
};

export class Panda3DSEmulator {
  #emuCanvas;
  #topCanvas;
  #bottomCanvas;
  #topCtx;
  #bottomCtx;
  #onStatus;
  #onLog;
  #onAbort;
  #module = null;
  #mirrorRafId = null;
  #syncTimerId = null;
  #syncInFlight = false;
  #running = false;
  #paused = false;
  #activeRomPath = null;
  #idbfsMounted = false;
  #initHandled = false;
  #patchedWebGL = false;

  constructor({ emuCanvas, topCanvas, bottomCanvas, onStatus, onLog, onAbort }) {
    this.#emuCanvas = emuCanvas;
    this.#topCanvas = topCanvas;
    this.#bottomCanvas = bottomCanvas;
    this.#topCtx = topCanvas.getContext('2d');
    this.#bottomCtx = bottomCanvas.getContext('2d');
    this.#onStatus = onStatus;
    this.#onLog = onLog;
    this.#onAbort = onAbort;

    this.#patchEmuCanvasWebGL();
    this.#bindBottomTouchForwarding();
    this.#bindUnloadSync();
  }

  get isRunning() {
    return this.#running;
  }

  get module() {
    return this.#module;
  }

  /**
   * Ensures preserveDrawingBuffer: true on the hidden SDL2 WebGL2 canvas so
   * ctx.drawImage(emuCanvas, ...) captures frames reliably across rAF boundaries.
   */
  #patchEmuCanvasWebGL() {
    if (this.#patchedWebGL) return;
    this.#patchedWebGL = true;

    const origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = (function (orig) {
      return function (type, attrs) {
        if (this.id === 'canvas' && (type === 'webgl2' || type === 'webgl' || type === 'experimental-webgl')) {
          attrs = { ...(attrs || {}), preserveDrawingBuffer: true };
        }
        return orig.call(this, type, attrs);
      };
    })(origGetContext);
  }

  #replaceHiddenCanvas() {
    const fresh = document.createElement('canvas');
    fresh.id = 'canvas';
    fresh.className = this.#emuCanvas.className;
    fresh.width = 400;
    fresh.height = 480;
    fresh.tabIndex = -1;
    fresh.setAttribute('aria-hidden', 'true');
    this.#emuCanvas.replaceWith(fresh);
    this.#emuCanvas = fresh;
  }

  async checkWasmAvailability() {
    try {
      const resp = await fetch('/wasm/Panda3DS.js', { method: 'HEAD', cache: 'no-store' });
      if (!resp.ok) {
        return { available: false, reason: `HTTP ${resp.status} ao buscar /wasm/Panda3DS.js` };
      }
      const ctype = resp.headers.get('content-type') || '';
      if (ctype.includes('text/html')) {
        return {
          available: false,
          reason: 'O servidor retornou HTML (fallback) em /wasm/Panda3DS.js — o núcleo WASM ainda não foi compilado em public/wasm/.',
        };
      }
      return { available: true };
    } catch (err) {
      return { available: false, reason: err.message };
    }
  }

  async launchRom(romFileName, romBytes) {
    if (!window.crossOriginIsolated) {
      this.#onLog?.('Aviso: crossOriginIsolated está desativado; SharedArrayBuffer pode estar indisponível.');
    }

    const safeFileName = romFileName.replace(/[^\w.\-]/g, '_');
    const romPath = `/roms/${safeFileName}`;

    // Resume seamlessly if user paused the same ROM by returning to HOME
    if (this.#module && this.#paused && this.#activeRomPath === romPath) {
      this.#paused = false;
      this.#running = true;
      this.#module._emscripten_resume_main_loop?.();
      this.#module.resumeMainLoop?.();
      this.#startMirrorLoop();
      this.#onStatus?.(`Retomando ${safeFileName}...`);
      return { ok: true };
    }

    // Switch ROM inside the active WebAssembly instance without leaking SharedArrayBuffer memory
    if (this.#module?.FS && this.#module?.callMain) {
      this.#module._emscripten_pause_main_loop?.();
      this.#module.pauseMainLoop?.();
      this.#stopMirrorLoop();
      await this.syncSavesToIndexedDb();
      this.#bootRomInModule(this.#module, romPath, romBytes);
      return { ok: true };
    }

    const probe = await this.checkWasmAvailability();
    if (!probe.available) {
      return { ok: false, missingWasm: true, reason: probe.reason };
    }

    // Reset stale canvas/state only if a non-reusable instance remained
    if (this.#module) {
      this.#module.pauseMainLoop?.();
      this.#stopMirrorLoop();
      await this.syncSavesToIndexedDb();
      this.#module = null;
      this.#idbfsMounted = false;
      this.#initHandled = false;
      this.#replaceHiddenCanvas();
    }

    // Use compatible WebGL2 shader path by default (?accel=1 enables experimental accelerated PICA shaders)
    const params = new URLSearchParams(location.search);
    window.p3dsForceAccel = params.get('accel') === '1' ? 1 : 0;
    window.__log = window.__log || [];
    window.__statsLog = window.__statsLog || [];

    this.#onStatus?.('Carregando núcleo Panda3DS.js...');
    const { promise, resolve, reject } = Promise.withResolvers();

    const moduleConfig = {
      canvas: this.#emuCanvas,
      locateFile: (file) => {
        if (file === 'Alber.wasm' || file.endsWith('.wasm')) return '/wasm/Panda3DS.wasm';
        if (file.endsWith('.worker.js')) return '/wasm/Panda3DS.worker.js';
        return `/wasm/${file}`;
      },
      noInitialRun: true,
      print: (msg) => this.#onLog?.(`[Panda3DS] ${msg}`),
      printErr: (msg) => this.#onLog?.(`[Panda3DS:err] ${msg}`),
      onAbort: (what) => {
        this.#running = false;
        this.#paused = false;
        this.#stopMirrorLoop();
        this.#onStatus?.(`Emulador abortado: ${what}`);
        this.#onLog?.(`[Abort] ${what}`);
        this.#onAbort?.(String(what));
      },
      onRuntimeInitialized: () => {
        this.#handleRuntimeInitialized(moduleConfig, romPath, romBytes, resolve, reject);
      },
    };

    window.Module = moduleConfig;

    try {
      if (typeof window.Panda3DS !== 'function') {
        await this.#loadClassicScript('/wasm/Panda3DS.js');
      }

      const factory = typeof window.Panda3DS === 'function'
        ? window.Panda3DS
        : typeof window.Module === 'function'
          ? window.Module
          : null;

      if (factory) {
        const instance = await factory(moduleConfig);
        this.#module = instance;
        if (!this.#initHandled && instance?.FS) {
          this.#handleRuntimeInitialized(instance, romPath, romBytes, resolve, reject);
        }
      }
    } catch (err) {
      reject(new Error(`Falha ao carregar /wasm/Panda3DS.js: ${err.message}`, { cause: err }));
    }

    await promise;
    return { ok: true };
  }

  #loadClassicScript(src) {
    const { promise, resolve, reject } = Promise.withResolvers();
    const existing = document.querySelector(`script[data-panda3ds-runtime="true"]`);
    if (existing) existing.remove();

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.dataset.panda3dsRuntime = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Erro de rede ao carregar ${src}`));
    document.head.append(script);
    return promise;
  }

  #handleRuntimeInitialized(mod, romPath, romBytes, resolve, reject) {
    if (this.#initHandled) return;
    this.#initHandled = true;
    this.#module = mod;

    const FS = mod.FS;
    const IDBFS = mod.IDBFS || FS?.filesystems?.IDBFS;
    if (!FS) {
      reject(new Error('Module.FS não está exportado no build WebAssembly.'));
      return;
    }

    try {
      FS.mkdirTree('/user');
      FS.mkdirTree('/roms');
      FS.mkdirTree('/libsdl');

      if (!this.#idbfsMounted && IDBFS) {
        FS.mount(IDBFS, {}, '/user');
        this.#idbfsMounted = true;
      }

      // Symlink /libsdl/Alber -> /user so SDL_GetPrefPath saves & config persist in /user IDBFS
      try {
        FS.lstat('/libsdl/Alber');
      } catch {
        try {
          FS.symlink('/user', '/libsdl/Alber');
        } catch {
          // Non-fatal if path already exists
        }
      }

      this.#onStatus?.('Sincronizando saves (/user <-> IndexedDB)...');
      FS.syncfs(true, (syncErr) => {
        if (syncErr) {
          this.#onLog?.(`[IDBFS] Erro ao restaurar /user: ${syncErr}`);
        } else {
          this.#onLog?.('[IDBFS] /user restaurado com sucesso do IndexedDB.');
        }

        try {
          this.#bootRomInModule(mod, romPath, romBytes);
          this.#startPeriodicSync();
          setTimeout(() => void this.syncSavesToIndexedDb(), 1200);
          resolve();
        } catch (bootErr) {
          reject(bootErr);
        }
      });
    } catch (err) {
      reject(new Error(`Erro ao inicializar sistema de arquivos IDBFS: ${err.message}`, { cause: err }));
    }
  }

  #bootRomInModule(mod, romPath, romBytes) {
    mod.FS.mkdirTree('/roms');
    mod.FS.writeFile(romPath, romBytes);
    this.#activeRomPath = romPath;
    this.#onLog?.(`[FS] ROM gravada em ${romPath} (${romBytes.byteLength} bytes)`);

    this.#running = true;
    this.#paused = false;
    this.#startMirrorLoop();
    this.#onStatus?.(`Executando ${romPath.split('/').pop()}...`);

    try {
      mod.callMain([romPath]);
    } catch (err) {
      if (!String(err).includes('unwind')) {
        this.#onLog?.(`[callMain] ${err?.stack || err}`);
      }
    }
  }

  /**
   * Captures the 400x480 hidden WebGL2 framebuffer and splits it:
   * - Top half (0, 0, 400, 240) -> Top Screen (400x240)
   * - Bottom half (40, 240, 320, 240) -> Bottom Screen (320x240)
   */
  #startMirrorLoop() {
    this.#stopMirrorLoop();
    const renderMirror = () => {
      if (!this.#running) return;
      this.#mirrorRafId = requestAnimationFrame(renderMirror);

      const srcW = this.#emuCanvas.width || 400;
      const srcH = this.#emuCanvas.height || 480;
      const halfH = Math.floor(srcH / 2);

      this.#topCtx.imageSmoothingEnabled = false;
      this.#topCtx.clearRect(0, 0, 400, 240);
      this.#topCtx.drawImage(this.#emuCanvas, 0, 0, srcW, halfH, 0, 0, 400, 240);

      const bottomSrcX = srcW >= 400 ? Math.floor((srcW - 320) / 2) : 0;
      const bottomSrcW = srcW >= 400 ? 320 : srcW;

      this.#bottomCtx.imageSmoothingEnabled = false;
      this.#bottomCtx.clearRect(0, 0, 320, 240);
      this.#bottomCtx.drawImage(this.#emuCanvas, bottomSrcX, halfH, bottomSrcW, halfH, 0, 0, 320, 240);
    };
    this.#mirrorRafId = requestAnimationFrame(renderMirror);
  }

  #stopMirrorLoop() {
    if (this.#mirrorRafId !== null) {
      cancelAnimationFrame(this.#mirrorRafId);
      this.#mirrorRafId = null;
    }
  }

  stopDisplay() {
    this.#running = false;
    this.#paused = true;
    this.#module?._emscripten_pause_main_loop?.();
    this.#module?.pauseMainLoop?.();
    this.#stopMirrorLoop();
    void this.syncSavesToIndexedDb();
  }

  async syncSavesToIndexedDb() {
    if (!this.#module?.FS || !this.#idbfsMounted || this.#syncInFlight) return;
    this.#syncInFlight = true;
    const { promise, resolve } = Promise.withResolvers();
    try {
      this.#module.FS.syncfs(false, (err) => {
        this.#syncInFlight = false;
        if (err) this.#onLog?.(`[IDBFS] Erro na sincronização: ${err}`);
        resolve();
      });
    } catch {
      this.#syncInFlight = false;
      resolve();
    }
    await promise;
  }

  #startPeriodicSync() {
    if (this.#syncTimerId !== null) clearInterval(this.#syncTimerId);
    this.#syncTimerId = setInterval(() => {
      void this.syncSavesToIndexedDb();
    }, SYNC_INTERVAL_MS);
  }

  #bindUnloadSync() {
    window.addEventListener('beforeunload', () => {
      if (this.#module?.FS && this.#idbfsMounted) {
        try {
          this.#module.FS.syncfs(false, () => {});
        } catch {
          // Best-effort unload sync
        }
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        void this.syncSavesToIndexedDb();
      }
    });
  }

  /**
   * Forwards mouse/touch clicks and drags on the Bottom Screen (320x240)
   * onto the hidden 400x480 SDL2 WebGL2 canvas bottom touchscreen region.
   */
  #bindBottomTouchForwarding() {
    let activePointerId = null;

    const mapToSdlClientCoords = (clientX, clientY) => {
      const bottomRect = this.#bottomCanvas.getBoundingClientRect();
      const emuRect = this.#emuCanvas.getBoundingClientRect();

      const u = Math.max(0, Math.min(1, (clientX - bottomRect.left) / Math.max(1, bottomRect.width)));
      const v = Math.max(0, Math.min(1, (clientY - bottomRect.top) / Math.max(1, bottomRect.height)));

      const targetX = emuRect.left + (40 + u * 320) * (emuRect.width / 400);
      const targetY = emuRect.top + (240 + v * 240) * (emuRect.height / 480);
      return { clientX: targetX, clientY: targetY };
    };

    const dispatchMouse = (type, clientX, clientY, buttons) => {
      const mapped = mapToSdlClientCoords(clientX, clientY);
      const evt = new MouseEvent(type, {
        clientX: mapped.clientX,
        clientY: mapped.clientY,
        button: 0,
        buttons,
        bubbles: true,
        cancelable: true,
      });
      this.#emuCanvas.dispatchEvent(evt);
    };

    this.#bottomCanvas.addEventListener('pointerenter', (e) => {
      if (!this.#running) return;
      dispatchMouse('mouseenter', e.clientX, e.clientY, 0);
      dispatchMouse('mousemove', e.clientX, e.clientY, 0);
    });

    this.#bottomCanvas.addEventListener('pointerdown', (e) => {
      if (!this.#running) return;
      activePointerId = e.pointerId;
      try { this.#bottomCanvas.setPointerCapture(e.pointerId); } catch {}
      // Emscripten SDL2 requires mousemove/mouseenter coordinates on #canvas prior to mousedown
      dispatchMouse('mouseenter', e.clientX, e.clientY, 0);
      dispatchMouse('mousemove', e.clientX, e.clientY, 0);
      dispatchMouse('mousedown', e.clientX, e.clientY, 1);
    });

    this.#bottomCanvas.addEventListener('pointermove', (e) => {
      if (!this.#running) return;
      if (activePointerId === e.pointerId) {
        dispatchMouse('mousemove', e.clientX, e.clientY, 1);
      } else if (activePointerId === null) {
        dispatchMouse('mousemove', e.clientX, e.clientY, 0);
      }
    });

    const endTouch = (e) => {
      if (activePointerId !== e.pointerId) return;
      activePointerId = null;
      try {
        if (this.#bottomCanvas.hasPointerCapture(e.pointerId)) {
          this.#bottomCanvas.releasePointerCapture(e.pointerId);
        }
      } catch {}
      if (this.#running) {
        dispatchMouse('mouseup', e.clientX, e.clientY, 0);
      }
    };

    this.#bottomCanvas.addEventListener('pointerup', endTouch);
    this.#bottomCanvas.addEventListener('pointercancel', endTouch);
  }

  /**
   * Dispatches synthetic key events with keyCode/which/code for SDL2 Emscripten input.
   */
  sendVirtualKey(key, pressed) {
    if (!this.#running || !key) return;
    const type = pressed ? 'keydown' : 'keyup';
    const info = KEYCODE_MAP[key] || { keyCode: 0, code: key };
    const evt = new KeyboardEvent(type, {
      key,
      code: info.code,
      keyCode: info.keyCode,
      which: info.keyCode,
      bubbles: true,
      cancelable: true,
    });
    if (evt.keyCode !== info.keyCode) {
      Object.defineProperty(evt, 'keyCode', { get: () => info.keyCode });
      Object.defineProperty(evt, 'which', { get: () => info.keyCode });
    }
    document.dispatchEvent(evt);
  }
}

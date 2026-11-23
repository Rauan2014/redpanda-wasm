/**
 * Emscripten Panda3DS Runtime Bridge:
 * - Dynamically loads /wasm/Panda3DS.js
 * - Mounts IDBFS on /user and restores IndexedDB state via FS.syncfs(true)
 * - Writes ROM bytes to /roms/<file> via FS.writeFile and runs Module.callMain
 * - Displays the top half (400x240) of the WebGL2 framebuffer directly in Top Screen and mirrors the bottom half onto Bottom Screen (320x240)
 * - Forwards Bottom Screen pointer drags/clicks as SDL2 mouse events
 */

import { t } from './i18n.js';

/* global __WASM_BUILD_HASH__ */
const WASM_BUILD_HASH = typeof __WASM_BUILD_HASH__ === 'string' ? __WASM_BUILD_HASH__ : '';
const WASM_QUERY = WASM_BUILD_HASH ? `?v=${WASM_BUILD_HASH}` : '';

const SYNC_INTERVAL_MS = 30000;
const CIRCLE_PAD_MAX = 0x9c;
const C_STICK_MAX = 2047;
const LOG_THROTTLE_MS = 250;

/** Panda3DS HID::Keys bitmasks aligned with include/services/hid.hpp */
export const HID_KEYS = Object.freeze({
  A: 1 << 0,
  B: 1 << 1,
  Select: 1 << 2,
  Start: 1 << 3,
  Right: 1 << 4,
  Left: 1 << 5,
  Up: 1 << 6,
  Down: 1 << 7,
  R: 1 << 8,
  L: 1 << 9,
  X: 1 << 10,
  Y: 1 << 11,
  ZL: 1 << 14,
  ZR: 1 << 15,
});

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
  '1': { keyCode: 49, code: 'Digit1' },
  '0': { keyCode: 48, code: 'Digit0' },
  w: { keyCode: 87, code: 'KeyW' },
  s: { keyCode: 83, code: 'KeyS' },
  a: { keyCode: 65, code: 'KeyA' },
  d: { keyCode: 68, code: 'KeyD' },
};

export class Panda3DSEmulator {
  #emuCanvas;
  #bottomCanvas;
  #topCtx;
  #bottomCtx;
  #onStatus;
  #onLog;
  #onAbort;
  #onFps;
  #module = null;
  #syncTimerId = null;
  #syncInFlight = false;
  #running = false;
  #paused = false;
  #activeRomPath = null;
  #idbfsMounted = false;
  #initHandled = false;
  #patchedWebGL = false;
  #cpuClockScalePct = 100;
  #emuAudioEnabled = true;
  #accelShaders = true;
  #mirrorBottom = true;
  #fpsFrames = 0;
  #fpsWindowStart = 0;
  #lastInfoLogAt = 0;

  constructor({ emuCanvas, topCanvas = null, bottomCanvas, onStatus, onLog, onAbort, onFps }) {
    this.#emuCanvas = emuCanvas;
    this.#bottomCanvas = bottomCanvas;
    this.#topCtx = topCanvas ? topCanvas.getContext('2d', { alpha: false }) : null;
    this.#bottomCtx = bottomCanvas.getContext('2d', { alpha: false });
    if (this.#topCtx) this.#topCtx.imageSmoothingEnabled = false;
    if (this.#bottomCtx) this.#bottomCtx.imageSmoothingEnabled = false;
    this.#onStatus = onStatus;
    this.#onLog = onLog;
    this.#onAbort = onAbort;
    this.#onFps = onFps;

    this.#patchEmuCanvasWebGL();
    this.#bindBottomTouchForwarding();
    this.#bindUnloadSync();
    this.#bindAudioUnlock();
  }

  get isRunning() {
    return this.#running;
  }

  get module() {
    return this.#module;
  }

  /**
   * Configures fast low-overhead WebGL2 attributes on the hidden SDL2 canvas.
   * Synchronous frame mirroring happens right after SDL_GL_SwapWindow so
   * preserveDrawingBuffer can stay false without extra compositor copies.
   */
  #patchEmuCanvasWebGL() {
    if (this.#patchedWebGL) return;
    this.#patchedWebGL = true;

    const origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = (function (orig) {
      return function (type, attrs) {
        if (this.id === 'canvas' && (type === 'webgl2' || type === 'webgl' || type === 'experimental-webgl')) {
          attrs = {
            ...(attrs || {}),
            antialias: false,
            alpha: false,
            depth: false,
            stencil: false,
            preserveDrawingBuffer: false,
            powerPreference: 'high-performance',
          };
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
    const ariaLabel = this.#emuCanvas.getAttribute('aria-label');
    fresh.setAttribute('aria-label', ariaLabel || t('canvas.topAria'));
    this.#emuCanvas.replaceWith(fresh);
    this.#emuCanvas = fresh;
  }

  async checkWasmAvailability() {
    try {
      const resp = await fetch(`/wasm/Panda3DS.js${WASM_QUERY}`, { method: 'HEAD', cache: 'no-store' });
      if (!resp.ok) {
        return { available: false, reason: t('emu.httpError', { status: resp.status }) };
      }
      const ctype = resp.headers.get('content-type') || '';
      if (ctype.includes('text/html')) {
        return {
          available: false,
          reason: t('emu.htmlFallbackError'),
        };
      }
      return { available: true };
    } catch (err) {
      return { available: false, reason: err.message };
    }
  }

  async launchRom(romFileName, romBytes) {
    if (!window.crossOriginIsolated) {
      this.#onLog?.(t('emu.noCoiWarn'));
    }

    const safeFileName = romFileName.replace(/[^\w.\-]/g, '_');
    const romPath = `/roms/${safeFileName}`;

    // Resume seamlessly if user paused the same ROM by returning to HOME
    if (this.#module && this.#paused && this.#activeRomPath === romPath) {
      this.#paused = false;
      this.#running = true;
      this.#applyRuntimePerfSettings();
      this.#module._panda_set_emu_audio?.(this.#emuAudioEnabled ? 1 : 0);
      if (this.#emuAudioEnabled) {
        this.unlockAudio();
      }
      this.#startMirrorHook();
      this.#module._emscripten_resume_main_loop?.();
      this.#module.resumeMainLoop?.();
      this.#onStatus?.(t('emu.resuming', { name: safeFileName }));
      return { ok: true };
    }

    // Switch ROM inside the active WebAssembly instance without leaking SharedArrayBuffer memory
    if (this.#module?.FS && this.#module?.callMain) {
      this.#module._emscripten_pause_main_loop?.();
      this.#module.pauseMainLoop?.();
      this.#stopMirrorHook();
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
      this.#stopMirrorHook();
      await this.syncSavesToIndexedDb();
      this.#module = null;
      this.#idbfsMounted = false;
      this.#initHandled = false;
      this.#replaceHiddenCanvas();
    }

    // Enable WebGL2 accelerated PICA vertex shaders by default (?accel=0 disables them)
    const params = new URLSearchParams(location.search);
    window.p3dsForceAccel = params.get('accel') === '0' ? 0 : 1;
    window.p3dsStreamBufMode = params.get('bufmode') === 'ring' ? 1 : 0;
    this.#mirrorBottom = params.get('bottom') !== '0';
    this.#accelShaders = window.p3dsForceAccel === 1;
    window.__log = window.__log || [];
    window.__statsLog = window.__statsLog || [];

    this.#onStatus?.(t('emu.loadingCore'));
    const { promise, resolve, reject } = Promise.withResolvers();

    const moduleConfig = {
      canvas: this.#emuCanvas,
      locateFile: (file) => {
        if (file === 'Alber.wasm' || file.endsWith('.wasm')) return `/wasm/Panda3DS.wasm${WASM_QUERY}`;
        if (file.endsWith('.worker.js')) return `/wasm/Panda3DS.worker.js${WASM_QUERY}`;
        return `/wasm/${file}${WASM_QUERY}`;
      },
      noInitialRun: true,
      print: (msg) => this.#handleCoreLog(msg, false),
      printErr: (msg) => this.#handleCoreLog(msg, true),
      onAbort: (what) => {
        this.#running = false;
        this.#paused = false;
        this.#stopMirrorHook();
        this.#onStatus?.(t('emu.emulatorAborted', { what }));
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
        await this.#loadClassicScript(`/wasm/Panda3DS.js${WASM_QUERY}`);
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
      reject(new Error(t('emu.wasmLoadFailed', { error: err.message }), { cause: err }));
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
    script.onerror = () => reject(new Error(`Network error loading ${src}`));
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
      reject(new Error(t('emu.noModuleFs')));
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

      this.#onStatus?.(t('emu.syncingSaves'));
      FS.syncfs(true, (syncErr) => {
        if (syncErr) {
          this.#onLog?.(t('emu.idbfsRestoreError', { error: syncErr }));
        } else {
          this.#onLog?.(t('emu.idbfsRestored'));
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
      reject(new Error(t('emu.idbfsInitError', { error: err.message }), { cause: err }));
    }
  }

  #bootRomInModule(mod, romPath, romBytes) {
    mod.FS.mkdirTree('/roms');
    mod.FS.writeFile(romPath, romBytes);
    this.#activeRomPath = romPath;
    this.#onLog?.(t('emu.romWritten', { path: romPath, bytes: romBytes.byteLength }));

    this.#running = true;
    this.#paused = false;
    this.resetWebInput();
    this.#applyRuntimePerfSettings();
    this.#startMirrorHook();
    this.#onStatus?.(t('emu.running', { name: romPath.split('/').pop() }));

    try {
      mod.callMain([romPath]);
    } catch (err) {
      if (!String(err).includes('unwind')) {
        this.#onLog?.(`[callMain] ${err?.stack || err}`);
      }
    } finally {
      if (this.#emuAudioEnabled) {
        this.unlockAudio();
      }
    }
  }

  #handleCoreLog(msg, isErr) {
    const text = String(msg ?? '');
    if (
      isErr ||
      !this.#running ||
      text.includes('FATAL') ||
      text.includes('Loaded') ||
      text.includes('Should raise') ||
      text.includes('WARN') ||
      text.includes('[Warning]') ||
      text.includes('ERROR') ||
      text.includes('[Perf]') ||
      text.includes('[ShaderDecompiler]') ||
      text.includes('GLSL recompiler')
    ) {
      this.#onLog?.(`${isErr ? '[Panda3DS:err]' : '[Panda3DS]'} ${text}`);
      return;
    }
    const now = performance.now();
    if (now - this.#lastInfoLogAt >= LOG_THROTTLE_MS) {
      this.#lastInfoLogAt = now;
      this.#onLog?.(`[Panda3DS] ${text}`);
    }
  }

  #applyRuntimePerfSettings() {
    this.#module?._panda_set_cpu_clock_scale?.(this.#cpuClockScalePct);
    this.#module?._panda_set_emu_audio?.(this.#emuAudioEnabled ? 1 : 0);
    this.#module?._panda_set_accelerate_shaders?.(this.#accelShaders ? 1 : 0);
  }

  setCpuClockScale(percent) {
    const clamped = Math.max(15, Math.min(200, Math.round(Number(percent) || 100)));
    this.#cpuClockScalePct = clamped;
    this.#module?._panda_set_cpu_clock_scale?.(clamped);
  }

  setEmuAudioEnabled(enabled) {
    this.#emuAudioEnabled = Boolean(enabled);
    this.#module?._panda_set_emu_audio?.(this.#emuAudioEnabled ? 1 : 0);
    if (this.#emuAudioEnabled) {
      this.unlockAudio();
    }
  }

  unlockAudio() {
    if (!this.#emuAudioEnabled || typeof window === 'undefined') return;
    const ma = window.miniaudio;
    if (!ma) return;
    const devices = ma.devices;
    const startedState = ma.device_state?.started;
    let hasSuspended = false;
    if (Array.isArray(devices)) {
      for (let i = 0; i < devices.length; i += 1) {
        const device = devices[i];
        const ctx = device?.webaudio;
        if (!ctx) continue;
        if (startedState !== undefined && device.state !== startedState) continue;
        if (ctx.state !== 'running') {
          hasSuspended = true;
          try {
            Promise.resolve(ctx.resume())
              .then(() => {
                if (ctx.state === 'running') {
                  this.#module?._ma_device__on_notification_unlocked?.(device.pDevice);
                }
              })
              .catch(() => {});
          } catch {
            // Ignore resume errors outside user gesture
          }
        }
      }
    }
    if (hasSuspended || !Array.isArray(devices)) {
      try {
        ma.unlock?.();
      } catch {
        // Ignore miniaudio unlock errors outside user gesture
      }
    }
  }

  #bindAudioUnlock() {
    if (typeof document === 'undefined') return;
    const onGesture = () => {
      if (this.#running && this.#emuAudioEnabled) {
        this.unlockAudio();
      }
    };
    for (const evt of ['pointerdown', 'keydown', 'touchend', 'click']) {
      document.addEventListener(evt, onGesture, { capture: true, passive: true });
    }
  }

  /**
   * Synchronously mirrors the 400x480 WebGL2 framebuffer immediately after
   * SDL_GL_SwapWindow(window) before the browser compositor clears it:
   * - Top half (0, 0, 400, 240) -> Top Screen (400x240)
   * - Bottom half (40, 240, 320, 240) -> Bottom Screen (320x240)
   */
  #startMirrorHook() {
    this.#fpsFrames = 0;
    this.#fpsWindowStart = performance.now();

    window.__pandaOnFrame = () => {
      if (!this.#running) return;

      const srcW = this.#emuCanvas.width || 400;
      const srcH = this.#emuCanvas.height || 480;
      const halfH = Math.floor(srcH / 2);

      if (this.#topCtx) {
        this.#topCtx.drawImage(this.#emuCanvas, 0, 0, srcW, halfH, 0, 0, 400, 240);
      }

      if (this.#mirrorBottom && this.#bottomCtx) {
        const bottomSrcX = srcW >= 400 ? Math.floor((srcW - 320) / 2) : 0;
        const bottomSrcW = srcW >= 400 ? 320 : srcW;
        this.#bottomCtx.drawImage(this.#emuCanvas, bottomSrcX, halfH, bottomSrcW, halfH, 0, 0, 320, 240);
      }

      this.#fpsFrames += 1;
      const now = performance.now();
      const elapsed = now - this.#fpsWindowStart;
      if (elapsed >= 500) {
        const fps = Math.round((this.#fpsFrames * 1000) / elapsed);
        this.#fpsFrames = 0;
        this.#fpsWindowStart = now;
        this.#onFps?.(fps);
      }
    };
  }

  #stopMirrorHook() {
    if (window.__pandaOnFrame) {
      window.__pandaOnFrame = null;
    }
    this.#fpsFrames = 0;
    this.#onFps?.(null);
  }

  stopDisplay() {
    this.#running = false;
    this.#paused = true;
    this.resetWebInput();
    this.#module?._panda_set_emu_audio?.(0);
    const devices = typeof window !== 'undefined' ? window.miniaudio?.devices : null;
    if (Array.isArray(devices)) {
      for (let i = 0; i < devices.length; i += 1) {
        const ctx = devices[i]?.webaudio;
        if (ctx && ctx.state === 'running') {
          try {
            void ctx.suspend();
          } catch {
            // Ignore suspend error
          }
        }
      }
    }
    this.#module?._emscripten_pause_main_loop?.();
    this.#module?.pauseMainLoop?.();
    this.#stopMirrorHook();
    void this.syncSavesToIndexedDb();
  }

  async syncSavesToIndexedDb() {
    if (!this.#module?.FS || !this.#idbfsMounted || this.#syncInFlight) return;
    this.#syncInFlight = true;
    const { promise, resolve } = Promise.withResolvers();
    try {
      this.#module.FS.syncfs(false, (err) => {
        this.#syncInFlight = false;
        if (err) this.#onLog?.(t('emu.idbfsSyncError', { error: err }));
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
    this.#bottomCanvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /**
   * Sends the active HID button bitmask (keyboard/gamepad/on-screen/mouse) to WASM.
   */
  setWebButtons(mask) {
    if (!this.#running) return;
    const normalized = mask >>> 0;
    if (normalized !== 0 && this.#emuAudioEnabled) {
      this.unlockAudio();
    }
    this.#module?._panda_set_web_buttons?.(normalized);
  }

  /**
   * Drives the analog Circle Pad using normalized browser screen axes:
   * axisX in [-1, 1] (+ right), axisY in [-1, 1] (+ down -> negated for 3DS +Y up).
   */
  setWebCirclePad(axisX, axisY, active) {
    if (!this.#running) return;
    const x = Math.round(Math.max(-1, Math.min(1, axisX)) * CIRCLE_PAD_MAX);
    const y = Math.round(Math.max(-1, Math.min(1, -axisY)) * CIRCLE_PAD_MAX);
    this.#module?._panda_set_web_circlepad?.(x, y, active ? 1 : 0);
  }

  /**
   * Drives the New 3DS C-Stick using normalized browser axes (+X right, +Y down).
   */
  setWebCStick(axisX, axisY, active) {
    if (!this.#running) return;
    const x = Math.round(Math.max(-1, Math.min(1, axisX)) * C_STICK_MAX);
    const y = Math.round(Math.max(-1, Math.min(1, -axisY)) * C_STICK_MAX);
    this.#module?._panda_set_web_cstick?.(x, y, active ? 1 : 0);
  }

  /**
   * Clears any latched web HID override state on ROM switch or exit to HOME.
   */
  resetWebInput() {
    this.#module?._panda_reset_web_input?.();
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
    window.dispatchEvent(new KeyboardEvent(type, {
      key,
      code: info.code,
      keyCode: info.keyCode,
      which: info.keyCode,
      bubbles: true,
      cancelable: true,
    }));
  }
}

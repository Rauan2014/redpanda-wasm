import { HID_KEYS } from './emulator.js';

const KEYBOARD_BUTTON_MAP = Object.freeze({
  ArrowUp: { mask: HID_KEYS.Up, uiKey: 'up' },
  ArrowDown: { mask: HID_KEYS.Down, uiKey: 'down' },
  ArrowLeft: { mask: HID_KEYS.Left, uiKey: 'left' },
  ArrowRight: { mask: HID_KEYS.Right, uiKey: 'right' },
  KeyL: { mask: HID_KEYS.A, uiKey: 'a' },
  KeyX: { mask: HID_KEYS.A, uiKey: 'a' },
  KeyK: { mask: HID_KEYS.B, uiKey: 'b' },
  KeyZ: { mask: HID_KEYS.B, uiKey: 'b' },
  KeyO: { mask: HID_KEYS.X, uiKey: 'x' },
  KeyV: { mask: HID_KEYS.X, uiKey: 'x' },
  KeyI: { mask: HID_KEYS.Y, uiKey: 'y' },
  KeyC: { mask: HID_KEYS.Y, uiKey: 'y' },
  KeyQ: { mask: HID_KEYS.L, uiKey: 'l' },
  KeyP: { mask: HID_KEYS.R, uiKey: 'r' },
  Digit1: { mask: HID_KEYS.ZL, uiKey: 'zl' },
  Digit0: { mask: HID_KEYS.ZR, uiKey: 'zr' },
  Enter: { mask: HID_KEYS.Start, uiKey: 'start' },
  Backspace: { mask: HID_KEYS.Select, uiKey: 'select' },
  ShiftRight: { mask: HID_KEYS.Select, uiKey: 'select' },
});

const KEYBOARD_ANALOG_VECTORS = Object.freeze({
  KeyW: [0, -1],
  KeyS: [0, 1],
  KeyA: [-1, 0],
  KeyD: [1, 0],
});

const MASK_TO_UI_KEYS = Object.freeze([
  [HID_KEYS.Up, 'up'],
  [HID_KEYS.Down, 'down'],
  [HID_KEYS.Left, 'left'],
  [HID_KEYS.Right, 'right'],
  [HID_KEYS.A, 'a'],
  [HID_KEYS.B, 'b'],
  [HID_KEYS.X, 'x'],
  [HID_KEYS.Y, 'y'],
  [HID_KEYS.L, 'l'],
  [HID_KEYS.R, 'r'],
  [HID_KEYS.ZL, 'zl'],
  [HID_KEYS.ZR, 'zr'],
  [HID_KEYS.Start, 'start'],
  [HID_KEYS.Select, 'select'],
]);

const MOUSE_MODES = ['motion', 'position', 'off'];

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function normalizeRadial(x, y, deadzone = 0) {
  const mag = Math.hypot(x, y);
  if (mag <= deadzone || mag === 0) return [0, 0];
  const scaled = clamp((mag - deadzone) / (1 - deadzone), 0, 1);
  return [(x / mag) * scaled, (y / mag) * scaled];
}

function vectorToDpadMask(x, y, threshold = 0.42) {
  let mask = 0;
  if (x <= -threshold) mask |= HID_KEYS.Left;
  if (x >= threshold) mask |= HID_KEYS.Right;
  if (y <= -threshold) mask |= HID_KEYS.Up;
  if (y >= threshold) mask |= HID_KEYS.Down;
  return mask;
}

/**
 * Unifies Keyboard, Web Gamepad API, Circle Pad pointer drag, Mouse-Motion Directional,
 * and clickable 3DS shell controls into a single deterministic HID + HOME input pipeline.
 */
export function createInputController({
  emulator,
  consoleEl,
  circlePadWell,
  circlePadThumb,
  bottomEmuCanvas,
  controlElements,
  isModalOpen,
  isFullscreen,
  onHomeNavigate,
  onHomeConfirm,
  onHomeCancel,
  onHomeToggle,
  onFullscreenToggle,
  onExitFullscreen,
  onMouseModeChange,
  onGamepadChange,
  onVisualState,
}) {
  const pressedCodes = new Set();
  const virtualButtons = new Map();
  let uiButtonMask = 0;

  let mouseMode = 'motion';
  let mouseMirrorDpad = true;
  let gamepadLayout = 'xbox'; // 'xbox' (Bottom=A, Right=B) | 'nintendo' (Bottom=B, Right=A)

  // Analog sources
  let padDragActive = false;
  let padDragPointerId = null;
  let padDragX = 0;
  let padDragY = 0;
  let padDragNavLatch = '';

  let mouseVelX = 0;
  let mouseVelY = 0;
  let mouseTargetX = 0;
  let mouseTargetY = 0;
  let lastClientX = null;
  let lastClientY = null;
  let lastMouseMoveAt = 0;

  let prevHomeGamepadNav = '';
  let prevHomePadRepeatAt = 0;
  let prevGamepadMask = 0;
  let lastReportedGamepadId = null;

  let rafId = null;
  let lastFrameTime = performance.now();

  function setMouseMode(nextMode) {
    if (!MOUSE_MODES.includes(nextMode)) return;
    mouseMode = nextMode;
    mouseTargetX = 0;
    mouseTargetY = 0;
    if (nextMode === 'off') {
      mouseVelX = 0;
      mouseVelY = 0;
    }
    onMouseModeChange?.(mouseMode);
  }

  function cycleMouseMode() {
    const idx = MOUSE_MODES.indexOf(mouseMode);
    setMouseMode(MOUSE_MODES[(idx + 1) % MOUSE_MODES.length]);
    return mouseMode;
  }

  function setMouseMirrorDpad(enabled) {
    mouseMirrorDpad = Boolean(enabled);
  }

  function setGamepadLayout(layout) {
    gamepadLayout = layout === 'nintendo' ? 'nintendo' : 'xbox';
  }

  function getSettings() {
    return { mouseMode, mouseMirrorDpad, gamepadLayout };
  }

  function clearAllLatched() {
    pressedCodes.clear();
    uiButtonMask = 0;
    padDragActive = false;
    padDragPointerId = null;
    padDragX = 0;
    padDragY = 0;
    mouseVelX = 0;
    mouseVelY = 0;
    mouseTargetX = 0;
    mouseTargetY = 0;
    prevGamepadMask = 0;
    syncOutputs(0, 0, 0, false, 0, 0, false);
  }

  function registerVirtualButton(uiKey, mask, element) {
    if (!element) return;
    virtualButtons.set(uiKey, { mask, element });

    let activePointerId = null;
    const press = (e) => {
      if (e.button && e.button !== 0) return;
      activePointerId = e.pointerId ?? 'mouse';
      uiButtonMask |= mask;
      element.classList.add('is-pressed');
    };
    const release = () => {
      if (activePointerId === null) return;
      activePointerId = null;
      uiButtonMask &= ~mask;
    };

    element.addEventListener('pointerdown', press);
    element.addEventListener('pointerup', release);
    element.addEventListener('pointercancel', release);
    element.addEventListener('pointerleave', release);
  }

  for (const [uiKey, cfg] of Object.entries(controlElements || {})) {
    registerVirtualButton(uiKey, cfg.mask, cfg.element);
  }

  // --------------------------------------------------------------------------
  // Direct Circle Pad Pointer Drag
  // --------------------------------------------------------------------------
  function updatePadDragFromPointer(clientX, clientY) {
    if (!circlePadWell) return;
    const rect = circlePadWell.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const radius = Math.max(12, rect.width * 0.42);
    const rawX = (clientX - cx) / radius;
    const rawY = (clientY - cy) / radius;
    const mag = Math.hypot(rawX, rawY);
    if (mag > 1) {
      padDragX = rawX / mag;
      padDragY = rawY / mag;
    } else {
      padDragX = rawX;
      padDragY = rawY;
    }

    if (!emulator.isRunning && !isModalOpen()) {
      let nav = '';
      if (Math.abs(padDragX) >= Math.abs(padDragY)) {
        if (padDragX <= -0.58) nav = 'left';
        else if (padDragX >= 0.58) nav = 'right';
      } else {
        if (padDragY <= -0.58) nav = 'up';
        else if (padDragY >= 0.58) nav = 'down';
      }
      if (nav && nav !== padDragNavLatch) {
        padDragNavLatch = nav;
        if (nav === 'left') onHomeNavigate?.(-1, 0);
        else if (nav === 'right') onHomeNavigate?.(1, 0);
        else if (nav === 'up') onHomeNavigate?.(0, -1);
        else if (nav === 'down') onHomeNavigate?.(0, 1);
      } else if (!nav) {
        padDragNavLatch = '';
      }
    }
  }

  if (circlePadWell) {
    circlePadWell.addEventListener('pointerdown', (e) => {
      if (e.button && e.button !== 0) return;
      e.preventDefault();
      padDragActive = true;
      padDragPointerId = e.pointerId;
      padDragNavLatch = '';
      circlePadWell.setPointerCapture?.(e.pointerId);
      updatePadDragFromPointer(e.clientX, e.clientY);
    });

    circlePadWell.addEventListener('pointermove', (e) => {
      if (!padDragActive || (padDragPointerId !== null && e.pointerId !== padDragPointerId)) return;
      updatePadDragFromPointer(e.clientX, e.clientY);
    });

    const stopPadDrag = (e) => {
      if (!padDragActive) return;
      if (padDragPointerId !== null && e.pointerId !== undefined && e.pointerId !== padDragPointerId) return;
      padDragActive = false;
      padDragPointerId = null;
      padDragX = 0;
      padDragY = 0;
      padDragNavLatch = '';
    };
    circlePadWell.addEventListener('pointerup', stopPadDrag);
    circlePadWell.addEventListener('pointercancel', stopPadDrag);
  }

  // --------------------------------------------------------------------------
  // Mouse Movement Directional ("Direcional move com o mouse mexendo")
  // --------------------------------------------------------------------------
  function handleMouseMotion(e) {
    if (isModalOpen() || mouseMode === 'off' || padDragActive) return;

    // Avoid interfering when user is actively touching/dragging bottom screen canvas
    if (e.target === bottomEmuCanvas && (e.buttons & 1) !== 0) {
      lastClientX = e.clientX;
      lastClientY = e.clientY;
      return;
    }

    const now = performance.now();
    lastMouseMoveAt = now;

    if (mouseMode === 'position') {
      const refRect = isFullscreen?.() || !consoleEl
        ? { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight }
        : consoleEl.getBoundingClientRect();
      const cx = refRect.left + refRect.width / 2;
      const cy = refRect.top + refRect.height / 2;
      const maxSpan = Math.max(120, Math.min(refRect.width, refRect.height) * 0.42);
      const rawX = (e.clientX - cx) / maxSpan;
      const rawY = (e.clientY - cy) / maxSpan;
      const [nx, ny] = normalizeRadial(rawX, rawY, 0.12);
      mouseTargetX = nx;
      mouseTargetY = ny;
      mouseVelX = nx;
      mouseVelY = ny;
      lastClientX = e.clientX;
      lastClientY = e.clientY;
      return;
    }

    // Default 'motion' mode: follow cursor movement velocity smoothly and self-center
    let dx = 0;
    let dy = 0;
    if (lastClientX !== null && lastClientY !== null) {
      dx = e.clientX - lastClientX;
      dy = e.clientY - lastClientY;
    } else if (typeof e.movementX === 'number' && typeof e.movementY === 'number' && (e.movementX || e.movementY)) {
      dx = e.movementX;
      dy = e.movementY;
    } else if (consoleEl) {
      const rect = consoleEl.getBoundingClientRect();
      dx = (e.clientX - (rect.left + rect.width / 2)) * 0.08;
      dy = (e.clientY - (rect.top + rect.height / 2)) * 0.08;
    }

    lastClientX = e.clientX;
    lastClientY = e.clientY;

    if (dx === 0 && dy === 0) return;

    const scaledX = clamp(dx / 12, -1, 1);
    const scaledY = clamp(dy / 12, -1, 1);
    const mag = Math.hypot(scaledX, scaledY);
    if (mag > 1) {
      mouseTargetX = scaledX / mag;
      mouseTargetY = scaledY / mag;
    } else {
      mouseTargetX = scaledX;
      mouseTargetY = scaledY;
    }
  }

  window.addEventListener('pointermove', handleMouseMotion, { passive: true });
  window.addEventListener('mousemove', (e) => {
    // Handles programmatic MouseEvent('mousemove') dispatches that omit PointerEvent
    if (window.PointerEvent && e instanceof PointerEvent) return;
    handleMouseMotion(e);
  }, { passive: true });

  // --------------------------------------------------------------------------
  // Keyboard Input (Gameplay + HOME Menu + Global Shortcuts)
  // --------------------------------------------------------------------------
  function isEditableTarget(target) {
    if (!target || !(target instanceof Element)) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
  }

  window.addEventListener('keydown', (e) => {
    if (isEditableTarget(e.target)) return;

    if (e.key === 'Escape') {
      if (isModalOpen()) return;
      if (isFullscreen?.()) {
        onExitFullscreen?.();
      } else if (!emulator.isRunning) {
        onHomeCancel?.();
      }
      return;
    }

    if (isModalOpen()) return;

    if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.repeat) {
      if (e.code === 'KeyF') {
        e.preventDefault();
        onFullscreenToggle?.();
        return;
      }
      if (e.code === 'KeyM') {
        e.preventDefault();
        cycleMouseMode();
        return;
      }
      if (e.code === 'KeyH' || e.code === 'Home') {
        if (emulator.isRunning) {
          e.preventDefault();
          onHomeToggle?.();
          return;
        }
      }
    }

    const mappedBtn = KEYBOARD_BUTTON_MAP[e.code];
    const isAnalogKey = e.code in KEYBOARD_ANALOG_VECTORS;

    if (!emulator.isRunning) {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        e.preventDefault();
        onHomeNavigate?.(-1, 0);
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        e.preventDefault();
        onHomeNavigate?.(1, 0);
      } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        onHomeNavigate?.(0, -1);
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault();
        onHomeNavigate?.(0, 1);
      } else if (!e.repeat && (e.code === 'KeyL' || e.code === 'KeyX' || (e.code === 'Enter' && !(document.activeElement instanceof HTMLButtonElement)))) {
        e.preventDefault();
        onHomeConfirm?.();
      } else if (!e.repeat && (e.code === 'KeyK' || e.code === 'KeyZ')) {
        e.preventDefault();
        onHomeCancel?.();
      }
    } else if (mappedBtn || isAnalogKey) {
      // Prevent Arrow keys from scrolling or Enter from re-triggering an unrelated toolbar button
      if (e.code.startsWith('Arrow') || e.code === 'Enter' || e.code === 'Backspace') {
        e.preventDefault();
      }
    }

    if (mappedBtn || isAnalogKey) {
      pressedCodes.add(e.code);
    }
  });

  window.addEventListener('keyup', (e) => {
    pressedCodes.delete(e.code);
  });

  window.addEventListener('blur', clearAllLatched);

  // --------------------------------------------------------------------------
  // Physical Gamepad / Controller Polling (navigator.getGamepads())
  // --------------------------------------------------------------------------
  function readGamepadState(now) {
    const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
    let pad = null;
    for (const candidate of pads) {
      if (candidate && candidate.connected) {
        pad = candidate;
        break;
      }
    }

    if (!pad) {
      if (lastReportedGamepadId !== null) {
        lastReportedGamepadId = null;
        onGamepadChange?.(null);
      }
      prevHomeGamepadNav = '';
      prevGamepadMask = 0;
      return { mask: 0, padX: 0, padY: 0, cX: 0, cY: 0 };
    }

    if (pad.id !== lastReportedGamepadId) {
      lastReportedGamepadId = pad.id;
      onGamepadChange?.({ id: pad.id, index: pad.index, mapping: pad.mapping || 'standard' });
    }

    const b = pad.buttons || [];
    const btnPressed = (idx, analogThreshold = 0.35) => {
      const btn = b[idx];
      return Boolean(btn && (btn.pressed || btn.value >= analogThreshold));
    };

    let mask = 0;
    if (gamepadLayout === 'nintendo') {
      if (btnPressed(0)) mask |= HID_KEYS.B;
      if (btnPressed(1)) mask |= HID_KEYS.A;
      if (btnPressed(2)) mask |= HID_KEYS.Y;
      if (btnPressed(3)) mask |= HID_KEYS.X;
    } else {
      if (btnPressed(0)) mask |= HID_KEYS.A;
      if (btnPressed(1)) mask |= HID_KEYS.B;
      if (btnPressed(2)) mask |= HID_KEYS.Y;
      if (btnPressed(3)) mask |= HID_KEYS.X;
    }

    if (btnPressed(4)) mask |= HID_KEYS.L;
    if (btnPressed(5)) mask |= HID_KEYS.R;
    if (btnPressed(6)) mask |= HID_KEYS.ZL;
    if (btnPressed(7)) mask |= HID_KEYS.ZR;
    if (btnPressed(8)) mask |= HID_KEYS.Select;
    if (btnPressed(9)) mask |= HID_KEYS.Start;
    if (btnPressed(12)) mask |= HID_KEYS.Up;
    if (btnPressed(13)) mask |= HID_KEYS.Down;
    if (btnPressed(14)) mask |= HID_KEYS.Left;
    if (btnPressed(15)) mask |= HID_KEYS.Right;

    // Guide / Home button (edge-triggered)
    const homePressed = btnPressed(16);
    const prevHomePressed = (prevGamepadMask & 0x100000) !== 0;
    if (homePressed && !prevHomePressed && !isModalOpen()) {
      onHomeToggle?.();
    }

    const ax = pad.axes || [];
    const [padX, padY] = normalizeRadial(ax[0] || 0, ax[1] || 0, 0.15);
    const [cX, cY] = normalizeRadial(ax[2] || 0, ax[3] || 0, 0.18);

    // HOME Menu navigation using physical gamepad D-Pad or Left Stick
    if (!emulator.isRunning && !isModalOpen()) {
      let nav = '';
      if ((mask & HID_KEYS.Left) || padX <= -0.55) nav = 'left';
      else if ((mask & HID_KEYS.Right) || padX >= 0.55) nav = 'right';
      else if ((mask & HID_KEYS.Up) || padY <= -0.55) nav = 'up';
      else if ((mask & HID_KEYS.Down) || padY >= 0.55) nav = 'down';

      if (nav && (nav !== prevHomeGamepadNav || now - prevHomePadRepeatAt >= 220)) {
        prevHomeGamepadNav = nav;
        prevHomePadRepeatAt = now;
        if (nav === 'left') onHomeNavigate?.(-1, 0);
        else if (nav === 'right') onHomeNavigate?.(1, 0);
        else if (nav === 'up') onHomeNavigate?.(0, -1);
        else if (nav === 'down') onHomeNavigate?.(0, 1);
      } else if (!nav) {
        prevHomeGamepadNav = '';
      }

      if ((mask & HID_KEYS.A) && !(prevGamepadMask & HID_KEYS.A)) {
        onHomeConfirm?.();
      } else if ((mask & HID_KEYS.B) && !(prevGamepadMask & HID_KEYS.B)) {
        onHomeCancel?.();
      }
    }

    prevGamepadMask = mask | (homePressed ? 0x100000 : 0);
    return { mask, padX, padY, cX, cY };
  }

  window.addEventListener('gamepadconnected', (e) => {
    lastReportedGamepadId = e.gamepad.id;
    onGamepadChange?.({ id: e.gamepad.id, index: e.gamepad.index, mapping: e.gamepad.mapping || 'standard' });
  });

  window.addEventListener('gamepaddisconnected', () => {
    lastReportedGamepadId = null;
    onGamepadChange?.(null);
  });

  // --------------------------------------------------------------------------
  // Frame Synchronization & Visual Feedback Loop
  // --------------------------------------------------------------------------
  function syncOutputs(buttonMask, circleX, circleY, circleActive, cX, cY, cActive) {
    // 1. Update Circle Pad visual thumb via CSS custom properties (on compositor)
    if (circlePadThumb) {
      const maxOffsetPx = 10;
      circlePadThumb.style.setProperty('--pad-x', `${(circleX * maxOffsetPx).toFixed(2)}px`);
      circlePadThumb.style.setProperty('--pad-y', `${(circleY * maxOffsetPx).toFixed(2)}px`);
    }
    if (circlePadWell) {
      circlePadWell.classList.toggle('is-active', circleActive || Math.hypot(circleX, circleY) > 0.08);
    }

    // 2. Highlight all active shell buttons visually (Keyboard + Gamepad + Mouse + Touch)
    for (const [maskBit, uiKey] of MASK_TO_UI_KEYS) {
      const btn = virtualButtons.get(uiKey);
      if (btn?.element) {
        btn.element.classList.toggle('is-pressed', (buttonMask & maskBit) !== 0);
      }
    }

    onVisualState?.({ buttonMask, circleX, circleY, circleActive });

    // 3. Push merged state directly into running Panda3DS WASM core
    if (emulator.isRunning) {
      emulator.setWebButtons(buttonMask);
      emulator.setWebCirclePad(circleX, circleY, circleActive);
      emulator.setWebCStick(cX, cY, cActive);
    }
  }

  function tick(now) {
    const dtMs = Math.min(50, Math.max(1, now - lastFrameTime));
    lastFrameTime = now;

    // 1. Smooth velocity follow + self-centering decay in 'motion' mouse mode
    if (mouseMode === 'motion' && !padDragActive) {
      if (now - lastMouseMoveAt > 95) {
        mouseTargetX = 0;
        mouseTargetY = 0;
      }
      const alpha = 1 - Math.exp(-dtMs * 0.022);
      mouseVelX += (mouseTargetX - mouseVelX) * alpha;
      mouseVelY += (mouseTargetY - mouseVelY) * alpha;
      if (Math.abs(mouseVelX) < 0.015 && mouseTargetX === 0) mouseVelX = 0;
      if (Math.abs(mouseVelY) < 0.015 && mouseTargetY === 0) mouseVelY = 0;
    }

    // 2. Keyboard buttons + WASD analog vector
    let keyMask = 0;
    let keyAxisX = 0;
    let keyAxisY = 0;
    for (const code of pressedCodes) {
      const mapped = KEYBOARD_BUTTON_MAP[code];
      if (mapped) keyMask |= mapped.mask;
      const vec = KEYBOARD_ANALOG_VECTORS[code];
      if (vec) {
        keyAxisX += vec[0];
        keyAxisY += vec[1];
      }
    }
    const keyMag = Math.hypot(keyAxisX, keyAxisY);
    if (keyMag > 1) {
      keyAxisX /= keyMag;
      keyAxisY /= keyMag;
    }

    // 3. Gamepad buttons + sticks
    const gp = readGamepadState(now);

    // 4. Priority selection for unified Circle Pad: Direct Pad Drag > Physical Gamepad > Keyboard WASD > Mouse Movement
    let circleX = 0;
    let circleY = 0;
    let circleActive = false;
    let mouseSteeredThisFrame = false;

    if (padDragActive && Math.hypot(padDragX, padDragY) > 0.05) {
      circleX = padDragX;
      circleY = padDragY;
      circleActive = true;
    } else if (Math.hypot(gp.padX, gp.padY) > 0.05) {
      circleX = gp.padX;
      circleY = gp.padY;
      circleActive = true;
    } else if (keyMag > 0) {
      circleX = keyAxisX;
      circleY = keyAxisY;
      circleActive = true;
    } else if (mouseMode !== 'off' && Math.hypot(mouseVelX, mouseVelY) > 0.04) {
      circleX = mouseVelX;
      circleY = mouseVelY;
      circleActive = true;
      mouseSteeredThisFrame = true;
    }

    // 5. Merge digital button masks (optionally mirror Mouse Directional / CirclePad drag onto D-Pad in-game)
    let totalMask = uiButtonMask | keyMask | gp.mask;
    if (emulator.isRunning && mouseMirrorDpad && (mouseSteeredThisFrame || padDragActive)) {
      totalMask |= vectorToDpadMask(circleX, circleY, 0.42);
    }

    const cActive = Math.hypot(gp.cX, gp.cY) > 0.05;
    syncOutputs(totalMask, circleX, circleY, circleActive, gp.cX, gp.cY, cActive);

    rafId = requestAnimationFrame(tick);
  }

  function start() {
    if (rafId !== null) return;
    lastFrameTime = performance.now();
    rafId = requestAnimationFrame(tick);
  }

  function stop() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    clearAllLatched();
  }

  return {
    start,
    stop,
    setMouseMode,
    cycleMouseMode,
    setMouseMirrorDpad,
    setGamepadLayout,
    getSettings,
    clearAllLatched,
  };
}

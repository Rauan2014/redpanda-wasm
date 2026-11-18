import * as THREE from 'three';

/**
 * Low-resolution (200x120) Three.js Nintendo 3DS Cartridge Banner.
 * Uses antialias: false and NearestFilter CanvasTexture for authentic 3DS pixel stair-stepping.
 */
export class CartridgeBanner3D {
  #canvas;
  #renderer;
  #scene;
  #camera;
  #cartGroup;
  #labelTexture;
  #labelCanvas;
  #labelCtx;
  #rafId = null;
  #impulseTimerId = null;
  #lastFrameTime = 0;
  #elapsed = 0;
  #paused = false;
  #reducedMotion = false;
  #dragging = false;
  #dragMoved = false;
  #dragLastX = 0;
  #dragLastY = 0;
  #targetTiltX = 0.1;
  #impulseVelocity = 0;
  #impulseRemainingMs = 0;
  #impulseDurationMs = 1900;
  #onTap = null;

  static BASE_SPIN_RAD_PER_FRAME = 0.011;
  static PERIODIC_IMPULSE_MS = 40_000;

  constructor(canvas, { onTap } = {}) {
    this.#canvas = canvas;
    this.#onTap = onTap;
    this.#reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Low-resolution 200x120 buffer with antialias: false for authentic 3DS hardware jaggies
    this.#renderer = new THREE.WebGLRenderer({
      canvas: this.#canvas,
      antialias: false,
      alpha: true,
      powerPreference: 'default',
    });
    this.#renderer.setPixelRatio(1);
    this.#renderer.setSize(200, 120, false);

    this.#scene = new THREE.Scene();
    this.#camera = new THREE.PerspectiveCamera(34, 200 / 120, 0.1, 30);
    this.#camera.position.set(0, 0.16, 4.35);
    this.#camera.lookAt(0, 0, 0);

    this.#setupLighting();
    this.#initLabelTexture();
    this.#cartGroup = this.#buildCartridgeModel();
    this.#cartGroup.rotation.y = -0.35;
    this.#cartGroup.rotation.x = 0.12;
    this.#scene.add(this.#cartGroup);

    this.#bindPointerEvents();
    this.#startPeriodicImpulse();
  }

  #setupLighting() {
    const hemi = new THREE.HemisphereLight(0xf6fbff, 0x5c728a, 1.35);
    this.#scene.add(hemi);

    const key = new THREE.DirectionalLight(0xfffaf0, 1.85);
    key.position.set(2.8, 3.6, 4.2);
    this.#scene.add(key);

    const fill = new THREE.DirectionalLight(0x8ee8ff, 0.85);
    fill.position.set(-3.2, 1.1, 2.5);
    this.#scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffffff, 0.75);
    rim.position.set(0.5, -2.5, -3.5);
    this.#scene.add(rim);
  }

  #initLabelTexture() {
    this.#labelCanvas = document.createElement('canvas');
    this.#labelCanvas.width = 128;
    this.#labelCanvas.height = 128;
    this.#labelCtx = this.#labelCanvas.getContext('2d');
    this.#labelCtx.imageSmoothingEnabled = false;

    this.#labelTexture = new THREE.CanvasTexture(this.#labelCanvas);
    this.#labelTexture.magFilter = THREE.NearestFilter;
    this.#labelTexture.minFilter = THREE.NearestFilter;
    this.#labelTexture.generateMipmaps = false;
    this.#labelTexture.colorSpace = THREE.SRGBColorSpace;
  }

  #buildCartridgeModel() {
    const group = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xeae8e1,
      roughness: 0.48,
      metalness: 0.05,
    });
    const grooveMat = new THREE.MeshStandardMaterial({
      color: 0xd7d4cb,
      roughness: 0.58,
      metalness: 0.04,
    });
    const darkPlasticMat = new THREE.MeshStandardMaterial({
      color: 0xc8c5bc,
      roughness: 0.65,
      metalness: 0.04,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xe3b83b,
      roughness: 0.24,
      metalness: 0.88,
    });

    // Main Nintendo 3DS Cartridge body
    const W = 1.76;
    const H = 1.94;
    const D = 0.22;

    const core = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), bodyMat);
    group.add(core);

    // Top grip bevel bar
    const topLip = new THREE.Mesh(new THREE.BoxGeometry(W + 0.03, 0.14, D + 0.03), bodyMat);
    topLip.position.set(0, H / 2 - 0.04, 0);
    group.add(topLip);

    // Asymmetric right-side distinguishing 3DS tab/notch ("dente lateral direito assimétrico")
    const rightTab = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.34, D), bodyMat);
    rightTab.position.set(W / 2 + 0.055, H / 2 - 0.2, 0);
    group.add(rightTab);

    // Upper side grip notches (3 horizontal ridges on left and right edges)
    for (let i = 0; i < 3; i++) {
      const yPos = 0.32 - i * 0.14;
      const ridgeL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, D * 0.72), grooveMat);
      ridgeL.position.set(-W / 2 - 0.01, yPos, 0);
      group.add(ridgeL);

      const ridgeR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, D * 0.72), grooveMat);
      ridgeR.position.set(W / 2 + 0.01, yPos - 0.12, 0);
      group.add(ridgeR);
    }

    // Front recessed label frame
    const frameW = 1.44;
    const frameH = 1.44;
    const recessBack = new THREE.Mesh(new THREE.BoxGeometry(frameW + 0.06, frameH + 0.06, 0.03), grooveMat);
    recessBack.position.set(0, -0.03, D / 2 - 0.005);
    group.add(recessBack);

    // Front sticker plane with dynamic pixelated CanvasTexture
    const stickerMat = new THREE.MeshStandardMaterial({
      map: this.#labelTexture,
      roughness: 0.34,
      metalness: 0.02,
    });
    const sticker = new THREE.Mesh(new THREE.PlaneGeometry(frameW, frameH), stickerMat);
    sticker.position.set(0, -0.03, D / 2 + 0.012);
    group.add(sticker);

    // Bottom triangle directional arrow embossed below label (classic DS/3DS cart detail)
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.09, 3), grooveMat);
    arrow.rotation.x = Math.PI;
    arrow.rotation.y = Math.PI;
    arrow.position.set(0, -H / 2 + 0.11, D / 2 + 0.005);
    group.add(arrow);

    // Back side: upper embossed label plate
    const backPlate = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.72, 0.02), grooveMat);
    backPlate.position.set(0, 0.42, -D / 2 - 0.004);
    group.add(backPlate);

    // Back side: recessed contact cavity + vertical plastic dividers + gold contact pins
    const pinAreaW = 1.46;
    const pinAreaH = 0.72;
    const pinCavity = new THREE.Mesh(new THREE.BoxGeometry(pinAreaW, pinAreaH, 0.03), darkPlasticMat);
    pinCavity.position.set(0, -H / 2 + 0.42, -D / 2 + 0.005);
    group.add(pinCavity);

    const numPins = 9;
    const pitch = pinAreaW / numPins;
    for (let i = 0; i < numPins; i++) {
      const x = -pinAreaW / 2 + pitch * (i + 0.5);
      // Gold contact pad recessed inside each slot
      const pin = new THREE.Mesh(new THREE.BoxGeometry(pitch * 0.58, pinAreaH * 0.78, 0.024), goldMat);
      pin.position.set(x, -H / 2 + 0.41, -D / 2 - 0.008);
      group.add(pin);
    }

    // Vertical plastic rib dividers shielding the gold pins
    for (let i = 0; i <= numPins; i++) {
      const x = -pinAreaW / 2 + pitch * i;
      const divider = new THREE.Mesh(new THREE.BoxGeometry(0.032, pinAreaH + 0.02, 0.055), bodyMat);
      divider.position.set(x, -H / 2 + 0.42, -D / 2 - 0.015);
      group.add(divider);
    }

    return group;
  }

  /**
   * Redraws the pixelated 128x128 cartridge label texture for the selected slot.
   */
  updateSlotLabel(slot) {
    const ctx = this.#labelCtx;
    const W = 128;
    const H = 128;
    ctx.imageSmoothingEnabled = false;

    // Background theme gradient per slot
    const palette = slot.palette || {
      bgTop: '#1668b2',
      bgBottom: '#0b2c5c',
      accent: '#38bdf8',
      text: '#ffffff',
    };

    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, palette.bgTop);
    grad.addColorStop(1, palette.bgBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Subtle pixel grid pattern
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    for (let y = 0; y < H; y += 8) {
      ctx.fillRect(0, y, W, 1);
    }

    // Main artwork box (right of the white lateral strip)
    const stripW = 22;
    const artX = stripW + 6;
    const artY = 10;
    const artW = W - artX - 8;
    const artH = 68;

    ctx.fillStyle = 'rgba(10, 18, 34, 0.45)';
    ctx.fillRect(artX - 2, artY - 2, artW + 4, artH + 4);

    if (slot.iconCanvas) {
      // Draw real extracted 48x48 SMDH ROM icon crisp-pixelated
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(artX, artY, artW, artH);
      const drawSize = Math.min(artW, artH) - 4;
      const dx = artX + Math.floor((artW - drawSize) / 2);
      const dy = artY + Math.floor((artH - drawSize) / 2);
      ctx.drawImage(slot.iconCanvas, dx, dy, drawSize, drawSize);
    } else if (slot.id === 'demo') {
      this.#draw2048Artwork(ctx, artX, artY, artW, artH);
    } else if (slot.id === 'load') {
      this.#drawLoadRomArtwork(ctx, artX, artY, artW, artH);
    } else if (slot.id === 'saves') {
      this.#drawSavesArtwork(ctx, artX, artY, artW, artH);
    } else {
      this.#drawEmptyArtwork(ctx, artX, artY, artW, artH);
    }

    // Slot title banner
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(stripW + 4, 83, W - stripW - 8, 22);
    ctx.fillStyle = palette.text || '#ffffff';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const shortName = (slot.cartTitle || slot.title || 'NINTENDO 3DS').slice(0, 13);
    ctx.fillText(shortName, stripW + (W - stripW) / 2, 94);

    // Serial code CTR-P-...
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 9px monospace';
    ctx.fillText((slot.serial || 'CTR-P-3DSW').slice(0, 14), stripW + (W - stripW) / 2, 115);

    // Signature white lateral "Nintendo 3DS" strip on the left side
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, stripW, H);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(stripW - 2, 0, 2, H);

    // Red accent square badge at top of white strip
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(4, 6, 14, 14);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('3DS', 11, 13);

    // Vertical "Nintendo 3DS" branding along the white strip
    ctx.save();
    ctx.translate(11, 74);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Nintendo 3DS', 0, 0);
    ctx.restore();

    this.#labelTexture.needsUpdate = true;
  }

  #draw2048Artwork(ctx, x, y, w, h) {
    ctx.fillStyle = '#bbada0';
    ctx.fillRect(x, y, w, h);
    const tiles = [
      { label: '2', bg: '#eee4da', fg: '#776e65' },
      { label: '4', bg: '#ede0c8', fg: '#776e65' },
      { label: '8', bg: '#f2b179', fg: '#ffffff' },
      { label: '2048', bg: '#edc22e', fg: '#ffffff' },
    ];
    const pad = 6;
    const cellW = Math.floor((w - pad * 3) / 2);
    const cellH = Math.floor((h - pad * 3) / 2);
    tiles.forEach((tile, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const cx = x + pad + col * (cellW + pad);
      const cy = y + pad + row * (cellH + pad);
      ctx.fillStyle = tile.bg;
      ctx.fillRect(cx, cy, cellW, cellH);
      ctx.fillStyle = tile.fg;
      ctx.font = tile.label.length > 2 ? 'bold 11px sans-serif' : 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tile.label, cx + cellW / 2, cy + cellH / 2 + 1);
    });
  }

  #drawLoadRomArtwork(ctx, x, y, w, h) {
    ctx.fillStyle = '#0f2942';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(x + 26, y + 12, 36, 40);
    ctx.fillStyle = '#0f2942';
    ctx.fillRect(x + 32, y + 18, 24, 14);
    ctx.fillStyle = '#facc15';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(x + 30 + i * 7, y + 40, 4, 8);
    }
    ctx.fillStyle = '#e0f2fe';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('.3DS / .3DSX', x + w / 2, y + h - 8);
  }

  #drawSavesArtwork(ctx, x, y, w, h) {
    ctx.fillStyle = '#0c3b36';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#2dd4bf';
    ctx.fillRect(x + 24, y + 14, 40, 38);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(x + 32, y + 16, 24, 14);
    ctx.fillStyle = '#0f766e';
    ctx.fillRect(x + 30, y + 34, 28, 14);
    ctx.fillStyle = '#ccfbf1';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('IDBFS /user', x + w / 2, y + h - 8);
  }

  #drawEmptyArtwork(ctx, x, y, w, h) {
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 12, y + 12, w - 24, h - 24);
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('EMPTY', x + w / 2, y + h / 2);
  }

  /**
   * Triggers a sudden spin impulse followed by gradual ~1.9s deceleration.
   */
  triggerSpinImpulse(strength = 0.24) {
    if (this.#paused) return;
    this.#impulseVelocity = strength;
    this.#impulseDurationMs = 1900;
    this.#impulseRemainingMs = this.#impulseDurationMs;
  }

  setPaused(paused) {
    this.#paused = Boolean(paused);
  }

  get paused() {
    return this.#paused;
  }

  start() {
    if (this.#rafId !== null) return;
    this.#lastFrameTime = performance.now();
    const tick = (now) => {
      this.#rafId = requestAnimationFrame(tick);
      const dtMs = Math.min(64, Math.max(1, now - this.#lastFrameTime));
      this.#lastFrameTime = now;
      this.#updateAndRender(dtMs);
    };
    this.#rafId = requestAnimationFrame(tick);
  }

  stop() {
    if (this.#rafId !== null) {
      cancelAnimationFrame(this.#rafId);
      this.#rafId = null;
    }
    if (this.#impulseTimerId !== null) {
      clearInterval(this.#impulseTimerId);
      this.#impulseTimerId = null;
    }
  }

  #startPeriodicImpulse() {
    if (this.#impulseTimerId !== null) clearInterval(this.#impulseTimerId);
    this.#impulseTimerId = setInterval(() => {
      if (!document.hidden && !this.#paused && !this.#reducedMotion) {
        this.triggerSpinImpulse(0.24);
      }
    }, CartridgeBanner3D.PERIODIC_IMPULSE_MS);
  }

  #updateAndRender(dtMs) {
    const frameScale = dtMs / 16.6667;

    if (!this.#paused && !this.#dragging) {
      if (this.#reducedMotion) {
        // Gentle static pose under reduced motion unless user explicitly tapped
        if (this.#impulseRemainingMs > 0) {
          const progress = 1 - this.#impulseRemainingMs / this.#impulseDurationMs;
          const easeOut = Math.pow(1 - progress, 2.4);
          this.#cartGroup.rotation.y += this.#impulseVelocity * easeOut * frameScale;
          this.#impulseRemainingMs = Math.max(0, this.#impulseRemainingMs - dtMs);
        }
      } else {
        this.#elapsed += dtMs * 0.001;
        let spinStep = CartridgeBanner3D.BASE_SPIN_RAD_PER_FRAME * frameScale;

        if (this.#impulseRemainingMs > 0) {
          const progress = 1 - this.#impulseRemainingMs / this.#impulseDurationMs;
          // Cubic/exponential gradual deceleration over ~1.9 seconds
          const easeOut = Math.pow(1 - progress, 2.6);
          spinStep += this.#impulseVelocity * easeOut * frameScale;
          this.#impulseRemainingMs = Math.max(0, this.#impulseRemainingMs - dtMs);
        }

        this.#cartGroup.rotation.y += spinStep;
        this.#cartGroup.position.y = Math.sin(this.#elapsed * 2.1) * 0.055;
        this.#cartGroup.rotation.x += (0.12 + Math.sin(this.#elapsed * 1.2) * 0.04 - this.#cartGroup.rotation.x) * 0.08;
      }
    } else if (this.#dragging) {
      this.#cartGroup.rotation.x += (this.#targetTiltX - this.#cartGroup.rotation.x) * 0.25;
    }

    this.#renderer.render(this.#scene, this.#camera);
  }

  #bindPointerEvents() {
    this.#canvas.addEventListener('pointerdown', (e) => {
      this.#dragging = true;
      this.#dragMoved = false;
      this.#dragLastX = e.clientX;
      this.#dragLastY = e.clientY;
      try { this.#canvas.setPointerCapture(e.pointerId); } catch {}
    });

    this.#canvas.addEventListener('pointermove', (e) => {
      if (!this.#dragging) return;
      const dx = e.clientX - this.#dragLastX;
      const dy = e.clientY - this.#dragLastY;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        this.#dragMoved = true;
      }
      this.#cartGroup.rotation.y += dx * 0.025;
      this.#targetTiltX = Math.max(-0.55, Math.min(0.65, this.#targetTiltX + dy * 0.012));
      this.#dragLastX = e.clientX;
      this.#dragLastY = e.clientY;
    });

    const endDrag = (e) => {
      if (!this.#dragging) return;
      this.#dragging = false;
      try {
        if (this.#canvas.hasPointerCapture(e.pointerId)) {
          this.#canvas.releasePointerCapture(e.pointerId);
        }
      } catch {}
      this.triggerSpinImpulse(this.#dragMoved ? 0.19 : 0.25);
      this.#onTap?.();
    };

    this.#canvas.addEventListener('pointerup', endDrag);
    this.#canvas.addEventListener('pointercancel', endDrag);
  }
}

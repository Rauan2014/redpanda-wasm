import './styles.css';
import { parseRomMetadata } from './romParser.js';
import { HomeAudioSynth } from './audio.js';
import { CartridgeBanner3D } from './cartridge3d.js';
import { SaveManager } from './saves.js';
import { Panda3DSEmulator, HID_KEYS } from './emulator.js';
import { createInputController } from './input-controller.js';
import { initAdSense, getAdSenseConfig } from './adsense.js';
import { initI18n, t, onLangChange } from './i18n.js';

const DEMO_ROM_URL = '/roms/blockblast.3dsx';
const DEMO_ROM_NAME = 'blockblast.3dsx';

const state = {
  selectedSlotId: 'demo',
  demoRomBytes: null,
  demoMeta: {
    id: 'demo',
    title: 'Block Blast',
    cartTitle: 'BLOCK BLAST',
    serial: 'CTR-P-BLOC',
    iconCanvas: null,
    palette: { bgTop: '#1d4ed8', bgBottom: '#0f172a', text: '#ffffff' },
  },
  customRomBytes: null,
  customRomName: null,
  customMeta: {
    id: 'load',
    title: 'Carregar ROM',
    cartTitle: 'CUSTOM ROM',
    serial: 'CTR-P-ROMX',
    iconCanvas: null,
    palette: { bgTop: '#6d28d9', bgBottom: '#31105f', text: '#ffffff' },
  },
  savesMeta: {
    id: 'saves',
    title: 'Gerenciador de Saves',
    cartTitle: 'SAVE DATA',
    serial: 'CTR-P-SAVE',
    iconCanvas: null,
    palette: { bgTop: '#0d9488', bgBottom: '#134e4a', text: '#ffffff' },
  },
  emptyMeta: {
    id: 'empty',
    title: 'Slot Vazio',
    cartTitle: 'SLOT VAZIO',
    serial: 'CTR-P-NONE',
    iconCanvas: null,
    palette: { bgTop: '#334155', bgBottom: '#0f172a', text: '#cbd5e1' },
  },
};

const SLOT_ORDER = ['demo', 'load', 'saves', 'empty'];

// DOM references
const coiBadgeEl = document.getElementById('coi-badge');
const clockEl = document.getElementById('status-clock');
const batteryMeterEl = document.getElementById('battery-meter');
const batteryBarsEl = document.getElementById('battery-bars');
const motionToggleBtn = document.getElementById('motion-toggle-btn');
const audioToggleBtn = document.getElementById('audio-toggle-btn');

const cartridgeCanvas = document.getElementById('cartridge-canvas');
const bottomEmuCanvas = document.getElementById('bottom-emu-canvas');
const emuWebglCanvas = document.getElementById('canvas');
const backHomeBtn = document.getElementById('back-home-btn');

const pillSerialEl = document.getElementById('pill-serial');
const pillTitleEl = document.getElementById('pill-title');
const slotCounterEl = document.getElementById('slot-counter');

const slotDemoIconEl = document.getElementById('slot-icon-demo');
const slotDemoNameEl = document.getElementById('slot-name-demo');
const slotLoadIconEl = document.getElementById('slot-icon-load');
const slotLoadNameEl = document.getElementById('slot-name-load');
const slotLoadBadgeEl = document.getElementById('slot-badge-load');
const slotButtons = Array.from(document.querySelectorAll('.slot-card'));

const dockLoadBtn = document.getElementById('dock-load-btn');
const dockOpenBtn = document.getElementById('dock-open-btn');
const romFileInput = document.getElementById('rom-file-input');
const saveFileInput = document.getElementById('save-file-input');

const exportSaveBtn = document.getElementById('export-save-btn');
const importSaveBtn = document.getElementById('import-save-btn');
const openSavesModalBtn = document.getElementById('open-saves-modal-btn');
const systemStatusEl = document.getElementById('system-status');

const saveDialog = document.getElementById('save-dialog');
const saveListBox = document.getElementById('save-list-box');
const closeSaveDialogBtn = document.getElementById('close-save-dialog-btn');
const modalImportSaveBtn = document.getElementById('modal-import-save-btn');
const modalExportSaveBtn = document.getElementById('modal-export-save-btn');
const modalClearSaveBtn = document.getElementById('modal-clear-save-btn');

const coreNoticeDialog = document.getElementById('core-notice-dialog');
const coreNoticeMessageEl = document.getElementById('core-notice-message');
const coreChecklistEl = document.getElementById('core-checklist');
const closeCoreDialogBtn = document.getElementById('close-core-dialog-btn');

const pageShellEl = document.getElementById('page-shell');
const consoleShellEl = document.getElementById('console-shell');
const fullscreenBtn = document.getElementById('fullscreen-btn');
const utilityFullscreenBtn = document.getElementById('utility-fullscreen-btn');
const fullscreenHudBar = document.getElementById('fullscreen-hud-bar');
const fsControlsToggleBtn = document.getElementById('fs-controls-toggle-btn');
const exitFullscreenBtn = document.getElementById('exit-fullscreen-btn');

const mouseModeBtn = document.getElementById('mouse-mode-btn');
const openControlsModalBtn = document.getElementById('open-controls-modal-btn');
const controlsDialog = document.getElementById('controls-dialog');
const closeControlsDialogBtn = document.getElementById('close-controls-dialog-btn');
const controlsGamepadInfoEl = document.getElementById('controls-gamepad-info');
const gamepadStatusPillEl = document.getElementById('gamepad-status-pill');
const selectMouseModeEl = document.getElementById('select-mouse-mode');
const selectGamepadLayoutEl = document.getElementById('select-gamepad-layout');
const chkMouseMirrorDpadEl = document.getElementById('chk-mouse-mirror-dpad');
const selectCpuClockEl = document.getElementById('select-cpu-clock');
const chkEmuAudioEl = document.getElementById('chk-emu-audio');
const emuFpsBadgeEl = document.getElementById('emu-fps-badge');

const circlePadWellEl = document.getElementById('circle-pad-well');
const circlePadThumbEl = document.getElementById('circle-pad-thumb');

const adBannerSlotEl = document.getElementById('ad-banner-slot');
const adsenseUnitEl = document.getElementById('adsense-unit');
const adSlotNoteEl = document.getElementById('ad-slot-note');

const supportDialog = document.getElementById('support-dialog');
const openSupportModalBtn = document.getElementById('open-support-modal-btn');
const footerSupportBtn = document.getElementById('footer-support-btn');
const closeSupportDialogBtn = document.getElementById('close-support-dialog-btn');
const modalPixKeyValueEl = document.getElementById('modal-pix-key-value');
const modalCopyPixBtn = document.getElementById('modal-copy-pix-btn');
const modalKofiLinkEl = document.getElementById('modal-kofi-link');
const modalGithubLinkEl = document.getElementById('modal-github-link');

const audio = new HomeAudioSynth();
const cartridge = new CartridgeBanner3D(cartridgeCanvas, {
  onTap: () => audio.playSelect(),
});

const emulator = new Panda3DSEmulator({
  emuCanvas: emuWebglCanvas,
  bottomCanvas: bottomEmuCanvas,
  onStatus: (msg) => setStatus(msg),
  onLog: (line) => {
    console.info(line);
    if (line.includes('Loaded an encrypted ROM')) {
      exitEmulatorView();
      setStatusKey('status.encryptedError');
    } else if (line.includes('Should raise coproc exception')) {
      exitEmulatorView();
      setStatusKey('status.coprocError');
    } else if (line.includes('[FATAL]') && !line.includes('SDMC::OpenArchive') && !line.includes('RenameFile')) {
      setStatus(line.replace(/\x1b\[[0-9;]*m/g, ''));
    }
  },
  onAbort: (reason) => {
    exitEmulatorView();
    setStatusKey('status.aborted', { reason });
  },
  onFps: (fps) => {
    if (!emuFpsBadgeEl) return;
    emuFpsBadgeEl.textContent = fps === null ? '-- FPS' : `${fps} FPS`;
  },
});

const saveManager = new SaveManager({
  getModule: () => emulator.module,
  syncFs: () => emulator.syncSavesToIndexedDb(),
});

let lastStatusKey = null;
let lastStatusVars = null;
let lastBatteryState = { level: 1, charging: false };
let lastGamepadInfo = null;
let lastMouseMode = 'motion';
let lastCoreNoticeArgs = null;
let adHandle = null;

function setStatus(text) {
  lastStatusKey = null;
  lastStatusVars = null;
  systemStatusEl.textContent = text;
}

function setStatusKey(key, vars = {}) {
  lastStatusKey = key;
  lastStatusVars = vars;
  systemStatusEl.textContent = t(key, vars);
}

function syncLocalizedSlotMeta() {
  if (!state.customRomBytes) {
    state.customMeta.title = t('home.slotLoadTitle');
    if (slotLoadNameEl) {
      slotLoadNameEl.textContent = t('home.slotLoadTitle');
    }
  }
  state.savesMeta.title = t('home.slotSavesTitle');
  state.emptyMeta.title = t('home.slotEmptyTitle');
  state.emptyMeta.cartTitle = t('home.slotEmptyCart');
}

function getSlotMeta(slotId) {
  switch (slotId) {
    case 'demo':
      return state.demoMeta;
    case 'load':
      return state.customMeta;
    case 'saves':
      return state.savesMeta;
    default:
      return state.emptyMeta;
  }
}

function updateBatteryAriaLabel() {
  const chargingSuffix = lastBatteryState.charging ? t('battery.charging') : '';
  batteryMeterEl.setAttribute(
    'aria-label',
    t('battery.aria', { percent: Math.round(lastBatteryState.level * 100), charging: chargingSuffix }),
  );
}

function syncMotionAndAudioButtons() {
  const paused = cartridge.paused;
  motionToggleBtn.textContent = paused ? '▶' : '❚❚';
  motionToggleBtn.setAttribute('aria-label', paused ? t('motion.resumeAria') : t('motion.pauseAria'));
  const muted = audio.muted;
  audioToggleBtn.textContent = muted ? '✕' : '♪';
  audioToggleBtn.setAttribute('aria-label', muted ? t('audio.unmuteAria') : t('audio.muteAria'));
}

function updateTopBarIsolationBadge() {
  const isolated = Boolean(window.crossOriginIsolated);
  const hasSAB = typeof SharedArrayBuffer === 'function';
  coiBadgeEl.textContent = isolated ? t('badge.sabOk') : t('badge.noCoi');
  coiBadgeEl.classList.toggle('is-isolated', isolated);
  coiBadgeEl.classList.toggle('is-unisolated', !isolated);
  coiBadgeEl.title = `crossOriginIsolated=${isolated}, SharedArrayBuffer=${hasSAB}`;
}

function startLiveClock() {
  const updateClock = () => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    clockEl.textContent = `${hh}:${mm}`;
  };
  updateClock();
  setInterval(updateClock, 10_000);
}

async function initBatteryIndicator() {
  const applyLevel = (level, charging) => {
    lastBatteryState = { level, charging: Boolean(charging) };
    const activeBars = Math.max(1, Math.min(4, Math.ceil(level * 4)));
    const bars = batteryBarsEl.querySelectorAll('i');
    bars.forEach((bar, index) => {
      bar.classList.toggle('is-lit', index < activeBars);
    });
    batteryBarsEl.classList.toggle('is-charging', Boolean(charging));
    updateBatteryAriaLabel();
  };

  applyLevel(1, false);
  if (typeof navigator.getBattery === 'function') {
    try {
      const battery = await navigator.getBattery();
      const refresh = () => applyLevel(battery.level, battery.charging);
      refresh();
      battery.addEventListener('levelchange', refresh);
      battery.addEventListener('chargingchange', refresh);
    } catch {
      // Fallback remains full 4-bar indicator
    }
  }
}

function renderSlotIcon(container, iconCanvas, fallbackGlyph, fallbackClass) {
  if (iconCanvas) {
    const clone = document.createElement('canvas');
    clone.width = iconCanvas.width;
    clone.height = iconCanvas.height;
    const ctx = clone.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(iconCanvas, 0, 0);
    }
    container.replaceChildren(clone);
    return;
  }

  const span = document.createElement('span');
  span.className = fallbackClass;
  span.setAttribute('aria-hidden', 'true');
  span.textContent = fallbackGlyph;
  container.replaceChildren(span);
}

function selectSlot(slotId, { impulse = true, sound = true } = {}) {
  state.selectedSlotId = slotId;
  const idx = SLOT_ORDER.indexOf(slotId);
  slotCounterEl.textContent = `${idx + 1} / ${SLOT_ORDER.length}`;

  for (const btn of slotButtons) {
    const active = btn.dataset.slot === slotId;
    btn.classList.toggle('is-selected', active);
    btn.setAttribute('aria-selected', String(active));
  }

  const meta = getSlotMeta(slotId);
  pillSerialEl.textContent = meta.serial;
  pillTitleEl.textContent = meta.title;
  cartridge.updateSlotLabel(meta);

  if (impulse) {
    cartridge.triggerSpinImpulse(0.24);
  }
  if (sound) {
    if (slotId === 'empty') {
      audio.playEmpty();
    } else {
      audio.playSelect();
    }
  }

  // Update dock primary action state
  if (slotId === 'empty') {
    dockOpenBtn.disabled = true;
    dockOpenBtn.textContent = t('home.dockEmpty');
  } else if (slotId === 'saves') {
    dockOpenBtn.disabled = false;
    dockOpenBtn.textContent = t('home.dockManage');
  } else if (slotId === 'load' && !state.customRomBytes) {
    dockOpenBtn.disabled = false;
    dockOpenBtn.textContent = t('home.dockChoose');
  } else {
    dockOpenBtn.disabled = false;
    dockOpenBtn.textContent = t('home.dockOpen');
  }
}

async function preloadDemoRom() {
  try {
    const resp = await fetch(DEMO_ROM_URL);
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }
    const bytes = new Uint8Array(await resp.arrayBuffer());
    const parsed = parseRomMetadata(DEMO_ROM_NAME, bytes);

    state.demoRomBytes = bytes;
    state.demoMeta = {
      ...state.demoMeta,
      title: `${parsed.title} (Demo)`,
      cartTitle: parsed.title,
      serial: parsed.serial,
      iconCanvas: parsed.iconCanvas,
    };

    slotDemoNameEl.textContent = parsed.title;
    if (parsed.iconCanvas) {
      renderSlotIcon(slotDemoIconEl, parsed.iconCanvas, '2048', 'glyph-rom');
    }

    if (state.selectedSlotId === 'demo') {
      selectSlot('demo', { impulse: false, sound: false });
    }

    setStatusKey('status.readyDemo', {
      name: DEMO_ROM_NAME,
      kb: (bytes.byteLength / 1024).toFixed(1),
      coi: window.crossOriginIsolated ? t('status.coiActive') : t('status.coiInactive'),
    });
  } catch (err) {
    setStatusKey('status.preloadError', { url: DEMO_ROM_URL, error: err.message });
  }
}

async function handleRomFileSelected(file) {
  if (!file) return;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const parsed = parseRomMetadata(file.name, bytes);

  state.customRomBytes = bytes;
  state.customRomName = file.name;
  state.customMeta = {
    id: 'load',
    title: parsed.title,
    cartTitle: parsed.title,
    serial: parsed.serial,
    iconCanvas: parsed.iconCanvas,
    palette: { bgTop: '#4f46e5', bgBottom: '#1e1b4b', text: '#ffffff' },
  };

  slotLoadNameEl.textContent = parsed.title;
  slotLoadBadgeEl.textContent = parsed.ext.toUpperCase() || 'ROM';
  renderSlotIcon(slotLoadIconEl, parsed.iconCanvas, '3DS', 'glyph-rom');

  audio.playInsertCart();
  selectSlot('load', { impulse: true, sound: false });
  const cryptoNote = parsed.encrypted
    ? t('status.romNoteEncrypted')
    : parsed.iconCanvas
      ? t('status.romNoteIcon')
      : '';
  setStatusKey('status.romSelected', {
    name: file.name,
    kb: (bytes.byteLength / 1024).toFixed(1),
    serial: parsed.serial,
    note: cryptoNote,
  });
}

function enterEmulatorView() {
  cartridge.suspend();
  consoleShellEl.classList.add('is-emulating');
  bottomEmuCanvas.hidden = false;
  backHomeBtn.hidden = false;
  if (emuFpsBadgeEl) {
    emuFpsBadgeEl.textContent = '-- FPS';
    emuFpsBadgeEl.hidden = false;
  }
}

function exitEmulatorView() {
  emulator.stopDisplay();
  consoleShellEl.classList.remove('is-emulating');
  bottomEmuCanvas.hidden = true;
  backHomeBtn.hidden = true;
  if (emuFpsBadgeEl) {
    emuFpsBadgeEl.hidden = true;
    emuFpsBadgeEl.textContent = '-- FPS';
  }
  cartridge.resume();
  setStatusKey('status.returnedHome');
}

function renderCoreNotice(reason, romName, romBytes) {
  lastCoreNoticeArgs = { reason, romName, romBytes };
  const kb = (romBytes.byteLength / 1024).toFixed(1);
  coreNoticeMessageEl.textContent = t('coreNotice.msg', { romName, kb });

  const coiStatus = window.crossOriginIsolated ? t('coreNotice.coiTrue') : t('coreNotice.coiFalse');
  const items = [
    t('coreNotice.checkCoi', { status: coiStatus }),
    t('coreNotice.checkRom', { romName, kb }),
    t('coreNotice.checkReason', { reason }),
    t('coreNotice.checkHint'),
  ];

  const nodes = items.map((line) => {
    const p = document.createElement('p');
    p.className = 'dialog-desc';
    p.textContent = `• ${line}`;
    return p;
  });

  coreChecklistEl.replaceChildren(...nodes);
}

function showCoreNotice(reason, romName, romBytes) {
  audio.playEmpty();
  renderCoreNotice(reason, romName, romBytes);
  coreNoticeDialog.showModal();
}

async function launchSelectedSlot() {
  const slotId = state.selectedSlotId;
  if (slotId === 'empty') {
    audio.playEmpty();
    return;
  }

  if (slotId === 'saves') {
    await openSavesDialog();
    return;
  }

  if (slotId === 'load' && !state.customRomBytes) {
    romFileInput.click();
    return;
  }

  const romName = slotId === 'demo' ? DEMO_ROM_NAME : state.customRomName;
  const romBytes = slotId === 'demo' ? state.demoRomBytes : state.customRomBytes;

  if (!romBytes || !romName) {
    setStatusKey('status.noRomReady');
    return;
  }

  audio.playLaunch();
  setStatusKey('status.initializing', { name: romName });

  try {
    const result = await emulator.launchRom(romName, romBytes);
    if (result.ok) {
      enterEmulatorView();
      return;
    }

    if (result.missingWasm) {
      setStatusKey('status.waitingCore', { reason: result.reason });
      showCoreNotice(result.reason, romName, romBytes);
    }
  } catch (err) {
    exitEmulatorView();
    setStatusKey('status.launchFailed', { name: romName, error: err.message });
  }
}

async function renderSaveList() {
  const entries = await saveManager.listSaves();
  if (entries.length === 0) {
    const emptyMsg = document.createElement('p');
    emptyMsg.className = 'save-empty-msg';
    emptyMsg.textContent = t('saves.emptyMsg');
    saveListBox.replaceChildren(emptyMsg);
    return;
  }

  const rows = entries.map((entry) => {
    const row = document.createElement('div');
    row.className = 'save-entry-row';

    const pathEl = document.createElement('span');
    pathEl.className = 'save-entry-path';
    pathEl.textContent = `/user/${entry.relPath}`;

    const metaEl = document.createElement('div');
    metaEl.className = 'save-entry-meta';

    const sizeEl = document.createElement('span');
    sizeEl.textContent = `${(entry.size / 1024).toFixed(1)} KB`;

    const dlBtn = document.createElement('button');
    dlBtn.type = 'button';
    dlBtn.className = 'utility-btn';
    dlBtn.textContent = t('saves.downloadBtn');
    dlBtn.addEventListener('click', () => {
      void saveManager.exportSingleSave(entry.relPath);
    });

    metaEl.append(sizeEl, dlBtn);
    row.append(pathEl, metaEl);
    return row;
  });

  saveListBox.replaceChildren(...rows);
}

async function openSavesDialog() {
  audio.playModal(true);
  await renderSaveList();
  saveDialog.showModal();
}

async function handleExportSaves() {
  try {
    const res = await saveManager.exportSaves();
    if (!res.exported) {
      audio.playEmpty();
      setStatusKey('status.noSavesToExport');
      return;
    }
    audio.playSelect();
    setStatusKey('status.exportedSaves', { count: res.count, fileName: res.fileName });
  } catch (err) {
    setStatusKey('status.exportError', { error: err.message });
  }
}

async function handleImportSaveFile(file) {
  if (!file) return;
  try {
    const count = await saveManager.importSaveFile(file);
    audio.playInsertCart();
    setStatusKey('status.importedSaves', { count });
    if (saveDialog.open) {
      await renderSaveList();
    }
  } catch (err) {
    audio.playEmpty();
    setStatusKey('status.importError', { error: err.message });
  }
}

// ============================================================================
// Event Wiring
// ============================================================================

slotButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const slotId = btn.dataset.slot;
    const wasSelected = state.selectedSlotId === slotId;
    selectSlot(slotId, { impulse: true, sound: true });

    if (slotId === 'load' && (!state.customRomBytes || wasSelected)) {
      romFileInput.click();
    } else if (slotId === 'saves' && wasSelected) {
      void openSavesDialog();
    } else if (slotId === 'demo' && wasSelected) {
      void launchSelectedSlot();
    }
  });
});

dockLoadBtn.addEventListener('click', () => {
  audio.playSelect();
  romFileInput.click();
});

dockOpenBtn.addEventListener('click', () => {
  void launchSelectedSlot();
});

romFileInput.addEventListener('change', () => {
  const file = romFileInput.files?.[0];
  if (file) {
    void handleRomFileSelected(file);
  }
  romFileInput.value = '';
});

saveFileInput.addEventListener('change', () => {
  const file = saveFileInput.files?.[0];
  if (file) {
    void handleImportSaveFile(file);
  }
  saveFileInput.value = '';
});

exportSaveBtn.addEventListener('click', () => void handleExportSaves());
importSaveBtn.addEventListener('click', () => saveFileInput.click());
openSavesModalBtn.addEventListener('click', () => void openSavesDialog());

modalImportSaveBtn.addEventListener('click', () => saveFileInput.click());
modalExportSaveBtn.addEventListener('click', () => void handleExportSaves());
modalClearSaveBtn.addEventListener('click', async () => {
  await saveManager.clearAllSaves();
  audio.playSelect();
  await renderSaveList();
  setStatusKey('status.clearedUser');
});

closeSaveDialogBtn.addEventListener('click', () => saveDialog.close());
closeCoreDialogBtn.addEventListener('click', () => coreNoticeDialog.close());
closeControlsDialogBtn.addEventListener('click', () => controlsDialog.close());
closeSupportDialogBtn?.addEventListener('click', () => supportDialog?.close());

function openSupportDialog() {
  if (!supportDialog) return;
  const cfg = getAdSenseConfig();
  if (modalPixKeyValueEl) modalPixKeyValueEl.textContent = cfg.pixKey;
  if (modalKofiLinkEl) modalKofiLinkEl.href = cfg.kofiUrl;
  if (modalGithubLinkEl) modalGithubLinkEl.href = cfg.githubUrl;
  audio.playModal(true);
  supportDialog.showModal();
}

openSupportModalBtn?.addEventListener('click', openSupportDialog);
footerSupportBtn?.addEventListener('click', openSupportDialog);

modalCopyPixBtn?.addEventListener('click', async () => {
  const cfg = getAdSenseConfig();
  try {
    await navigator.clipboard.writeText(cfg.pixKey);
    audio.playSelect();
    modalCopyPixBtn.textContent = t('supportDialog.pixCopied');
    setStatusKey('status.pixCopied', { key: cfg.pixKey });
    setTimeout(() => {
      modalCopyPixBtn.textContent = t('supportDialog.copyPix');
    }, 2600);
  } catch {
    setStatusKey('status.pixFallback', { key: cfg.pixKey });
  }
});

saveDialog.addEventListener('close', () => {
  saveDialog.returnValue = '';
  audio.playModal(false);
});
coreNoticeDialog.addEventListener('close', () => {
  coreNoticeDialog.returnValue = '';
});
controlsDialog.addEventListener('close', () => {
  controlsDialog.returnValue = '';
  audio.playModal(false);
});
supportDialog?.addEventListener('close', () => {
  supportDialog.returnValue = '';
  audio.playModal(false);
});

if (!('closedBy' in HTMLDialogElement.prototype)) {
  const outside = (e, dialog) => {
    const r = dialog.getBoundingClientRect();
    return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
  };
  for (const dialog of document.querySelectorAll('dialog[closedby="any"]')) {
    let pressedOutside = false;
    dialog.addEventListener('pointerdown', (e) => {
      pressedOutside = outside(e, dialog);
    });
    dialog.addEventListener('pointerup', (e) => {
      if (pressedOutside && outside(e, dialog)) dialog.close();
    });
  }
}

motionToggleBtn.addEventListener('click', () => {
  const nextPaused = !cartridge.paused;
  cartridge.setPaused(nextPaused);
  syncMotionAndAudioButtons();
});

audioToggleBtn.addEventListener('click', () => {
  const muted = audio.toggleMute();
  syncMotionAndAudioButtons();
  if (emulator.isRunning) {
    const enabled = !muted;
    if (chkEmuAudioEl) chkEmuAudioEl.checked = enabled;
    try {
      localStorage.setItem(EMU_AUDIO_STORAGE_KEY, String(enabled));
    } catch {
      // Ignore storage unavailability
    }
    emulator.setEmuAudioEnabled(enabled);
    if (enabled) emulator.unlockAudio();
  }
});

backHomeBtn.addEventListener('click', () => exitEmulatorView());
document.getElementById('btn-home').addEventListener('click', () => {
  if (emulator.isRunning) {
    exitEmulatorView();
  } else {
    selectSlot('demo', { impulse: true, sound: true });
  }
});

// ============================================================================
// Pure Dual-Screen Fullscreen Mode (somente tela maior + tela menor)
// ============================================================================

let cssFullscreenFallback = false;
let fsControlsVisible = false;
let fsControlsTouchedByUser = false;

function shouldDefaultFsControlsVisible() {
  return Boolean(window.matchMedia?.('(pointer: coarse)').matches) && !lastGamepadInfo;
}

function isFullscreenActive() {
  return Boolean(document.fullscreenElement) || cssFullscreenFallback;
}

function syncFullscreenUi() {
  const active = isFullscreenActive();
  const showControls = active && fsControlsVisible;
  pageShellEl.classList.toggle('is-fullscreen', active);
  consoleShellEl.classList.toggle('is-fullscreen', active);
  consoleShellEl.classList.toggle('fs-controls-visible', showControls);
  if (fullscreenHudBar) fullscreenHudBar.hidden = !active;
  exitFullscreenBtn.hidden = !active;
  fsControlsToggleBtn?.setAttribute('aria-pressed', showControls ? 'true' : 'false');
  fullscreenBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
  fullscreenBtn.title = active ? t('fullscreen.exitTitle') : t('fullscreen.enterTitle');
  utilityFullscreenBtn.textContent = active ? t('fullscreen.utilityExit') : t('fullscreen.utilityEnter');
  utilityFullscreenBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
}

async function enterFullscreenMode() {
  if (isFullscreenActive()) return;
  if (!fsControlsTouchedByUser) {
    fsControlsVisible = shouldDefaultFsControlsVisible();
  }
  try {
    if (document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen();
      cssFullscreenFallback = false;
    } else {
      cssFullscreenFallback = true;
    }
  } catch {
    cssFullscreenFallback = true;
  }
  syncFullscreenUi();
}

async function exitFullscreenMode() {
  cssFullscreenFallback = false;
  if (document.fullscreenElement && document.exitFullscreen) {
    try {
      await document.exitFullscreen();
    } catch {
      // Fall back to UI sync
    }
  }
  syncFullscreenUi();
}

function toggleFullscreenMode() {
  if (isFullscreenActive()) {
    void exitFullscreenMode();
  } else {
    void enterFullscreenMode();
  }
}

document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement) {
    cssFullscreenFallback = false;
  }
  syncFullscreenUi();
});

fullscreenBtn.addEventListener('click', toggleFullscreenMode);
utilityFullscreenBtn.addEventListener('click', toggleFullscreenMode);
exitFullscreenBtn.addEventListener('click', () => void exitFullscreenMode());
fsControlsToggleBtn?.addEventListener('click', () => {
  fsControlsTouchedByUser = true;
  fsControlsVisible = !fsControlsVisible;
  syncFullscreenUi();
});

// ============================================================================
// Unified Keyboard + Gamepad + Mouse Directional Input
// ============================================================================

const MOUSE_MODE_KEYS = {
  motion: 'mouseMode.motion',
  position: 'mouseMode.position',
  off: 'mouseMode.off',
};

function updateMouseModeUi(mode) {
  lastMouseMode = mode;
  const modeLabel = t(MOUSE_MODE_KEYS[mode] || 'mouseMode.motion');
  mouseModeBtn.textContent = t('utility.mouseModeBtn', { mode: modeLabel });
  selectMouseModeEl.value = mode;
}

function updateGamepadUi(gp) {
  lastGamepadInfo = gp || null;
  if (gp) {
    const shortName = gp.id.replace(/\s*\([^)]*\)/g, '').slice(0, 34);
    gamepadStatusPillEl.textContent = t('utility.gamepadConnected', { name: shortName });
    gamepadStatusPillEl.classList.add('is-connected');
    controlsGamepadInfoEl.textContent = t('controlsDialog.gamepadConnected', {
      id: gp.id,
      mapping: gp.mapping,
    });
    controlsGamepadInfoEl.classList.add('is-connected');
  } else {
    gamepadStatusPillEl.textContent = t('utility.gamepadDisconnected');
    gamepadStatusPillEl.classList.remove('is-connected');
    controlsGamepadInfoEl.textContent = t('controlsDialog.gamepadNone');
    controlsGamepadInfoEl.classList.remove('is-connected');
  }
  if (isFullscreenActive() && !fsControlsTouchedByUser) {
    fsControlsVisible = shouldDefaultFsControlsVisible();
    syncFullscreenUi();
  }
}

function isAnyModalOpen() {
  return saveDialog.open || coreNoticeDialog.open || controlsDialog.open || Boolean(supportDialog?.open);
}

function navigateHomeGrid(dx, dy) {
  if (emulator.isRunning || isAnyModalOpen()) return;
  const idx = SLOT_ORDER.indexOf(state.selectedSlotId);
  const step = dx !== 0 ? dx : dy;
  if (step === 0) return;
  const nextIdx = (idx + step + SLOT_ORDER.length) % SLOT_ORDER.length;
  selectSlot(SLOT_ORDER[nextIdx], { impulse: true, sound: true });
}

const inputController = createInputController({
  emulator,
  consoleEl: consoleShellEl,
  circlePadWell: circlePadWellEl,
  circlePadThumb: circlePadThumbEl,
  bottomEmuCanvas,
  controlElements: {
    up: { mask: HID_KEYS.Up, element: document.querySelector('.dpad-up') },
    down: { mask: HID_KEYS.Down, element: document.querySelector('.dpad-down') },
    left: { mask: HID_KEYS.Left, element: document.querySelector('.dpad-left') },
    right: { mask: HID_KEYS.Right, element: document.querySelector('.dpad-right') },
    a: { mask: HID_KEYS.A, element: document.querySelector('.face-a') },
    b: { mask: HID_KEYS.B, element: document.querySelector('.face-b') },
    x: { mask: HID_KEYS.X, element: document.querySelector('.face-x') },
    y: { mask: HID_KEYS.Y, element: document.querySelector('.face-y') },
    l: { mask: HID_KEYS.L, element: document.getElementById('btn-l') },
    r: { mask: HID_KEYS.R, element: document.getElementById('btn-r') },
    zl: { mask: HID_KEYS.ZL, element: document.getElementById('btn-zl') },
    zr: { mask: HID_KEYS.ZR, element: document.getElementById('btn-zr') },
    select: { mask: HID_KEYS.Select, element: document.getElementById('btn-select') },
    start: { mask: HID_KEYS.Start, element: document.getElementById('btn-start') },
  },
  isModalOpen: isAnyModalOpen,
  isFullscreen: isFullscreenActive,
  onHomeNavigate: navigateHomeGrid,
  onHomeConfirm: () => {
    if (!emulator.isRunning && !isAnyModalOpen()) {
      void launchSelectedSlot();
    }
  },
  onHomeCancel: () => {
    if (saveDialog.open) saveDialog.close();
    if (coreNoticeDialog.open) coreNoticeDialog.close();
    if (controlsDialog.open) controlsDialog.close();
    if (supportDialog?.open) supportDialog.close();
  },
  onHomeToggle: () => {
    if (emulator.isRunning) {
      exitEmulatorView();
    } else {
      selectSlot('demo', { impulse: true, sound: true });
    }
  },
  onFullscreenToggle: toggleFullscreenMode,
  onExitFullscreen: () => void exitFullscreenMode(),
  onMouseModeChange: updateMouseModeUi,
  onGamepadChange: updateGamepadUi,
});

mouseModeBtn.addEventListener('click', () => {
  audio.playSelect();
  inputController.cycleMouseMode();
});

openControlsModalBtn.addEventListener('click', () => {
  audio.playModal(true);
  controlsDialog.showModal();
});

selectMouseModeEl.addEventListener('change', () => {
  inputController.setMouseMode(selectMouseModeEl.value);
});

selectGamepadLayoutEl.addEventListener('change', () => {
  inputController.setGamepadLayout(selectGamepadLayoutEl.value);
});

chkMouseMirrorDpadEl.addEventListener('change', () => {
  inputController.setMouseMirrorDpad(chkMouseMirrorDpadEl.checked);
});

const CPU_CLOCK_STORAGE_KEY = 'p3ds.cpuClockScale';
const EMU_AUDIO_STORAGE_KEY = 'p3ds.emuAudio';

function initPerformancePreferences() {
  let savedClock = '100';
  let savedAudio = true;
  try {
    const rawClock = localStorage.getItem(CPU_CLOCK_STORAGE_KEY);
    if (rawClock && ['100', '75', '50', '35'].includes(rawClock)) {
      savedClock = rawClock;
    }
    const rawAudio = localStorage.getItem(EMU_AUDIO_STORAGE_KEY);
    if (rawAudio === 'false') {
      savedAudio = false;
    }
  } catch {
    // Ignore storage unavailability
  }

  if (selectCpuClockEl) {
    selectCpuClockEl.value = savedClock;
    selectCpuClockEl.addEventListener('change', () => {
      const pct = Number(selectCpuClockEl.value) || 100;
      emulator.setCpuClockScale(pct);
      try {
        localStorage.setItem(CPU_CLOCK_STORAGE_KEY, String(pct));
      } catch {
        // Ignore storage unavailability
      }
    });
  }
  emulator.setCpuClockScale(Number(savedClock));

  if (chkEmuAudioEl) {
    chkEmuAudioEl.checked = savedAudio;
    chkEmuAudioEl.addEventListener('change', () => {
      const enabled = chkEmuAudioEl.checked;
      emulator.setEmuAudioEnabled(enabled);
      if (enabled) emulator.unlockAudio();
      try {
        localStorage.setItem(EMU_AUDIO_STORAGE_KEY, String(enabled));
      } catch {
        // Ignore storage unavailability
      }
    });
  }
  emulator.setEmuAudioEnabled(savedAudio);
}

// Physical console D-Pad + A/B clicks in HOME Menu (gameplay holds handled by inputController)
document.querySelectorAll('[data-nav]').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (emulator.isRunning) return;
    const step = btn.dataset.nav === 'left' || btn.dataset.nav === 'up' ? -1 : 1;
    navigateHomeGrid(step, 0);
  });
});

document.querySelectorAll('.face-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (emulator.isRunning) return;
    if (btn.dataset.action === 'a') {
      void launchSelectedSlot();
    } else if (btn.dataset.action === 'b') {
      if (saveDialog.open) saveDialog.close();
      if (coreNoticeDialog.open) coreNoticeDialog.close();
      if (controlsDialog.open) controlsDialog.close();
      if (supportDialog?.open) supportDialog.close();
    }
  });
});

// ============================================================================
// Bootstrap
// ============================================================================

function syncControlsTableLabels() {
  const table = document.querySelector('.controls-map-table');
  if (!table) return;
  table.style.setProperty('--label-2', JSON.stringify(t('controlsDialog.thKeyboard')));
  table.style.setProperty('--label-3', JSON.stringify(t('controlsDialog.thGamepadMouse')));
}

initI18n();
syncControlsTableLabels();
syncLocalizedSlotMeta();
syncMotionAndAudioButtons();
updateMouseModeUi(lastMouseMode);
updateGamepadUi(lastGamepadInfo);
updateTopBarIsolationBadge();
startLiveClock();
void initBatteryIndicator();
initPerformancePreferences();
selectSlot('demo', { impulse: false, sound: false });
cartridge.start();
inputController.start();
adHandle = initAdSense({
  insElement: adsenseUnitEl,
  statusElement: adSlotNoteEl,
  containerElement: adBannerSlotEl,
  onOpenSupport: openSupportDialog,
});

onLangChange(() => {
  syncControlsTableLabels();
  syncLocalizedSlotMeta();
  selectSlot(state.selectedSlotId, { impulse: false, sound: false });
  syncFullscreenUi();
  syncMotionAndAudioButtons();
  updateTopBarIsolationBadge();
  updateMouseModeUi(lastMouseMode);
  updateGamepadUi(lastGamepadInfo);
  updateBatteryAriaLabel();
  if (saveDialog.open) {
    void renderSaveList();
  }
  if (coreNoticeDialog.open && lastCoreNoticeArgs) {
    renderCoreNotice(lastCoreNoticeArgs.reason, lastCoreNoticeArgs.romName, lastCoreNoticeArgs.romBytes);
  }
  if (lastStatusKey) {
    setStatusKey(lastStatusKey, lastStatusVars);
  }
  adHandle?.refreshLanguage?.();
});

void preloadDemoRom();

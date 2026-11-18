import './styles.css';
import { parseRomMetadata } from './romParser.js';
import { HomeAudioSynth } from './audio.js';
import { CartridgeBanner3D } from './cartridge3d.js';
import { SaveManager } from './saves.js';
import { Panda3DSEmulator } from './emulator.js';

const DEMO_ROM_URL = '/roms/flappy.3dsx';
const DEMO_ROM_NAME = 'flappy.3dsx';

const state = {
  selectedSlotId: 'demo',
  demoRomBytes: null,
  demoMeta: {
    id: 'demo',
    title: 'Flappy Bird',
    cartTitle: 'FLAPPY 3DS',
    serial: 'CTR-P-FLAP',
    iconCanvas: null,
    palette: { bgTop: '#0284c7', bgBottom: '#075985', text: '#ffffff' },
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
const topEmuCanvas = document.getElementById('top-emu-canvas');
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

const audio = new HomeAudioSynth();
const cartridge = new CartridgeBanner3D(cartridgeCanvas, {
  onTap: () => audio.playSelect(),
});

const emulator = new Panda3DSEmulator({
  emuCanvas: emuWebglCanvas,
  topCanvas: topEmuCanvas,
  bottomCanvas: bottomEmuCanvas,
  onStatus: (msg) => setStatus(msg),
  onLog: (line) => {
    console.info(line);
    if (line.includes('Loaded an encrypted ROM')) {
      exitEmulatorView();
      setStatus('ROM .3ds criptografada: o Panda3DS no navegador precisa de ROM descriptografada (.3ds/.cci/.cxi ou .3dsx).');
    } else if (line.includes('[FATAL]') && !line.includes('SDMC::OpenArchive')) {
      setStatus(line.replace(/\x1b\[[0-9;]*m/g, ''));
    }
  },
  onAbort: (reason) => {
    exitEmulatorView();
    setStatus(`Emulação encerrada: ${reason}`);
  },
});

const saveManager = new SaveManager({
  getModule: () => emulator.module,
  syncFs: () => emulator.syncSavesToIndexedDb(),
});

function setStatus(text) {
  systemStatusEl.textContent = text;
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

function updateTopBarIsolationBadge() {
  const isolated = Boolean(window.crossOriginIsolated);
  const hasSAB = typeof SharedArrayBuffer === 'function';
  coiBadgeEl.textContent = isolated ? 'SAB OK' : 'NO COI';
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
    const activeBars = Math.max(1, Math.min(4, Math.ceil(level * 4)));
    const bars = batteryBarsEl.querySelectorAll('i');
    bars.forEach((bar, index) => {
      bar.classList.toggle('is-lit', index < activeBars);
    });
    batteryBarsEl.classList.toggle('is-charging', Boolean(charging));
    batteryMeterEl.setAttribute(
      'aria-label',
      `Bateria ${Math.round(level * 100)}%${charging ? ' (carregando)' : ''}`,
    );
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
    dockOpenBtn.textContent = 'Vazio';
  } else if (slotId === 'saves') {
    dockOpenBtn.disabled = false;
    dockOpenBtn.textContent = '▶ Gerenciar';
  } else if (slotId === 'load' && !state.customRomBytes) {
    dockOpenBtn.disabled = false;
    dockOpenBtn.textContent = '▶ Escolher';
  } else {
    dockOpenBtn.disabled = false;
    dockOpenBtn.textContent = '▶ Abrir';
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

    const coi = window.crossOriginIsolated ? 'crossOriginIsolated ativo (SharedArrayBuffer OK)' : 'Sem COOP/COEP';
    setStatus(`Pronto • Demo ${DEMO_ROM_NAME} (${(bytes.byteLength / 1024).toFixed(1)} KB) carregada • ${coi}`);
  } catch (err) {
    setStatus(`Erro ao pré-carregar ROM demo (${DEMO_ROM_URL}): ${err.message}`);
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
    ? ' • ExeFS criptografada (Panda3DS requer ROM descriptografada)'
    : parsed.iconCanvas
      ? ' • Ícone SMDH extraído'
      : '';
  setStatus(`ROM selecionada: ${file.name} (${(bytes.byteLength / 1024).toFixed(1)} KB • ${parsed.serial}${cryptoNote})`);
}

function enterEmulatorView() {
  topEmuCanvas.hidden = false;
  bottomEmuCanvas.hidden = false;
  backHomeBtn.hidden = false;
}

function exitEmulatorView() {
  emulator.stopDisplay();
  topEmuCanvas.hidden = true;
  bottomEmuCanvas.hidden = true;
  backHomeBtn.hidden = true;
  setStatus('Retornou ao HOME Menu. Saves sincronizados com IDBFS (/user).');
}

function showCoreNotice(reason, romName, romBytes) {
  audio.playEmpty();
  coreNoticeMessageEl.textContent =
    `O front-end preparou a ROM "${romName}" (${(romBytes.byteLength / 1024).toFixed(1)} KB) e verificou o ambiente WebAssembly, mas o núcleo compilado não está presente em /wasm/Panda3DS.js.`;

  const items = [
    `crossOriginIsolated: ${window.crossOriginIsolated ? 'true (SharedArrayBuffer disponível)' : 'false'}`,
    `ROM pronta para FS.writeFile('/roms/${romName}'): ${(romBytes.byteLength / 1024).toFixed(1)} KB`,
    `Motivo: ${reason}`,
    'Gere os artefatos Panda3DS.js, Panda3DS.wasm e Panda3DS.worker.js em public/wasm/ executando scripts/build-wasm.sh (requer fork/patch Emscripten com interpretador ARM11).',
  ];

  const nodes = items.map((line) => {
    const p = document.createElement('p');
    p.className = 'dialog-desc';
    p.textContent = `• ${line}`;
    return p;
  });

  coreChecklistEl.replaceChildren(...nodes);
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
    setStatus('Nenhuma ROM pronta para iniciar.');
    return;
  }

  audio.playLaunch();
  setStatus(`Inicializando Panda3DS para ${romName}...`);

  try {
    const result = await emulator.launchRom(romName, romBytes);
    if (result.ok) {
      enterEmulatorView();
      return;
    }

    if (result.missingWasm) {
      setStatus(`Aguardando núcleo compilado em public/wasm/Panda3DS.js (${result.reason})`);
      showCoreNotice(result.reason, romName, romBytes);
    }
  } catch (err) {
    exitEmulatorView();
    setStatus(`Falha ao iniciar ${romName}: ${err.message}`);
  }
}

async function renderSaveList() {
  const entries = await saveManager.listSaves();
  if (entries.length === 0) {
    const emptyMsg = document.createElement('p');
    emptyMsg.className = 'save-empty-msg';
    emptyMsg.textContent = 'Nenhum arquivo de save encontrado em /user (IDBFS).';
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
    dlBtn.textContent = 'Baixar';
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
      setStatus('Não há arquivos em /user para exportar no momento.');
      return;
    }
    audio.playSelect();
    setStatus(`Exportado ${res.count} arquivo(s) para ${res.fileName}.`);
  } catch (err) {
    setStatus(`Erro ao exportar saves: ${err.message}`);
  }
}

async function handleImportSaveFile(file) {
  if (!file) return;
  try {
    const count = await saveManager.importSaveFile(file);
    audio.playInsertCart();
    setStatus(`Importado(s) ${count} arquivo(s) de save em /user e sincronizado no IDBFS.`);
    if (saveDialog.open) {
      await renderSaveList();
    }
  } catch (err) {
    audio.playEmpty();
    setStatus(`Erro ao importar save: ${err.message}`);
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
  setStatus('Diretório /user no IDBFS limpo.');
});

closeSaveDialogBtn.addEventListener('click', () => saveDialog.close());
closeCoreDialogBtn.addEventListener('click', () => coreNoticeDialog.close());

saveDialog.addEventListener('close', () => {
  saveDialog.returnValue = '';
  audio.playModal(false);
});
coreNoticeDialog.addEventListener('close', () => {
  coreNoticeDialog.returnValue = '';
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
  motionToggleBtn.textContent = nextPaused ? '▶' : '❚❚';
  motionToggleBtn.setAttribute('aria-label', nextPaused ? 'Retomar rotação 3D' : 'Pausar rotação 3D');
});

audioToggleBtn.addEventListener('click', () => {
  const muted = audio.toggleMute();
  audioToggleBtn.textContent = muted ? '✕' : '♪';
  audioToggleBtn.setAttribute('aria-label', muted ? 'Ativar efeitos sonoros' : 'Silenciar efeitos sonoros');
});

backHomeBtn.addEventListener('click', () => exitEmulatorView());
document.getElementById('btn-home').addEventListener('click', () => {
  if (emulator.isRunning) {
    exitEmulatorView();
  } else {
    selectSlot('demo', { impulse: true, sound: true });
  }
});

// Physical console D-Pad + A/B/X/Y + SELECT/START wiring
document.querySelectorAll('[data-nav]').forEach((btn) => {
  btn.addEventListener('pointerdown', () => {
    if (emulator.isRunning) {
      emulator.sendVirtualKey(btn.dataset.key, true);
    }
  });
  btn.addEventListener('pointerup', () => {
    if (emulator.isRunning) {
      emulator.sendVirtualKey(btn.dataset.key, false);
    }
  });
  btn.addEventListener('click', () => {
    if (emulator.isRunning) return;
    const idx = SLOT_ORDER.indexOf(state.selectedSlotId);
    const delta = btn.dataset.nav === 'left' || btn.dataset.nav === 'up' ? -1 : 1;
    const nextIdx = (idx + delta + SLOT_ORDER.length) % SLOT_ORDER.length;
    selectSlot(SLOT_ORDER[nextIdx], { impulse: true, sound: true });
  });
});

document.querySelectorAll('.face-btn, .sys-pill-btn').forEach((btn) => {
  btn.addEventListener('pointerdown', () => {
    if (emulator.isRunning && btn.dataset.key) {
      emulator.sendVirtualKey(btn.dataset.key, true);
    }
  });
  btn.addEventListener('pointerup', () => {
    if (emulator.isRunning && btn.dataset.key) {
      emulator.sendVirtualKey(btn.dataset.key, false);
    }
  });
  btn.addEventListener('click', () => {
    if (emulator.isRunning) return;
    if (btn.dataset.action === 'a') {
      void launchSelectedSlot();
    } else if (btn.dataset.action === 'b') {
      if (saveDialog.open) saveDialog.close();
      if (coreNoticeDialog.open) coreNoticeDialog.close();
    }
  });
});

window.addEventListener('keydown', (e) => {
  if (emulator.isRunning || saveDialog.open || coreNoticeDialog.open) return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    e.preventDefault();
    const idx = SLOT_ORDER.indexOf(state.selectedSlotId);
    const delta = e.key === 'ArrowLeft' ? -1 : 1;
    const nextIdx = (idx + delta + SLOT_ORDER.length) % SLOT_ORDER.length;
    selectSlot(SLOT_ORDER[nextIdx], { impulse: true, sound: true });
  }
});

// ============================================================================
// Bootstrap
// ============================================================================

updateTopBarIsolationBadge();
startLiveClock();
void initBatteryIndicator();
selectSlot('demo', { impulse: false, sound: false });
cartridge.start();
void preloadDemoRom();

import JSZip from 'jszip';
import { t } from './i18n.js';

const IDBFS_MOUNT = '/user';
const IDBFS_DB_VERSION = 21;
const IDBFS_STORE = 'FILE_DATA';
const MODE_FILE = 0o100666; // 33206 (S_IFREG | 0666)
const MODE_DIR = 0o040777;  // 16895 (S_IFDIR | 0777)

function sanitizeRelativeSavePath(rawPath) {
  const normalized = String(rawPath || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/^user\//, '');
  const parts = normalized.split('/').filter((part) => part && part !== '.' && part !== '..');
  return parts.join('/');
}

function openIdbfsDatabase() {
  const { promise, resolve, reject } = Promise.withResolvers();
  const req = indexedDB.open(IDBFS_MOUNT, IDBFS_DB_VERSION);

  req.onupgradeneeded = () => {
    const db = req.result;
    if (!db.objectStoreNames.contains(IDBFS_STORE)) {
      db.createObjectStore(IDBFS_STORE);
    }
  };

  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(new Error('Falha ao abrir IndexedDB (/user)', { cause: req.error }));
  return promise;
}

async function readIdbfsEntriesDirect() {
  const db = await openIdbfsDatabase();
  try {
    const tx = db.transaction(IDBFS_STORE, 'readonly');
    const store = tx.objectStore(IDBFS_STORE);
    const entries = [];

    const { promise, resolve, reject } = Promise.withResolvers();
    const cursorReq = store.openCursor();
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (!cursor) {
        resolve(entries);
        return;
      }
      const key = String(cursor.key);
      const val = cursor.value;
      if (val && val.contents instanceof Uint8Array) {
        const relPath = sanitizeRelativeSavePath(key);
        if (relPath) {
          entries.push({
            path: key,
            relPath,
            size: val.contents.byteLength,
            timestamp: val.timestamp ? new Date(val.timestamp) : null,
            contents: new Uint8Array(val.contents),
          });
        }
      }
      cursor.continue();
    };
    cursorReq.onerror = () => reject(new Error('Erro ao ler saves do IDBFS', { cause: cursorReq.error }));
    return await promise;
  } finally {
    db.close();
  }
}

async function writeIdbfsFileDirect(relPath, bytes) {
  const cleanRel = sanitizeRelativeSavePath(relPath);
  if (!cleanRel) return;

  const db = await openIdbfsDatabase();
  try {
    const tx = db.transaction(IDBFS_STORE, 'readwrite');
    const store = tx.objectStore(IDBFS_STORE);
    const now = new Date();

    // Ensure intermediate directory entries exist in IDBFS store
    const parts = cleanRel.split('/');
    let dirAccum = IDBFS_MOUNT;
    store.put({ timestamp: now, mode: MODE_DIR }, dirAccum);
    for (let i = 0; i < parts.length - 1; i++) {
      dirAccum += `/${parts[i]}`;
      store.put({ timestamp: now, mode: MODE_DIR }, dirAccum);
    }

    const fullPath = `${IDBFS_MOUNT}/${cleanRel}`;
    store.put(
      {
        timestamp: now,
        mode: MODE_FILE,
        contents: bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes),
      },
      fullPath,
    );

    const { promise, resolve, reject } = Promise.withResolvers();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error('Erro ao gravar save no IndexedDB', { cause: tx.error }));
    await promise;
  } finally {
    db.close();
  }
}

async function clearIdbfsDirect() {
  const db = await openIdbfsDatabase();
  try {
    const tx = db.transaction(IDBFS_STORE, 'readwrite');
    tx.objectStore(IDBFS_STORE).clear();
    const { promise, resolve, reject } = Promise.withResolvers();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error('Erro ao limpar IndexedDB', { cause: tx.error }));
    await promise;
  } finally {
    db.close();
  }
}

function walkLiveModuleFs(FS, currentDir, results = []) {
  let names = [];
  try {
    names = FS.readdir(currentDir);
  } catch {
    return results;
  }

  for (const name of names) {
    if (name === '.' || name === '..') continue;
    const fullPath = `${currentDir}/${name}`;
    try {
      const stat = FS.stat(fullPath);
      if (FS.isDir(stat.mode)) {
        walkLiveModuleFs(FS, fullPath, results);
      } else if (FS.isFile(stat.mode)) {
        const contents = FS.readFile(fullPath);
        const relPath = sanitizeRelativeSavePath(fullPath);
        if (relPath) {
          results.push({
            path: fullPath,
            relPath,
            size: contents.byteLength,
            timestamp: stat.mtime ? new Date(stat.mtime) : new Date(),
            contents,
          });
        }
      }
    } catch {
      // Ignore unreadable special nodes
    }
  }
  return results;
}

export class SaveManager {
  #getModule;
  #syncFn;

  constructor({ getModule, syncFs }) {
    this.#getModule = getModule;
    this.#syncFn = syncFs;
  }

  async listSaves() {
    const mod = this.#getModule?.();
    if (mod?.FS) {
      return walkLiveModuleFs(mod.FS, IDBFS_MOUNT, []);
    }
    return readIdbfsEntriesDirect();
  }

  async exportSaves() {
    const entries = await this.listSaves();
    if (entries.length === 0) {
      return { exported: false, count: 0 };
    }

    // If a single .sav file exists, allow exporting directly or always zip /user cleanly
    if (entries.length === 1 && entries[0].relPath.toLowerCase().endsWith('.sav')) {
      const entry = entries[0];
      const blob = new Blob([entry.contents], { type: 'application/octet-stream' });
      const fileName = entry.relPath.split('/').pop() || 'save.sav';
      this.#triggerDownload(blob, fileName);
      return { exported: true, count: 1, fileName, format: 'sav' };
    }

    const zip = new JSZip();
    for (const entry of entries) {
      zip.file(entry.relPath, entry.contents);
    }

    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    const stamp = new Date().toISOString().slice(0, 10);
    const fileName = `panda3ds-saves-${stamp}.zip`;
    this.#triggerDownload(blob, fileName);
    return { exported: true, count: entries.length, fileName, format: 'zip' };
  }

  async exportSingleSave(relPath) {
    const entries = await this.listSaves();
    const target = entries.find((e) => e.relPath === relPath);
    if (!target) return false;
    const blob = new Blob([target.contents], { type: 'application/octet-stream' });
    const fileName = target.relPath.split('/').pop() || 'save.sav';
    this.#triggerDownload(blob, fileName);
    return true;
  }

  async importSaveFile(file) {
    const buffer = new Uint8Array(await file.arrayBuffer());
    const isZip = file.name.toLowerCase().endsWith('.zip') ||
      (buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04);

    const filesToWrite = [];
    if (isZip) {
      const zip = await JSZip.loadAsync(buffer);
      const tasks = [];
      zip.forEach((relPath, zipEntry) => {
        if (zipEntry.dir) return;
        const clean = sanitizeRelativeSavePath(relPath);
        if (!clean) return;
        tasks.push(
          zipEntry.async('uint8array').then((bytes) => {
            filesToWrite.push({ relPath: clean, bytes });
          }),
        );
      });
      await Promise.all(tasks);
    } else {
      const cleanName = sanitizeRelativeSavePath(file.name) || 'imported.sav';
      filesToWrite.push({ relPath: cleanName, bytes: buffer });
    }

    if (filesToWrite.length === 0) {
      throw new Error(t('saves.noValidInPackage'));
    }

    const mod = this.#getModule?.();
    if (mod?.FS) {
      for (const item of filesToWrite) {
        const fullPath = `${IDBFS_MOUNT}/${item.relPath}`;
        const parentDir = fullPath.slice(0, fullPath.lastIndexOf('/'));
        mod.FS.mkdirTree(parentDir);
        mod.FS.writeFile(fullPath, item.bytes);
      }
      await this.#syncFn?.();
    } else {
      for (const item of filesToWrite) {
        await writeIdbfsFileDirect(item.relPath, item.bytes);
      }
    }

    return filesToWrite.length;
  }

  async clearAllSaves() {
    const mod = this.#getModule?.();
    if (mod?.FS) {
      const entries = walkLiveModuleFs(mod.FS, IDBFS_MOUNT, []);
      for (const entry of entries) {
        try {
          mod.FS.unlink(entry.path);
        } catch {
          // Ignore locked files
        }
      }
      await this.#syncFn?.();
    } else {
      await clearIdbfsDirect();
    }
  }

  #triggerDownload(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

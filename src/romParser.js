/**
 * Parses Nintendo 3DS ROM metadata (.3dsx SMDH headers and .3ds/.cci/.cxi NCCH headers)
 * entirely in the browser without external dependencies.
 */

const TILE_ORDER = [
  0, 1, 8, 9, 2, 3, 10, 11,
  16, 17, 24, 25, 18, 19, 26, 27,
  4, 5, 12, 13, 6, 7, 14, 15,
  20, 21, 28, 29, 22, 23, 30, 31,
  32, 33, 40, 41, 34, 35, 42, 43,
  48, 49, 56, 57, 50, 51, 58, 59,
  36, 37, 44, 45, 38, 39, 46, 47,
  52, 53, 60, 61, 54, 55, 62, 63,
];

function decodeUtf16Le(bytes, offset, byteLength) {
  if (offset + byteLength > bytes.length) return '';
  const slice = bytes.subarray(offset, offset + byteLength);
  const decoder = new TextDecoder('utf-16le');
  return decoder.decode(slice).split('\0')[0].trim();
}

function decodeAscii(bytes, offset, byteLength) {
  if (offset + byteLength > bytes.length) return '';
  let result = '';
  for (let i = 0; i < byteLength; i++) {
    const ch = bytes[offset + i];
    if (ch === 0) break;
    if (ch >= 0x20 && ch <= 0x7e) {
      result += String.fromCharCode(ch);
    }
  }
  return result.trim();
}

function decodeSmdhLargeIcon(bytes, iconOffset) {
  const size = 48;
  const required = size * size * 2;
  if (iconOffset + required > bytes.length) return null;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const imgData = ctx.createImageData(size, size);
  const view = new DataView(bytes.buffer, bytes.byteOffset + iconOffset, required);

  let pos = 0;
  for (let tileY = 0; tileY < size; tileY += 8) {
    for (let tileX = 0; tileX < size; tileX += 8) {
      for (let i = 0; i < 64; i++) {
        const morton = TILE_ORDER[i];
        const px = tileX + (morton & 7);
        const py = tileY + (morton >> 3);
        const rgb565 = view.getUint16(pos * 2, true);
        pos++;

        const r = ((rgb565 >> 11) & 0x1f) * (255 / 31);
        const g = ((rgb565 >> 5) & 0x3f) * (255 / 63);
        const b = (rgb565 & 0x1f) * (255 / 31);
        const idx = (py * size + px) * 4;
        imgData.data[idx] = Math.round(r);
        imgData.data[idx + 1] = Math.round(g);
        imgData.data[idx + 2] = Math.round(b);
        imgData.data[idx + 3] = 255;
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

function parseSmdhBlock(bytes, smdhOffset) {
  if (smdhOffset < 0 || smdhOffset + 0x36c0 > bytes.length) return null;
  const magic = decodeAscii(bytes, smdhOffset, 4);
  if (magic !== 'SMDH') return null;

  // Title entry #1 (English) starts at +8 + 0x200
  const enOffset = smdhOffset + 8 + 0x200;
  const shortTitle = decodeUtf16Le(bytes, enOffset, 0x80);
  const longTitle = decodeUtf16Le(bytes, enOffset + 0x80, 0x100);
  const publisher = decodeUtf16Le(bytes, enOffset + 0x180, 0x80);
  const iconCanvas = decodeSmdhLargeIcon(bytes, smdhOffset + 0x24c0);

  return {
    shortTitle,
    longTitle,
    publisher,
    iconCanvas,
  };
}

function deriveSerialFromName(fileName) {
  const clean = fileName.replace(/\.[^.]+$/, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const code = (clean.slice(0, 4) || 'HOME').padEnd(4, 'X');
  return `CTR-P-${code}`;
}

function extractNcchMetadata(bytes, view, ncchOffset, meta) {
  if (ncchOffset + 0x200 > bytes.length) return;
  if (decodeAscii(bytes, ncchOffset + 0x100, 4) !== 'NCCH') return;

  const productCode = decodeAscii(bytes, ncchOffset + 0x150, 16);
  if (productCode) meta.serial = productCode;

  const noCrypto = (bytes[ncchOffset + 0x188 + 7] & 0x04) === 0x04;
  const exeFsOffset = ncchOffset + view.getUint32(ncchOffset + 0x1a0, true) * 0x200;
  const exeFsSize = view.getUint32(ncchOffset + 0x1a4, true) * 0x200;

  if (exeFsSize < 0x200 || exeFsOffset + 0x200 > bytes.length) {
    meta.encrypted = !noCrypto;
    return;
  }

  // ExeFS header has up to 10 file entries (16 bytes each: 8B name, 4B offset, 4B size)
  let foundSmdh = false;
  for (let i = 0; i < 10; i++) {
    const entryOff = exeFsOffset + i * 16;
    const entryName = decodeAscii(bytes, entryOff, 8);
    const fileOffset = view.getUint32(entryOff + 8, true);
    const fileSize = view.getUint32(entryOff + 12, true);

    if (entryName === 'icon' && fileSize >= 0x36c0) {
      const iconSmdhOff = exeFsOffset + 0x200 + fileOffset;
      if (iconSmdhOff + 0x36c0 <= bytes.length) {
        const smdh = parseSmdhBlock(bytes, iconSmdhOff);
        if (smdh) {
          foundSmdh = true;
          if (smdh.shortTitle) meta.title = smdh.shortTitle;
          if (smdh.publisher) meta.publisher = smdh.publisher;
          if (smdh.longTitle) meta.subtitle = smdh.longTitle;
          meta.iconCanvas = smdh.iconCanvas;
        }
      }
      break;
    }
  }

  meta.encrypted = !noCrypto && !foundSmdh;
}

export function parseRomMetadata(fileName, bytes) {
  const fallbackTitle = fileName.replace(/\.[^.]+$/, '');
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  const meta = {
    fileName,
    ext,
    sizeBytes: bytes.byteLength,
    title: fallbackTitle,
    subtitle: `${(bytes.byteLength / 1024).toFixed(1)} KB • .${ext || 'rom'}`,
    publisher: 'Nintendo 3DS Software',
    serial: deriveSerialFromName(fileName),
    iconCanvas: null,
    encrypted: false,
    format: ext.toUpperCase() || 'ROM',
  };

  if (bytes.length >= 44 && decodeAscii(bytes, 0, 4) === '3DSX') {
    meta.format = '3DSX Homebrew';
    const headerSize = view.getUint16(4, true);
    if (headerSize >= 44) {
      const smdhOffset = view.getUint32(32, true);
      const smdhSize = view.getUint32(36, true);
      if (smdhSize >= 0x36c0 && smdhOffset + smdhSize <= bytes.length) {
        const smdh = parseSmdhBlock(bytes, smdhOffset);
        if (smdh) {
          if (smdh.shortTitle) meta.title = smdh.shortTitle;
          if (smdh.publisher) meta.publisher = smdh.publisher;
          if (smdh.longTitle) meta.subtitle = smdh.longTitle;
          meta.iconCanvas = smdh.iconCanvas;
        }
      }
    }
    if (fileName.toLowerCase().includes('2048')) {
      meta.serial = 'CTR-P-2048';
    }
    return meta;
  }

  // NCSD (.3ds / .cci): magic 'NCSD' at 0x100, partition 0 NCCH starts at offset table * 0x200 (default 0x4000)
  if (bytes.length >= 0x4200 && decodeAscii(bytes, 0x100, 4) === 'NCSD') {
    meta.format = 'NCSD (.3ds)';
    const ncchOffsetUnits = view.getUint32(0x120, true);
    const ncchOffset = ncchOffsetUnits > 0 ? ncchOffsetUnits * 0x200 : 0x4000;
    extractNcchMetadata(bytes, view, ncchOffset, meta);
    return meta;
  }

  // Standalone NCCH (.cxi / .app): magic 'NCCH' at 0x100
  if (bytes.length >= 0x200 && decodeAscii(bytes, 0x100, 4) === 'NCCH') {
    meta.format = 'NCCH (.cxi)';
    extractNcchMetadata(bytes, view, 0, meta);
    return meta;
  }

  return meta;
}

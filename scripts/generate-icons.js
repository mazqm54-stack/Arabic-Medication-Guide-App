/**
 * Generates public/icon-192.png and public/icon-512.png using Node.js built-in zlib.
 * No external dependencies required.
 * Palette: Deep Teal #006D77, Warm White #F8F9FA, Amber #F59E0B, Dark Slate #1D3557.
 */
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createMedicationIconPng(size) {
  const width = size;
  const height = size;
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const table = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (-306674912 ^ (c >>> 1)) : (c >>> 1);
    table[i] = c;
  }
  function crc32(buf) {
    let crc = -1;
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
    }
    return (crc ^ -1) >>> 0;
  }
  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const t = Buffer.from(type, 'ascii');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
    return Buffer.concat([len, t, data, crc]);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2; // RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rowLen = 1 + width * 3;
  const raw = Buffer.alloc(height * rowLen);
  
  // Capsule dimensions
  const capHalfWidth = width * 0.28;
  const capRadius = height * 0.16;
  const cx = width / 2;
  const cy = height / 2;

  for (let y = 0; y < height; y++) {
    const offset = y * rowLen;
    raw[offset] = 0;
    for (let x = 0; x < width; x++) {
      const px = offset + 1 + x * 3;
      // Background: Deep Teal #006D77
      let r = 0, g = 109, b = 119;
      
      const dx = x - cx;
      const dy = y - cy;
      let inCapsule = false;
      const isRightSide = dx > 0;

      if (Math.abs(dy) <= capRadius) {
        if (Math.abs(dx) <= capHalfWidth - capRadius) {
          inCapsule = true;
        } else if (dx < 0 && Math.hypot(dx + (capHalfWidth - capRadius), dy) <= capRadius) {
          inCapsule = true;
        } else if (dx > 0 && Math.hypot(dx - (capHalfWidth - capRadius), dy) <= capRadius) {
          inCapsule = true;
        }
      }

      if (inCapsule) {
        if (Math.abs(dx) < 2) {
          // Capsule divider: Dark Slate #1D3557
          r = 29; g = 53; b = 87;
        } else if (isRightSide) {
          // Right half: Amber #F59E0B
          r = 245; g = 158; b = 11;
        } else {
          // Left half: Warm White #F8F9FA
          r = 248; g = 249; b = 250;
        }
      }

      raw[px] = r;
      raw[px + 1] = g;
      raw[px + 2] = b;
    }
  }

  const idat = chunk('IDAT', zlib.deflateSync(raw));
  const iend = chunk('IEND', Buffer.alloc(0));
  return Buffer.concat([signature, chunk('IHDR', ihdr), idat, iend]);
}

const publicDir = path.resolve(__dirname, '..', 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

fs.writeFileSync(path.join(publicDir, 'icon-192.png'), createMedicationIconPng(192));
fs.writeFileSync(path.join(publicDir, 'icon-512.png'), createMedicationIconPng(512));
console.log('Successfully generated public/icon-192.png and public/icon-512.png');

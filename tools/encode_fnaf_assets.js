/**
 * tools/encode_fnaf_assets.js
 * 
 * Five Nights at Freddy's (FNAF) Asset Compression Pipeline for NumWorks (EquaLib)
 * High-Fidelity 160x120 4bpp with 2x2 Box-Filter Downsampling & Floyd-Steinberg Dithering.
 * Custom 16-color RGB565 palette per asset.
 * 
 * Output:
 *  - launcher/include/fnaf_assets.h
 *  - launcher/src/fnaf_assets.c
 * 
 * Budget constraint: strictly < 350 KB (< 358,400 bytes).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

const ASSET_DIR = fs.existsSync('assets/fnaf') ? 'assets/fnaf' : 'web/assets/fnaf';
const HEADER_OUT = 'launcher/include/fnaf_assets.h';
const SOURCE_OUT = 'launcher/src/fnaf_assets.c';

const ASSET_SPECS = [
  { id: 'FNAF_IMG_OFFICE_NORMAL_LEFT',     file: 'office_normal_left.png' },
  { id: 'FNAF_IMG_OFFICE_NORMAL_CENTER',   file: 'office_normal_center.png' },
  { id: 'FNAF_IMG_OFFICE_NORMAL_RIGHT',    file: 'office_normal_right.png' },
  { id: 'FNAF_IMG_OFFICE_LIGHT_L_LEFT',    file: 'office_light_l_left.png' },
  { id: 'FNAF_IMG_OFFICE_LIGHT_L_CENTER',  file: 'office_light_l_center.png' },
  { id: 'FNAF_IMG_OFFICE_LIGHT_L_RIGHT',   file: 'office_light_l_right.png' },
  { id: 'FNAF_IMG_OFFICE_LIGHT_R_LEFT',    file: 'office_light_r_left.png' },
  { id: 'FNAF_IMG_OFFICE_LIGHT_R_CENTER',  file: 'office_light_r_center.png' },
  { id: 'FNAF_IMG_OFFICE_LIGHT_R_RIGHT',   file: 'office_light_r_right.png' },
  { id: 'FNAF_IMG_OFFICE_BONNIE_LEFT',     file: 'office_bonnie_left.png' },
  { id: 'FNAF_IMG_OFFICE_BONNIE_CENTER',   file: 'office_bonnie_center.png' },
  { id: 'FNAF_IMG_OFFICE_BONNIE_RIGHT',    file: 'office_bonnie_right.png' },
  { id: 'FNAF_IMG_OFFICE_CHICA_LEFT',      file: 'office_chica_left.png' },
  { id: 'FNAF_IMG_OFFICE_CHICA_CENTER',    file: 'office_chica_center.png' },
  { id: 'FNAF_IMG_OFFICE_CHICA_RIGHT',     file: 'office_chica_right.png' },
  { id: 'FNAF_IMG_OFFICE_BLACKOUT_LEFT',   file: 'office_blackout_left.png' },
  { id: 'FNAF_IMG_OFFICE_BLACKOUT_CENTER', file: 'office_blackout_center.png' },
  { id: 'FNAF_IMG_OFFICE_BLACKOUT_RIGHT',  file: 'office_blackout_right.png' },
  { id: 'FNAF_IMG_CAM_1A_STAGE',           file: 'cam_1a_stage.png' },
  { id: 'FNAF_IMG_CAM_1B_DINING',          file: 'cam_1b_dining.png' },
  { id: 'FNAF_IMG_CAM_1C_COVE',            file: 'cam_1c_cove.png' },
  { id: 'FNAF_IMG_CAM_2A_WEST_HALL',       file: 'cam_2a_west_hall.png' },
  { id: 'FNAF_IMG_CAM_2B_WEST_CORNER',     file: 'cam_2b_west_corner.png' },
  { id: 'FNAF_IMG_CAM_3_CLOSET',           file: 'cam_3_closet.png' },
  { id: 'FNAF_IMG_CAM_4A_EAST_HALL',       file: 'cam_4a_east_hall.png' },
  { id: 'FNAF_IMG_CAM_4B_EAST_CORNER',     file: 'cam_4b_east_corner.png' },
  { id: 'FNAF_IMG_SCARE_BONNIE',           file: 'scare_bonnie.png' },
  { id: 'FNAF_IMG_SCARE_CHICA',            file: 'scare_chica.png' },
  { id: 'FNAF_IMG_SCARE_FOXY',             file: 'scare_foxy.png' },
  { id: 'FNAF_IMG_SCARE_FREDDY',           file: 'scare_freddy.png' },
  { id: 'FNAF_IMG_SCARE_0210',             file: 'scare_0210.png' },
  { id: 'FNAF_IMG_SCARE_0225',             file: 'scare_0225.png' },
  { id: 'FNAF_IMG_SCARE_0245',             file: 'scare_0245.png' },
  { id: 'FNAF_IMG_SCARE_0280',             file: 'scare_0280.png' },
  { id: 'FNAF_IMG_SCARE_0295',             file: 'scare_0295.png' }
];

function decodePNG(filePath) {
  const buf = fs.readFileSync(filePath);
  let pos = 8;
  let ihdr = null;
  const idats = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.slice(pos + 8, pos + 8 + len);
    pos += 12 + len;
    if (type === 'IHDR') {
      ihdr = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        depth: data[8],
        colorType: data[9],
      };
    } else if (type === 'IDAT') {
      idats.push(data);
    }
  }
  const idatBuf = zlib.inflateSync(Buffer.concat(idats));
  const bpp = ihdr.colorType === 6 ? 4 : (ihdr.colorType === 2 ? 3 : 1);
  const stride = ihdr.width * bpp;
  const pixels = Buffer.alloc(ihdr.width * ihdr.height * bpp);
  let srcPos = 0;

  function paeth(a, b, c) {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    if (pb <= pc) return b;
    return c;
  }

  for (let y = 0; y < ihdr.height; y++) {
    const filter = idatBuf[srcPos++];
    const lineDst = y * stride;
    const prevDst = (y - 1) * stride;
    for (let x = 0; x < stride; x++) {
      const raw = idatBuf[srcPos++];
      const a = x >= bpp ? pixels[lineDst + x - bpp] : 0;
      const b = y > 0 ? pixels[prevDst + x] : 0;
      const c = (x >= bpp && y > 0) ? pixels[prevDst + x - bpp] : 0;
      let val = raw;
      if (filter === 1) val = (raw + a) & 0xff;
      else if (filter === 2) val = (raw + b) & 0xff;
      else if (filter === 3) val = (raw + Math.floor((a + b) / 2)) & 0xff;
      else if (filter === 4) val = (raw + paeth(a, b, c)) & 0xff;
      pixels[lineDst + x] = val;
    }
  }
  return { width: ihdr.width, height: ihdr.height, bpp, pixels };
}

// High-Fidelity 2x2 Area-Average Downscaling
function boxDownscale2x(pixels, bpp, sw, sh) {
  const dw = sw >> 1;
  const dh = sh >> 1;
  const out = Buffer.alloc(dw * dh * 3);
  for (let dy = 0; dy < dh; dy++) {
    for (let dx = 0; dx < dw; dx++) {
      const sx = dx << 1;
      const sy = dy << 1;
      let r = 0, g = 0, b = 0;
      for (let oy = 0; oy < 2; oy++) {
        for (let ox = 0; ox < 2; ox++) {
          const idx = ((sy + oy) * sw + (sx + ox)) * bpp;
          r += pixels[idx];
          g += pixels[idx + 1];
          b += pixels[idx + 2];
        }
      }
      const outIdx = (dy * dw + dx) * 3;
      out[outIdx]     = (r + 2) >> 2;
      out[outIdx + 1] = (g + 2) >> 2;
      out[outIdx + 2] = (b + 2) >> 2;
    }
  }
  return out;
}

function toRGB565(r, g, b) {
  return (((r & 0xF8) << 8) | ((g & 0xFC) << 3) | ((b & 0xF8) >> 3)) & 0xFFFF;
}

// Adaptive 16-Color Palette Generation + Floyd-Steinberg Error Diffusion Dithering
function quantizeAndDither16(rgbPixels, w, h) {
  const total = w * h;
  const k = 16;

  // 1. Histogram with 4-bit perceptual quantization
  const hist = new Map();
  for (let i = 0; i < total; i++) {
    const idx = i * 3;
    const r = (rgbPixels[idx] >> 3) << 3;
    const g = (rgbPixels[idx + 1] >> 3) << 3;
    const b = (rgbPixels[idx + 2] >> 3) << 3;
    const key = (r << 16) | (g << 8) | b;
    hist.set(key, (hist.get(key) || 0) + 1);
  }

  const sorted = Array.from(hist.entries()).sort((a, b) => b[1] - a[1]);
  const centroids = [[0, 0, 0]]; // Pure black slot 0

  // Diversity-driven palette selection
  for (const [key, _] of sorted) {
    if (centroids.length >= k) break;
    const r = (key >> 16) & 0xff;
    const g = (key >> 8) & 0xff;
    const b = key & 0xff;
    let ok = true;
    for (const [cr, cg, cb] of centroids) {
      const d = (r - cr) * (r - cr) * 0.299 + (g - cg) * (g - cg) * 0.587 + (b - cb) * (b - cb) * 0.114;
      if (d < 180) { ok = false; break; }
    }
    if (ok) centroids.push([r, g, b]);
  }
  while (centroids.length < k) centroids.push([0, 0, 0]);

  // Working float buffer for error diffusion
  const bufR = new Float32Array(total);
  const bufG = new Float32Array(total);
  const bufB = new Float32Array(total);
  for (let i = 0; i < total; i++) {
    bufR[i] = rgbPixels[i * 3];
    bufG[i] = rgbPixels[i * 3 + 1];
    bufB[i] = rgbPixels[i * 3 + 2];
  }

  const indexed = new Uint8Array(total);
  const ditherStrength = 0.65; // Balanced error diffusion for optimal RLE compression & smooth gradients

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const r = Math.min(255, Math.max(0, bufR[idx]));
      const g = Math.min(255, Math.max(0, bufG[idx]));
      const b = Math.min(255, Math.max(0, bufB[idx]));

      let bestDist = Infinity, bestC = 0;
      for (let c = 0; c < k; c++) {
        const cr = centroids[c][0], cg = centroids[c][1], cb = centroids[c][2];
        const dist = (r - cr) * (r - cr) * 0.299 + (g - cg) * (g - cg) * 0.587 + (b - cb) * (b - cb) * 0.114;
        if (dist < bestDist) { bestDist = dist; bestC = c; }
      }
      indexed[idx] = bestC;

      const errR = (r - centroids[bestC][0]) * ditherStrength;
      const errG = (g - centroids[bestC][1]) * ditherStrength;
      const errB = (b - centroids[bestC][2]) * ditherStrength;

      if (x + 1 < w) {
        bufR[idx + 1] += errR * (7 / 16);
        bufG[idx + 1] += errG * (7 / 16);
        bufB[idx + 1] += errB * (7 / 16);
      }
      if (y + 1 < h) {
        if (x > 0) {
          bufR[idx + w - 1] += errR * (3 / 16);
          bufG[idx + w - 1] += errG * (3 / 16);
          bufB[idx + w - 1] += errB * (3 / 16);
        }
        bufR[idx + w] += errR * (5 / 16);
        bufG[idx + w] += errG * (5 / 16);
        bufB[idx + w] += errB * (5 / 16);
        if (x + 1 < w) {
          bufR[idx + w + 1] += errR * (1 / 16);
          bufG[idx + w + 1] += errG * (1 / 16);
          bufB[idx + w + 1] += errB * (1 / 16);
        }
      }
    }
  }

  const palette = centroids.map(([r, g, b]) => toRGB565(r, g, b));
  return { palette, indexed };
}

// 1-byte packed RLE: ((run - 1) << 4) | (color_index & 0x0F)
function encodeRLE(indexed) {
  const bytes = [];
  let i = 0;
  while (i < indexed.length) {
    const color = indexed[i];
    let run = 1;
    while (i + run < indexed.length && indexed[i + run] === color && run < 16) {
      run++;
    }
    bytes.push(((run - 1) << 4) | (color & 0x0F));
    i += run;
  }
  return Buffer.from(bytes);
}

// Main Encoding Process
console.log('=== High-Fidelity FNAF Asset Compression Pipeline ===');
console.log(`Processing ${ASSET_SPECS.length} assets from ${ASSET_DIR}...\n`);

const encodedAssets = [];
const contentHashMap = new Map();
let totalFlashBytes = 0;

for (let idx = 0; idx < ASSET_SPECS.length; idx++) {
  const spec = ASSET_SPECS[idx];
  const filePath = path.join(ASSET_DIR, spec.file);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing asset file: ${filePath}`);
  }
  const fileBuf = fs.readFileSync(filePath);
  const hash = crypto.createHash('sha256').update(fileBuf).digest('hex');

  if (contentHashMap.has(hash)) {
    const masterIdx = contentHashMap.get(hash);
    const master = encodedAssets[masterIdx];
    encodedAssets.push({
      id: spec.id,
      file: spec.file,
      width: master.width,
      height: master.height,
      palette: master.palette,
      rleBuffer: master.rleBuffer,
      sharedWith: masterIdx
    });
    console.log(`[${idx + 1}/35] ${spec.file.padEnd(28)} -> REUSED asset #${masterIdx} (${master.file})`);
    continue;
  }

  const decoded = decodePNG(filePath);
  const targetW = 160;
  const targetH = 120;
  const dsPixels = boxDownscale2x(decoded.pixels, decoded.bpp, decoded.width, decoded.height);
  const { palette, indexed } = quantizeAndDither16(dsPixels, targetW, targetH);
  const rleBuffer = encodeRLE(indexed);

  totalFlashBytes += rleBuffer.length + (palette.length * 2);
  contentHashMap.set(hash, idx);

  encodedAssets.push({
    id: spec.id,
    file: spec.file,
    width: targetW,
    height: targetH,
    palette,
    rleBuffer,
    sharedWith: null
  });

  console.log(`[${idx + 1}/35] ${spec.file.padEnd(28)} -> ${rleBuffer.length} bytes RLE + 32B pal`);
}

console.log(`\nTotal Flash size for 35 compressed assets: ${totalFlashBytes} bytes (${(totalFlashBytes / 1024).toFixed(1)} KB)`);
if (totalFlashBytes > 350 * 1024) {
  console.error(`ERROR: Total asset footprint (${totalFlashBytes} bytes) exceeds 350 KB ceiling!`);
  process.exit(1);
} else {
  console.log(`✓ Successfully under 350 KB Flash budget! (${(totalFlashBytes / 1024).toFixed(1)} KB / 350.0 KB)\n`);
}

// Generate launcher/include/fnaf_assets.h
const headerContent = `/* =========================================================================
 * Five Nights at Freddy's (FNAF) Asset Definitions for NumWorks (EquaLib)
 * Auto-generated by tools/encode_fnaf_assets.js - DO NOT EDIT MANUALLY
 * ========================================================================= */

#ifndef FNAF_ASSETS_H
#define FNAF_ASSETS_H

#include <stdint.h>

#define FNAF_ASSET_COUNT 35
#define FNAF_SCREEN_WIDTH 320
#define FNAF_SCREEN_HEIGHT 240

typedef enum {
${encodedAssets.map((a, i) => `    ${a.id} = ${i},`).join('\n')}
} fnaf_asset_id_t;

/* Convenience aliases for spec compatibility */
#define FNAF_IMG_OFFICE_LIGHT_L_EMPTY   FNAF_IMG_OFFICE_LIGHT_L_LEFT
#define FNAF_IMG_OFFICE_LIGHT_L_BONNIE  FNAF_IMG_OFFICE_BONNIE_LEFT
#define FNAF_IMG_OFFICE_LIGHT_R_EMPTY   FNAF_IMG_OFFICE_LIGHT_R_RIGHT
#define FNAF_IMG_OFFICE_LIGHT_R_CHICA   FNAF_IMG_OFFICE_CHICA_RIGHT
#define FNAF_IMG_CAM_1C_COVE_0          FNAF_IMG_CAM_1C_COVE
#define FNAF_IMG_CAM_1C_COVE_1          FNAF_IMG_CAM_1C_COVE
#define FNAF_IMG_CAM_1C_COVE_2          FNAF_IMG_CAM_1C_COVE
#define FNAF_IMG_CAM_1C_COVE_3          FNAF_IMG_CAM_1C_COVE
#define FNAF_IMG_CAM_5_BACKSTAGE        FNAF_IMG_CAM_3_CLOSET
#define FNAF_IMG_CAM_7_RESTROOMS        FNAF_IMG_CAM_1B_DINING

typedef struct {
    uint16_t width;
    uint16_t height;
    uint16_t palette_size;
    const uint16_t *palette_rgb565;
    const uint8_t *rle_data;
    uint32_t rle_data_size;
} fnaf_asset_descriptor_t;

extern const fnaf_asset_descriptor_t g_fnaf_assets[FNAF_ASSET_COUNT];

#endif /* FNAF_ASSETS_H */
`;

// Generate launcher/src/fnaf_assets.c
let sourceContent = `/* =========================================================================
 * Five Nights at Freddy's (FNAF) Asset Tables for NumWorks (EquaLib)
 * Auto-generated by tools/encode_fnaf_assets.js - DO NOT EDIT MANUALLY
 * ========================================================================= */

#include "fnaf_assets.h"

`;

// Output Palettes and RLE buffers for non-shared assets
for (let i = 0; i < encodedAssets.length; i++) {
  const asset = encodedAssets[i];
  if (asset.sharedWith !== null) continue;

  const safeName = asset.id.toLowerCase();
  sourceContent += `/* Asset #${i}: ${asset.file} (${asset.rleBuffer.length} bytes RLE) */\n`;
  sourceContent += `static const uint16_t s_${safeName}_pal[16] = {\n`;
  for (let p = 0; p < asset.palette.length; p += 8) {
    const chunk = asset.palette.slice(p, p + 8);
    sourceContent += `    ${chunk.map(c => '0x' + c.toString(16).padStart(4, '0')).join(', ')}${p + 8 < asset.palette.length ? ',' : ''}\n`;
  }
  sourceContent += `};\n\n`;

  sourceContent += `static const uint8_t s_${safeName}_rle[${asset.rleBuffer.length}] = {\n`;
  for (let r = 0; r < asset.rleBuffer.length; r += 16) {
    const chunk = asset.rleBuffer.slice(r, r + 16);
    const hexVals = [];
    for (let b = 0; b < chunk.length; b++) {
      hexVals.push('0x' + chunk[b].toString(16).padStart(2, '0'));
    }
    sourceContent += `    ${hexVals.join(', ')}${r + 16 < asset.rleBuffer.length ? ',' : ''}\n`;
  }
  sourceContent += `};\n\n`;
}

// Descriptor Table
sourceContent += `const fnaf_asset_descriptor_t g_fnaf_assets[FNAF_ASSET_COUNT] = {\n`;
for (let i = 0; i < encodedAssets.length; i++) {
  const asset = encodedAssets[i];
  const refIndex = asset.sharedWith !== null ? asset.sharedWith : i;
  const master = encodedAssets[refIndex];
  const safeName = master.id.toLowerCase();

  sourceContent += `    [${asset.id}] = {\n`;
  sourceContent += `        .width = ${asset.width},\n`;
  sourceContent += `        .height = ${asset.height},\n`;
  sourceContent += `        .palette_size = ${asset.palette.length},\n`;
  sourceContent += `        .palette_rgb565 = s_${safeName}_pal,\n`;
  sourceContent += `        .rle_data = s_${safeName}_rle,\n`;
  sourceContent += `        .rle_data_size = ${asset.rleBuffer.length}\n`;
  sourceContent += `    }${i + 1 < encodedAssets.length ? ',' : ''}\n`;
}
sourceContent += `};\n`;

fs.writeFileSync(HEADER_OUT, headerContent, 'utf8');
fs.writeFileSync(SOURCE_OUT, sourceContent, 'utf8');

console.log(`Generated ${HEADER_OUT}`);
console.log(`Generated ${SOURCE_OUT}`);
console.log('=== High-Fidelity FNAF Asset Encoding Complete! ===');

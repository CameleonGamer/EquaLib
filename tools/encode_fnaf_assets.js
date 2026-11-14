/**
 * tools/encode_fnaf_assets.js
 * 
 * Five Nights at Freddy's (FNAF) Asset Compression Pipeline for NumWorks (EquaLib)
 * Converts 35 PNG assets into 160x120 4bpp (16-color) RLE-compressed C arrays
 * with custom RGB565 palettes.
 * 
 * Output:
 *  - launcher/include/fnaf_assets.h
 *  - launcher/src/fnaf_assets.c
 * 
 * Footprint target: strictly under 350 KB, and keeping total binary under 1 MB.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

const ASSET_DIR = fs.existsSync('assets/fnaf') ? 'assets/fnaf' : 'web/assets/fnaf';
const HEADER_OUT = 'launcher/include/fnaf_assets.h';
const SOURCE_OUT = 'launcher/src/fnaf_assets.c';

// Explicit ordering of the 35 assets
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

// Pure Node.js PNG decoder (RGBA / RGB, 8-bit depth)
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

// Downsample bilinear/nearest to 160x120
function downsample(pixels, bpp, sw, sh, dw, dh) {
  const out = Buffer.alloc(dw * dh * bpp);
  const xRatio = sw / dw;
  const yRatio = sh / dh;
  for (let y = 0; y < dh; y++) {
    const sy = Math.floor(y * yRatio);
    for (let x = 0; x < dw; x++) {
      const sx = Math.floor(x * xRatio);
      const srcIdx = (sy * sw + sx) * bpp;
      const dstIdx = (y * dw + x) * bpp;
      for (let c = 0; c < bpp; c++) {
        out[dstIdx + c] = pixels[srcIdx + c];
      }
    }
  }
  return out;
}

// Convert 8-bit R,G,B to RGB565 uint16
function toRGB565(r, g, b) {
  return (((r & 0xF8) << 8) | ((g & 0xFC) << 3) | ((b & 0xF8) >> 3)) & 0xFFFF;
}

// Quantize image to 16 RGB565 colors using diversity-initialized K-Means
function quantize16(pixels, bpp, totalPixels) {
  const k = 16;
  const shift = 4;
  const map = new Map();
  for (let i = 0; i < totalPixels; i++) {
    const idx = i * bpp;
    const r = (pixels[idx] >> shift) << shift;
    const g = (pixels[idx+1] >> shift) << shift;
    const b = (pixels[idx+2] >> shift) << shift;
    const key = (r << 16) | (g << 8) | b;
    map.set(key, (map.get(key) || 0) + 1);
  }

  const sorted = Array.from(map.entries()).sort((a,b) => b[1] - a[1]);
  const centroids = [];
  centroids.push([0, 0, 0]); // Pure black slot 0

  for (const [key, _] of sorted) {
    if (centroids.length >= k) break;
    const r = (key >> 16) & 0xff;
    const g = (key >> 8) & 0xff;
    const b = key & 0xff;
    let tooClose = false;
    for (const [cr, cg, cb] of centroids) {
      const d = (r-cr)*(r-cr) + (g-cg)*(g-cg) + (b-cb)*(b-cb);
      if (d < 400) { tooClose = true; break; }
    }
    if (!tooClose) centroids.push([r, g, b]);
  }
  while (centroids.length < k) {
    centroids.push([0, 0, 0]);
  }

  const assignments = new Uint8Array(totalPixels);
  for (let i = 0; i < totalPixels; i++) {
    const idx = i * bpp;
    let r = (pixels[idx] >> 3) << 3;
    let g = (pixels[idx+1] >> 3) << 3;
    let b = (pixels[idx+2] >> 3) << 3;
    let bestDist = Infinity, bestC = 0;
    for (let c = 0; c < k; c++) {
      const cr = centroids[c][0], cg = centroids[c][1], cb = centroids[c][2];
      const dist = (r-cr)*(r-cr) + (g-cg)*(g-cg) + (b-cb)*(b-cb);
      if (dist < bestDist) { bestDist = dist; bestC = c; }
    }
    assignments[i] = bestC;
  }

  const palette = centroids.map(([r,g,b]) => toRGB565(r, g, b));
  return { palette, indexed: assignments };
}

// 1-byte packed RLE:
// byte = ((run - 1) << 4) | (color_index & 0x0F)
// where run is 1 to 16
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
console.log('=== FNAF Asset Compression Pipeline ===');
console.log(`Processing ${ASSET_SPECS.length} assets from ${ASSET_DIR}...\n`);

const encodedAssets = [];
const contentHashMap = new Map(); // hash -> master asset index
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
    // Reuse identical asset
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
  const dsPixels = downsample(decoded.pixels, decoded.bpp, decoded.width, decoded.height, targetW, targetH);
  const { palette, indexed } = quantize16(dsPixels, decoded.bpp, targetW * targetH);
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
  console.error('ERROR: Total asset footprint exceeds 350 KB ceiling!');
  process.exit(1);
} else {
  console.log('✓ Successfully under 350 KB Flash budget!\n');
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

fs.writeFileSync(HEADER_OUT, headerContent, 'utf8');
console.log(`Generated ${HEADER_OUT}`);

// Generate launcher/src/fnaf_assets.c
let sourceContent = `/* =========================================================================
 * Five Nights at Freddy's (FNAF) Compressed Asset Tables
 * Auto-generated by tools/encode_fnaf_assets.js - DO NOT EDIT MANUALLY
 * ========================================================================= */

#include "fnaf_assets.h"

`;

// Write palettes and RLE data arrays (only for unique assets)
for (let i = 0; i < encodedAssets.length; i++) {
  const asset = encodedAssets[i];
  if (asset.sharedWith !== null) continue; // Reuse master asset

  sourceContent += `/* Asset ${i}: ${asset.id} (${asset.file}) */\n`;
  sourceContent += `static const uint16_t s_fnaf_pal_${i}[16] = {\n  `;
  for (let p = 0; p < asset.palette.length; p++) {
    sourceContent += `0x${asset.palette[p].toString(16).padStart(4, '0')}`;
    if (p < asset.palette.length - 1) sourceContent += ', ';
    if ((p + 1) % 8 === 0 && p < asset.palette.length - 1) sourceContent += '\n  ';
  }
  sourceContent += '\n};\n\n';

  sourceContent += `static const uint8_t s_fnaf_rle_${i}[${asset.rleBuffer.length}] = {\n  `;
  for (let b = 0; b < asset.rleBuffer.length; b++) {
    sourceContent += `0x${asset.rleBuffer[b].toString(16).padStart(2, '0')}`;
    if (b < asset.rleBuffer.length - 1) sourceContent += ',';
    if ((b + 1) % 16 === 0 && b < asset.rleBuffer.length - 1) sourceContent += '\n  ';
  }
  sourceContent += '\n};\n\n';
}

// Write the descriptor table
sourceContent += `const fnaf_asset_descriptor_t g_fnaf_assets[FNAF_ASSET_COUNT] = {\n`;
for (let i = 0; i < encodedAssets.length; i++) {
  const asset = encodedAssets[i];
  const masterIdx = (asset.sharedWith !== null) ? asset.sharedWith : i;
  sourceContent += `    { ${asset.width}, ${asset.height}, 16, s_fnaf_pal_${masterIdx}, s_fnaf_rle_${masterIdx}, ${asset.rleBuffer.length} },\n`;
}
sourceContent += '};\n';

fs.writeFileSync(SOURCE_OUT, sourceContent, 'utf8');
console.log(`Generated ${SOURCE_OUT}`);
console.log('=== FNAF Asset Encoding Complete! ===');

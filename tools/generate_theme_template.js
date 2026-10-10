const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// 1. Création du SVG vectoriel haute précision 320x240
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240" width="320" height="240">
  <defs>
    <style>
      .label-title { font-family: monospace; font-size: 10px; font-weight: bold; fill: #ffffff; }
      .label-sub { font-family: monospace; font-size: 8px; fill: #94a3b8; }
      .label-zone { font-family: monospace; font-size: 9px; font-weight: bold; }
      .grid-box { fill: #1e293b; stroke: #38bdf8; stroke-width: 1.5; stroke-dasharray: 4,2; rx: 6px; }
      .grid-num { font-family: monospace; font-size: 14px; font-weight: bold; fill: #38bdf8; text-anchor: middle; }
      .grid-txt { font-family: monospace; font-size: 8px; fill: #cbd5e1; text-anchor: middle; }
    </style>
  </defs>

  <!-- Fond Principal LCD 320x240 -->
  <rect x="0" y="0" width="320" height="240" fill="#0b0f19"/>

  <!-- ==================== ZONE 1 : TOP BAR (y: 0 - 22) ==================== -->
  <rect x="0" y="0" width="320" height="22" fill="#d97706" opacity="0.9"/>
  <rect x="0" y="21" width="320" height="1" fill="#f59e0b"/>
  <text x="8" y="15" class="label-title">⚡ EQUALIB HUB [TOP BAR]</text>
  <text x="260" y="15" class="label-sub" fill="#fef3c7">H: 22px</text>

  <!-- ==================== ZONE 2 : GRILLE GALERIE (y: 22 - 188) ==================== -->
  <!-- Fond discret pour la zone galerie -->
  <rect x="0" y="22" width="320" height="166" fill="#0f172a" opacity="0.6"/>
  <text x="8" y="34" class="label-zone" fill="#38bdf8">ZONE GALERIE (3x2 Tuiles) • y: 22 à 188 (H: 166px)</text>

  <!-- Tuile 1 -->
  <rect x="12" y="40" width="90" height="66" class="grid-box"/>
  <text x="57" y="70" class="grid-num">1</text>
  <text x="57" y="94" class="grid-txt">App 1 (90x66)</text>

  <!-- Tuile 2 -->
  <rect x="115" y="40" width="90" height="66" class="grid-box"/>
  <text x="160" y="70" class="grid-num">2</text>
  <text x="160" y="94" class="grid-txt">App 2 (90x66)</text>

  <!-- Tuile 3 -->
  <rect x="218" y="40" width="90" height="66" class="grid-box"/>
  <text x="263" y="70" class="grid-num">3</text>
  <text x="263" y="94" class="grid-txt">App 3 (90x66)</text>

  <!-- Tuile 4 -->
  <rect x="12" y="114" width="90" height="66" class="grid-box"/>
  <text x="57" y="144" class="grid-num">4</text>
  <text x="57" y="168" class="grid-txt">App 4 (90x66)</text>

  <!-- Tuile 5 -->
  <rect x="115" y="114" width="90" height="66" class="grid-box"/>
  <text x="160" y="144" class="grid-num">5</text>
  <text x="160" y="168" class="grid-txt">App 5 (90x66)</text>

  <!-- Tuile 6 -->
  <rect x="218" y="114" width="90" height="66" class="grid-box"/>
  <text x="263" y="144" class="grid-num">6</text>
  <text x="263" y="168" class="grid-txt">App 6 (90x66)</text>

  <!-- ==================== ZONE 3 : DOCK APPLI ACTIVE (y: 188 - 218) ==================== -->
  <rect x="10" y="188" width="300" height="28" fill="#1e293b" stroke="#f59e0b" stroke-width="1.5" rx="5px"/>
  <text x="20" y="206" class="label-zone" fill="#f59e0b">📦 DOCK ACTIF : Nom de l'App Sélectionnée</text>
  <text x="265" y="206" class="label-sub" fill="#fde68a">H: 30px</text>

  <!-- ==================== ZONE 4 : RACCOURCIS / TOOLTIPS (y: 218 - 240) ==================== -->
  <rect x="0" y="218" width="320" height="22" fill="#030712" opacity="0.95"/>
  <rect x="0" y="218" width="320" height="1" fill="#334155"/>
  <text x="160" y="233" class="label-sub" fill="#94a3b8" text-anchor="middle">▲▼◀▶ : Naviguer | OK : Lancer | Back : Hub  [TOOLTIPS y: 218-240]</text>

  <!-- Quadrillage de sécurité externe (Bordures de l'écran 320x240) -->
  <rect x="0" y="0" width="320" height="240" fill="none" stroke="#ef4444" stroke-width="1" opacity="0.6"/>
</svg>`;

// Sauvegarder le SVG
const assetsDir = path.join(__dirname, '..', 'web', 'assets');
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

const svgPath = path.join(assetsDir, 'theme_template_320x240.svg');
fs.writeFileSync(svgPath, svgContent, 'utf-8');
console.log('✓ SVG généré :', svgPath);

// 2. Générateur de PNG pur Node.js (sans dépendance externe)
function createPng320x240() {
  const width = 320;
  const height = 240;

  // Buffer RGBA pour 320 x 240 pixels
  const rgba = Buffer.alloc(width * height * 4, 0);

  function setPixel(x, y, r, g, b, a = 255) {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const idx = (y * width + x) * 4;
    rgba[idx] = r;
    rgba[idx + 1] = g;
    rgba[idx + 2] = b;
    rgba[idx + 3] = a;
  }

  function fillRect(x1, y1, w, h, r, g, b, a = 255) {
    for (let y = y1; y < y1 + h; y++) {
      for (let x = x1; x < x1 + w; x++) {
        setPixel(x, y, r, g, b, a);
      }
    }
  }

  function strokeRect(x1, y1, w, h, r, g, b, a = 255) {
    for (let x = x1; x < x1 + w; x++) {
      setPixel(x, y1, r, g, b, a);
      setPixel(x, y1 + h - 1, r, g, b, a);
    }
    for (let y = y1; y < y1 + h; y++) {
      setPixel(x1, y, r, g, b, a);
      setPixel(x1 + w - 1, y, r, g, b, a);
    }
  }

  // 1. Fond sombre galactique (#0b0f19)
  fillRect(0, 0, width, height, 11, 15, 25);

  // 2. Zone 1 : Top Bar (y: 0..22) - Orange ambré (#d97706)
  fillRect(0, 0, width, 22, 217, 119, 6);
  fillRect(0, 21, width, 1, 245, 158, 11); // Ligne accent

  // 3. Zone 2 : Galerie fond (#0f172a)
  fillRect(0, 22, width, 166, 15, 23, 42);

  // 3x2 Tuiles d'applications (90x66 px chacune avec bordure cyan)
  const tiles = [
    { x: 12, y: 40 }, { x: 115, y: 40 }, { x: 218, y: 40 },
    { x: 12, y: 114 }, { x: 115, y: 114 }, { x: 218, y: 114 }
  ];

  tiles.forEach((t, i) => {
    fillRect(t.x, t.y, 90, 66, 30, 41, 59); // Fond de tuile
    strokeRect(t.x, t.y, 90, 66, 56, 189, 248); // Bordure cyan
    // Marque centrale en croix
    for (let dx = -10; dx <= 10; dx++) setPixel(t.x + 45 + dx, t.y + 33, 56, 189, 248);
    for (let dy = -10; dy <= 10; dy++) setPixel(t.x + 45, t.y + 33 + dy, 56, 189, 248);
  });

  // 4. Zone 3 : Dock actif (y: 188..218) - Fond ardoise avec bordure ambrée
  fillRect(10, 188, 300, 28, 30, 41, 59);
  strokeRect(10, 188, 300, 28, 245, 158, 11);

  // 5. Zone 4 : Raccourcis tooltips (y: 218..240) - Bandeau noir / gris
  fillRect(0, 218, width, 22, 3, 7, 18);
  fillRect(0, 218, width, 1, 51, 65, 85);

  // 6. Cadre de délimitation externe 320x240 (Bord rouge de sécurité)
  strokeRect(0, 0, width, height, 239, 68, 68);

  // Encodage PNG
  // Chaque scanline commence par 0x00 (Filter type: None) + (width * 4 bytes RGBA)
  const scanlineWidth = 1 + width * 4;
  const rawData = Buffer.alloc(height * scanlineWidth);

  for (let y = 0; y < height; y++) {
    const rawOffset = y * scanlineWidth;
    rawData[rawOffset] = 0; // Filter type = None
    const rgbaOffset = y * width * 4;
    rgba.copy(rawData, rawOffset + 1, rgbaOffset, rgbaOffset + width * 4);
  }

  // Compression DEFLATE avec zlib
  const compressedData = zlib.deflateSync(rawData, { level: 9 });

  // CRC32 Helper
  const crcTable = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[i] = c;
  }

  function crc32(buf) {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function createChunk(type, data) {
    const len = data.length;
    const buf = Buffer.alloc(8 + len + 4);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4, 4, 'ascii');
    data.copy(buf, 8);
    const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = crc32(typeAndData);
    buf.writeUInt32BE(crc, 8 + len);
    return buf;
  }

  // PNG Signature
  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR Chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // Bit depth: 8
  ihdrData[9] = 6; // Color type: 6 (RGBA)
  ihdrData[10] = 0; // Compression: Deflate
  ihdrData[11] = 0; // Filter: Adaptive
  ihdrData[12] = 0; // Interlace: None
  const ihdrChunk = createChunk('IHDR', ihdrData);

  // IDAT Chunk
  const idatChunk = createChunk('IDAT', compressedData);

  // IEND Chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  const pngFile = Buffer.concat([pngSignature, ihdrChunk, idatChunk, iendChunk]);
  const pngPath = path.join(assetsDir, 'theme_template_320x240.png');
  fs.writeFileSync(pngPath, pngFile);
  console.log('✓ PNG généré :', pngPath, `(${pngFile.length} octets)`);
}

createPng320x240();

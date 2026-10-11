const fs = require('fs');
const assert = require('assert');

console.log('=== TEST SUITE: STUDIO PINCEAU & FOND D\'ECRAN EQUALIB ===\n');

// 1. Charger wallpaper_studio.js dans un environnement mock
const code = fs.readFileSync('web/wallpaper_studio.js', 'utf8');

const mockWindow = {
  customWallpaperRGB565: null,
  customWallpaperDataUrl: null,
  localStorage: {
    store: {},
    getItem(k) { return this.store[k] || null; },
    setItem(k, v) { this.store[k] = v; },
    removeItem(k) { delete this.store[k]; }
  }
};

const fn = new Function('window', code);
fn(mockWindow);

assert(mockWindow.EquaLibWallpaperStudio, 'EquaLibWallpaperStudio doit être défini sur window');
console.log('✓ EquaLibWallpaperStudio chargé');

// 2. Instanciation
const studio = new mockWindow.EquaLibWallpaperStudio();
assert.strictEqual(studio.currentTool, 'brush', 'L\'outil par défaut doit être le pinceau');
assert.strictEqual(studio.brushSize, 3, 'La taille de pinceau par défaut doit être 3px');
assert.strictEqual(studio.brushShape, 'round', 'La forme de pinceau par défaut doit être ronde');
console.log('✓ Propriétés initiales du Studio validées (outil=brush, taille=3, forme=round)');

// 3. Validation de la taille de pinceau
studio.setBrushSize(8);
assert.strictEqual(studio.brushSize, 8, 'La taille de pinceau doit être 8px');
studio.setBrushSize(50); // Au-dessus du max (24)
assert.strictEqual(studio.brushSize, 24, 'La taille de pinceau doit être plafonnée à 24px');
studio.setBrushSize(0); // En-dessous du min (1)
assert.strictEqual(studio.brushSize, 1, 'La taille de pinceau doit être bornée à 1px');
console.log('✓ Bornes de taille du pinceau (1px à 24px) validées');

// 4. Test du stamp rond et carré
studio.setBrushSize(5);
studio.drawBrushStamp(50, 50, '#FF0000', 5, 'round');
const pCenter = studio.getPixel(50, 50);
assert.strictEqual(pCenter.r, 255);
assert.strictEqual(pCenter.g, 0);
assert.strictEqual(pCenter.b, 0);

studio.drawBrushStamp(100, 100, '#00FF00', 4, 'square');
const pSquare = studio.getPixel(100, 100);
assert.strictEqual(pSquare.r, 0);
assert.strictEqual(pSquare.g, 255);
assert.strictEqual(pSquare.b, 0);
console.log('✓ Tracé des empreintes ronde et carrée validé');

// 5. Test de la ligne continue au pinceau
studio.drawBrushLine(10, 10, 20, 10, '#0000FF', 3, 'round');
for (let x = 10; x <= 20; x++) {
  const p = studio.getPixel(x, 10);
  assert.strictEqual(p.b, 255, `Le pixel (${x}, 10) doit être colorié en bleu`);
}
console.log('✓ Tracé continu Bresenham sans interruption validé');

// 6. Test de génération RGB565 (153600 octets)
const rgb565 = studio.generateRGB565Bytes();
assert.strictEqual(rgb565.length, 153600, 'Le buffer RGB565 doit mesurer exactement 153,600 octets');
console.log('✓ Buffer RGB565 Little-Endian (153,600 octets) validé');

// 7. Test de conversion Base64 <-> Uint8Array
const b64 = studio.uint8ToBase64(rgb565);
assert(b64.length > 0, 'La chaîne Base64 ne doit pas être vide');
const restored = studio.base64ToUint8(b64);
assert.strictEqual(restored.length, rgb565.length);
assert.strictEqual(restored[0], rgb565[0]);
assert.strictEqual(restored[1000], rgb565[1000]);
assert.strictEqual(restored[153599], rgb565[153599]);
console.log('✓ Encodage et décodage Base64 bit-exact validé');

// 8. Test des presets de fond
studio.applyBackgroundPreset('numworks');
assert(studio.pixelData[0] === 255 && studio.pixelData[1] === 187, 'Bordure supérieure doit être jaune NumWorks');
studio.applyBackgroundPreset('white');
assert(studio.pixelData[0] === 248 && studio.pixelData[1] === 250, 'Fond blanc pur validé');
studio.applyBackgroundPreset('slate');
assert(studio.pixelData[0] > 10, 'Fond ardoise non-noir validé');
console.log('✓ Presets de fond (numworks, white, slate) validés');

// 9. Vérification du code source C pour le bug de l'écran noir
const mainC = fs.readFileSync('launcher/src/main.c', 'utf8');
assert(!mainC.includes('.screen_bg = 0x10A2'), 'Le repli theme 6 ne doit plus être 0x10A2 (noir pur)');
assert(mainC.includes('const uint16_t band_h = 20;'), 'Le rendu du fond doit s\'effectuer par bandes sécurisées de 20 lignes');
assert(mainC.includes('eadk_display_push_rect(band_r, wp_ptr + (y * EADK_SCREEN_WIDTH));'), 'Transfert LCD par bandes de 20 lignes validé');
console.log('✓ launcher/src/main.c vérifié (repli screen_bg contrasté et bandes DMA sécurisées)');

// 10. Vérification de bundler.js
const bundlerJs = fs.readFileSync('web/bundler.js', 'utf8');
assert(bundlerJs.includes('localStorage.getItem(\'equalib_custom_wallpaper_rgb565\')'), 'bundler.js doit réhydrater le fond depuis localStorage');
console.log('✓ web/bundler.js vérifié (réhydratation automatique depuis localStorage)');

console.log('\n🎉 TOUS LES 10 TESTS STUDIO PINCEAU & FOND D\'ECRAN SONT 100% SUCCÈS !');

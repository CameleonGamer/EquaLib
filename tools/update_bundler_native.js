const fs = require('fs');

const nwaBuf = fs.readFileSync('launcher/equalib.nwa');
const binBuf = fs.readFileSync('web/equalib_n0120.bin');

const nwaB64 = nwaBuf.toString('base64');
const binB64 = binBuf.toString('base64');

console.log('equalib.nwa Base64 length:', nwaB64.length);
console.log('equalib_n0120.bin Base64 length:', binB64.length);

const bundlerJsContent = `/**
 * EquaLib Client-Side Binary Bundler
 * Assemble dynamiquement l'exécutable EquaLib Launcher (.nwa et .bin pour NumWorks N0120)
 * Intègre le manifeste d'applications sélectionnées par l'utilisateur à la volée.
 * Chargement dynamique et asynchrone (zéro payload binaire Base64 bloquant).
 */

class EquaLibBundler {
  constructor(options = {}) {
    this.options = Object.assign({
      targetModel: 'N0120'
    }, options);
  }

  base64ToUint8Array(base64) {
    if (typeof atob === 'function') {
      const binaryString = atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    } else {
      return new Uint8Array(Buffer.from(base64, 'base64'));
    }
  }

  /**
   * Recherche l'offset du manifeste EquaLib (Signature 'EQAL', version 1)
   */
  findManifestOffset(buf) {
    const magic = [0x45, 0x51, 0x41, 0x4C]; // "EQAL"
    for (let i = 0; i <= buf.length - 24 - 20 * 144; i += 1) {
      if (buf[i] === magic[0] && buf[i+1] === magic[1] && buf[i+2] === magic[2] && buf[i+3] === magic[3]) {
        const version = buf[i+4] | (buf[i+5] << 8) | (buf[i+6] << 16) | (buf[i+7] << 24);
        if (version === 1) {
          return i;
        }
      }
    }
    return -1;
  }

  /**
   * Injecte les applications sélectionnées dans le manifeste binaire
   */
  async patchManifest(rawBytes, apps = [], options = {}) {
    // Créer une copie indépendante du buffer
    const u8 = new Uint8Array(rawBytes.length);
    u8.set(rawBytes, 0);

    const offset = this.findManifestOffset(u8);
    if (offset === -1) {
      console.warn("[EquaLib] Manifest non trouvé dans le binaire !");
      return u8;
    }

    const selectedList = (apps && apps.length > 0) ? apps.slice(0, 20) : [];
    const count = selectedList.length;

    if (count > 0) {
      // Mise à jour de app_count
      u8[offset + 8] = count & 0xFF;
      u8[offset + 9] = (count >> 8) & 0xFF;
      u8[offset + 10] = (count >> 16) & 0xFF;
      u8[offset + 11] = (count >> 24) & 0xFF;
    }

    // Custom Wallpaper extraction & injection
    let wallpaperBytes = options.customWallpaper || this.options?.customWallpaper;
    if (!wallpaperBytes && typeof window !== 'undefined') {
      if (window.customWallpaperRGB565) {
        wallpaperBytes = window.customWallpaperRGB565;
      } else {
        try {
          const b64 = localStorage.getItem('equalib_custom_wallpaper_rgb565');
          if (b64) {
            wallpaperBytes = this.base64ToUint8Array(b64);
            window.customWallpaperRGB565 = wallpaperBytes;
          }
        } catch (_) {}
      }
    }

    // Mise à jour de manifest.flags (thème par défaut et mode d'affichage)
    let flags = 0;
    const themeName = (options.theme || this.options?.theme || (typeof window !== 'undefined' && window.userSettings?.theme) || 'default').toLowerCase();
    let themeIndex = 0;
    if (themeName.includes('custom')) themeIndex = 6;
    else if (themeName.includes('sakura')) themeIndex = 1;
    else if (themeName.includes('hacker') || themeName.includes('matrix') || themeName.includes('cyber')) themeIndex = 2;
    else if (themeName.includes('bee') || themeName.includes('abeille')) themeIndex = 3;
    else if (themeName.includes('mario')) themeIndex = 4;
    else if (themeName.includes('gameboy') || themeName.includes('mono') || themeName.includes('dark')) themeIndex = 5;
    else if (wallpaperBytes) themeIndex = 6;
    flags |= (themeIndex & 0x0F);

    const isList = (options.displayMode === 'list' || this.options?.displayMode === 'list' || (typeof window !== 'undefined' && window.userSettings?.displayMode === 'list'));
    if (isList) flags |= 0x10;

    u8[offset + 12] = flags & 0xFF;
    u8[offset + 13] = (flags >> 8) & 0xFF;
    u8[offset + 14] = (flags >> 16) & 0xFF;
    u8[offset + 15] = (flags >> 24) & 0xFF;

    let extraPayloads = [];
    let currentExtraOffset = u8.length; // offset relatif au début du slot flash 0x90180000

    // Wallpaper offset (offset + 16) et size (offset + 20)
    if (wallpaperBytes && wallpaperBytes.length > 0) {
      const wpOffset = (currentExtraOffset + 3) & ~3;
      const pad = wpOffset - currentExtraOffset;
      if (pad > 0) {
        extraPayloads.push(new Uint8Array(pad));
        currentExtraOffset += pad;
      }

      u8[offset + 16] = wpOffset & 0xFF;
      u8[offset + 17] = (wpOffset >> 8) & 0xFF;
      u8[offset + 18] = (wpOffset >> 16) & 0xFF;
      u8[offset + 19] = (wpOffset >> 24) & 0xFF;

      const wpSize = wallpaperBytes.length;
      u8[offset + 20] = wpSize & 0xFF;
      u8[offset + 21] = (wpSize >> 8) & 0xFF;
      u8[offset + 22] = (wpSize >> 16) & 0xFF;
      u8[offset + 23] = (wpSize >> 24) & 0xFF;

      extraPayloads.push(wallpaperBytes);
      currentExtraOffset += wpSize;
    } else {
      u8[offset + 16] = 0;
      u8[offset + 17] = 0;
      u8[offset + 18] = 0;
      u8[offset + 19] = 0;

      u8[offset + 20] = 0;
      u8[offset + 21] = 0;
      u8[offset + 22] = 0;
      u8[offset + 23] = 0;
    }

    if (count > 0) {
      // Nettoyage de la table des 20 apps (20 * 144 = 2880 octets)
      const appsStart = offset + 24;
      u8.fill(0, appsStart, appsStart + 20 * 144);

      for (let i = 0; i < count; i++) {
      const app = selectedList[i];
      const entryOffset = appsStart + i * 144;

      // 1. ID (16 octets max)
      const idStr = (app.id || ('app_' + i)).substring(0, 15);
      for (let c = 0; c < idStr.length; c++) {
        u8[entryOffset + c] = idStr.charCodeAt(c) & 0x7F;
      }

      // 2. Nom d'affichage (32 octets max)
      let displayName = app.name || 'Application';
      if (!/^\\d+\\./.test(displayName)) {
        displayName = (i + 1) + '. ' + displayName;
      }
      displayName = displayName.substring(0, 31);
      for (let c = 0; c < displayName.length; c++) {
        u8[entryOffset + 16 + c] = displayName.charCodeAt(c) & 0x7F;
      }

      // 3. Catégorie (20 octets max)
      const catStr = (app.category || 'Outil').substring(0, 19);
      for (let c = 0; c < catStr.length; c++) {
        u8[entryOffset + 48 + c] = catStr.charCodeAt(c) & 0x7F;
      }

      // 4. Description (64 octets max)
      const descStr = (app.description || '').substring(0, 63);
      for (let c = 0; c < descStr.length; c++) {
        u8[entryOffset + 68 + c] = descStr.charCodeAt(c) & 0x7F;
      }

      // 5. Détermination du type d'application (offset 132)
      let appType = 6; // Type 6: Visionneuse texte par défaut
      const appIdLower = (app.id || '').toLowerCase();
      const appNameLower = (app.name || '').toLowerCase();
      const isBin = (app.format === 'BIN') || (app.category === 'BIN') || appIdLower.includes('.bin') || appNameLower.includes('.bin');
      const isNwa = (app.format === 'NWA') || (app.category === 'NWA') || appIdLower.includes('.nwa') || appNameLower.includes('.nwa');
      const isNative = isBin || isNwa || (app.data && app.data.length >= 4 && (
        (app.data[0] === 0xBA && app.data[1] === 0xBE && app.data[2] === 0xC0 && app.data[3] === 0xDE) || // 0xDEC0BEBA EADK flat binary
        (app.data[0] === 0x7F && app.data[1] === 0x45 && app.data[2] === 0x4C && app.data[3] === 0x46)    // ELF relocatable object
      ));

      if (appIdLower === 'mariokart' || appIdLower.includes('mario') || appNameLower.includes('mario')) {
        appType = 1; // Super Mario Kart 3D natif C (issu de MathDS)
      } else if (appIdLower === 'periodique' || appIdLower.includes('periodique')) {
        appType = 2; // Tableau Périodique natif C
      } else if (appIdLower === 'fiches' || appIdLower.includes('cours')) {
        appType = 3; // Fiches de cours natives C
      } else if (appIdLower === 'math_solver' || appIdLower.includes('solveur')) {
        appType = 4; // Solveur 2nd degré natif C
      } else if (appIdLower === 'comm_flappy' || appIdLower === 'flappy' || appNameLower.includes('flappy')) {
        appType = 7; // Flappy Bird natif C 60 FPS
      } else if (appIdLower === 'comm_2048' || appIdLower === '2048' || appNameLower.includes('2048')) {
        appType = 8; // 2048 Ultimate natif C 60 FPS
      } else if (appIdLower === 'comm_snake' || appIdLower === 'snake' || appNameLower.includes('snake')) {
        appType = 9; // Snake Classic natif C 60 FPS
      } else if (appIdLower === 'comm_tetris' || appIdLower === 'tetris' || appNameLower.includes('tetris')) {
        appType = 10; // Tetris NumWorks natif C 60 FPS
      } else if (appIdLower === 'comm_minesweeper' || appIdLower.includes('mine') || appNameLower.includes('démin') || appNameLower.includes('demin')) {
        appType = 11; // Démineur NumWorks natif C 60 FPS
      } else if (appIdLower === 'pong' || appIdLower === 'comm_pong' || appNameLower.includes('pong')) {
        appType = 15; // Pong Retro Arcade natif C 60 FPS
      } else if (appIdLower === 'dino' || appIdLower === 'comm_dino' || appNameLower.includes('dino')) {
        appType = 16; // Chrome Dino Runner natif C 60 FPS
      } else if (appIdLower === 'space_invaders' || appIdLower === 'comm_space_invaders' || appNameLower.includes('invader')) {
        appType = 17; // Space Invaders Retro natif C 60 FPS
      } else if (appIdLower === 'breakout' || appIdLower === 'comm_breakout' || appNameLower.includes('brique') || appNameLower.includes('breakout')) {
        appType = 18; // Casse-Briques Breakout natif C 60 FPS
      } else if (appIdLower === 'puissance4' || appIdLower === 'comm_puissance4' || appNameLower.includes('puissance 4') || appNameLower.includes('puissance4') || appNameLower.includes('connect 4')) {
        appType = 19; // Puissance 4 natif C 60 FPS
      } else if (appIdLower === 'morpion' || appIdLower === 'comm_morpion' || appNameLower.includes('morpion') || appNameLower.includes('tic tac toe')) {
        appType = 20; // Morpion natif C 60 FPS
      } else if (isNative) {
        appType = 13; // Exécutable natif ARM EADK (.bin ou .nwa)
      } else if ((app.format === 'NWS') || (app.format === 'PY') || appIdLower.includes('.nws') || appNameLower.includes('.nws') || (app.data && !isNative)) {
        appType = 12; // Moteur Python natif pour tout script .nws / .py
      }

      u8[entryOffset + 132] = appType;

      // 6. Gestion du payload binaire (type 13) vs texte/script (type 6 ou 12)
      if (appType === 13) {
        if (app.data && app.data.length > 0) {
          let binBytes = (app.data instanceof Uint8Array) ? app.data : new Uint8Array(app.data);

          // Détection d'un fichier ELF .nwa qui doit être lié dynamiquement à l'adresse Flash du pack
          const isElf = (binBytes.length >= 4 && binBytes[0] === 0x7F && binBytes[1] === 0x45 && binBytes[2] === 0x4C && binBytes[3] === 0x46);
          if (isElf) {
            const targetFlash = 0x90180000 + currentExtraOffset;
            const targetRam = 0x24020000 + (extraPayloads.length * 0x8000);
            console.log('[EquaLib Bundler] Liaison dynamique de "' + app.name + '" pour Flash 0x' + targetFlash.toString(16) + ', RAM 0x' + targetRam.toString(16) + '...');
            if (typeof EquaLibLinker !== 'undefined' && EquaLibLinker.convertNwaToBin) {
              try {
                binBytes = await EquaLibLinker.convertNwaToBin(binBytes, {
                  flashStart: '0x' + targetFlash.toString(16),
                  ramStart: '0x' + targetRam.toString(16),
                  ldWasmUrl: 'toolchain/ld.wasm',
                  objcopyWasmUrl: 'toolchain/objcopy.wasm'
                });
                console.log('[EquaLib Bundler] ✓ Binaire lié avec succès (' + binBytes.length + ' octets) !');
              } catch (linkErr) {
                console.error('[EquaLib Bundler] Erreur lors du linkage de "' + app.name + '":', linkErr);
                throw new Error('Échec du linkage pour "' + app.name + '": ' + linkErr.message);
              }
            } else {
              console.warn('[EquaLib Bundler] EquaLibLinker non disponible, inclusion brute.');
            }
          }

          const pad = (4 - (binBytes.length % 4)) % 4;
          const totalPayload = new Uint8Array(binBytes.length + pad);
          totalPayload.set(binBytes, 0);

          const dataOffset = currentExtraOffset;
          const dataSize = binBytes.length;

          // Écriture de data_offset (offset 136)
          u8[entryOffset + 136] = dataOffset & 0xFF;
          u8[entryOffset + 137] = (dataOffset >> 8) & 0xFF;
          u8[entryOffset + 138] = (dataOffset >> 16) & 0xFF;
          u8[entryOffset + 139] = (dataOffset >> 24) & 0xFF;

          // Écriture de data_size (offset 140)
          u8[entryOffset + 140] = dataSize & 0xFF;
          u8[entryOffset + 141] = (dataSize >> 8) & 0xFF;
          u8[entryOffset + 142] = (dataSize >> 16) & 0xFF;
          u8[entryOffset + 143] = (dataSize >> 24) & 0xFF;

          extraPayloads.push(totalPayload);
          currentExtraOffset += totalPayload.length;
        }
      } else if (appType === 6 || appType === 12) {
        let scriptText = '';
        if (app.data) {
          try {
            const rawStr = new TextDecoder('utf-8').decode(app.data);
            try {
              const parsed = JSON.parse(rawStr);
              if (parsed.scripts && parsed.scripts.length > 0) {
                scriptText = parsed.scripts.map(s => s.text).join('\\n\\n');
                appType = 12; // C'est un vrai script Python exécutable !
              } else if (parsed.description) {
                scriptText = '# ' + (parsed.name || app.name) + '\\n\\n' + parsed.description;
              } else {
                scriptText = rawStr;
              }
            } catch (jsonErr) {
              scriptText = rawStr;
            }
          } catch (e) {
            scriptText = '# ' + app.name + '\\n';
          }
        } else if (app.description) {
          scriptText = '# ' + app.name + '\\n' + app.description + '\\n';
        }

        // Si le contenu commence par du code Python (import, def, while, #), forcer type 12
        if (scriptText && (scriptText.includes('import ') || scriptText.includes('def ') || scriptText.includes('kandinsky') || scriptText.includes('ion.'))) {
          appType = 12;
        }

        u8[entryOffset + 132] = appType;

        if (scriptText) {
          const textBytes = new TextEncoder().encode(scriptText);
          const pad = (4 - (textBytes.length % 4)) % 4;
          const totalPayload = new Uint8Array(textBytes.length + pad);
          totalPayload.set(textBytes, 0);

          const dataOffset = currentExtraOffset;
          const dataSize = textBytes.length;

          // Écriture de data_offset (offset 136)
          u8[entryOffset + 136] = dataOffset & 0xFF;
          u8[entryOffset + 137] = (dataOffset >> 8) & 0xFF;
          u8[entryOffset + 138] = (dataOffset >> 16) & 0xFF;
          u8[entryOffset + 139] = (dataOffset >> 24) & 0xFF;

          // Écriture de data_size (offset 140)
          u8[entryOffset + 140] = dataSize & 0xFF;
          u8[entryOffset + 141] = (dataSize >> 8) & 0xFF;
          u8[entryOffset + 142] = (dataSize >> 16) & 0xFF;
          u8[entryOffset + 143] = (dataSize >> 24) & 0xFF;

          extraPayloads.push(totalPayload);
          currentExtraOffset += totalPayload.length;
        }
      }
    }
  }

    if (extraPayloads.length > 0) {
      const totalExtra = extraPayloads.reduce((sum, p) => sum + p.length, 0);
      const finalBuffer = new Uint8Array(u8.length + totalExtra);
      finalBuffer.set(u8, 0);
      let curPos = u8.length;
      for (const p of extraPayloads) {
        finalBuffer.set(p, curPos);
        curPos += p.length;
      }

      // Mise à jour de la taille totale de l'application dans l'en-tête EADK (offset 24..27)
      // Requis par Epsilon OS pour la configuration MPU (Memory Protection Unit)
      if (finalBuffer.length > 28 && finalBuffer[0] === 0xba && finalBuffer[1] === 0xbe && finalBuffer[2] === 0xc0 && finalBuffer[3] === 0xde) {
        finalBuffer[24] = finalBuffer.length & 0xff;
        finalBuffer[25] = (finalBuffer.length >> 8) & 0xff;
        finalBuffer[26] = (finalBuffer.length >> 16) & 0xff;
        finalBuffer[27] = (finalBuffer.length >> 24) & 0xff;
      }

      return finalBuffer;
    }

    return u8;
  }

  /**
   * Construit et retourne le fichier (.bin ou .nwa) personnalisé pour l'installation
   * @param {Array} apps Liste des applications sélectionnées
   * @param {string} format 'bin' pour le flash direct WebUSB, 'nwa' pour le téléversement manuel
   * @returns {Object} { blob, arrayBuffer, totalBytes, appCount }
   */
  async buildBundle(apps = [], format = 'bin', options = {}) {
    const isBin = (format === 'bin');
    console.log(\`[EquaLib] Génération du pack personnalisé (\${apps.length} apps, format: \${format})...\`);

    let rawData = null;
    const targetFile = isBin ? 'equalib_n0120.bin' : 'equalib_n0120.nwa';

    if (typeof window !== 'undefined' && typeof fetch === 'function') {
      try {
        const resp = await fetch(\`\${targetFile}?v=\${Date.now()}\`, { cache: 'no-store' });
        if (resp.ok) {
          const ab = await resp.arrayBuffer();
          rawData = new Uint8Array(ab);
        }
      } catch (e) {
        console.warn("[EquaLib] Fetch du binaire échoué :", e);
      }
    }
    
    // Support Node.js pour les tests unitaires et outils CLI
    if (!rawData && typeof require === 'function') {
      try {
        const nodeFs = require('fs');
        const nodePath = require('path');
        const candidates = [
          nodePath.join(__dirname, targetFile),
          nodePath.join(__dirname, 'web', targetFile),
          nodePath.join(process.cwd(), targetFile),
          nodePath.join(process.cwd(), 'web', targetFile)
        ];
        for (const cand of candidates) {
          if (nodeFs.existsSync(cand)) {
            rawData = new Uint8Array(nodeFs.readFileSync(cand));
            break;
          }
        }
      } catch (e) {
        console.warn("[EquaLib] Chargement local Node.js échoué :", e);
      }
    }

    if (!rawData) {
      throw new Error(\`[EquaLib] Impossible de charger le binaire source \${targetFile}\`);
    }

    const patchedBytes = await this.patchManifest(rawData, apps, options);
    const totalSize = patchedBytes.byteLength;

    console.log(\`[EquaLib] Pack personnalisé prêt (\${(totalSize / 1024).toFixed(1)} Ko, \${apps.length} apps)\`);

    return {
      blob: new Blob([patchedBytes], { type: 'application/octet-stream' }),
      arrayBuffer: patchedBytes.buffer,
      totalBytes: totalSize,
      appCount: apps.length
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = EquaLibBundler;
}
if (typeof window !== 'undefined') {
  window.EquaLibBundler = EquaLibBundler;
}
`;

fs.writeFileSync('web/bundler.js', bundlerJsContent, 'utf8');
console.log('✓ web/bundler.js updated with dynamic manifest injection for both BIN and NWA!');

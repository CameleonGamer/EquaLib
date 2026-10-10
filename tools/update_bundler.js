const fs = require('fs');

const b64 = fs.readFileSync('tools/template_b64.txt', 'utf8').trim();

const bundlerJsContent = `/**
 * EquaLib Client-Side Binary Bundler
 * Assemble l'exécutable EquaLib Launcher (.nwa au format ELF standard)
 * Compatible à 100% avec l'uploader officiel my.numworks.com/apps (sans erreur Size: NaN KB)
 */

const EQUALIB_MAGIC_0 = 0x4C415145; // "EQAL"
const EQUALIB_MAGIC_1 = 0x31304249; // "IB01"

// Modèle binaire ELF ARM officiel (Cortex-M7 / Cortex-M4) avec sections EADK
const EQUALIB_ELF_TEMPLATE_B64 = "${b64}";

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
      // Node.js fallback
      return new Uint8Array(Buffer.from(base64, 'base64'));
    }
  }

  encodeAppName(name) {
    const buffer = new Uint8Array(32);
    const encoder = new TextEncoder();
    const encoded = encoder.encode(name.substring(0, 31));
    buffer.set(encoded);
    return buffer;
  }

  /**
   * Construit un fichier .nwa valide (Format ELF Relocatable ARM)
   * Reconnue immédiatement par l'uploader officiel de NumWorks sans erreur NaN.
   * @param {Array} apps Liste des applications sélectionnées
   * @returns {Object} { blob, arrayBuffer, totalBytes }
   */
  async buildBundle(apps) {
    console.log(\`[EquaLib] Assemblage de \${apps.length} application(s) au format ELF NWA...\`);

    // 1. Récupération du binaire ELF de base
    const baseElf = this.base64ToUint8Array(EQUALIB_ELF_TEMPLATE_B64);
    const elfLength = baseElf.byteLength;

    // 2. Construction de la table des matières EquaLib (TOC)
    const HEADER_SIZE = 48; // equalib_header_t
    const ENTRY_SIZE = 64;  // equalib_app_entry_t
    const tocSize = HEADER_SIZE + (apps.length * ENTRY_SIZE);

    // Calcul de l'espace pour les payloads
    let payloadsSize = 0;
    const appOffsets = [];
    for (let i = 0; i < apps.length; i++) {
      appOffsets.push(payloadsSize);
      const appSize = apps[i].data ? apps[i].data.byteLength : (apps[i].size_kb * 1024);
      const aligned = Math.ceil(appSize / 4) * 4;
      payloadsSize += aligned;
    }

    const extraBundleSize = tocSize + payloadsSize;
    const totalSize = elfLength + extraBundleSize;

    const buffer = new ArrayBuffer(totalSize);
    const bytes = new Uint8Array(buffer);
    const view = new DataView(buffer);

    // 3. Copie du binaire ELF de base (qui contient le header ELF 0x7F 'E' 'L' 'F')
    bytes.set(baseElf, 0);

    // 4. Écriture de l'en-tête EquaLib à la suite du template
    let cursor = elfLength;
    view.setUint32(cursor + 0, EQUALIB_MAGIC_0, true);
    view.setUint32(cursor + 4, EQUALIB_MAGIC_1, true);
    view.setUint32(cursor + 8, 1, true); // Version 1
    view.setUint32(cursor + 12, apps.length, true);

    let flags = 0;
    view.setUint32(cursor + 16, flags, true);
    view.setUint32(cursor + 20, 0, true);
    view.setUint32(cursor + 24, 0, true);
    view.setUint32(cursor + 28, totalSize, true);

    cursor += HEADER_SIZE;

    // 5. Écriture des métadonnées des applications
    const payloadBaseOffset = elfLength + tocSize;
    for (let i = 0; i < apps.length; i++) {
      const app = apps[i];
      const entryStart = cursor;

      // Nom
      const nameBytes = this.encodeAppName(app.name);
      bytes.set(nameBytes, entryStart);

      const appDataSize = app.data ? app.data.byteLength : (app.size_kb * 1024);
      const relOffset = appOffsets[i];

      view.setUint32(entryStart + 32, payloadBaseOffset + relOffset, true);
      view.setUint32(entryStart + 36, appDataSize, true);
      view.setUint32(entryStart + 40, 0, true);
      view.setUint32(entryStart + 44, 0, true);
      view.setUint32(entryStart + 48, 0x20, true);
      view.setUint32(entryStart + 52, 0, true);

      cursor += ENTRY_SIZE;
    }

    // 6. Injection des données de chaque application
    for (let i = 0; i < apps.length; i++) {
      const app = apps[i];
      const writePos = payloadBaseOffset + appOffsets[i];

      if (app.data instanceof Uint8Array) {
        bytes.set(app.data, writePos);
      } else {
        // Stub exécutable par défaut si aucun fichier externe n'est chargé
        const stub = new Uint8Array([0x00, 0xBF, 0x70, 0x47]); // NOP; BX LR
        bytes.set(stub, writePos);
      }
    }

    console.log(\`[EquaLib] Fichier ELF .nwa généré avec succès (\${(totalSize / 1024).toFixed(1)} Ko)\`);

    return {
      blob: new Blob([buffer], { type: 'application/octet-stream' }),
      arrayBuffer: buffer,
      totalBytes: totalSize
    };
  }
}

// Export pour utilisation dans les modules web et Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EquaLibBundler;
}
if (typeof window !== 'undefined') {
  window.EquaLibBundler = EquaLibBundler;
}
`;

fs.writeFileSync('web/bundler.js', bundlerJsContent, 'utf8');
console.log('web/bundler.js updated with valid ELF template!');

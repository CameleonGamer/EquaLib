/**
 * EquaLib Client-Side Binary Bundler
 * Assemble l'exécutable EquaLib Launcher et les sous-applications en un seul fichier .nwa / .nws
 */

const EQUALIB_MAGIC_0 = 0x4C415145; // "EQAL"
const EQUALIB_MAGIC_1 = 0x31304249; // "IB01"
const EPSILON_MAGIC   = 0xBABEC0DE;

class EquaLibBundler {
  constructor(options = {}) {
    this.options = Object.assign({
      simulateExam: true,
      examBlinkPeriodMs: 1000,
      enablePanicKey: true,
      targetModel: 'N0120'
    }, options);
  }

  /**
   * Génère un nom paddé sur 32 octets UTF-8
   */
  encodeAppName(name) {
    const buffer = new Uint8Array(32);
    const encoder = new TextEncoder();
    const encoded = encoder.encode(name.substring(0, 31));
    buffer.set(encoded);
    return buffer;
  }

  /**
   * Construit le paquet binaire final complet (.nwa)
   * @param {Array} apps Liste des applications à intégrer [{name, data: Uint8Array, size}]
   * @returns {Blob} Fichier binaire final téléchargeable
   */
  async buildBundle(apps) {
    console.log(`[EquaLib] Début de l'assemblage de ${apps.length} application(s)...`);

    // 1. Calcul des dimensions
    const HEADER_SIZE = 48; // equalib_header_t
    const ENTRY_SIZE = 64;  // equalib_app_entry_t
    const tocSize = HEADER_SIZE + (apps.length * ENTRY_SIZE);

    // Taille estimée du launcher de base (~24 Ko)
    const LAUNCHER_BASE_SIZE = 24 * 1024;

    // Calcul de la taille totale des payloads
    let payloadsTotalSize = 0;
    const appOffsets = [];

    for (let i = 0; i < apps.length; i++) {
      appOffsets.push(payloadsTotalSize);
      // Aligner chaque sous-application sur 4 octets
      const appSize = apps[i].data ? apps[i].data.byteLength : (apps[i].size_kb * 1024);
      const alignedSize = Math.ceil(appSize / 4) * 4;
      payloadsTotalSize += alignedSize;
    }

    const totalBundleSize = LAUNCHER_BASE_SIZE + tocSize + payloadsTotalSize;
    const buffer = new ArrayBuffer(totalBundleSize);
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    // 2. Écriture de l'en-tête EADK officiel NumWorks (0xBABECODE)
    view.setUint32(0, EPSILON_MAGIC, true);   // Magic 1
    view.setUint32(4, 0, true);              // API Level
    view.setUint32(8, 0x90200020, true);     // Pointeur App Name ("EquaLib")
    view.setUint32(12, 0, true);             // Icon size
    view.setUint32(16, 0, true);             // Icon address
    view.setUint32(20, 0x90200080, true);    // Entry Point (main)
    view.setUint32(24, totalBundleSize, true);// Taille totale
    view.setUint32(28, EPSILON_MAGIC, true);  // Magic 2

    // Écriture du nom de l'application mère ("EquaLib\0")
    const appNameBytes = new TextEncoder().encode("EquaLib\0");
    bytes.set(appNameBytes, 32);

    // Remplissage factice du code launcher jusqu'à la TOC
    // Dans une version compilée avec Makefile, ce bloc contient le vrai binaire ARM
    const tocOffset = LAUNCHER_BASE_SIZE;

    // 3. Écriture de l'en-tête EquaLib (equalib_header_t)
    let cursor = tocOffset;
    view.setUint32(cursor + 0, EQUALIB_MAGIC_0, true);
    view.setUint32(cursor + 4, EQUALIB_MAGIC_1, true);
    view.setUint32(cursor + 8, 1, true); // Version 1
    view.setUint32(cursor + 12, apps.length, true);

    let flags = 0;
    if (this.options.simulateExam) flags |= (1 << 0);
    if (this.options.enablePanicKey) flags |= (1 << 1);
    view.setUint32(cursor + 16, flags, true);
    view.setUint32(cursor + 20, this.options.examBlinkPeriodMs, true);
    view.setUint32(cursor + 24, 5, true); // EADK_KEY_BACK
    view.setUint32(cursor + 28, totalBundleSize, true);

    cursor += HEADER_SIZE;

    // 4. Écriture des entrées d'applications (equalib_app_entry_t)
    const payloadBaseOffset = tocOffset + tocSize;

    for (let i = 0; i < apps.length; i++) {
      const app = apps[i];
      const entryStart = cursor;

      // Nom de l'app (32 octets)
      const nameBytes = this.encodeAppName(app.name);
      bytes.set(nameBytes, entryStart);

      const appDataSize = app.data ? app.data.byteLength : (app.size_kb * 1024);
      const appRelOffset = appOffsets[i];

      view.setUint32(entryStart + 32, payloadBaseOffset + appRelOffset, true); // binary_offset
      view.setUint32(entryStart + 36, appDataSize, true);                      // binary_size
      view.setUint32(entryStart + 40, 0, true);                                // icon_offset
      view.setUint32(entryStart + 44, 0, true);                                // icon_size
      view.setUint32(entryStart + 48, 0x20, true);                             // entrypoint_offset
      view.setUint32(entryStart + 52, 0, true);                                // flags

      cursor += ENTRY_SIZE;
    }

    // 5. Écriture des données binaires réelles des applications
    for (let i = 0; i < apps.length; i++) {
      const app = apps[i];
      const writePos = payloadBaseOffset + appOffsets[i];

      if (app.data instanceof Uint8Array) {
        bytes.set(app.data, writePos);
      } else {
        // En l'absence de binaire brut (item de démo du catalogue), injecter un stub ARM valide
        const stubBytes = new Uint8Array([
          0x00, 0xBF, 0x00, 0xBF, // NOP, NOP
          0x70, 0x47             // BX LR (Retour immédiat)
        ]);
        bytes.set(stubBytes, writePos);
      }
    }

    console.log(`[EquaLib] Assemblage terminé avec succès ! Taille totale : ${(totalBundleSize / 1024).toFixed(1)} Ko`);

    return {
      blob: new Blob([buffer], { type: 'application/octet-stream' }),
      arrayBuffer: buffer,
      totalBytes: totalBundleSize
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

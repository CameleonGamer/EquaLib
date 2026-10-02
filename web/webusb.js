/**
 * EquaLib WebUSB & WebDFU Manager
 * Protocole DFU / USB officiel NumWorks pour les modèles N0120 et N0110
 * Compatible Epsilon OS (0xA291), Scandium Bootloader (0xA51A) et ST DFU (0xDF11)
 * Développé par CameleonGamer en collaboration avec Gemini (Google DeepMind)
 */

const NUMWORKS_VENDOR_ID = 0x0483; // STMicroelectronics

const NUMWORKS_PIDS = {
  EPSILON: 0xA291,    // 41617: Epsilon OS standard
  SCANDIUM: 0xA51A,   // 42266: Bootloader Scandium (N0120)
  DFU_STM32: 0xDF11   // 57105: Mode DFU STM32 (Bootloader matériel N0110 / Recovery)
};

// Requêtes standard USB DFU (bRequest)
const DFU_REQUESTS = {
  DETACH: 0,
  DNLOAD: 1,
  UPLOAD: 2,
  GETSTATUS: 3,
  CLRSTATUS: 4,
  GETSTATE: 5,
  ABORT: 6
};

// États DFU du périphérique
const DFU_STATES = {
  appIDLE: 0,
  appDETACH: 1,
  dfuIDLE: 2,
  dfuDNLOAD_SYNC: 3,
  dfuDNBUSY: 4,
  dfuDNLOAD_IDLE: 5,
  dfuMANIFEST_SYNC: 6,
  dfuMANIFEST: 7,
  dfuMANIFEST_WAIT_RESET: 8,
  dfuUPLOAD_IDLE: 9,
  dfuERROR: 10
};

// Statuts DFU (bStatus)
const DFU_STATUS_OK = 0x00;

// Commandes spécifiques ST DFU (transmises via DFU_DNLOAD avec wValue = 0)
const ST_DFU_COMMANDS = {
  SET_ADDRESS: 0x21, // Définir le pointeur d'adresse
  ERASE_PAGE: 0x41   // Effacer un secteur Flash
};

const FLASH_SECTOR_SIZE = 65536;       // 64 Ko par secteur Flash externe QSPI
const DFU_TRANSFER_SIZE = 2048;        // 2048 octets par bloc USB DFU
const DEFAULT_FLASH_ADDR = 0x90200000; // Adresse officielle des applications externes Epsilon (N0120 & N0110)

class NumWorksWebUSB {
  constructor() {
    this.device = null;
    this.isConnected = false;
    this.model = 'NumWorks N0120';
    this.mode = 'Inconnu';
    this.interfaceNumber = 0;
    this.alternateSetting = 0;
  }

  isSupported() {
    return typeof navigator !== 'undefined' && 'usb' in navigator;
  }

  /**
   * Ouvre la boîte de dialogue de sélection WebUSB du navigateur et initialise la liaison DFU
   */
  async connect() {
    if (!this.isSupported()) {
      throw new Error("WebUSB n'est pas supporté par votre navigateur. Veuillez utiliser Google Chrome, Microsoft Edge ou Brave.");
    }

    try {
      const filters = [
        { vendorId: NUMWORKS_VENDOR_ID, productId: NUMWORKS_PIDS.EPSILON },
        { vendorId: NUMWORKS_VENDOR_ID, productId: NUMWORKS_PIDS.SCANDIUM },
        { vendorId: NUMWORKS_VENDOR_ID, productId: NUMWORKS_PIDS.DFU_STM32 },
        { vendorId: NUMWORKS_VENDOR_ID } // Fallback générique STMicroelectronics
      ];

      this.device = await navigator.usb.requestDevice({ filters });
      await this.device.open();

      // Découverte de l'interface USB DFU (Class 0xFE, Subclass 0x01)
      let configValue = 1;
      let targetInterface = 0;

      if (this.device.configurations && this.device.configurations.length > 0) {
        for (const config of this.device.configurations) {
          for (const iface of config.interfaces) {
            for (const alt of iface.alternates) {
              if (alt.interfaceClass === 0xFE && alt.interfaceSubclass === 0x01) {
                configValue = config.configurationValue;
                targetInterface = iface.interfaceNumber;
                break;
              }
            }
          }
        }
      }

      if (this.device.configuration === null || this.device.configuration.configurationValue !== configValue) {
        await this.device.selectConfiguration(configValue);
      }

      try {
        await this.device.claimInterface(targetInterface);
      } catch (claimErr) {
        console.warn("[WebUSB] claimInterface warning :", claimErr);
      }

      // Conforme à nwlink : on utilise l'Alternate 0 standard sans forcer de basculement
      this.interfaceNumber = targetInterface;
      this.alternateSetting = 0;
      this.isConnected = true;

      // Détection du modèle et du mode d'exécution
      const pid = this.device.productId;
      const prodName = this.device.productName || '';
      const bcd = (this.device.deviceVersionMajor << 8) | this.device.deviceVersionMinor;

      let modelName = 'NumWorks N0120';
      if (bcd === 0x0110 || prodName.includes('N0110') || prodName.includes('F7')) {
        modelName = 'NumWorks N0110';
      }

      let modeName = 'Epsilon OS';
      if (pid === NUMWORKS_PIDS.DFU_STM32) {
        modeName = 'Mode DFU';
      } else if (pid === NUMWORKS_PIDS.SCANDIUM) {
        modeName = 'Scandium Bootloader';
      }

      this.model = modelName;
      this.mode = modeName;

      console.log(`[WebUSB] Connecté à ${this.model} (${this.mode}) sur interface ${this.interfaceNumber}`);

      // Réinitialisation de l'état DFU vers dfuIDLE
      await this.abortToIdle();

      return {
        success: true,
        model: this.model,
        mode: this.mode,
        flashAddress: DEFAULT_FLASH_ADDR,
        device: this.device
      };
    } catch (err) {
      this.isConnected = false;
      this.device = null;
      console.error('[WebUSB] Erreur lors de la connexion :', err);
      throw err;
    }
  }

  /**
   * Déconnexion sécurisée du périphérique USB
   */
  async disconnect() {
    if (this.device && this.device.opened) {
      try {
        await this.device.close();
      } catch (e) {
        console.warn("[WebUSB] Erreur fermeture device :", e);
      }
    }
    this.isConnected = false;
    this.device = null;
    console.log('[WebUSB] Déconnecté');
  }

  // ==================== PRIMITIVES DE CONTRÔLE USB DFU ====================

  async controlTransferIn(bRequest, wValue = 0, wLength = 0) {
    if (!this.device || !this.device.opened) {
      throw new Error("Périphérique déconnecté");
    }
    const res = await this.device.controlTransferIn({
      requestType: 'class',
      recipient: 'interface',
      request: bRequest,
      value: wValue,
      index: this.interfaceNumber
    }, wLength);

    if (res.status !== 'ok') {
      throw new Error(`USB TransferIn échoué (requête ${bRequest}, statut ${res.status})`);
    }
    return res.data;
  }

  async controlTransferOut(bRequest, data, wValue = 0) {
    if (!this.device || !this.device.opened) {
      throw new Error("Périphérique déconnecté");
    }
    const res = await this.device.controlTransferOut({
      requestType: 'class',
      recipient: 'interface',
      request: bRequest,
      value: wValue,
      index: this.interfaceNumber
    }, data);

    if (res.status !== 'ok') {
      throw new Error(`USB TransferOut échoué (requête ${bRequest}, statut ${res.status})`);
    }
    return res.bytesWritten;
  }

  /**
   * Récupère l'état et le statut DFU du périphérique (6 octets)
   */
  async getStatus() {
    const data = await this.controlTransferIn(DFU_REQUESTS.GETSTATUS, 0, 6);
    const status = data.getUint8(0);
    const pollTimeout = (data.getUint32(1, true) & 0x00FFFFFF);
    const state = data.getUint8(4);
    return { status, pollTimeout, state };
  }

  /**
   * Récupère l'état DFU brut (1 octet)
   */
  async getState() {
    const data = await this.controlTransferIn(DFU_REQUESTS.GETSTATE, 0, 1);
    return data.getUint8(0);
  }

  /**
   * Réinitialise le statut d'erreur DFU (CLRSTATUS)
   */
  async clearStatus() {
    try {
      await this.controlTransferOut(DFU_REQUESTS.CLRSTATUS, new ArrayBuffer(0), 0);
    } catch (e) {
      // Ignoré si le périphérique est inaccessible
    }
  }

  /**
   * Interrompt l'opération DFU en cours (ABORT)
   */
  async abort() {
    try {
      await this.controlTransferOut(DFU_REQUESTS.ABORT, new ArrayBuffer(0), 0);
    } catch (e) {
      // Ignoré si le périphérique est inaccessible
    }
  }

  /**
   * Remet le contrôleur DFU dans l'état dfuIDLE (2)
   */
  async abortToIdle() {
    try {
      await this.abort();
    } catch (e) {}

    let state;
    try {
      state = await this.getState();
    } catch (e) {
      state = DFU_STATES.dfuIDLE;
    }

    if (state === DFU_STATES.dfuERROR) {
      try {
        await this.clearStatus();
        state = await this.getState();
      } catch (e) {
        state = DFU_STATES.dfuIDLE;
      }
    }

    if (state !== DFU_STATES.dfuIDLE) {
      try {
        await this.abort();
      } catch (e) {}
    }
    return state;
  }

  /**
   * Attend activement qu'une condition d'état DFU soit remplie
   * Respecte strictement le pollTimeout annoncé par le microcontrôleur STM32
   */
  async pollUntil(predicate, timeoutMs = 30000) {
    const startTime = Date.now();
    let status = await this.getStatus();

    while (!predicate(status.state) && status.state !== DFU_STATES.dfuERROR) {
      if (Date.now() - startTime > timeoutMs) {
        throw new Error(`Délai d'attente DFU dépassé (${timeoutMs} ms)`);
      }

      // Attente requise par le microcontrôleur STM32 (au moins 10 ms)
      const delay = Math.max(status.pollTimeout || 10, 10);
      await new Promise(r => setTimeout(r, delay));
      status = await this.getStatus();
    }

    if (status.state === DFU_STATES.dfuERROR) {
      await this.clearStatus();
      await this.abortToIdle();
    }

    return status;
  }

  /**
   * Positionne le pointeur d'adresse en mémoire Flash (Commande ST DFU 0x21)
   */
  async setAddress(address) {
    const buf = new ArrayBuffer(5);
    const view = new DataView(buf);
    view.setUint8(0, ST_DFU_COMMANDS.SET_ADDRESS);
    view.setUint32(1, address, true); // Little-endian 32-bit uint

    await this.controlTransferOut(DFU_REQUESTS.DNLOAD, buf, 0);
    const status = await this.pollUntil(state => state !== DFU_STATES.dfuDNBUSY);
    if (status.status !== DFU_STATUS_OK) {
      throw new Error(`Échec setAddress à 0x${address.toString(16)} (status ${status.status})`);
    }
  }

  /**
   * Efface un secteur Flash à l'adresse spécifiée (Commande ST DFU 0x41)
   */
  async eraseSegment(address) {
    if (await this.getState() !== DFU_STATES.dfuIDLE) {
      await this.abortToIdle();
    }

    const buf = new ArrayBuffer(5);
    const view = new DataView(buf);
    view.setUint8(0, ST_DFU_COMMANDS.ERASE_PAGE);
    view.setUint32(1, address, true); // Little-endian 32-bit uint

    await this.controlTransferOut(DFU_REQUESTS.DNLOAD, buf, 0);
    const status = await this.pollUntil(state => state !== DFU_STATES.dfuDNBUSY, 30000);
    if (status.status !== DFU_STATUS_OK) {
      console.warn(`[WebUSB] Avertissement effacement secteur à 0x${address.toString(16)} (status ${status.status})`);
      await this.abortToIdle();
    }
  }

  /**
   * Téléverse un bloc binaire vers la mémoire Flash
   */
  async downloadBlock(chunk, targetAddress) {
    await this.setAddress(targetAddress);
    await this.controlTransferOut(DFU_REQUESTS.DNLOAD, chunk, 2); // wValue = 2 pour les blocs de données
    const status = await this.pollUntil(state => state === DFU_STATES.dfuDNLOAD_IDLE || state === DFU_STATES.dfuIDLE);
    if (status.status !== DFU_STATUS_OK) {
      throw new Error(`Échec écriture bloc à 0x${targetAddress.toString(16)} (status ${status.status})`);
    }
  }

  /**
   * Quitte le mode DFU et déclenche l'exécution du code Flash
   */
  async leave(resetAddress = DEFAULT_FLASH_ADDR) {
    console.log(`[WebUSB] Sortie DFU vers 0x${resetAddress.toString(16)}...`);
    try {
      await this.setAddress(resetAddress);
      await this.controlTransferOut(DFU_REQUESTS.DNLOAD, new ArrayBuffer(0), 2);
      await this.pollUntil(state => state === DFU_STATES.dfuMANIFEST, 1500);
    } catch (e) {
      // La déconnexion / reset USB immédiat du STM32 est le comportement nominal
      console.log("[WebUSB] Calculatrice redémarrée avec succès.");
    }
  }

  // ==================== MÉTHODE PRINCIPALE DE FLASHAGE ====================

  /**
   * Flashe le binaire complet dans le slot d'applications externes de la NumWorks
   * @param {ArrayBuffer|Uint8Array} binaryData Données binaires exécutables
   * @param {Function} onProgress Callback de progression ({ phase, percent, message })
   * @param {number|null} targetFlashAddr Adresse optionnelle de destination en Flash (0x90200000 par défaut)
   */
  async flashBinary(binaryData, onProgress = () => {}, targetFlashAddr = null) {
    if (!this.isConnected || !this.device) {
      throw new Error("Calculatrice non connectée. Veuillez brancher votre NumWorks et cliquer sur 'Connecter'.");
    }

    const uint8 = (binaryData instanceof Uint8Array) 
      ? binaryData 
      : new Uint8Array(binaryData);

    if (uint8.byteLength < 64) {
      throw new Error("Données de l'application invalides ou fichier vide.");
    }

    // Protection anti-erreur ELF : si un fichier .nwa brut (non lié en .bin) est passé
    if (uint8[0] === 0x7F && uint8[1] === 0x45 && uint8[2] === 0x4C && uint8[3] === 0x46) {
      console.warn("[WebUSB] Détection d'un fichier ELF .nwa. Récupération automatique du binaire plat lié .bin...");
      const binResp = await fetch(`equalib_n0120.bin?v=${Date.now()}`);
      if (binResp.ok) {
        return await this.flashBinary(await binResp.arrayBuffer(), onProgress, targetFlashAddr);
      }
    }

    // Utilisation de l'adresse officielle du slot d'applications externes Epsilon (0x90200000)
    const flashAddress = (targetFlashAddr && targetFlashAddr !== 0x90000000) ? targetFlashAddr : DEFAULT_FLASH_ADDR;

    // Alignement sur secteur 64 Ko et ajout du secteur terminateur 0xFF
    const rem = uint8.byteLength % FLASH_SECTOR_SIZE;
    const padSize = (rem > 0) ? (FLASH_SECTOR_SIZE - rem) : 0;
    const terminatorSize = FLASH_SECTOR_SIZE;
    const totalProgramSize = uint8.byteLength + padSize + terminatorSize;

    const paddedData = new Uint8Array(totalProgramSize);
    paddedData.set(uint8, 0);
    paddedData.fill(0xFF, uint8.byteLength);

    const nbSectors = Math.ceil(totalProgramSize / FLASH_SECTOR_SIZE);

    console.log(`[WebUSB] Début du flashage vers 0x${flashAddress.toString(16)} :`);
    console.log(`         - Taille utile : ${uint8.byteLength} octets`);
    console.log(`         - Taille totale programmée : ${paddedData.byteLength} octets (${nbSectors} secteurs de 64 Ko)`);

    // Phase 1 : Effacement des secteurs Flash de l'application (Progression 5% à 25%)
    onProgress({ phase: 'erase', percent: 5, message: 'Effacement de la mémoire Flash...' });

    for (let s = 0; s < nbSectors; s++) {
      const sectorAddr = flashAddress + (s * FLASH_SECTOR_SIZE);
      try {
        await this.eraseSegment(sectorAddr);
      } catch (err) {
        console.warn(`[WebUSB] Avertissement effacement secteur 0x${sectorAddr.toString(16)} :`, err);
        await this.abortToIdle();
      }
      const erasePercent = 5 + Math.min(20, Math.round(((s + 1) / nbSectors) * 20));
      onProgress({
        phase: 'erase',
        percent: erasePercent,
        message: `Effacement Flash... (${s + 1}/${nbSectors} secteurs)`
      });
    }

    // Phase 2 : Écriture des blocs de 2048 octets (Progression 25% à 96%)
    const totalBytes = paddedData.byteLength;
    let offset = 0;

    onProgress({ phase: 'write', percent: 25, message: 'Écriture du binaire en Flash...' });

    while (offset < totalBytes) {
      const chunkLength = Math.min(DFU_TRANSFER_SIZE, totalBytes - offset);
      const chunk = paddedData.subarray(offset, offset + chunkLength);
      const currentTargetAddr = flashAddress + offset;

      await this.downloadBlock(chunk, currentTargetAddr);

      offset += chunkLength;
      const writePercent = 25 + Math.round((offset / totalBytes) * 71);
      onProgress({
        phase: 'write',
        percent: Math.min(96, writePercent),
        message: `Programmation Flash : ${Math.round((offset / totalBytes) * 100)}%`
      });

      // Bref répit pour soulager le bus USB
      await new Promise(r => setTimeout(r, 4));
    }

    // Phase 3 : Sortie DFU et redémarrage de la calculatrice (Progression 97% à 100%)
    onProgress({ phase: 'reboot', percent: 98, message: 'Redémarrage de votre NumWorks...' });
    try {
      await this.leave(flashAddress);
    } catch (e) {
      console.log("[WebUSB] Déconnexion nominale au redémarrage.");
    }

    // Mise à jour de l'état de connexion post-redémarrage
    this.isConnected = false;
    this.device = null;

    onProgress({ phase: 'done', percent: 100, message: '✓ EquaLib a été installé avec succès !' });

    console.log('[WebUSB] Flashage terminé avec succès !');
    return true;
  }

  /**
   * Alias de compatibilité ascendante pour flashBinary
   */
  async flashBundle(bundleData, onProgress = () => {}) {
    return await this.flashBinary(bundleData, onProgress, DEFAULT_FLASH_ADDR);
  }
}

if (typeof window !== 'undefined') {
  window.NumWorksWebUSB = NumWorksWebUSB;
}

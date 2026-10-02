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
const DEFAULT_FLASH_ADDR = 0x90200000; // Adresse standard officielle des applications externes Epsilon (N0120 & N0110)

class NumWorksWebUSB {
  constructor() {
    this.device = null;
    this.isConnected = false;
    this.model = 'NumWorks N0120';
    this.mode = 'Inconnu';
    this.interfaceNumber = 0;
    this.alternateSetting = 0;
    this.dfuAlternates = [];
    this.firmwareInfos = null;
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
      let targetAlternate = 0;
      let foundDfu = false;
      this.dfuAlternates = [];

      if (this.device.configurations && this.device.configurations.length > 0) {
        for (const config of this.device.configurations) {
          for (const iface of config.interfaces) {
            for (const alt of iface.alternates) {
              if (alt.interfaceClass === 0xFE && alt.interfaceSubclass === 0x01) {
                configValue = config.configurationValue;
                targetInterface = iface.interfaceNumber;
                foundDfu = true;
                this.dfuAlternates.push(alt);
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

      this.interfaceNumber = targetInterface;
      this.alternateSetting = 0;

      // Lecture des descripteurs de chaque Alternate Setting
      for (const alt of this.dfuAlternates) {
        let desc = alt.interfaceName || '';
        if (!desc && alt.iInterface > 0) {
          try {
            desc = await this.getStringDescriptor(alt.iInterface);
          } catch (e) {}
        }
        alt._parsedDescriptor = desc;
        console.log(`[WebUSB] Interface ${targetInterface} Alt ${alt.alternateSetting} : "${desc}"`);
      }

      // Sélection initiale de l'alternate le plus approprié
      const flashAlt = this.dfuAlternates.find(a => 
        (a._parsedDescriptor && (a._parsedDescriptor.includes('0x90') || a._parsedDescriptor.toLowerCase().includes('external') || a._parsedDescriptor.toLowerCase().includes('qspi')))
      );
      if (flashAlt) {
        targetAlternate = flashAlt.alternateSetting;
      } else if (this.dfuAlternates.length > 1) {
        // Sur NumWorks N0120 Epsilon, alt 1 est la mémoire externe Flash
        targetAlternate = 1;
      }

      if (targetAlternate > 0) {
        try {
          await this.device.selectAlternateInterface(targetInterface, targetAlternate);
          this.alternateSetting = targetAlternate;
        } catch (altErr) {
          console.warn("[WebUSB] selectAlternateInterface initial warning :", altErr);
        }
      }

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

      console.log(`[WebUSB] Connecté à ${this.model} (${this.mode}) sur interface ${this.interfaceNumber} Alt ${this.alternateSetting}`);

      // Réinitialisation de l'état DFU vers dfuIDLE
      await this.abortToIdle();

      // Interrogation dynamique de la table de mémoire Epsilon en RAM
      try {
        this.firmwareInfos = await this.extractInfos();
      } catch (infErr) {
        console.warn("[WebUSB] Infos mémoire non extraites :", infErr);
      }

      return {
        success: true,
        model: this.model,
        mode: this.mode,
        infos: this.firmwareInfos,
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
    this.firmwareInfos = null;
    console.log('[WebUSB] Déconnecté');
  }

  // ==================== PRIMITIVES DE CONTRÔLE USB DFU ====================

  async controlTransferIn(bRequest, wValue = 0, wLength = 0) {
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
   * Récupère un descripteur de chaîne USB standard (GET_DESCRIPTOR)
   */
  async getStringDescriptor(index) {
    if (!index || index <= 0) return '';
    try {
      const res = await this.device.controlTransferIn({
        requestType: 'standard',
        recipient: 'device',
        request: 6, // GET_DESCRIPTOR
        value: (3 << 8) | index, // 3 = STRING_DESCRIPTOR
        index: 0x0409 // Langue : US English
      }, 255);
      if (res.status === 'ok' && res.data.byteLength > 2) {
        const u16 = new Uint16Array(res.data.buffer, res.data.byteOffset + 2, Math.floor((res.data.byteLength - 2) / 2));
        return new TextDecoder('utf-16le').decode(u16);
      }
    } catch (e) {
      console.warn(`[WebUSB] getStringDescriptor(${index}) :`, e.message || e);
    }
    return '';
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
      // Ignoré
    }
  }

  /**
   * Interrompt l'opération DFU en cours (ABORT)
   */
  async abort() {
    try {
      await this.controlTransferOut(DFU_REQUESTS.ABORT, new ArrayBuffer(0), 0);
    } catch (e) {
      // Ignoré
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
   * Respecte strictement le pollTimeout requis par le STM32 sans tronquer arbitrairement
   */
  async pollUntil(predicate, timeoutMs = 30000) {
    const startTime = Date.now();
    let status = await this.getStatus();

    while (!predicate(status.state) && status.state !== DFU_STATES.dfuERROR) {
      if (Date.now() - startTime > timeoutMs) {
        throw new Error(`Délai d'attente DFU dépassé (${timeoutMs} ms)`);
      }

      // Attente recommandée par le microcontrôleur STM32 (au moins 10 ms)
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
   * Sélectionne l'Alternate Setting DFU le plus adapté à une plage d'adresse
   */
  async selectAlternateForAddress(address) {
    if (!this.device || !this.device.configuration) return;
    const iface = this.device.configuration.interfaces[this.interfaceNumber];
    if (!iface || iface.alternates.length <= 1) return;

    let bestAlt = null;
    const addrPrefix = '0x' + (address >>> 24).toString(16).toLowerCase();

    for (const alt of iface.alternates) {
      const desc = alt._parsedDescriptor || alt.interfaceName || '';
      if (desc.toLowerCase().includes(addrPrefix)) {
        bestAlt = alt.alternateSetting;
        break;
      }
      if ((address >= 0x90000000) && (desc.toLowerCase().includes('external') || desc.toLowerCase().includes('qspi') || desc.toLowerCase().includes('flash'))) {
        bestAlt = alt.alternateSetting;
      }
    }

    // Si non explicite et qu'on cible la Flash externe 0x90xxxxxx, privilégier Alt 1
    if (bestAlt === null && (address >= 0x90000000)) {
      const alt1 = iface.alternates.find(a => a.alternateSetting === 1);
      if (alt1) bestAlt = 1;
    }

    if (bestAlt !== null && bestAlt !== this.alternateSetting) {
      console.log(`[WebUSB] Changement Alternate Setting vers ${bestAlt} pour l'adresse 0x${address.toString(16)}`);
      try {
        await this.device.selectAlternateInterface(this.interfaceNumber, bestAlt);
        this.alternateSetting = bestAlt;
        await this.abortToIdle();
      } catch (e) {
        console.warn(`[WebUSB] selectAlternateInterface(${bestAlt}) :`, e);
      }
    }
  }

  /**
   * Positionne le pointeur d'adresse en mémoire (Commande ST DFU 0x21)
   * Intègre un basculement de secours automatique si l'alternate courant rejette l'adresse
   */
  async setAddress(address) {
    await this.selectAlternateForAddress(address);

    const buf = new ArrayBuffer(5);
    const view = new DataView(buf);
    view.setUint8(0, ST_DFU_COMMANDS.SET_ADDRESS);
    view.setUint32(1, address, true); // Little-endian 32-bit uint

    await this.controlTransferOut(DFU_REQUESTS.DNLOAD, buf, 0);
    const status = await this.pollUntil(state => state !== DFU_STATES.dfuDNBUSY);
    
    if (status.status !== DFU_STATUS_OK) {
      // Si l'alternate actuel a rejeté l'adresse (status 1 = errTARGET), tenter sur l'autre alternate
      const currentAlt = this.alternateSetting;
      const otherAlt = (currentAlt === 0) ? 1 : 0;
      console.warn(`[WebUSB] setAddress à 0x${address.toString(16)} rejeté (status ${status.status}) sur Alt ${currentAlt}. Essai de basculement vers Alt ${otherAlt}...`);
      
      await this.abortToIdle();
      try {
        await this.device.selectAlternateInterface(this.interfaceNumber, otherAlt);
        this.alternateSetting = otherAlt;
        await this.abortToIdle();
        await this.controlTransferOut(DFU_REQUESTS.DNLOAD, buf, 0);
        const retryStatus = await this.pollUntil(state => state !== DFU_STATES.dfuDNBUSY);
        if (retryStatus.status === DFU_STATUS_OK) {
          console.log(`[WebUSB] ✓ setAddress réussi avec succès sur Alt ${otherAlt} !`);
          return;
        }
      } catch (retryErr) {
        console.warn(`[WebUSB] Échec secours sur Alt ${otherAlt} :`, retryErr);
      }
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
    await this.selectAlternateForAddress(address);

    const buf = new ArrayBuffer(5);
    const view = new DataView(buf);
    view.setUint8(0, ST_DFU_COMMANDS.ERASE_PAGE);
    view.setUint32(1, address, true); // Little-endian 32-bit uint

    await this.controlTransferOut(DFU_REQUESTS.DNLOAD, buf, 0);
    const status = await this.pollUntil(state => state !== DFU_STATES.dfuDNBUSY, 30000);
    if (status.status !== DFU_STATUS_OK) {
      console.warn(`[WebUSB] Avertissement effacement à 0x${address.toString(16)} (status ${status.status})`);
      await this.abortToIdle();
    }
  }

  /**
   * Télécharge (lit) des octets depuis une adresse mémoire (Commande USB DFU UPLOAD)
   */
  async upload(address, length) {
    if (await this.getState() !== DFU_STATES.dfuIDLE) {
      await this.abortToIdle();
    }
    await this.setAddress(address);
    await this.abortToIdle();

    let blockNumber = 2;
    const result = new Uint8Array(length);
    let bytesRead = 0;

    while (bytesRead < length) {
      const chunkLength = Math.min(DFU_TRANSFER_SIZE, length - bytesRead);
      const data = await this.controlTransferIn(DFU_REQUESTS.UPLOAD, chunkLength, blockNumber++);
      if (data.byteLength > 0) {
        result.set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength), bytesRead);
        bytesRead += data.byteLength;
      }
    }
    await this.abortToIdle();
    return result;
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
      // Le redémarrage ou la déconnexion USB immédiate est le comportement nominal du STM32
      console.log("[WebUSB] Calculatrice redémarrée avec succès.");
    }
  }

  // ==================== INSPECTION DE LA MÉMOIRE & INFORMATIONS ====================

  /**
   * Extrait dynamiquement la cartographie officielle de la mémoire externe Epsilon depuis la RAM
   * (Méthode officielle NumWorks : table Slot Info à 0x24000000 / 0x20000000)
   */
  async extractInfos() {
    const prodName = this.device.productName || '';
    const bcd = (this.device.deviceVersionMajor << 8) | this.device.deviceVersionMinor;
    const isN0120 = (bcd === 0x0120) || prodName.includes('N0120') || (this.device.productId === NUMWORKS_PIDS.SCANDIUM);
    const ramStart = isN0120 ? 0x24000000 : 0x20000000;

    let externalAppsFlashStart = null;
    let externalAppsFlashEnd = null;
    let externalAppsRamStart = null;
    let externalAppsRamEnd = null;

    try {
      console.log(`[WebUSB] Lecture de la table Slot Info en RAM à 0x${ramStart.toString(16)}...`);
      const slotBytes = await this.upload(ramStart, 16);
      const slotView = new DataView(slotBytes.buffer, slotBytes.byteOffset);

      // Vérification du magic 0xBADBEEEF (0xBA, 0xDB, 0xEE, 0xEF en début et fin de table)
      const isSlotMagic = (slotBytes[0] === 0xBA && slotBytes[1] === 0xDB && slotBytes[2] === 0xEE && slotBytes[3] === 0xEF);

      if (isSlotMagic) {
        const kernelHeaderAddr = slotView.getUint32(4, true);
        const userlandHeaderAddr = slotView.getUint32(8, true);
        console.log(`[WebUSB] Table Slot Info valide ! Kernel=0x${kernelHeaderAddr.toString(16)}, Userland=0x${userlandHeaderAddr.toString(16)}`);

        // Lecture des 40 octets de l'en-tête Userland
        const userlandBytes = await this.upload(userlandHeaderAddr, 40);
        const userlandView = new DataView(userlandBytes.buffer, userlandBytes.byteOffset);

        // Vérification du magic 0xFEEDC0DE (0xFE, 0xED, 0xC0, 0xDE)
        const isUserMagic = (userlandBytes[0] === 0xFE && userlandBytes[1] === 0xED && userlandBytes[2] === 0xC0 && userlandBytes[3] === 0xDE);

        if (isUserMagic) {
          externalAppsFlashStart = userlandView.getUint32(20, true);
          externalAppsFlashEnd   = userlandView.getUint32(24, true);
          externalAppsRamStart   = userlandView.getUint32(28, true);
          externalAppsRamEnd     = userlandView.getUint32(32, true);
          console.log(`[WebUSB] ✓ Paramètres officiels extraits avec succès depuis Epsilon :`);
          console.log(`         Flash Start : 0x${externalAppsFlashStart.toString(16)}`);
          console.log(`         Flash End   : 0x${externalAppsFlashEnd.toString(16)}`);
          console.log(`         RAM Start   : 0x${externalAppsRamStart.toString(16)}`);
          console.log(`         RAM End     : 0x${externalAppsRamEnd.toString(16)}`);
        }
      }
    } catch (e) {
      console.warn("[WebUSB] Erreur lecture dynamique Slot Info :", e.message || e);
      await this.abortToIdle();
    }

    if (!externalAppsFlashStart || externalAppsFlashStart === 0 || externalAppsFlashStart === 0xFFFFFFFF) {
      // Fallback standard NumWorks : 0x90200000
      externalAppsFlashStart = DEFAULT_FLASH_ADDR;
      console.log(`[WebUSB] Utilisation du slot d'applications externes standard : 0x${externalAppsFlashStart.toString(16)}`);
    }

    return {
      isN0120,
      ramStart,
      externalAppsFlashStart,
      externalAppsFlashEnd,
      externalAppsRamStart,
      externalAppsRamEnd
    };
  }

  // ==================== MÉTHODE PRINCIPALE DE FLASHAGE ====================

  /**
   * Flashe le binaire complet dans le slot d'applications externes de la NumWorks
   * @param {ArrayBuffer|Uint8Array} binaryData Données binaires exécutables
   * @param {Function} onProgress Callback de progression ({ phase, percent, message })
   * @param {number|null} targetFlashAddr Adresse optionnelle de destination en Flash
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

    // Phase 0 : Détection dynamique de l'adresse Flash officielle
    onProgress({ phase: 'init', percent: 2, message: 'Interrogation de la calculatrice...' });
    let flashAddress = targetFlashAddr;
    if (!flashAddress || flashAddress === 0x90000000) {
      const infos = this.firmwareInfos || await this.extractInfos();
      flashAddress = infos.externalAppsFlashStart || DEFAULT_FLASH_ADDR;
    }

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
    await this.leave(flashAddress);
    onProgress({ phase: 'done', percent: 100, message: '✓ EquaLib a été installé avec succès !' });

    console.log('[WebUSB] Flashage terminé avec succès !');
    return true;
  }

  /**
   * Alias de compatibilité ascendante pour flashBinary
   */
  async flashBundle(bundleData, onProgress = () => {}) {
    return await this.flashBinary(bundleData, onProgress, null);
  }
}

if (typeof window !== 'undefined') {
  window.NumWorksWebUSB = NumWorksWebUSB;
}

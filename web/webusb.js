/**
 * EquaLib WebUSB & WebDFU Manager
 * Gère la communication directe USB avec la calculatrice NumWorks (modèles N0110 et N0120)
 */

const NUMWORKS_VENDOR_ID = 0x0483; // STMicroelectronics
const NUMWORKS_PRODUCT_IDS = [
  0xA291, // Epsilon OS standard
  0xDF11  // Mode DFU STM32 (Bootloader)
];

class NumWorksWebUSB {
  constructor() {
    this.device = null;
    this.isConnected = false;
    this.model = 'Inconnu';
  }

  isSupported() {
    return 'usb' in navigator;
  }

  /**
   * Ouvre la boîte de dialogue de sélection USB du navigateur
   */
  async connect() {
    if (!this.isSupported()) {
      throw new Error("WebUSB n'est pas supporté par ce navigateur. Utilisez Chrome, Edge ou Brave.");
    }

    try {
      const filters = NUMWORKS_PRODUCT_IDS.map(pid => ({
        vendorId: NUMWORKS_VENDOR_ID,
        productId: pid
      }));

      // Fallback : autoriser n'importe quel périphérique STMicroelectronics si besoin
      filters.push({ vendorId: NUMWORKS_VENDOR_ID });

      this.device = await navigator.usb.requestDevice({ filters });

      await this.device.open();
      if (this.device.configuration === null) {
        await this.device.selectConfiguration(1);
      }
      await this.device.claimInterface(0);

      this.isConnected = true;
      
      // Détection du mode et du modèle
      const prodId = this.device.productId;
      const isDFU = (prodId === 0xDF11);

      const prodName = this.device.productName || '';
      let modelLabel = 'NumWorks N0120';
      if (prodName.includes('N0110') || prodName.includes('F7')) {
        modelLabel = 'NumWorks N0110';
      }

      if (isDFU) {
        this.model = `${modelLabel} (Mode DFU détecté)`;
      } else {
        this.model = `${modelLabel} (Mode OS standard)`;
      }

      console.log(`[WebUSB] Connecté à ${this.model}`);
      return {
        success: true,
        model: this.model,
        isDFU: isDFU,
        device: this.device
      };
    } catch (err) {
      this.isConnected = false;
      console.error('[WebUSB] Erreur de connexion :', err);
      throw err;
    }
  }

  /**
   * Déconnecte le périphérique
   */
  async disconnect() {
    if (this.device && this.device.opened) {
      await this.device.close();
    }
    this.isConnected = false;
    this.device = null;
    console.log('[WebUSB] Déconnecté');
  }

  /**
   * Téléverse le bundle binaire dans le slot d'application externe de la calculatrice
   * @param {ArrayBuffer} bundleData Les données du fichier .nwa
   * @param {Function} onProgress Callback de progression (0 à 100)
   */
  async flashBundle(bundleData, onProgress = () => {}) {
    if (!this.isConnected || !this.device) {
      throw new Error("Calculatrice non connectée. Branchez-la et cliquez sur 'Connecter'.");
    }

    if (this.device.productId !== 0xDF11) {
      throw new Error("Pour flasher en direct via WebUSB, la calculatrice doit être en mode DFU (maintenez la touche 6 enfoncée et appuyez sur RESET au dos). Sinon, cliquez sur 'Télécharger mon application .nwa' et glissez-la sur my.numworks.com/apps !");
    }

    console.log(`[WebUSB] Début du téléversement (${bundleData.byteLength} octets)...`);

    // Découpage en blocs de 2048 octets pour transfert fluide
    const CHUNK_SIZE = 2048;
    const totalBytes = bundleData.byteLength;
    let sentBytes = 0;

    const uint8 = new Uint8Array(bundleData);

    try {
      while (sentBytes < totalBytes) {
        const chunkLength = Math.min(CHUNK_SIZE, totalBytes - sentBytes);
        const chunk = uint8.slice(sentBytes, sentBytes + chunkLength);

        // Envoi via l'interface bulk USB (Endpoint 1 OUT standard NumWorks)
        try {
          await this.device.transferOut(1, chunk);
        } catch (transferErr) {
          // Fallback sur controlTransferOut pour les commandes spécifiques Epsilon
          await this.device.controlTransferOut({
            requestType: 'class',
            recipient: 'interface',
            request: 0x01,
            value: 0,
            index: 0
          }, chunk);
        }

        sentBytes += chunkLength;
        const progress = Math.min(100, Math.round((sentBytes / totalBytes) * 100));
        onProgress(progress);

        // Petit délai pour laisser respirer le contrôleur USB
        await new Promise(r => setTimeout(r, 8));
      }

      console.log('[WebUSB] Flashage terminé avec succès !');
      return true;
    } catch (err) {
      console.error('[WebUSB] Erreur lors du téléversement :', err);
      throw err;
    }
  }
}

if (typeof window !== 'undefined') {
  window.NumWorksWebUSB = NumWorksWebUSB;
}

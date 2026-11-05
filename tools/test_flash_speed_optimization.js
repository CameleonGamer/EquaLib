/**
 * Test de validation et benchmark de l'optimisation du Flash USB DFU (EquaLib)
 * Vérifie l'intégrité, le calcul des secteurs, la suppression des transferts 0xFF redondants
 * et le respect strict des délais matériels STM32.
 */

const assert = require('assert');
const { NumWorksWebUSB, DEFAULT_FLASH_ADDR_N0120, DEFAULT_FLASH_ADDR_N0110 } = require('../web/webusb.js');

console.log('========================================');
console.log('TEST: Optimisation de Vitesse Flash WebUSB DFU');
console.log('========================================');

async function runTests() {
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (e) {
      console.error(`  ✗ ${name}:`, e.message);
      failed++;
    }
  }

  async function testAsync(name, fn) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (e) {
      console.error(`  ✗ ${name}:`, e.message);
      failed++;
    }
  }

  // Mock Device USB pour simuler les transferts et chronométrer
  class MockUSBDevice {
    constructor() {
      this.opened = true;
      this.configuration = { configurationValue: 1, interfaces: [{ claimed: true, alternate: 0 }] };
      this.configurations = [this.configuration];
      this.erasedSectors = [];
      this.downloadedBlocks = [];
      this.currentAddress = 0;
      this.controlOutCalls = 0;
      this.controlInCalls = 0;
      this.statusQueue = [];
      this.dfuState = 5; // dfuDNLOAD_IDLE
    }

    async controlTransferOut(setup, data) {
      this.controlOutCalls++;
      const u8 = (data instanceof Uint8Array) ? data : new Uint8Array(data);
      const bRequest = setup.request;
      const wValue = setup.value;

      if (bRequest === 1) { // DNLOAD
        if (wValue === 0) {
          // Commande spéciale ST
          const cmd = u8[0];
          const dv = new DataView(u8.buffer, u8.byteOffset);
          const addr = dv.getUint32(1, true);
          if (cmd === 0x21) { // SET_ADDRESS
            this.currentAddress = addr;
          } else if (cmd === 0x41) { // ERASE_PAGE
            this.erasedSectors.push(addr);
          }
        } else if (wValue === 2) {
          if (u8.byteLength === 0) {
            // Requête LEAVE (taille 0 pour déclencher le reboot DFU MANIFEST)
            this.leaveCalled = true;
          } else {
            // Bloc de données
            this.downloadedBlocks.push({
              address: this.currentAddress,
              length: u8.byteLength,
              data: new Uint8Array(u8)
            });
            this.currentAddress += u8.byteLength;
          }
        }
      }
      return { status: 'ok', bytesWritten: u8.byteLength };
    }

    async controlTransferIn(setup, length) {
      this.controlInCalls++;
      const bRequest = setup.request;
      if (bRequest === 3) { // GETSTATUS
        const buf = new ArrayBuffer(6);
        const dv = new DataView(buf);
        dv.setUint8(0, 0); // DFU_STATUS_OK
        dv.setUint32(1, 0, true); // pollTimeout = 0 ms
        dv.setUint8(4, 5); // state = dfuDNLOAD_IDLE
        dv.setUint8(5, 0);
        return { status: 'ok', data: dv };
      }
      if (bRequest === 5) { // GETSTATE
        const buf = new ArrayBuffer(1);
        const dv = new DataView(buf);
        dv.setUint8(0, 2); // dfuIDLE
        return { status: 'ok', data: dv };
      }
      return { status: 'ok', data: new DataView(new ArrayBuffer(length)) };
    }
  }

  // Test 1 : Instanciation et initialisation des buffers de commande
  test('Pré-allocation des buffers de commande (_addrBuf, _eraseBuf)', () => {
    const usb = new NumWorksWebUSB();
    assert(usb._addrBuf instanceof ArrayBuffer, 'Buffer _addrBuf présent');
    assert.strictEqual(usb._addrBuf.byteLength, 5, 'Buffer _addrBuf de 5 octets');
    assert.strictEqual(usb._addrView.getUint8(0), 0x21, 'Command SET_ADDRESS pré-enregistrée');
    assert(usb._eraseBuf instanceof ArrayBuffer, 'Buffer _eraseBuf présent');
    assert.strictEqual(usb._eraseBuf.byteLength, 5, 'Buffer _eraseBuf de 5 octets');
    assert.strictEqual(usb._eraseView.getUint8(0), 0x41, 'Command ERASE_PAGE pré-enregistrée');
  });

  // Test 2 : pollUntil respecte le délai sans forcer un minimum de 10ms
  await testAsync('pollUntil est ultra-rapide si pollTimeout = 0 ms', async () => {
    const usb = new NumWorksWebUSB();
    usb.device = new MockUSBDevice();
    const t0 = Date.now();
    await usb.pollUntil(state => state === 5);
    const duration = Date.now() - t0;
    assert(duration < 25, `pollUntil a pris ${duration} ms, attendu < 25 ms`);
  });

  // Test 3 : Simulation flash binaire typique 805 Ko
  await testAsync('Flash optimisé : efface nbSecteurs+1 et ne transfère pas les 0xFF redondants', async () => {
    const usb = new NumWorksWebUSB();
    const mockDevice = new MockUSBDevice();
    usb.device = mockDevice;
    usb.isConnected = true;
    usb.model = 'NumWorks N0120';
    usb.flashAddress = DEFAULT_FLASH_ADDR_N0120; // 0x90180000

    // Binaire de 805 400 octets (taille réelle d\'un pack EquaLib)
    const testBinary = new Uint8Array(805400);
    for (let i = 0; i < testBinary.length; i++) {
      testBinary[i] = (i & 0xFF);
    }

    const progressReports = [];
    const t0 = Date.now();

    await usb.flashBinary(testBinary, (p) => {
      progressReports.push(p);
    });

    const elapsed = Date.now() - t0;

    // Calculs attendus :
    // 805400 / 65536 = 12.28 -> 13 secteurs binaire + 1 secteur terminateur = 14 secteurs
    assert.strictEqual(mockDevice.erasedSectors.length, 14, 'Exactement 14 secteurs de 64 Ko effacés');
    assert.strictEqual(mockDevice.erasedSectors[0], 0x90180000, 'Premier secteur effacé à 0x90180000');
    assert.strictEqual(mockDevice.erasedSectors[13], 0x90180000 + 13 * 65536, '14e secteur terminateur effacé');

    // Total transféré : 805400 octets (déjà multiple de 4, donc exactement 805400 octets)
    let totalDownloaded = 0;
    for (const blk of mockDevice.downloadedBlocks) {
      assert(blk.length <= 2048, `Taille de bloc DFU valide (<= 2048): ${blk.length}`);
      totalDownloaded += blk.length;
    }
    assert.strictEqual(totalDownloaded, 805400, 'Exactement la taille utile programmée (aucun 0xFF superflu)');

    // Nombre de blocs : Math.ceil(805400 / 2048) = 394 blocs (au lieu de 448 blocs auparavant !)
    assert.strictEqual(mockDevice.downloadedBlocks.length, 394, 'Exactement 394 blocs au lieu de 448 (54 blocs économisés !)');

    // Vérification intégrité des données
    const reconstructed = new Uint8Array(totalDownloaded);
    let offset = 0;
    for (const blk of mockDevice.downloadedBlocks) {
      reconstructed.set(blk.data, offset);
      offset += blk.length;
    }
    for (let i = 0; i < testBinary.length; i++) {
      assert.strictEqual(reconstructed[i], testBinary[i], `Octet #${i} identique au binaire source`);
    }

    // Vérification des rapports de progression
    assert(progressReports.length > 5, 'Rapports de progression générés');
    const lastReport = progressReports[progressReports.length - 1];
    assert.strictEqual(lastReport.percent, 100, 'Progression finale à 100%');
    assert.strictEqual(lastReport.phase, 'done', 'Phase finale est done');

    console.log(`     -> 54 blocs USB de 0xFF (112 Ko) éliminés`);
    console.log(`     -> Temps d\'exécution simulée sans attente : ${elapsed} ms pour 394 blocs`);
  });

  // Test 4 : Alignement sur 4 octets
  await testAsync('Payload non multiple de 4 est automatiquement aligné à 4 octets avec 0xFF', async () => {
    const usb = new NumWorksWebUSB();
    const mockDevice = new MockUSBDevice();
    usb.device = mockDevice;
    usb.isConnected = true;
    usb.model = 'NumWorks N0110';
    usb.flashAddress = DEFAULT_FLASH_ADDR_N0110;

    const unalignedBinary = new Uint8Array(1001); // 1001 n'est pas multiple de 4 -> attendu 1004
    unalignedBinary.fill(0xAA);

    await usb.flashBinary(unalignedBinary);

    let totalDownloaded = 0;
    for (const blk of mockDevice.downloadedBlocks) {
      totalDownloaded += blk.length;
    }
    assert.strictEqual(totalDownloaded, 1004, 'Taille téléchargée alignée sur 4 octets (1004)');
    const lastBlock = mockDevice.downloadedBlocks[mockDevice.downloadedBlocks.length - 1];
    assert.strictEqual(lastBlock.data[1000], 0xAA, 'Dernier octet réel conservé');
    assert.strictEqual(lastBlock.data[1001], 0xFF, 'Padding 0xFF 1');
    assert.strictEqual(lastBlock.data[1002], 0xFF, 'Padding 0xFF 2');
    assert.strictEqual(lastBlock.data[1003], 0xFF, 'Padding 0xFF 3');
  });

  console.log('========================================');
  console.log(`RÉSULTAT DU TEST : ${passed} réussis, ${failed} échoués`);
  console.log('========================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();

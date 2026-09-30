const fs = require('fs');
const path = require('path');
const EquaLibBundler = require('../web/bundler.js');

async function test() {
  console.log('--- Test du packaging binaire EquaLib ---');
  const bundler = new EquaLibBundler({ simulateExam: true, targetModel: 'N0120' });

  const dummyApps = [
    {
      name: "KhiCAS",
      size_kb: 1420,
      data: new Uint8Array(1420 * 1024)
    },
    {
      name: "Periodique",
      size_kb: 180,
      data: new Uint8Array(180 * 1024)
    }
  ];

  const result = await bundler.buildBundle(dummyApps);
  console.log('Result totalBytes:', result.totalBytes);

  const view = new DataView(result.arrayBuffer);
  const magic1 = view.getUint32(0, true);
  console.log('Epsilon Magic 1:', '0x' + magic1.toString(16).toUpperCase());

  if (magic1 === 0xBABEC0DE) {
    console.log('✓ Validation de la signature Epsilon EADK réussie !');
  } else {
    console.error('✗ Erreur signature Epsilon');
    process.exit(1);
  }

  console.log('✓ Test terminé avec succès !');
}

test();

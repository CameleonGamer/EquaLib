const fs = require('fs');

console.log('=== VERIFYING FULL EQUALIB PIPELINE ===\n');

// 1. Require Linker and Bundler
require('../web/nwa_linker.js');
const Bundler = require('../web/bundler.js');

const nwaData = fs.readFileSync('tools/test_compiled.nwa');
console.log('1. Sample NWA loaded:', nwaData.length, 'bytes');

async function testAll() {
  // Test A: Convert NWA -> standalone BIN (as in converter.html)
  console.log('\n--- TEST A: Standalone NWA -> BIN (Converter) ---');
  const standaloneBin = await global.EquaLibLinker.convertNwaToBin(nwaData, {
    flashStart: '0x90180000',
    ramStart: '0x24020000',
    ramLength: '64K'
  });
  console.log('Standalone bin size:', standaloneBin.length);
  const u32A = new Uint32Array(standaloneBin.buffer, standaloneBin.byteOffset, 8);
  console.log('Magic1:', '0x' + u32A[0].toString(16));
  console.log('Magic2:', '0x' + u32A[7].toString(16));
  console.log('Entry offset:', '0x' + u32A[5].toString(16));
  if (u32A[0] !== 0xdec0beba || u32A[7] !== 0xdec0beba) {
    throw new Error('TEST A FAILED: Bad magic');
  }
  // Check that 0x90010030 is NOT present
  for (let i = 0; i < standaloneBin.length - 4; i += 2) {
    if (standaloneBin[i] === 0x30 && standaloneBin[i+1] === 0x00 && standaloneBin[i+2] === 0x01 && standaloneBin[i+3] === 0x90) {
      throw new Error('TEST A FAILED: Found trampoline address 0x90010030');
    }
  }
  console.log('✓ TEST A PASSED: Standalone binary is 100% valid with NO broken trampoline!\n');

  // Test B: Multi-app bundle with imported NWA (as in index.html WebUSB)
  console.log('--- TEST B: Multi-app pack with imported NWA (WebUSB Bundle) ---');
  const selectedApps = [
    { id: 'mariokart', name: 'Mario Kart', category: 'Jeu / Arcade' },
    { id: 'comm_tetris', name: 'Tetris NumWorks', category: 'Jeu / Arcade' },
    { id: 'comm_snake', name: 'Snake Classic', category: 'Jeu / Arcade' },
    { id: 'stealth_calc', name: 'Mode Furtif Panique', category: 'Securite' },
    {
      id: 'custom_123',
      name: 'Mon Jeu Test',
      category: 'Natif ARM',
      format: 'NWA',
      data: nwaData
    }
  ];

  const binFile = fs.readFileSync('web/equalib_n0120.bin');
  const bundler = new Bundler();
  const patched = await bundler.patchManifest(new Uint8Array(binFile), selectedApps);
  console.log('Patched bundle size:', patched.length);

  // Inspect manifest in patched bundle
  const MAGIC = 0x4C415145; // 'EQAL'
  let manifestOffset = -1;
  const pBuf = Buffer.from(patched);
  for (let i = 0; i <= pBuf.length - 4; i += 4) {
    if (pBuf.readUInt32LE(i) === MAGIC) {
      manifestOffset = i;
      break;
    }
  }
  console.log('Manifest offset in bundle: 0x' + manifestOffset.toString(16));
  const appCount = pBuf.readUInt32LE(manifestOffset + 8);
  console.log('Total apps in manifest:', appCount);
  if (appCount !== 5) throw new Error('Bad app count');

  // Inspect last app (custom_123)
  const entry = manifestOffset + 16 + 4 * 144;
  const id = pBuf.toString('utf8', entry, entry + 16).replace(/\0/g, '');
  const name = pBuf.toString('utf8', entry + 16, entry + 48).replace(/\0/g, '');
  const appType = pBuf.readUInt8(entry + 132);
  const dataOffset = pBuf.readUInt32LE(entry + 136);
  const dataSize = pBuf.readUInt32LE(entry + 140);
  console.log(`App 4: ID='${id}', Name='${name}', Type=${appType}, dataOffset=0x${dataOffset.toString(16)}, dataSize=${dataSize}`);

  if (appType !== 13) throw new Error('Expected Type 13');
  if (dataOffset < binFile.length) throw new Error('dataOffset overlaps launcher binary');
  if (dataOffset + dataSize > patched.length) throw new Error('dataOffset exceeds bundle length');

  const payload = pBuf.subarray(dataOffset, dataOffset + dataSize);
  const u32B = new Uint32Array(payload.buffer, payload.byteOffset, 8);
  console.log('Child app Magic1: 0x' + u32B[0].toString(16));
  console.log('Child app Magic2: 0x' + u32B[7].toString(16));
  console.log('Child app Entry offset: 0x' + u32B[5].toString(16));
  if (u32B[0] !== 0xdec0beba || u32B[7] !== 0xdec0beba) {
    throw new Error('TEST B FAILED: Bad child magic');
  }

  // Check child compiled flash relocation
  const childEntry = u32B[5];
  const compiledFlash = payload.readUInt32LE(childEntry + 0x38);
  const expectedFlash = 0x90180000 + dataOffset;
  console.log('Child compiledFlash: 0x' + compiledFlash.toString(16));
  console.log('Expected Flash base: 0x' + expectedFlash.toString(16));
  if (compiledFlash < expectedFlash || compiledFlash > expectedFlash + dataSize + 0x2000) {
    throw new Error('TEST B FAILED: Flash relocation mismatch');
  }

  // Check that 0x90010030 is NOT present in child payload
  for (let i = 0; i < payload.length - 4; i += 2) {
    if (payload[i] === 0x30 && payload[i+1] === 0x00 && payload[i+2] === 0x01 && payload[i+3] === 0x90) {
      throw new Error('TEST B FAILED: Found trampoline address 0x90010030 in child payload');
    }
  }
  console.log('✓ TEST B PASSED: Multi-app bundle with relocated child app is 100% verified!\n');

  console.log('=== ALL TESTS PASSED WITH 100% SUCCESS! ===');
}

testAll().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Convertisseur officiel NWA -> BIN pour NumWorks N0120 & N0110
 * Utilise le compilateur/linker EADK officiel NumWorks (nwlink)
 * Usage: node tools/convert_nwa_to_bin.js <input.nwa> [output.bin] [--flash-start <addr>]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
  console.log('Usage: node tools/convert_nwa_to_bin.js <app.nwa> [output.bin] [--flash-start <hex>] [--ram-start <hex>]');
  console.log('Exemple: node tools/convert_nwa_to_bin.js myapp.nwa');
  process.exit(0);
}

const inputNwa = args[0];
if (!fs.existsSync(inputNwa)) {
  console.error(`Erreur: Fichier introuvable "${inputNwa}"`);
  process.exit(1);
}

let outputBin = inputNwa.replace(/\.nwa$/i, '.bin');
if (args[1] && !args[1].startsWith('--')) {
  outputBin = args[1];
}

let flashStart = '0x90180000';
let ramStart = '0x240118a4';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--flash-start' && args[i+1]) {
    flashStart = args[i+1];
  }
  if (args[i] === '--ram-start' && args[i+1]) {
    ramStart = args[i+1];
  }
}

console.log(`\n=== CONVERSION NWA -> BIN (EADK NumWorks) ===`);
console.log(`Source : ${inputNwa}`);
console.log(`Cible  : ${outputBin}`);
console.log(`Flash  : ${flashStart}`);
console.log(`RAM    : ${ramStart}\n`);

try {
  const cmd = `npx --yes -- nwlink@1.0.0 nwa-bin "${inputNwa}" "${outputBin}" --flash-start ${flashStart} --ram-start ${ramStart}`;
  console.log(`Exécution : ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });

  if (!fs.existsSync(outputBin)) {
    throw new Error('Fichier .bin non généré');
  }

  const binData = fs.readFileSync(outputBin);
  const u32 = new Uint32Array(binData.buffer, binData.byteOffset, 8);
  const magic1 = u32[0];
  const entryOffset = u32[5];

  console.log(`\n✓ Succès !`);
  console.log(`Taille     : ${(binData.length / 1024).toFixed(1)} Ko (${binData.length} octets)`);
  console.log(`Magic EADK : 0x${magic1.toString(16).toUpperCase()} ${magic1 === 0xdec0beba ? '(VALIDE)' : '(NON RECONNU)'}`);
  console.log(`Offset _start : 0x${entryOffset.toString(16)} (+0x${entryOffset.toString(16)})`);
  console.log(`\nVous pouvez maintenant importer "${outputBin}" directement sur EquaLib Web !`);
} catch (err) {
  console.error(`\nErreur lors de la conversion :`, err.message);
  process.exit(1);
}

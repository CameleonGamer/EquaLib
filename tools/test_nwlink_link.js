const fs = require('fs');
const path = require('path');

// nwlink un class
const nwlink = require('./package/dist/index.js');

// Test de chargement de khicas_sample.nwa
const fileBuffer = fs.readFileSync('tools/khicas_sample.nwa');

// Créons une instance de NwaApp comme nwlink le fait
async function test() {
  console.log('--- Test de validation NWA avec nwlink ---');
  
  // Cherchons la classe AppInfo / NwaApp
  // Dans index.js, l'export de nwlink ou un(fileBuffer)
  // Utilisons directement le script nwlink pour imprimer le nom
  const { execSync } = require('child_process');
  
  // Test d'exécution de nwa-name
  try {
    const out = execSync(`node tools/package/bin/nwlink nwa-name tools/khicas_sample.nwa`, { encoding: 'utf8' });
    console.log('App name detected by nwlink:', out.trim());
  } catch (e) {
    console.log('Erreur nwa-name:', e.message);
  }
}

test();

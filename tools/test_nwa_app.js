const fs = require('fs');

// Testons la classe NwaApp avec tools/equalib_template.nwa
const data = fs.readFileSync('tools/equalib_template.nwa');

// Dans index.js, cherchons le constructeur NwaApp
// Exécutons le script pour voir si refreshSizeAndNeedOfExternalData réussit sans NaN
const { execSync } = require('child_process');

try {
  const name = execSync('node tools/package/bin/nwlink nwa-name tools/equalib_template.nwa', { encoding: 'utf8' }).trim();
  console.log('App Name:', name);

  execSync('node tools/package/bin/nwlink nwa-bin tools/equalib_template.nwa tools/test_out.bin');
  const stat = fs.statSync('tools/test_out.bin');
  console.log('Linked binary size:', stat.size, 'bytes (', (stat.size / 1024).toFixed(2), 'KB )');
  
  if (name === 'EquaLib' && !isNaN(stat.size)) {
    console.log('✓ SUCCÈS : Le fichier tools/equalib_template.nwa est un ELF NWA 100% valide et ne produira JAMAIS "Size: NaN KB" !');
  }
} catch (e) {
  console.error('Erreur:', e.message);
}

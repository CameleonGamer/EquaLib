const path = require('path');
const usb = require(path.resolve(__dirname, 'package/node_modules/usb'));

console.log('=== TEST NUMWORKS CONNECTÉE EN DIRECT ===\n');

const devs = usb.getDeviceList();
const nwDevs = devs.filter(d => d.deviceDescriptor.idVendor === 0x0483);

if (nwDevs.length === 0) {
  console.log('❌ Aucune NumWorks détectée sur les ports USB.');
  console.log('\nDiagnostic matériel :');
  console.log(' 1. CÂBLE USB : Utilisez un câble USB qui transfère les DONNÉES (pas un câble de charge seule).');
  console.log(' 2. CALCULATRICE ALLUMÉE : Allumez l\'écran (touche ON ou Home).');
  console.log(' 3. MESSAGE ÉCRAN : Si la calculatrice affiche "Connecter à un ordinateur ?", validez avec [OK].');
  console.log(' 4. PORT USB : Branchez directement sur un port USB de la carte mère (évitez les hubs non alimentés).');
  console.log(' 5. REDÉMARRAGE : Si la calculatrice est figée, appuyez sur le bouton RESET au dos avec une pointe fine.');
  process.exit(1);
}

console.log(`✓ ${nwDevs.length} NumWorks détectée(s) !\n`);

nwDevs.forEach((dev, idx) => {
  const dd = dev.deviceDescriptor;
  const bcd = dd.bcdDevice;
  const major = (bcd >> 8) & 0xFF;
  const minor = (bcd >> 4) & 0x0F;
  const subminor = bcd & 0x0F;

  let model = 'Inconnu';
  let arch = 'Inconnu';
  let slot = '0x90200000';

  if (bcd === 0x0120 || minor === 2 || dd.idProduct === 0xA51A) {
    model = 'NumWorks N0120';
    arch = 'STM32H725 (Cortex-M7 @ 550MHz)';
    slot = '0x90180000';
  } else if (bcd === 0x0115 || subminor === 5) {
    model = 'NumWorks N0115';
    arch = 'STM32F730 (Cortex-M7 @ 216MHz)';
    slot = '0x90200000';
  } else {
    model = 'NumWorks N0110';
    arch = 'STM32F730 (Cortex-M7 @ 216MHz)';
    slot = '0x90200000';
  }

  let mode = 'Epsilon OS standard';
  if (dd.idProduct === 0xDF11) {
    mode = 'Mode Bootloader DFU STM32 (Recovery)';
  } else if (dd.idProduct === 0xA51A) {
    mode = 'Bootloader Scandium';
  }

  console.log(`[Périphérique #${idx + 1}]`);
  console.log(` • Modèle détecté : ${model}`);
  console.log(` • Mode USB        : ${mode}`);
  console.log(` • Processeur      : ${arch}`);
  console.log(` • Slot externe    : ${slot}`);
  console.log(` • VID / PID       : 0x${dd.idVendor.toString(16).padStart(4, '0')} / 0x${dd.idProduct.toString(16).padStart(4, '0')}`);
  console.log(` • bcdDevice       : 0x${bcd.toString(16).padStart(4, '0')} (décimal: ${bcd})`);
  console.log(` • Version décodée : major=${major}, minor=${minor}, subminor=${subminor}`);
});

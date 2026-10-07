const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('=== BUILD EQUALIB NWA & BIN FOR N0120 ===\n');

// 1. Compile all launcher C files
const srcFiles = [
  'main.c',
  'app_mariokart.c',
  'app_courses.c',
  'app_periodic.c',
  'app_math_tools.c',
  'app_text_viewer.c',
  'app_flappy.c',
  'app_2048.c',
  'app_snake.c',
  'app_tetris.c',
  'app_minesweeper.c',
  'app_python.c',
  'eq_font.c',
  'mini_libc.c'
];

for (const file of srcFiles) {
  const cPath = path.join('launcher/src', file);
  const oPath = path.join('launcher/src', file.replace('.c', '.o'));
  console.log(`Compiling ${cPath}...`);
  execSync(
    `arm-none-eabi-gcc -mthumb -mfloat-abi=hard -mcpu=cortex-m7 -mfpu=fpv5-sp-d16 -DPLATFORM_DEVICE=1 -Os -Ilauncher/include -IC:/Users/noear/Desktop/projets/MathDS/src -fno-exceptions -fno-unwind-tables -fdata-sections -ffunction-sections -c "${cPath}" -o "${oPath}"`,
    { stdio: 'inherit' }
  );
}

// 2. Collect all object files
const launcherObjs = srcFiles.map(f => path.join('launcher/src', f.replace('.c', '.o')));
const mathDir = 'C:/Users/noear/Desktop/projets/MathDS/output';
const mathObjs = fs.readdirSync(mathDir)
  .filter(f => f.startsWith('smk_') && f.endsWith('.o'))
  .map(f => path.join(mathDir, f));
const iconObj = path.join(mathDir, 'icon.o');

const allObjs = [...launcherObjs, ...mathObjs, iconObj];
console.log(`\nLinking ${allObjs.length} objects into launcher/equalib.nwa...`);

const ldFlags = [
  '-mthumb',
  '-mfloat-abi=hard',
  '-mcpu=cortex-m7',
  '-mfpu=fpv5-sp-d16',
  '-Wl,--relocatable',
  '-nostartfiles',
  '-nodefaultlibs',
  '-Wl,-e,main',
  '-Wl,-u,eadk_app_name',
  '-Wl,-u,eadk_app_icon',
  '-Wl,-u,eadk_api_level',
  '-Wl,-u,g_equalib_manifest',
  '-Wl,--gc-sections'
];

const linkCmd = `arm-none-eabi-gcc ${ldFlags.join(' ')} ${allObjs.map(o => `"${o}"`).join(' ')} -o "launcher/equalib.nwa"`;
execSync(linkCmd, { stdio: 'inherit' });
console.log('✓ launcher/equalib.nwa generated successfully!');

// 3. Convert NWA to BIN via nwlink with N0120 memory map
console.log('\nConverting NWA to flat BIN with nwlink (Flash: 0x90180000, RAM: 0x240118a4)...');
execSync('npx --yes -- nwlink@1.0.0 nwa-bin launcher/equalib.nwa test_equalib_n0120.bin --flash-start 0x90180000 --ram-start 0x240118a4', { stdio: 'inherit' });
console.log('✓ test_equalib_n0120.bin generated successfully!');

// Copy to web/
fs.copyFileSync('test_equalib_n0120.bin', 'web/equalib_n0120.bin');
fs.copyFileSync('launcher/equalib.nwa', 'web/equalib_n0120.nwa');
console.log('✓ Copied to web/equalib_n0120.bin and web/equalib_n0120.nwa');

// 4. Update bundler.js with new base64
execSync('node tools/update_bundler_native.js', { stdio: 'inherit' });
console.log('✓ web/bundler.js updated!');

console.log('\n=== BUILD COMPLETED 100% SUCCESSFULLY! ===');

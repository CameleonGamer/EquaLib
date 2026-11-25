const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('=== BUILD EQUALIB SLIM NWA & BIN (ALL MODELS) ===\n');

const coreSrcFiles = [
  'storage.c',
  'manifest.c',
  'eq_font.c',
  'mini_libc.c',
  'app_courses.c',
  'app_periodic.c',
  'app_math_tools.c',
  'app_text_viewer.c',
  'app_flappy.c',
  'app_2048.c',
  'app_snake.c',
  'app_tetris.c',
  'app_minesweeper.c',
  'app_pong.c',
  'app_dino.c',
  'app_space_invaders.c',
  'app_breakout.c',
  'app_puissance4.c',
  'app_morpion.c',
  'app_python.c'
];

const cflags = '-mthumb -mfloat-abi=hard -mcpu=cortex-m7 -mfpu=fpv5-sp-d16 -DPLATFORM_DEVICE=1 -Os -ffreestanding -fno-builtin -Ilauncher/include -fno-exceptions -fno-unwind-tables -fdata-sections -ffunction-sections';

console.log('Compiling launcher/src/main.c (-DEQUALIB_SLIM=1)...');
execSync(
  `arm-none-eabi-gcc ${cflags} -DEQUALIB_SLIM=1 -c "launcher/src/main.c" -o "launcher/src/main_slim.o"`,
  { stdio: 'inherit' }
);

const objs = ['launcher/src/main_slim.o'];
for (const file of coreSrcFiles) {
  const cPath = path.join('launcher/src', file);
  const oPath = path.join('launcher/src', file.replace('.c', '.o'));
  if (!fs.existsSync(oPath) || fs.statSync(cPath).mtimeMs > fs.statSync(oPath).mtimeMs) {
    console.log(`Compiling ${cPath}...`);
    execSync(`arm-none-eabi-gcc ${cflags} -c "${cPath}" -o "${oPath}"`, { stdio: 'inherit' });
  }
  objs.push(oPath);
}

const iconObj = 'launcher/icon.o';
if (fs.existsSync(iconObj)) {
  objs.push(iconObj);
}

const libgccPath = execSync('arm-none-eabi-gcc -mthumb -mfloat-abi=hard -mcpu=cortex-m7 -mfpu=fpv5-sp-d16 -print-libgcc-file-name', { encoding: 'utf8' }).trim();

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

execSync(
  `arm-none-eabi-gcc ${ldFlags.join(' ')} ${objs.map(o => `"${o}"`).join(' ')} "${libgccPath}" -o "launcher/equalib_slim.nwa"`,
  { stdio: 'inherit' }
);
console.log('✓ launcher/equalib_slim.nwa generated!');
execSync('arm-none-eabi-size launcher/equalib_slim.nwa', { stdio: 'inherit' });

const targets = [
  { suffix: 'n0120', flash: '0x90180000', ram: '0x240118a4' },
  { suffix: 'n0120_58', flash: '0x90580000', ram: '0x240118a4' },
  { suffix: 'n0110', flash: '0x90200000', ram: '0x20000000' },
  { suffix: 'n0115', flash: '0x90600000', ram: '0x200118a4' }
];

const localNwlink = path.join(process.env.APPDATA || '', 'npm', 'nwlink.cmd');
const nwlinkCmd = fs.existsSync(localNwlink) ? `"${localNwlink}"` : 'npx --yes -- nwlink@1.0.0';

for (const t of targets) {
  const outBin = `web/equalib_slim_${t.suffix}.bin`;
  execSync(
    `${nwlinkCmd} nwa-bin launcher/equalib_slim.nwa "${outBin}" --flash-start ${t.flash} --ram-start ${t.ram}`,
    { stdio: 'inherit' }
  );
  console.log(`✓ ${outBin}: ${fs.statSync(outBin).size} bytes`);
}

for (const nwaName of ['equalib_slim_n0120.nwa', 'equalib_slim_n0110.nwa', 'equalib_slim_n0115.nwa', 'equalib_slim.nwa']) {
  fs.copyFileSync('launcher/equalib_slim.nwa', path.join('web', nwaName));
}
console.log('✓ Copied slim .nwa and .bin binaries to web/');

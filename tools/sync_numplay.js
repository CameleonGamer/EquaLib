const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const TEMP_NUMPLAY = path.join(ROOT, 'temp_numplay');
const APPS_DIR = path.join(ROOT, 'web', 'apps', 'numplay');
const ICONS_DIR = path.join(ROOT, 'web', 'assets', 'icons', 'numplay');

fs.mkdirSync(APPS_DIR, { recursive: true });
fs.mkdirSync(ICONS_DIR, { recursive: true });

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(dest) && fs.statSync(dest).size > 500) {
      return resolve({ skipped: true, size: fs.statSync(dest).size });
    }
    const doGet = (targetUrl, redirects = 0) => {
      if (redirects > 8) return reject(new Error('Too many redirects for ' + url));
      https.get(targetUrl, { headers: { 'User-Agent': 'EquaLib-Sync/1.0' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return doGet(res.headers.location, redirects + 1);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode} for ${targetUrl}`));
        }
        const tmp = dest + '.part';
        const out = fs.createWriteStream(tmp);
        res.pipe(out);
        out.on('finish', () => {
          out.close(() => {
            fs.renameSync(tmp, dest);
            resolve({ skipped: false, size: fs.statSync(dest).size });
          });
        });
        out.on('error', (err) => {
          try { fs.unlinkSync(tmp); } catch (_) {}
          reject(err);
        });
      }).on('error', reject);
    };
    doGet(url);
  });
}

async function runPool(items, concurrency, fn) {
  let idx = 0;
  const results = [];
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

const RELEASE_ASSET_MAP = {
  chess: 'NumChess.nwa',
  twoplayer: 'TwoPlayers.nwa',
  isaac: 'BindingOfIsaac.nwa',
  fnafworld: 'FiveNightsAtFreddysWorld.nwa',
  fourplayer: 'FourPlayers.nwa',
  paperclips: 'UniversalPaperclips-French.nwa',
  meowdoku: 'Meowdoku.nwa',
  retrogo: 'RetroGo.nwa'
};

// Mapping des IDs existants dans web/catalog.json vers leur équivalent NumPlay
const CATALOG_REPLACE_MAP = {
  flappybird: { id: 'comm_flappy', iconEmoji: '🐦' },
  g2048: { id: 'comm_2048', iconEmoji: '🔢' },
  snake: { id: 'comm_snake', iconEmoji: '🐍' },
  tetris: { id: 'comm_tetris', iconEmoji: '🧱' },
  minesweeper: { id: 'comm_minesweeper', iconEmoji: '💣' },
  dinorun: { id: 'dino', iconEmoji: '🦖' },
  invaders: { id: 'space_invaders', iconEmoji: '👾' },
  breakout: { id: 'breakout', iconEmoji: '🧱' },
  connectfour: { id: 'puissance4', iconEmoji: '🟡' },
  fnaf: { id: 'fnaf', iconEmoji: '🐻' }
};

const COMM_REPLACE_MAP = {
  flappybird: 'comm_flappy',
  g2048: 'comm_2048',
  snake: 'comm_snake',
  tetris: 'comm_tetris',
  minesweeper: 'comm_minesweeper',
  dinorun: 'comm_dino',
  invaders: 'comm_space_invaders',
  breakout: 'comm_breakout',
  connectfour: 'comm_puissance4',
  fnaf: 'comm_fnaf'
};

const CATEGORY_MAP = {
  fnaf: 'Jeux / Horreur', fnaf2: 'Jeux / Horreur', fnaf3: 'Jeux / Horreur', fnaf4: 'Jeux / Horreur',
  buckshot: 'Jeux / Horreur',
  fnafworld: 'Jeux / RPG', undertale: 'Jeux / RPG', deltarune: 'Jeux / RPG', isaac: 'Jeux / RPG', badtime: 'Jeux / RPG',
  celeste: 'Jeux / Plateforme', hollowknight: 'Jeux / Plateforme', hkfungal: 'Jeux / Plateforme',
  sonic: 'Jeux / Plateforme', leveldevil: 'Jeux / Plateforme', catninja: 'Jeux / Plateforme',
  donkeykong: 'Jeux / Plateforme', numdash: 'Jeux / Plateforme', famidash: 'Jeux / Plateforme',
  numdrive: 'Jeux / Course', hillclimb: 'Jeux / Course', polytrack: 'Jeux / Course',
  motox3m: 'Jeux / Course', rider: 'Jeux / Course', snowrider: 'Jeux / Course',
  dune: 'Jeux / Course',
  tetris: 'Jeux / Puzzle', g2048: 'Jeux / Puzzle', minesweeper: 'Jeux / Puzzle',
  sudoku: 'Jeux / Puzzle', sokoban: 'Jeux / Puzzle', meowdoku: 'Jeux / Puzzle',
  mahjong: 'Jeux / Puzzle', blockblast: 'Jeux / Puzzle', suika: 'Jeux / Puzzle',
  portal: 'Jeux / Puzzle', circloo: 'Jeux / Puzzle', mrbullet: 'Jeux / Puzzle',
  chess: 'Jeux / Stratégie', connectfour: 'Jeux / Stratégie', solitaire: 'Jeux / Stratégie',
  uttt: 'Jeux / Stratégie', uno: 'Jeux / Stratégie', pvz: 'Jeux / Stratégie',
  clashroyale: 'Jeux / Stratégie', kingdomrush: 'Jeux / Stratégie', finalearth2: 'Jeux / Stratégie',
  balatro: 'Jeux / Stratégie', paperclips: 'Jeux / Stratégie', cookieclicker: 'Jeux / Stratégie',
  monkeymart: 'Jeux / Stratégie',
  amongus: 'Jeux / Multijoueur', imposter: 'Jeux / Multijoueur', twoplayer: 'Jeux / Multijoueur', fourplayer: 'Jeux / Multijoueur',
  retrogo: 'Jeux / Émulateurs', numpico: 'Jeux / Émulateurs', numpowder: 'Jeux / Sandbox', numblocks: 'Jeux / Sandbox',
  numvisuals: 'Jeux / Outils'
};

const EMOJI_MAP = {
  numdash: '🟦', crossyroad: '🐔', numblocks: '⛏️', numdrive: '🚙', balatro: '🃏',
  buckshot: '🔫', blockblast: '🟪', suika: '🍉', portal: '🌀', tetris: '🧱',
  dinorun: '🦖', doodlejump: '🦘', chess: '♟️', flappybird: '🐦', flappydunk: '🏀',
  towerblock: '🏗️', coreball: '🎯', pacman: '🟡', snake: '🐍', connectfour: '🔴',
  solitaire: '♠️', g2048: '🔢', minesweeper: '💣', breakout: '🧱', twoplayer: '👥',
  invaders: '👾', sudoku: '9️⃣', uttt: '❌', sokoban: '📦', meowdoku: '🐱',
  retrogo: '🕹️', celeste: '🍓', hollowknight: '🪲', hkfungal: '🍄', undertale: '❤️',
  deltarune: '💜', championisland: '🏅', finalearth2: '🌍', numpowder: '⏳', subway: '🏃',
  fnaf: '🐻', doom: '👹', isaac: '😭', hillclimb: '🚗', pvz: '🌻',
  sonic: '🦔', cookieclicker: '🍪', leveldevil: '😈', jetpackjoyride: '🚀', stickmanhook: '🕸️',
  donkeykong: '🦍', dune: '🏜️', monkeymart: '🐒', tombofthemask: '👺', uno: '🃏',
  fnf: '🎤', angrybirds: '🐦', numvisuals: '🎨', polytrack: '🏎️', paperclips: '📎',
  badtime: '💀', mahjong: '🀄', rider: '🏍️', snowrider: '🛷', templerun: '🗿',
  fnaf2: '🐰', fnaf3: '🐇', fnaf4: '🧸', fnafworld: '🌟', famidash: '🔺',
  clashroyale: '👑', catninja: '🐈', kingdomrush: '🏰', mrbullet: '🕵️', numpico: '👾',
  motox3m: '🏍️', amongus: '🚀', imposter: '🎭', fourplayer: '🎮', circloo: '⭕'
};

function buildMeowdoku() {
  const out = path.join(APPS_DIR, 'Meowdoku.nwa');
  if (fs.existsSync(out) && fs.statSync(out).size > 10000) {
    console.log('Meowdoku.nwa ready:', fs.statSync(out).size);
    return;
  }
  const tmpDir = path.join(ROOT, 'temp_meow');
  fs.mkdirSync(tmpDir, { recursive: true });
  const cflags = execSync('npx --yes -- nwlink@1.0.0 eadk-cflags-device').toString().trim();
  execSync(`npx --yes -- nwlink@1.0.0 png-icon-o "${path.join(TEMP_NUMPLAY, 'games/meowdoku/src/icon.png')}" "${path.join(tmpDir, 'icon.o')}"`, { stdio: 'inherit' });
  const baseFlags = `-std=c11 ${cflags} -Os -Wno-unused-parameter -fno-math-errno -fsingle-precision-constant -fno-tree-loop-distribute-patterns -I "${path.join(TEMP_NUMPLAY, 'launcher/src')}" -I "${path.join(TEMP_NUMPLAY, 'games/common')}" -I "${path.join(TEMP_NUMPLAY, 'games/meowdoku/src')}"`;
  const srcs = [
    ['games/meowdoku/src/main.c', 'main.o'],
    ['launcher/src/gfx.c', 'gfx.o'],
    ['launcher/src/font_data.c', 'font_data.o'],
    ['launcher/src/xfont.c', 'xfont.o']
  ];
  for (const [rel, obj] of srcs) {
    execSync(`arm-none-eabi-gcc ${baseFlags} -c "${path.join(TEMP_NUMPLAY, rel)}" -o "${path.join(tmpDir, obj)}"`, { stdio: 'inherit' });
  }
  const fullNwa = path.join(tmpDir, 'Meowdoku.nwa');
  execSync(`arm-none-eabi-gcc ${baseFlags} -Wl,--relocatable -nostartfiles --specs=nano.specs -Wl,-e,main -Wl,-u,eadk_app_name -Wl,-u,eadk_app_icon -Wl,-u,eadk_api_level -Wl,--gc-sections "${path.join(tmpDir, 'main.o')}" "${path.join(tmpDir, 'gfx.o')}" "${path.join(tmpDir, 'font_data.o')}" "${path.join(tmpDir, 'xfont.o')}" "${path.join(tmpDir, 'icon.o')}" -o "${fullNwa}"`, { stdio: 'inherit' });
  execSync(`arm-none-eabi-strip --strip-unneeded "${fullNwa}" -o "${out}"`, { stdio: 'inherit' });
  console.log('Meowdoku.nwa built & stripped:', fs.statSync(out).size);
}

function buildRetroGo() {
  const out = path.join(APPS_DIR, 'RetroGo.nwa');
  if (fs.existsSync(out) && fs.statSync(out).size > 10000) {
    console.log('RetroGo.nwa ready:', fs.statSync(out).size);
    return true;
  }
  try {
    const rgDir = path.join(TEMP_NUMPLAY, 'games', 'retrogo');
    const tmpDir = path.join(ROOT, 'temp_rg');
    fs.mkdirSync(tmpDir, { recursive: true });
    execSync(`python "${path.join(rgDir, 'tools/m68ktab.py')}" "${path.join(rgDir, 'src/md/m68kops.h')}" "${path.join(tmpDir, 'm68k_tab.h')}"`, { stdio: 'inherit' });
    execSync(`python "${path.join(TEMP_NUMPLAY, 'tools/romtable.py')}" --c "${path.join(tmpDir, 'roms.c')}"`, { stdio: 'inherit' });
    execSync(`npx --yes -- nwlink@1.0.0 png-icon-o "${path.join(rgDir, 'src/icon.png')}" "${path.join(tmpDir, 'icon.o')}"`, { stdio: 'inherit' });
    const cflags = execSync('npx --yes -- nwlink@1.0.0 eadk-cflags-device').toString().trim();
    execSync(`arm-none-eabi-gcc -std=gnu11 ${cflags} -Os -c "${path.join(tmpDir, 'roms.c')}" -o "${path.join(tmpDir, 'roms.o')}"`, { stdio: 'inherit' });
    const walkC = (dir) => {
      let files = [];
      for (const f of fs.readdirSync(dir)) {
        const p = path.join(dir, f);
        if (fs.statSync(p).isDirectory()) files = files.concat(walkC(p));
        else if (f.endsWith('.c')) files.push(p);
      }
      return files;
    };
    const coreSrcs = [
      ...walkC(path.join(rgDir, 'src/gb')),
      ...walkC(path.join(rgDir, 'src/nes')),
      ...walkC(path.join(rgDir, 'src/sms')),
      ...walkC(path.join(rgDir, 'src/gw')),
      ...walkC(path.join(rgDir, 'src/md'))
    ];
    const appSrcs = ['src/main.c', 'src/romtable.c', 'src/pack.c'].map(s => path.join(rgDir, s));
    const inc = `-I "${path.join(rgDir, 'src/nes')}" -I "${tmpDir}" -I "${path.join(TEMP_NUMPLAY, 'launcher/src')}" -I "${path.join(TEMP_NUMPLAY, 'games/common')}" -I "${path.join(rgDir, 'src')}"`;
    const commonFlags = `-std=gnu11 ${cflags} ${inc} -Wno-unused-parameter -Wno-sign-compare -Wno-implicit-fallthrough -Wno-missing-field-initializers -Wno-old-style-declaration -Wno-misleading-indentation -Wno-unused-but-set-variable -Wno-maybe-uninitialized -fno-math-errno -fsingle-precision-constant -fno-tree-loop-distribute-patterns -DNDEBUG -Wno-unused-function -Wno-unused-variable -Wno-parentheses -Wno-unused-value -Wno-return-type -Wno-pointer-sign`;

    const objs = [path.join(tmpDir, 'icon.o'), path.join(tmpDir, 'roms.o')];
    for (const s of coreSrcs) {
      const o = path.join(tmpDir, path.relative(rgDir, s).replace(/[\\/]/g, '_') + '.o');
      execSync(`arm-none-eabi-gcc ${commonFlags} -O2 -c "${s}" -o "${o}"`, { stdio: 'inherit' });
      objs.push(o);
    }
    for (const s of appSrcs) {
      const o = path.join(tmpDir, path.relative(rgDir, s).replace(/[\\/]/g, '_') + '.o');
      execSync(`arm-none-eabi-gcc ${commonFlags} -Os -c "${s}" -o "${o}"`, { stdio: 'inherit' });
      objs.push(o);
    }
    for (const [rel, name] of [
      ['launcher/src/gfx.c', 'gfx.o'],
      ['launcher/src/font_data.c', 'font_data.o'],
      ['launcher/src/xfont.c', 'xfont.o']
    ]) {
      const o = path.join(tmpDir, name);
      execSync(`arm-none-eabi-gcc ${commonFlags} -Os -c "${path.join(TEMP_NUMPLAY, rel)}" -o "${o}"`, { stdio: 'inherit' });
      objs.push(o);
    }
    const objList = objs.map(o => `"${o}"`).join(' ');
    const fullNwa = path.join(tmpDir, 'RetroGo-full.nwa');
    execSync(`arm-none-eabi-gcc ${commonFlags} -Os -Wl,--relocatable -nostartfiles --specs=nano.specs -Wl,-e,main -Wl,-u,eadk_app_name -Wl,-u,eadk_app_icon -Wl,-u,eadk_api_level -Wl,--gc-sections -Wl,-T,"${path.join(rgDir, 'src/roms.ld')}" ${objList} -o "${fullNwa}"`, { stdio: 'inherit' });
    execSync(`arm-none-eabi-strip --strip-unneeded "${fullNwa}" -o "${out}"`, { stdio: 'inherit' });
    console.log('RetroGo.nwa built & stripped:', fs.statSync(out).size);
    return true;
  } catch (e) {
    console.warn('RetroGo build failed:', e.message);
    return false;
  }
}

async function main() {
  const gamesEn = JSON.parse(fs.readFileSync(path.join(TEMP_NUMPLAY, 'games/games.json'), 'utf8'));
  const kitEn = JSON.parse(fs.readFileSync(path.join(ROOT, 'temp_kit.json'), 'utf8'));
  const kitFr = JSON.parse(fs.readFileSync(path.join(ROOT, 'temp_kit_fr.json'), 'utf8'));
  const rel = JSON.parse(fs.readFileSync(path.join(ROOT, 'temp_release.json'), 'utf8'));

  const releaseAssets = rel.assets.filter(a => a.name.endsWith('.nwa') && !a.name.startsWith('NumPlay'));
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

  const kitEnMap = Object.fromEntries(kitEn.games.map(g => [g.id, g]));
  const kitFrMap = Object.fromEntries(kitFr.games.map(g => [g.id, g]));

  // 1. Build Meowdoku & RetroGo locally
  buildMeowdoku();
  buildRetroGo();

  // 2. Download all 80 rounded icons
  console.log('Downloading 80 NumPlay icons...');
  await runPool(gamesEn, 8, async (g) => {
    const dest = path.join(ICONS_DIR, `${g.id}.png`);
    const url = `https://mason363.github.io/NumPlay/customize/kit/icons/${g.id}.png`;
    try {
      await downloadFile(url, dest);
    } catch (e) {
      const localCand = [
        path.join(TEMP_NUMPLAY, 'games', g.id, 'src/icon.png'),
        path.join(TEMP_NUMPLAY, 'games', g.id, 'assets/icon.png'),
        path.join(TEMP_NUMPLAY, 'games', g.id, 'docs/icon.png')
      ].find(p => fs.existsSync(p));
      if (localCand) fs.copyFileSync(localCand, dest);
      else console.warn(`Missing icon for ${g.id}: ${e.message}`);
    }
  });
  console.log('Icons downloaded!');

  // 3. Download all release .nwa files
  const nwaJobs = [];
  for (const g of gamesEn) {
    let assetName = RELEASE_ASSET_MAP[g.id];
    let asset = assetName ? releaseAssets.find(a => a.name === assetName) : null;
    if (!asset) {
      asset = releaseAssets.find(a => norm(a.name.replace('.nwa', '')) === norm(g.title) || norm(a.name.replace('.nwa', '')) === norm(g.id));
    }
    if (asset) {
      g._nwaFile = asset.name;
      nwaJobs.push({ id: g.id, name: asset.name, url: asset.browser_download_url, dest: path.join(APPS_DIR, asset.name) });
    } else if (RELEASE_ASSET_MAP[g.id] && fs.existsSync(path.join(APPS_DIR, RELEASE_ASSET_MAP[g.id]))) {
      g._nwaFile = RELEASE_ASSET_MAP[g.id];
    } else {
      console.warn('No NWA asset for:', g.id);
    }
  }

  console.log(`Downloading ${nwaJobs.length} .nwa binaries from Mason363/NumPlay v${kitEn.version}...`);
  await runPool(nwaJobs, 6, async (job, i) => {
    const res = await downloadFile(job.url, job.dest);
    if (!res.skipped) {
      console.log(`  [${i + 1}/${nwaJobs.length}] ${job.name} (${Math.round(res.size / 1024)} KB)`);
    }
  });
  console.log('All .nwa binaries downloaded!');

  // 4. Read existing catalog.json and community_apps.json
  const oldCatalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'web/catalog.json'), 'utf8'));
  const oldComm = JSON.parse(fs.readFileSync(path.join(ROOT, 'web/community_apps.json'), 'utf8'));

  const replacedCatalogIds = new Set(Object.values(CATALOG_REPLACE_MAP).map(x => x.id));
  const replacedCommIds = new Set(Object.values(COMM_REPLACE_MAP));

  const keptCatalog = oldCatalog.filter(a => !replacedCatalogIds.has(a.id) && !String(a.id).startsWith('np_') && a.source !== 'GitHub: Mason363/NumPlay');
  const keptComm = oldComm.filter(a => !replacedCommIds.has(a.id) && !String(a.id).startsWith('comm_np_') && a.source !== 'GitHub: Mason363/NumPlay');

  // Build NumPlay entries
  const replacedCatalogEntries = [];
  const addedCatalogEntries = [];
  const numplayCommEntries = [];

  // Sort games by rank so popular NumPlay games appear near top after core EquaLib items
  const sortedGames = [...gamesEn].sort((a, b) => (a.rank || 999) - (b.rank || 999));

  for (const g of sortedGames) {
    if (!g._nwaFile) continue;
    const fr = kitFrMap[g.id] || {};
    const en = kitEnMap[g.id] || {};
    const fileStat = fs.statSync(path.join(APPS_DIR, g._nwaFile));
    const sizeKb = Math.max(1, Math.round(fileStat.size / 1024));
    const title = fr.title || g.title;
    const tagline = fr.tagline || g.tagline || '';
    const credit = fr.credit || g.credit || '';
    const color = '#' + String(g.top || '3B82F6').replace(/^0x/i, '').padStart(6, '0');
    const descBase = [tagline, credit].filter(Boolean).join(' — ');
    const fullDesc = `${descBase ? descBase + ' • ' : ''}Issu du dépôt GitHub Mason363/NumPlay (https://github.com/Mason363/NumPlay).`;
    const category = CATEGORY_MAP[g.id] || 'Jeux / Arcade';
    const iconEmoji = EMOJI_MAP[g.id] || '🎮';
    const nwaUrl = `apps/numplay/${g._nwaFile}`;
    const iconUrl = `assets/icons/numplay/${g.id}.png`;

    const replCat = CATALOG_REPLACE_MAP[g.id];
    const catObj = {
      id: replCat ? replCat.id : `np_${g.id}`,
      name: title,
      author: 'Mason363 / NumPlay (GitHub)',
      source: 'GitHub: Mason363/NumPlay',
      repo_url: 'https://github.com/Mason363/NumPlay',
      version: kitEn.version || '1.24.24',
      size_kb: sizeKb,
      category: category,
      format: 'NWA',
      download_url: nwaUrl,
      description: fullDesc,
      icon_initial: replCat ? replCat.iconEmoji : iconEmoji,
      icon_url: iconUrl,
      color: color,
      recommended: !!(replCat && g.id !== 'fnaf')
    };

    if (replCat) {
      replacedCatalogEntries.push(catObj);
    } else {
      addedCatalogEntries.push(catObj);
    }

    const commId = COMM_REPLACE_MAP[g.id] || `comm_np_${g.id}`;
    numplayCommEntries.push({
      id: commId,
      name: title,
      author: 'Mason363 / NumPlay (GitHub)',
      version: kitEn.version || '1.24.24',
      size_kb: sizeKb,
      category: category,
      format: 'NWA',
      description: fullDesc,
      icon_initial: iconEmoji,
      color: color,
      download_url: nwaUrl,
      source: 'GitHub: Mason363/NumPlay',
      repo_url: 'https://github.com/Mason363/NumPlay',
      tags: Array.from(new Set([
        g.id,
        title.toLowerCase(),
        'numplay',
        'mason363',
        'github',
        'nwa',
        category.split('/').pop().trim().toLowerCase()
      ])),
      icon_url: iconUrl
    });
  }

  // Merge catalog: kept core EquaLib apps + replaced NumPlay games + all new NumPlay games
  const finalCatalog = [...keptCatalog, ...replacedCatalogEntries, ...addedCatalogEntries];
  const finalComm = [...keptComm, ...numplayCommEntries];

  fs.writeFileSync(path.join(ROOT, 'web/catalog.json'), JSON.stringify(finalCatalog, null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(ROOT, 'web/community_apps.json'), JSON.stringify(finalComm, null, 2) + '\n', 'utf8');

  console.log(`Updated web/catalog.json: ${finalCatalog.length} entries (${replacedCatalogEntries.length} replaced, ${addedCatalogEntries.length} added, ${keptCatalog.length} kept).`);
  console.log(`Updated web/community_apps.json: ${finalComm.length} entries (${numplayCommEntries.length} NumPlay, ${keptComm.length} kept).`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

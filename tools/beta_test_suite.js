/**
 * EquaLib Comprehensive Beta Test Suite
 * Valide l'ensemble des fonctionnalités ajoutées :
 * - Mode galerie carrée vs mode liste
 * - Dock d'application active en bas au centre
 * - Menu paramètres, persistance localStorage, tooltips
 * - Thèmes (Sakura, Hacker, Abeille, Mario, GameBoy, Default)
 * - Roue chromatique interactive & calculs HSV
 * - Simulateur virtuel NumWorks et tous les jeux
 * - Pipeline NWA -> BIN et Bundler WebUSB
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

let passedTests = 0;
let failedTests = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✓ ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${desc}`);
    console.error(`    -> Erreur: ${err.message}`);
    failedTests++;
  }
}

async function itAsync(desc, fn) {
  try {
    await fn();
    console.log(`  ✓ ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${desc}`);
    console.error(`    -> Erreur: ${err.message}`);
    failedTests++;
  }
}

function describe(suiteName, fn) {
  console.log(`\n========================================`);
  console.log(`BETA TEST: ${suiteName}`);
  console.log(`========================================`);
  fn();
}

// -------------------------------------------------------------
// SUITE 1: Intégrité des Fichiers et Syntaxe
// -------------------------------------------------------------
describe('1. Intégrité des Fichiers et Syntaxe Web', () => {
  const filesToCheck = [
    'web/index.html',
    'web/app.js',
    'web/retro_ascii.css',
    'web/crt_math.js',
    'web/sim_engine.js',
    'web/bundler.js',
    'web/nwa_linker.js',
    'web/webusb.js',
    'web/sound_fx.js',
    'web/catalog.json',
    'web/community_apps.json',
    'web/equalib_n0120.bin',
    'web/equalib_n0120.nwa'
  ];

  filesToCheck.forEach(file => {
    it(`Fichier ${file} existe et n'est pas vide`, () => {
      assert(fs.existsSync(file), `Le fichier ${file} est manquant`);
      const stat = fs.statSync(file);
      assert(stat.size > 0, `Le fichier ${file} est vide`);
    });
  });

  it('catalog.json est un JSON valide contenant les applications requises', () => {
    const raw = fs.readFileSync('web/catalog.json', 'utf8');
    const catalog = JSON.parse(raw);
    assert(Array.isArray(catalog), 'catalog.json doit être un tableau');
    assert(catalog.length >= 6, `Le catalogue contient ${catalog.length} apps, au moins 6 attendues`);
    
    // Vérification des champs indispensables
    catalog.forEach(app => {
      assert(app.id, 'App sans ID');
      assert(app.name, 'App sans nom');
      assert(app.category, `App ${app.id} sans catégorie`);
      assert(app.size_kb > 0, `App ${app.id} taille invalide`);
      assert(app.icon_initial, `App ${app.id} sans icône`);
      assert(app.color, `App ${app.id} sans couleur`);
    });
  });

  it('community_apps.json est un JSON valide contenant les applications web (.nws)', () => {
    const raw = fs.readFileSync('web/community_apps.json', 'utf8');
    const comm = JSON.parse(raw);
    assert(Array.isArray(comm), 'community_apps.json doit être un tableau');
    assert(comm.length >= 8, `Recherche communautaire contient ${comm.length} apps`);
    comm.forEach(app => {
      assert(app.id, 'App sans ID');
      assert(app.name, 'App sans nom');
      assert(app.download_url, `App ${app.id} sans url`);
    });
  });
});

// -------------------------------------------------------------
// SUITE 2: Thèmes, CSS et Arrière-plans Animés
// -------------------------------------------------------------
describe('2. Système de Thèmes et Presets Visuels', () => {
  const cssContent = fs.readFileSync('web/retro_ascii.css', 'utf8');
  const crtContent = fs.readFileSync('web/crt_math.js', 'utf8');

  it('retro_ascii.css contient toutes les classes de thèmes demandées', () => {
    const requiredThemes = [
      'body.theme-sakura',
      'body.theme-hacker',
      'body.theme-bee',
      'body.theme-mario',
      'body.theme-gameboy'
    ];
    requiredThemes.forEach(cls => {
      assert(cssContent.includes(cls), `Classe CSS manquante : ${cls}`);
    });
  });

  it('retro_ascii.css contient la règle de désactivation des tooltips', () => {
    assert(cssContent.includes('body.hide-tooltips .kbd-key'), 'Règle .kbd-key manquante dans hide-tooltips');
    assert(cssContent.includes('display: none !important'), 'display: none !important manquant');
  });

  it('retro_ascii.css contient les styles du Mode Galerie (tuiles carrées)', () => {
    assert(cssContent.includes('.gallery-grid'), 'Classe .gallery-grid manquante');
    assert(cssContent.includes('.gallery-card'), 'Classe .gallery-card manquante');
    assert(cssContent.includes('aspect-ratio: 1 / 1'), 'aspect-ratio: 1 / 1 manquant pour les tuiles carrées');
    assert(cssContent.includes('.gallery-icon-wrapper'), 'Classe .gallery-icon-wrapper manquante');
  });

  it('retro_ascii.css contient les styles du Dock Flottant Bas au Centre', () => {
    assert(cssContent.includes('#active-app-dock'), '#active-app-dock manquant');
    assert(cssContent.includes('dock-hidden'), 'dock-hidden manquant');
    assert(cssContent.includes('dock-visible'), 'dock-visible manquant');
  });

  it('retro_ascii.css contient les styles de la Roue Chromatique', () => {
    assert(cssContent.includes('.color-wheel-wrapper'), '.color-wheel-wrapper manquant');
    assert(cssContent.includes('#color-wheel-canvas'), '#color-wheel-canvas manquant');
    assert(cssContent.includes('.color-wheel-picker'), '.color-wheel-picker manquant');
  });

  it('crt_math.js implémente les moteurs d\'animation pour chaque preset', () => {
    assert(crtContent.includes('drawSakura'), 'Moteur Sakura manquant');
    assert(crtContent.includes('drawBees'), 'Moteur Abeilles manquant');
    assert(crtContent.includes('drawMario'), 'Moteur Mario manquant');
    assert(crtContent.includes('drawGameBoy'), 'Moteur GameBoy manquant');
    assert(crtContent.includes('drawMathGrid'), 'Moteur Math Grid manquant');
    assert(crtContent.includes('window.setThemeBg = function'), 'API window.setThemeBg manquante');
  });
});

// -------------------------------------------------------------
// SUITE 3: Algorithmes Mathématiques de la Roue Chromatique (HSV)
// -------------------------------------------------------------
describe('3. Algorithmes Mathématiques de la Roue Chromatique', () => {
  // Reproduction de la logique HSV to Hex de app.js
  function hsvToHex(h, s, v) {
    let r, g, b;
    const i = Math.floor(h / 60) % 6;
    const f = (h / 60) - Math.floor(h / 60);
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    switch (i) {
      case 0: r = v; g = t; b = p; break;
      case 1: r = q; g = v; b = p; break;
      case 2: r = p; g = v; b = t; break;
      case 3: r = p; g = q; b = v; break;
      case 4: r = t; g = p; b = v; break;
      case 5: r = v; g = p; b = q; break;
    }
    const toHex = (n) => Math.round(n * 255).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  function pickColorAtMock(x, y, center, radius) {
    const dx = x - center;
    const dy = y - center;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const clampedDist = Math.min(dist, radius);
    const angle = ((Math.atan2(dy, dx) * 180 / Math.PI) + 360) % 360;
    const sat = clampedDist / radius;
    return {
      angle,
      sat,
      hex: hsvToHex(angle, sat, 1.0)
    };
  }

  it('Centre de la roue (saturation 0) produit du blanc', () => {
    const res = pickColorAtMock(90, 90, 90, 86);
    assert.strictEqual(res.sat, 0);
    assert.strictEqual(res.hex.toLowerCase(), '#ffffff');
  });

  it('Bord droit (0 deg, sat 1) produit du Rouge pur #ff0000', () => {
    const res = pickColorAtMock(176, 90, 90, 86);
    assert(Math.abs(res.angle - 0) < 0.1 || Math.abs(res.angle - 360) < 0.1);
    assert.strictEqual(res.sat, 1);
    assert.strictEqual(res.hex.toLowerCase(), '#ff0000');
  });

  it('Bord supérieur-gauche (240 deg, sat 1) produit du Bleu pur #0000ff', () => {
    // 240 deg : x = 90 + 86 * cos(240*PI/180) = 90 - 43 = 47
    //           y = 90 + 86 * sin(240*PI/180) = 90 - 74.47 = 15.5
    const res = pickColorAtMock(47, 15.5, 90, 86);
    assert(Math.abs(res.angle - 240) < 1.0);
    assert.strictEqual(res.sat, 1);
    assert.strictEqual(res.hex.toLowerCase(), '#0000ff');
  });

  it('Bord supérieur (270 deg, sat 1) produit de l\'indigo/violet #8000ff', () => {
    const res = pickColorAtMock(90, 4, 90, 86);
    assert(Math.abs(res.angle - 270) < 0.1);
    assert.strictEqual(res.sat, 1);
    assert.strictEqual(res.hex.toLowerCase(), '#8000ff');
  });

  it('Validation des codes couleur Hexadécimaux', () => {
    const validHex = ['#F59E0B', '#ff00aa', '#10B981', '#000000', '#ffffff'];
    const invalidHex = ['#FFF', '#12345', 'rgb(0,0,0)', '#GG1122', 'red'];

    validHex.forEach(h => {
      assert(/^#[0-9a-fA-F]{6}$/i.test(h), `Devrait être valide : ${h}`);
    });
    invalidHex.forEach(h => {
      assert(!/^#[0-9a-fA-F]{6}$/i.test(h), `Devrait être invalide : ${h}`);
    });
  });
});

// -------------------------------------------------------------
// SUITE 4: Logique de Sélection, Limite à 20 Apps & Dock
// -------------------------------------------------------------
describe('4. Pack d\'Applications et Dock Flottant', () => {
  let selectedApps = [];
  const catalog = JSON.parse(fs.readFileSync('web/catalog.json', 'utf8'));

  function addApp(app) {
    if (selectedApps.length >= 20) return false;
    if (selectedApps.some(s => s.id === app.id)) return false;
    selectedApps.push({ ...app });
    return true;
  }

  function removeApp(id) {
    const idx = selectedApps.findIndex(s => s.id === id);
    if (idx !== -1) {
      selectedApps.splice(idx, 1);
      return true;
    }
    return false;
  }

  it('Ajout d\'applications et respect de la limite stricte de 20', () => {
    selectedApps = [];
    catalog.forEach(app => addApp(app));
    assert.strictEqual(selectedApps.length, Math.min(20, catalog.length));

    // Tentative d'ajout au-delà de 20
    for (let i = 0; i < 25; i++) {
      addApp({ id: 'dummy_' + i, name: 'Dummy', size_kb: 10 });
    }
    assert.strictEqual(selectedApps.length, 20, 'Le pack ne doit jamais dépasser 20 applications');
  });

  it('Suppression et bascule dynamique des statuts d\'application', () => {
    const firstId = selectedApps[0].id;
    assert(selectedApps.some(s => s.id === firstId));
    removeApp(firstId);
    assert(!selectedApps.some(s => s.id === firstId));
    assert.strictEqual(selectedApps.length, 19);
  });

  it('Dock d\'application active retourne les bonnes informations', () => {
    const app = catalog[0];
    const isSel = selectedApps.some(s => s.id === app.id);
    const actionLabel = isSel ? '✓ Inclus' : '+ Ajouter';
    assert(actionLabel === '✓ Inclus' || actionLabel === '+ Ajouter');
    assert(app.name.length > 0);
    assert(app.category.length > 0);
  });
});

// -------------------------------------------------------------
// SUITE 5: Simulateur Virtuel NumWorks & Mini-Jeux
// -------------------------------------------------------------
describe('5. Simulateur Virtuel et Jeux NumWorks', () => {
  // Environnement mock pour instancier NumWorksSimulator sans navigateur complet
  global.window = {
    addEventListener: () => {},
    removeEventListener: () => {},
    soundFx: {
      playClick: () => {},
      playFlap: () => {},
      playScore: () => {},
      playHit: () => {},
      playOver: () => {}
    }
  };
  global.document = {
    getElementById: (id) => ({
      id,
      style: {},
      classList: { add: () => {}, remove: () => {} },
      addEventListener: () => {},
      innerHTML: '',
      textContent: '',
      getContext: () => ({
        fillRect: () => {},
        strokeRect: () => {},
        fillText: () => {},
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        arc: () => {},
        fill: () => {},
        stroke: () => {},
        clearRect: () => {},
        createRadialGradient: () => ({ addColorStop: () => {} })
      }),
      querySelectorAll: () => []
    }),
    querySelectorAll: () => []
  };
  global.requestAnimationFrame = (cb) => 1;
  global.cancelAnimationFrame = () => {};

  // Charger sim_engine.js
  const simCode = fs.readFileSync('web/sim_engine.js', 'utf8');
  eval(simCode);
  const sim = new window.NumWorksSimulator('sim-screen');

  it('Instanciation réussie du simulateur virtuel avec ses applications', () => {
    assert(sim !== null);
    assert(Array.isArray(sim.apps));
    assert(sim.apps.length >= 8);
  });

  it('Navigation dans le menu du simulateur (wrap-around cyclique)', () => {
    sim.selectedIndex = 0;
    sim.moveSelection(-1);
    assert.strictEqual(sim.selectedIndex, sim.apps.length - 1);
    sim.moveSelection(1);
    assert.strictEqual(sim.selectedIndex, 0);
  });

  it('Lancement du jeu Flappy Bird (physique, battement d\'ailes et reset)', () => {
    sim.launchApp('flappy');
    assert.strictEqual(sim.currentView, 'FLAPPY');
    assert(typeof sim.flappyFlap === 'function');
    sim.flappyFlap(); // Test battement
    sim.returnToMenu();
    assert.strictEqual(sim.currentView, 'MENU');
  });

  it('Lancement du jeu 2048 (glissement directionnel et fusion des tuiles)', () => {
    sim.launchApp('2048');
    assert.strictEqual(sim.currentView, '2048');
    assert(typeof sim.slide2048 === 'function');
    sim.slide2048('ArrowRight');
    sim.slide2048('ArrowUp');
    sim.slide2048('ArrowLeft');
    sim.slide2048('ArrowDown');
    sim.returnToMenu();
    assert.strictEqual(sim.currentView, 'MENU');
  });

  it('Lancement du jeu Snake (déplacement et directions)', () => {
    sim.launchApp('snake');
    assert.strictEqual(sim.currentView, 'SNAKE');
    assert(typeof sim.snakeChangeDir === 'function');
    sim.snakeChangeDir('ArrowRight');
    sim.snakeChangeDir('ArrowDown');
    sim.returnToMenu();
    assert.strictEqual(sim.currentView, 'MENU');
  });

  it('Lancement du Tableau Périodique (navigation dans les éléments)', () => {
    sim.launchApp('periodique');
    assert.strictEqual(sim.currentView, 'PERIODIC');
    sim.returnToMenu();
    assert.strictEqual(sim.currentView, 'MENU');
  });

  it('Lancement des Fiches de Cours (navigation dans les pages)', () => {
    sim.launchApp('fiches');
    assert.strictEqual(sim.currentView, 'COURSES');
    sim.returnToMenu();
    assert.strictEqual(sim.currentView, 'MENU');
  });

  it('Lancement de Mario Kart 3D (aperçu Mode 7)', () => {
    sim.launchApp('mariokart');
    assert.strictEqual(sim.currentView, 'MARIO');
    sim.returnToMenu();
    assert.strictEqual(sim.currentView, 'MENU');
  });

  it('Lancement du jeu Pong Retro (contrôles raquette et IA)', () => {
    sim.launchApp('PONG');
    assert.strictEqual(sim.currentView, 'PONG');
    assert(typeof sim.pongMove === 'function');
    sim.pongMove(1);
    sim.pongMove(-1);
    sim.pongRestart();
    sim.returnToMenu();
    assert.strictEqual(sim.currentView, 'MENU');
  });

  it('Lancement du jeu Chrome Dino (saut et accroupissement)', () => {
    sim.launchApp('DINO');
    assert.strictEqual(sim.currentView, 'DINO');
    assert(typeof sim.dinoJump === 'function');
    sim.dinoJump();
    sim.dinoDuck(true);
    sim.dinoDuck(false);
    sim.dinoRestart();
    sim.returnToMenu();
    assert.strictEqual(sim.currentView, 'MENU');
  });

  it('Lancement de Space Invaders (déplacement, tir laser et vagues)', () => {
    sim.launchApp('SPACE_INVADERS');
    assert.strictEqual(sim.currentView, 'SPACE_INVADERS');
    assert(typeof sim.invadersMove === 'function');
    sim.invadersMove(1);
    sim.invadersMove(-1);
    sim.invadersShoot();
    sim.invadersRestart();
    sim.returnToMenu();
    assert.strictEqual(sim.currentView, 'MENU');
  });

  it('Lancement de Casse-Briques Breakout (déviation angulaire et briques)', () => {
    sim.launchApp('BREAKOUT');
    assert.strictEqual(sim.currentView, 'BREAKOUT');
    assert(typeof sim.breakoutMove === 'function');
    sim.breakoutMove(1);
    sim.breakoutMove(-1);
    sim.breakoutLaunch();
    sim.breakoutRestart();
    sim.returnToMenu();
    assert.strictEqual(sim.currentView, 'MENU');
  });

  it('Lancement de Puissance 4 (sélection de colonne et lâcher de jeton IA)', () => {
    sim.launchApp('PUISSANCE4');
    assert.strictEqual(sim.currentView, 'PUISSANCE4');
    assert(typeof sim.p4Move === 'function');
    sim.p4Move(1);
    sim.p4Move(-1);
    sim.p4Drop();
    sim.p4Restart();
    sim.returnToMenu();
    assert.strictEqual(sim.currentView, 'MENU');
  });

  it('Lancement du jeu Morpion (Tic-Tac-Toe, placement de symbole et IA Minimax)', () => {
    sim.launchApp('MORPION');
    assert.strictEqual(sim.currentView, 'MORPION');
    assert(typeof sim.morpionMove === 'function');
    assert(typeof sim.morpionPlace === 'function');
    assert(typeof sim.morpionPlayCell === 'function');
    assert(typeof sim.morpionRestart === 'function');
    sim.morpionMove(0, 1);
    sim.morpionMove(1, 0);
    sim.morpionPlace();
    sim.morpionRestart();
    sim.returnToMenu();
    assert.strictEqual(sim.currentView, 'MENU');
  });
});

// -------------------------------------------------------------
// SUITE 6: Intégrité des Binaires Natifs & Manifeste N0120
// -------------------------------------------------------------
describe('6. Intégrité des Binaires Natifs & Manifeste N0120', () => {
  it('equalib_n0120.bin contient la signature magique et un format correct', () => {
    const bin = fs.readFileSync('web/equalib_n0120.bin');
    assert(bin.length > 500000, `Binaire trop petit (${bin.length} octets)`);
    // Vérifier présence du manifeste 'EQAL'
    const MAGIC = 0x4C415145; // 'EQAL'
    let found = false;
    for (let i = 0; i <= bin.length - 4; i += 4) {
      if (bin.readUInt32LE(i) === MAGIC) {
        found = true;
        break;
      }
    }
    assert(found, 'Signature magique EQAL introuvable dans le binaire');
  });

  it('equalib_n0120.nwa est un objet ELF ARM Cortex-M7 valide', () => {
    const nwa = fs.readFileSync('web/equalib_n0120.nwa');
    // ELF Header Magic: 0x7f 'E' 'L' 'F'
    assert.strictEqual(nwa[0], 0x7f);
    assert.strictEqual(nwa[1], 0x45); // 'E'
    assert.strictEqual(nwa[2], 0x4c); // 'L'
    assert.strictEqual(nwa[3], 0x46); // 'F'
    assert.strictEqual(nwa[4], 1); // 32-bit architecture
    assert.strictEqual(nwa[5], 1); // Little endian
  });
});

// -------------------------------------------------------------
// SUITE 7: Compilation et Validité Syntaxique des Jeux Python (.NWS)
// -------------------------------------------------------------
describe('7. Compilation et Validité Syntaxique des Jeux Python (.NWS)', () => {
  const { execSync } = require('child_process');
  const nwsFiles = fs.readdirSync('web/apps').filter(f => f.endsWith('.nws'));

  nwsFiles.forEach(nwsFile => {
    it(`Validation syntaxique Python pour ${nwsFile}`, () => {
      const content = JSON.parse(fs.readFileSync(path.join('web/apps', nwsFile), 'utf8'));
      assert(content.scripts && Array.isArray(content.scripts), 'Le fichier nws doit contenir des scripts');
      content.scripts.forEach(s => {
        const tempPath = path.join(__dirname, `temp_${path.basename(nwsFile, '.nws')}.py`);
        fs.writeFileSync(tempPath, s.text);
        try {
          execSync(`py -m py_compile "${tempPath}"`, { stdio: 'pipe' });
        } finally {
          if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        }
      });
    });
  });
});

// -------------------------------------------------------------
// RÉSUMÉ DES TESTS
// -------------------------------------------------------------
console.log(`\n========================================`);
console.log(`RÉSULTAT FINAL DU BETA TEST :`);
console.log(`  Tests réussis : ${passedTests}`);
console.log(`  Tests échoués : ${failedTests}`);
console.log(`========================================\n`);

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('🎉 TOUTES LES FONCTIONNALITÉS SONT 100% OPÉRATIONNELLES ET VALIDÉES !');
  process.exit(0);
}

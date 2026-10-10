/**
 * EquaLib Interactive Virtual NumWorks Simulator
 * Moteur de simulation en direct des jeux et applications pour le web
 */
function safeStorageGet(key, def = null) {
  try {
    if (typeof localStorage !== 'undefined') {
      const v = localStorage.getItem(key);
      return v !== null ? v : def;
    }
  } catch (_) {}
  return def;
}

function safeStorageSet(key, val) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, val);
    }
  } catch (_) {}
}

class NumWorksSimulator {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.screen = document.getElementById('sim-screen');
    this.topbar = document.getElementById('sim-topbar');
    this.title = document.getElementById('sim-title');
    this.led = document.getElementById('sim-led');
    this.content = document.getElementById('sim-content');

    this.selectedIndex = 0;
    this.currentView = 'MENU';
    window.simulator = this;

    this.apps = [
      { id: 'mariokart', name: '1. Mario Kart', cat: 'Arcade', type: 'MARIO', icon: '🏎️' },
      { id: 'periodique', name: '2. Tableau Périodique', cat: 'Chimie', type: 'PERIODIC', icon: '🧪' },
      { id: 'fiches', name: '3. Fiches de Cours', cat: 'Révision', type: 'COURSES', icon: '📚' },
      { id: 'flappy', name: '4. Flappy Bird', cat: 'Arcade', type: 'FLAPPY', icon: '🐦' },
      { id: '2048', name: '5. 2048 Ultimate', cat: 'Arcade', type: '2048', icon: '🔢' },
      { id: 'snake', name: '6. Snake Classic', cat: 'Arcade', type: 'SNAKE', icon: '🐍' },
      { id: 'pong', name: '7. Pong Retro', cat: 'Arcade', type: 'PONG', icon: '🏓' },
      { id: 'dino', name: '8. Chrome Dino', cat: 'Arcade', type: 'DINO', icon: '🦖' },
      { id: 'space_invaders', name: '9. Space Invaders', cat: 'Arcade', type: 'SPACE_INVADERS', icon: '👾' },
      { id: 'breakout', name: '10. Casse-Briques', cat: 'Arcade', type: 'BREAKOUT', icon: '🧱' },
      { id: 'puissance4', name: '11. Puissance 4', cat: 'Arcade', type: 'PUISSANCE4', icon: '🟡' },
      { id: 'settings', name: '12. Paramètres & Thèmes', cat: 'Options', type: 'SETTINGS', icon: '⚙️' }
    ];

    let savedSettings = null;
    try {
      const raw = safeStorageGet('equalib_user_settings');
      if (raw) savedSettings = JSON.parse(raw);
    } catch (_) {}

    this.displayMode = (savedSettings && savedSettings.displayMode) || (window.userSettings && window.userSettings.displayMode) || 'gallery';
    this.theme = (savedSettings && savedSettings.theme) || safeStorageGet('equalib_theme') || (window.userSettings && window.userSettings.theme) || 'default';
    this.showTooltips = (savedSettings && savedSettings.showTooltips !== undefined) ? savedSettings.showTooltips : ((window.userSettings && window.userSettings.showTooltips !== undefined) ? window.userSettings.showTooltips : true);
    this.settingsSubIndex = 0;

    this.gameLoopId = null;
    this.init();
  }

  saveCurrentSettings() {
    try {
      const cfg = {
        displayMode: this.displayMode,
        theme: this.theme,
        showTooltips: this.showTooltips
      };
      safeStorageSet('equalib_user_settings', JSON.stringify(cfg));
      safeStorageSet('equalib_theme', this.theme);
      if (window.userSettings) {
        window.userSettings.displayMode = this.displayMode;
        window.userSettings.theme = this.theme;
        window.userSettings.showTooltips = this.showTooltips;
      }
    } catch (_) {}
  }

  init() {
    this.renderMenu();
    this.bindControls();
    this.bindTouchGestures();
  }

  bindTouchGestures() {
    let startX = 0;
    let startY = 0;
    let isMouseDown = false;
    if (!this.content) return;

    this.content.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches[0]) {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
      }
    }, { passive: true });

    this.content.addEventListener('touchend', (e) => {
      if (!e.changedTouches || !e.changedTouches[0]) return;
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      this.triggerSwipe(dx, dy);
    }, { passive: true });

    this.content.addEventListener('mousedown', (e) => {
      isMouseDown = true;
      startX = e.clientX;
      startY = e.clientY;
    });

    this.content.addEventListener('mouseup', (e) => {
      if (!isMouseDown) return;
      isMouseDown = false;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      this.triggerSwipe(dx, dy);
    });
  }

  triggerSwipe(dx, dy) {
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (Math.max(absX, absY) > 20) {
      if (absX > absY) {
        if (dx > 0) this.handleInput('RIGHT');
        else this.handleInput('LEFT');
      } else {
        if (dy > 0) this.handleInput('DOWN');
        else this.handleInput('UP');
      }
    }
  }

  bindControls() {
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
      const keyL = (e.key || '').toLowerCase();

      if (this.currentView === 'MENU') {
        if (e.key === 'ArrowUp' || keyL === 'z' || keyL === 'w') { e.preventDefault(); this.handleInput('UP'); }
        else if (e.key === 'ArrowDown' || keyL === 's') { e.preventDefault(); this.handleInput('DOWN'); }
        else if (e.key === 'ArrowLeft' || keyL === 'q' || keyL === 'a') { e.preventDefault(); this.handleInput('LEFT'); }
        else if (e.key === 'ArrowRight' || keyL === 'd') { e.preventDefault(); this.handleInput('RIGHT'); }
        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.launchSelected(); }
        else if (keyL === 't' || keyL === 'p') { e.preventDefault(); this.launchApp('SETTINGS'); }
      } else if (this.currentView === 'SETTINGS') {
        if (e.key === 'ArrowUp' || keyL === 'z' || keyL === 'w') { e.preventDefault(); this.settingsMove(-1); }
        else if (e.key === 'ArrowDown' || keyL === 's') { e.preventDefault(); this.settingsMove(1); }
        else if (e.key === 'ArrowLeft' || keyL === 'q' || keyL === 'a') { e.preventDefault(); this.settingsChange(-1); }
        else if (e.key === 'ArrowRight' || keyL === 'd') { e.preventDefault(); this.settingsChange(1); }
        else if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape' || e.key === 'Backspace') {
          e.preventDefault();
          this.returnToMenu();
        }
      } else if (this.currentView === 'FLAPPY') {
        if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'Enter' || keyL === 'z' || keyL === 'w') {
          e.preventDefault();
          this.flappyFlap();
        } else if (e.key === 'Escape' || e.key === 'Backspace') {
          e.preventDefault();
          this.returnToMenu();
        }
      } else if (this.currentView === 'SNAKE') {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) || ['z','s','q','d','w','a'].includes(keyL)) {
          e.preventDefault();
          let dir = e.key;
          if (keyL === 'z' || keyL === 'w') dir = 'ArrowUp';
          else if (keyL === 's') dir = 'ArrowDown';
          else if (keyL === 'q' || keyL === 'a') dir = 'ArrowLeft';
          else if (keyL === 'd') dir = 'ArrowRight';
          this.snakeChangeDir(dir);
        } else if (e.key === 'Escape' || e.key === 'Backspace') {
          e.preventDefault();
          this.returnToMenu();
        }
      } else if (this.currentView === '2048') {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', '8', '2', '4', '6'].includes(e.key) || ['z','s','q','d','w','a'].includes(keyL)) {
          e.preventDefault();
          let dir = 'UP';
          if (e.key === 'ArrowUp' || e.key === '8' || keyL === 'z' || keyL === 'w') dir = 'UP';
          else if (e.key === 'ArrowDown' || e.key === '2' || keyL === 's') dir = 'DOWN';
          else if (e.key === 'ArrowLeft' || e.key === '4' || keyL === 'q' || keyL === 'a') dir = 'LEFT';
          else if (e.key === 'ArrowRight' || e.key === '6' || keyL === 'd') dir = 'RIGHT';
          this.slide2048(dir);
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.restart2048?.();
        } else if (e.key === 'Escape' || e.key === 'Backspace') {
          e.preventDefault();
          this.returnToMenu();
        }
      } else if (this.currentView === 'PONG') {
        if (e.key === 'ArrowUp' || keyL === 'z' || keyL === 'w' || e.key === '8') { e.preventDefault(); this.pongMove(-1); }
        else if (e.key === 'ArrowDown' || keyL === 's' || e.key === '2') { e.preventDefault(); this.pongMove(1); }
        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.pongRestart?.(); }
        else if (e.key === 'Escape' || e.key === 'Backspace') { e.preventDefault(); this.returnToMenu(); }
      } else if (this.currentView === 'DINO') {
        if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === '8' || keyL === 'z' || keyL === 'w') { e.preventDefault(); this.dinoJump?.(); }
        else if (e.key === 'ArrowDown' || e.key === '2' || keyL === 's') { e.preventDefault(); this.dinoDuck?.(true); }
        else if (e.key === 'Escape' || e.key === 'Backspace') { e.preventDefault(); this.returnToMenu(); }
      } else if (this.currentView === 'SPACE_INVADERS') {
        if (e.key === 'ArrowLeft' || e.key === '4' || keyL === 'q' || keyL === 'a') { e.preventDefault(); this.invadersMove?.(-1); }
        else if (e.key === 'ArrowRight' || e.key === '6' || keyL === 'd') { e.preventDefault(); this.invadersMove?.(1); }
        else if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowUp' || keyL === 'z' || keyL === 'w') { e.preventDefault(); this.invadersShoot?.(); }
        else if (e.key === 'Escape' || e.key === 'Backspace') { e.preventDefault(); this.returnToMenu(); }
      } else if (this.currentView === 'BREAKOUT') {
        if (e.key === 'ArrowLeft' || e.key === '4' || keyL === 'q' || keyL === 'a') { e.preventDefault(); this.breakoutMove?.(-1); }
        else if (e.key === 'ArrowRight' || e.key === '6' || keyL === 'd') { e.preventDefault(); this.breakoutMove?.(1); }
        else if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowUp' || keyL === 'z' || keyL === 'w') { e.preventDefault(); this.breakoutLaunch?.(); }
        else if (e.key === 'Escape' || e.key === 'Backspace') { e.preventDefault(); this.returnToMenu(); }
      } else if (this.currentView === 'PUISSANCE4') {
        if (['1', '2', '3', '4', '5', '6', '7'].includes(e.key)) {
          e.preventDefault();
          this.p4DropCol?.(parseInt(e.key, 10) - 1);
        } else if (e.key === 'ArrowLeft' || keyL === 'q' || keyL === 'a') { e.preventDefault(); this.p4Move?.(-1); }
        else if (e.key === 'ArrowRight' || keyL === 'd') { e.preventDefault(); this.p4Move?.(1); }
        else if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowDown' || keyL === 's') { e.preventDefault(); this.p4Drop?.(); }
        else if (e.key === 'Escape' || e.key === 'Backspace') { e.preventDefault(); this.returnToMenu(); }
      } else if (this.currentView === 'COURSES') {
        if (e.key === 'ArrowRight' || keyL === 'd') { e.preventDefault(); this.nextCoursePage(1); }
        else if (e.key === 'ArrowLeft' || keyL === 'q' || keyL === 'a') { e.preventDefault(); this.nextCoursePage(-1); }
        else if (e.key === 'Escape' || e.key === 'Backspace') { e.preventDefault(); this.returnToMenu(); }
      } else {
        if (e.key === 'Escape' || e.key === 'Backspace') {
          e.preventDefault();
          this.returnToMenu();
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      const keyL = (e.key || '').toLowerCase();
      if (this.currentView === 'DINO' && (e.key === 'ArrowDown' || e.key === '2' || keyL === 's')) {
        this.dinoDuck?.(false);
      }
    });

    const dpadUp = document.getElementById('sim-dpad-up');
    const dpadDown = document.getElementById('sim-dpad-down');
    const dpadLeft = document.getElementById('sim-dpad-left');
    const dpadRight = document.getElementById('sim-dpad-right');
    const dpadOk = document.getElementById('sim-dpad-ok');
    const dpadBack = document.getElementById('sim-dpad-back');

    if (dpadUp) dpadUp.addEventListener('click', () => { window.soundFx?.playClick(); this.handleInput('UP'); });
    if (dpadDown) dpadDown.addEventListener('click', () => { window.soundFx?.playClick(); this.handleInput('DOWN'); });
    if (dpadLeft) dpadLeft.addEventListener('click', () => { window.soundFx?.playClick(); this.handleInput('LEFT'); });
    if (dpadRight) dpadRight.addEventListener('click', () => { window.soundFx?.playClick(); this.handleInput('RIGHT'); });
    if (dpadOk) dpadOk.addEventListener('click', () => { window.soundFx?.playClick(); this.handleInput('OK'); });
    if (dpadBack) dpadBack.addEventListener('click', () => { window.soundFx?.playClick(); this.handleInput('BACK'); });
  }

  getPalette() {
    const THEME_PALETTES = {
      default: { topbar: '#FFBB00', bg: '#f8fafc', card: '#ffffff', cardSel: '#fef3c7', border: '#f59e0b', text: '#0f172a', badge: '⚡ NumWorks', descText: '#64748b' },
      sakura: { topbar: '#f472b6', bg: '#fff1f2', card: '#ffffff', cardSel: '#fce7f3', border: '#ec4899', text: '#831843', badge: '🌸 Sakura', descText: '#9d174d' },
      hacker: { topbar: '#030712', bg: '#060d17', card: '#0f172a', cardSel: '#1e293b', border: '#38bdf8', text: '#e0f2fe', badge: '💻 Hacker', descText: '#7dd3fc' },
      bee: { topbar: '#fbbf24', bg: '#18181b', card: '#27272a', cardSel: '#3f3f46', border: '#facc15', text: '#fef08a', badge: '🐝 Abeille', descText: '#fde047' },
      mario: { topbar: '#ef4444', bg: '#fef2f2', card: '#ffffff', cardSel: '#fee2e2', border: '#dc2626', text: '#991b1b', badge: '🍄 Mario', descText: '#b91c1c' },
      gameboy: { topbar: '#8bac0f', bg: '#0f380f', card: '#1f481f', cardSel: '#306230', border: '#9bbc0f', text: '#e0f8d0', badge: '🕹️ GameBoy', descText: '#8bac0f' }
    };
    return THEME_PALETTES[this.theme] || THEME_PALETTES.default;
  }

  setSimulatorTheme(theme) {
    this.theme = theme || 'default';
    if (this.currentView === 'MENU') this.renderMenu();
    else if (this.currentView === 'SETTINGS') this.startSettingsScreen();
  }

  setSimulatorDisplayMode(mode) {
    this.displayMode = mode || 'gallery';
    if (this.currentView === 'MENU') this.renderMenu();
    else if (this.currentView === 'SETTINGS') this.startSettingsScreen();
  }

  setSimulatorTooltips(show) {
    this.showTooltips = show;
    if (this.currentView === 'MENU') this.renderMenu();
  }

  handleInput(action) {
    if (this.currentView === 'MENU') {
      if (this.displayMode === 'gallery') {
        if (action === 'UP') this.moveSelection(-3);
        else if (action === 'DOWN') this.moveSelection(3);
        else if (action === 'LEFT') this.moveSelection(-1);
        else if (action === 'RIGHT') this.moveSelection(1);
        else if (action === 'OK') this.launchSelected();
      } else {
        if (action === 'UP') this.moveSelection(-1);
        else if (action === 'DOWN') this.moveSelection(1);
        else if (action === 'LEFT' || action === 'RIGHT') {
          this.displayMode = (this.displayMode === 'gallery' ? 'list' : 'gallery');
          this.renderMenu();
        }
        else if (action === 'OK') this.launchSelected();
      }
    } else if (this.currentView === 'SETTINGS') {
      if (action === 'UP') this.settingsMove(-1);
      else if (action === 'DOWN') this.settingsMove(1);
      else if (action === 'LEFT') this.settingsChange(-1);
      else if (action === 'RIGHT') this.settingsChange(1);
      else if (action === 'OK' || action === 'BACK') this.returnToMenu();
    } else if (this.currentView === 'FLAPPY') {
      if (action === 'OK' || action === 'UP') this.flappyFlap();
      else if (action === 'BACK') this.returnToMenu();
    } else if (this.currentView === 'SNAKE') {
      if (action === 'UP') this.snakeChangeDir('ArrowUp');
      else if (action === 'DOWN') this.snakeChangeDir('ArrowDown');
      else if (action === 'LEFT') this.snakeChangeDir('ArrowLeft');
      else if (action === 'RIGHT') this.snakeChangeDir('ArrowRight');
      else if (action === 'BACK') this.returnToMenu();
    } else if (this.currentView === '2048') {
      if (action === 'UP') this.slide2048('UP');
      else if (action === 'DOWN') this.slide2048('DOWN');
      else if (action === 'LEFT') this.slide2048('LEFT');
      else if (action === 'RIGHT') this.slide2048('RIGHT');
      else if (action === 'OK') this.restart2048?.();
      else if (action === 'BACK') this.returnToMenu();
    } else if (this.currentView === 'PONG') {
      if (action === 'UP') this.pongMove(-1);
      else if (action === 'DOWN') this.pongMove(1);
      else if (action === 'OK') this.pongRestart?.();
      else if (action === 'BACK') this.returnToMenu();
    } else if (this.currentView === 'DINO') {
      if (action === 'OK' || action === 'UP') this.dinoJump?.();
      else if (action === 'DOWN') { this.dinoDuck?.(true); setTimeout(() => this.dinoDuck?.(false), 300); }
      else if (action === 'BACK') this.returnToMenu();
    } else if (this.currentView === 'SPACE_INVADERS') {
      if (action === 'LEFT') this.invadersMove?.(-1);
      else if (action === 'RIGHT') this.invadersMove?.(1);
      else if (action === 'OK' || action === 'UP') this.invadersShoot?.();
      else if (action === 'BACK') this.returnToMenu();
    } else if (this.currentView === 'BREAKOUT') {
      if (action === 'LEFT') this.breakoutMove?.(-1);
      else if (action === 'RIGHT') this.breakoutMove?.(1);
      else if (action === 'OK' || action === 'UP') this.breakoutLaunch?.();
      else if (action === 'BACK') this.returnToMenu();
    } else if (this.currentView === 'PUISSANCE4') {
      if (action === 'LEFT') this.p4Move?.(-1);
      else if (action === 'RIGHT') this.p4Move?.(1);
      else if (action === 'OK' || action === 'DOWN') this.p4Drop?.();
      else if (action === 'BACK') this.returnToMenu();
    } else if (this.currentView === 'COURSES') {
      if (action === 'RIGHT') this.nextCoursePage(1);
      else if (action === 'LEFT') this.nextCoursePage(-1);
      else if (action === 'BACK') this.returnToMenu();
    } else {
      if (action === 'BACK') this.returnToMenu();
    }
  }

  moveSelection(dir) {
    window.soundFx?.playClick();
    this.selectedIndex = (this.selectedIndex + dir + this.apps.length) % this.apps.length;
    this.renderMenu();
  }

  launchSelected() {
    window.soundFx?.playClick();
    const app = this.apps[this.selectedIndex];
    this.launchApp(app.type || app.id);
  }

  launchApp(type) {
    if (this.gameLoopId) {
      cancelAnimationFrame(this.gameLoopId);
      this.gameLoopId = null;
    }

    const t = (type || '').toString().toUpperCase();
    if (t === 'SETTINGS' || t.includes('SETTING') || t.includes('PARAM')) {
      this.startSettingsScreen();
    } else if (t === 'FLAPPY' || t.includes('FLAPPY')) {
      this.currentView = 'FLAPPY';
      this.startFlappyGame();
    } else if (t === '2048' || t.includes('2048')) {
      this.currentView = '2048';
      this.start2048Game();
    } else if (t === 'SNAKE' || t.includes('SNAKE')) {
      this.currentView = 'SNAKE';
      this.startSnakeGame();
    } else if (t === 'PONG' || t.includes('PONG')) {
      this.currentView = 'PONG';
      this.startPongGame();
    } else if (t === 'DINO' || t.includes('DINO')) {
      this.currentView = 'DINO';
      this.startDinoGame();
    } else if (t === 'SPACE_INVADERS' || t.includes('SPACE') || t.includes('INVADER')) {
      this.currentView = 'SPACE_INVADERS';
      this.startSpaceInvadersGame();
    } else if (t === 'BREAKOUT' || t.includes('BREAKOUT') || t.includes('BRIQUE')) {
      this.currentView = 'BREAKOUT';
      this.startBreakoutGame();
    } else if (t === 'PUISSANCE4' || t.includes('PUISSANCE') || t.includes('CONNECT4')) {
      this.currentView = 'PUISSANCE4';
      this.startPuissance4Game();
    } else if (t === 'COURSES' || t.includes('FICHE') || t.includes('COURS')) {
      this.currentView = 'COURSES';
      this.startCoursesViewer();
    } else if (t === 'PERIODIC' || t.includes('PERIOD') || t.includes('TABLEAU')) {
      this.currentView = 'PERIODIC';
      this.startPeriodicViewer();
    } else if (t === 'MARIO' || t.includes('MARIO') || t.includes('KART')) {
      this.currentView = 'MARIO';
      this.startMarioKartPreview();
    } else {
      this.currentView = type;
      this.startGenericPreview(type);
    }
  }

  startSettingsScreen() {
    this.currentView = 'SETTINGS';
    const pal = this.getPalette();
    this.topbar.style.backgroundColor = pal.topbar;
    this.title.textContent = 'Paramètres & Thèmes EquaLib';
    this.screen.style.backgroundColor = pal.bg;
    this.content.style.backgroundColor = pal.bg;

    const themeLabels = {
      default: '⚡ NumWorks (Jaune)',
      sakura: '🌸 Sakura (Rose)',
      hacker: '💻 Hacker (Cyber Cyan)',
      bee: '🐝 Abeille (Jaune/Noir)',
      mario: '🍄 Mario (Rouge/Blanc)',
      gameboy: '🕹️ GameBoy (8-Bit Vert)'
    };

    let html = `
      <div class="space-y-1.5 p-1 text-[10px]" style="background-color: ${pal.bg}; color: ${pal.text};">
        <div class="p-1 rounded border ${this.settingsSubIndex === 0 ? 'ring-1' : ''}" style="background-color: ${this.settingsSubIndex === 0 ? pal.cardSel : pal.card}; border-color: ${this.settingsSubIndex === 0 ? pal.border : 'rgba(0,0,0,0.1)'};">
          <div class="flex justify-between font-bold">
            <span>Mode d'Affichage :</span>
            <span style="color: ${pal.border}">◀ ${this.displayMode === 'gallery' ? 'GALERIE' : 'LISTE'} ▶</span>
          </div>
          <div class="text-[8px] text-slate-400">Tuiles carrées ou cartes horizontales</div>
        </div>

        <div class="p-1 rounded border ${this.settingsSubIndex === 1 ? 'ring-1' : ''}" style="background-color: ${this.settingsSubIndex === 1 ? pal.cardSel : pal.card}; border-color: ${this.settingsSubIndex === 1 ? pal.border : 'rgba(0,0,0,0.1)'};">
          <div class="flex justify-between font-bold">
            <span>Raccourcis / Tooltips :</span>
            <span style="color: ${pal.border}">◀ ${this.showTooltips ? 'ACTIVÉS' : 'MASQUÉS'} ▶</span>
          </div>
          <div class="text-[8px] text-slate-400">Légendes et touches d'aide</div>
        </div>

        <div class="p-1 rounded border ${this.settingsSubIndex === 2 ? 'ring-1' : ''}" style="background-color: ${this.settingsSubIndex === 2 ? pal.cardSel : pal.card}; border-color: ${this.settingsSubIndex === 2 ? pal.border : 'rgba(0,0,0,0.1)'};">
          <div class="font-bold">Thème Visuel :</div>
          <div class="font-extrabold text-[9px] mt-0.5" style="color: ${pal.border}">◀ ${themeLabels[this.theme] || this.theme} ▶</div>
        </div>

        <div class="p-1 rounded border text-center font-bold cursor-pointer ${this.settingsSubIndex === 3 ? 'ring-1' : ''}" id="sim-settings-back" style="background-color: ${this.settingsSubIndex === 3 ? pal.cardSel : pal.card}; border-color: ${this.settingsSubIndex === 3 ? pal.border : 'rgba(0,0,0,0.1)'}; color: ${pal.border};">
          [ OK / Back : Revenir au Hub ]
        </div>
      </div>
      <div class="text-[8px] text-center text-slate-500 pt-0.5">▲▼: Choisir | ◀▶: Modifier | OK: Valider</div>
    `;

    this.content.innerHTML = html;

    const backBtn = document.getElementById('sim-settings-back');
    if (backBtn) backBtn.addEventListener('click', () => this.returnToMenu());
  }

  settingsMove(dir) {
    window.soundFx?.playClick();
    this.settingsSubIndex = (this.settingsSubIndex + dir + 4) % 4;
    this.startSettingsScreen();
  }

  settingsChange(dir) {
    window.soundFx?.playClick();
    if (this.settingsSubIndex === 0) {
      this.displayMode = (this.displayMode === 'gallery') ? 'list' : 'gallery';
      if (typeof window.setDisplayMode === 'function') {
        window.setDisplayMode(this.displayMode);
      }
    } else if (this.settingsSubIndex === 1) {
      this.showTooltips = !this.showTooltips;
      if (window.userSettings) {
        window.userSettings.showTooltips = this.showTooltips;
      }
      document.body.classList.toggle('hide-tooltips', !this.showTooltips);
      const settingToggle = document.getElementById('setting-tooltips-toggle');
      if (settingToggle) settingToggle.checked = this.showTooltips;
    } else if (this.settingsSubIndex === 2) {
      const themesList = ['default', 'sakura', 'hacker', 'bee', 'mario', 'gameboy'];
      let curIdx = themesList.indexOf(this.theme);
      if (curIdx === -1) curIdx = 0;
      const nextIdx = (curIdx + dir + themesList.length) % themesList.length;
      this.theme = themesList[nextIdx];
      if (typeof window.setAppTheme === 'function') {
        window.setAppTheme(this.theme);
      } else if (typeof window.setThemeBg === 'function') {
        window.setThemeBg(this.theme);
      }
    }
    this.saveCurrentSettings();
    if (typeof window.saveUserSettings === 'function') {
      window.saveUserSettings();
    }
    this.startSettingsScreen();
  }

  returnToMenu() {
    window.soundFx?.playClick();
    if (this.gameLoopId) {
      cancelAnimationFrame(this.gameLoopId);
      this.gameLoopId = null;
    }
    this.currentView = 'MENU';
    this.renderMenu();
  }

  renderMenu() {
    const pal = this.getPalette();
    this.topbar.style.backgroundColor = pal.topbar;
    this.title.textContent = `EquaLib Hub ${this.displayMode === 'gallery' ? '[Galerie]' : '[Liste]'}`;
    this.screen.style.backgroundColor = pal.bg;
    this.content.style.backgroundColor = pal.bg;

    if (!this.apps || this.apps.length === 0) {
      this.apps = [
        { id: 'mariokart', name: '1. Mario Kart', cat: 'Arcade', type: 'MARIO', icon: '🏎️' },
        { id: 'periodique', name: '2. Tableau Périodique', cat: 'Chimie', type: 'PERIODIC', icon: '🧪' },
        { id: 'fiches', name: '3. Fiches de Cours', cat: 'Révision', type: 'COURSES', icon: '📚' },
        { id: 'flappy', name: '4. Flappy Bird', cat: 'Arcade', type: 'FLAPPY', icon: '🐦' },
        { id: '2048', name: '5. 2048 Ultimate', cat: 'Arcade', type: '2048', icon: '🔢' },
        { id: 'snake', name: '6. Snake Classic', cat: 'Arcade', type: 'SNAKE', icon: '🐍' }
      ];
    }
    if (this.selectedIndex < 0) this.selectedIndex = 0;
    if (this.selectedIndex >= this.apps.length) this.selectedIndex = Math.max(0, this.apps.length - 1);

    const selApp = this.apps[this.selectedIndex] || this.apps[0];
    let html = '';

    if (this.displayMode === 'gallery') {
      const page = Math.floor(this.selectedIndex / 6);
      const pageStart = page * 6;
      const visibleApps = this.apps.slice(pageStart, pageStart + 6);

      html += `<div class="grid grid-cols-3 gap-1 mb-0.5">`;
      visibleApps.forEach((app, relIdx) => {
        const absIdx = pageStart + relIdx;
        const isSel = (absIdx === this.selectedIndex);
        html += `
          <div class="sim-item sim-gallery-card cursor-pointer p-0.5 rounded-lg border text-center flex flex-col items-center justify-between transition-all select-none"
            data-index="${absIdx}"
            style="background-color: ${isSel ? pal.cardSel : pal.card}; border-color: ${isSel ? pal.border : 'rgba(0,0,0,0.1)'}; ${isSel ? 'box-shadow: 0 0 6px ' + pal.border + '66; transform: scale(1.02);' : ''} height: 44px;">
            <span class="text-sm leading-none mt-0.5">${app.icon}</span>
            <span class="text-[8px] font-bold truncate max-w-full leading-tight mb-0.5" style="color: ${isSel ? pal.border : pal.text}">${app.name.replace(/^[0-9]+\.\s*/, '')}</span>
          </div>
        `;
      });
      html += `</div>`;

      html += `
        <div class="flex justify-between items-center text-[7px] px-1 py-0.5" style="color: ${pal.descText}">
          <span>Page ${page + 1}/${Math.ceil(this.apps.length / 6)}</span>
          <span>${pal.badge}</span>
        </div>
      `;
    } else {
      html += `<div class="space-y-1 overflow-y-auto max-h-[105px] pr-1">`;
      this.apps.forEach((app, idx) => {
        const isSel = idx === this.selectedIndex;
        html += `
          <div class="sim-item cursor-pointer p-1 rounded ${
            isSel 
              ? 'font-bold shadow-sm' 
              : 'hover:opacity-80'
          } text-[9px] flex justify-between items-center transition-all border"
            data-index="${idx}"
            style="background-color: ${isSel ? pal.cardSel : pal.card}; border-color: ${isSel ? pal.border : 'rgba(0,0,0,0.1)'};">
            <span class="truncate flex items-center gap-1" style="color: ${isSel ? pal.border : pal.text}">
              <span>${app.icon}</span> ${app.name}
            </span>
            <span class="text-[8px] shrink-0 ml-1 font-mono" style="color: ${pal.descText}">${app.cat}</span>
          </div>
        `;
      });
      html += `</div>`;
    }

    /* BANDEAU EN BAS AU CENTRE : APPLI ACTIVE */
    html += `
      <div class="sim-bottom-dock p-1 rounded-md border shadow-sm flex items-center justify-between text-[9px] select-none transition-all mt-0.5"
        style="background-color: ${pal.card}; border-color: ${pal.border};">
        <div class="flex items-center gap-1 min-w-0">
          <span class="text-xs shrink-0">${selApp.icon || '📦'}</span>
          <span class="font-extrabold truncate" style="color: ${pal.text}">${selApp.name}</span>
        </div>
        <span class="text-[8px] px-1 py-0.2 rounded font-mono font-bold shrink-0 ml-1 border"
          style="background-color: ${pal.border}22; color: ${pal.border}; border-color: ${pal.border}55;">${selApp.cat}</span>
      </div>
    `;

    /* RACCOURCIS / TOOLTIPS AU BAS DE L'ÉCRAN */
    if (this.showTooltips) {
      html += `
        <div class="text-[7px] text-center truncate pt-0.5" style="color: ${pal.descText}">
          ▲▼◀▶: Naviguer | OK: Lancer | Back: Hub
        </div>
      `;
    }

    this.content.innerHTML = html;

    if (this.displayMode === 'list') {
      const activeItem = this.content.querySelector(`.sim-item[data-index="${this.selectedIndex}"]`);
      if (activeItem && typeof activeItem.scrollIntoView === 'function') {
        activeItem.scrollIntoView({ block: 'nearest' });
      }
    }

    const items = this.content.querySelectorAll('.sim-item');
    items.forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.getAttribute('data-index'), 10);
        if (this.selectedIndex === idx) {
          this.launchSelected();
        } else {
          this.selectedIndex = idx;
          this.renderMenu();
        }
      });
    });
  }

  syncWithPack(pack) {
    if (!pack || pack.length === 0) {
      this.apps = [
        { id: 'mariokart', name: '1. Mario Kart', cat: 'Arcade', type: 'MARIO', icon: '🏎️' },
        { id: 'periodique', name: '2. Tableau Périodique', cat: 'Chimie', type: 'PERIODIC', icon: '🧪' },
        { id: 'fiches', name: '3. Fiches de Cours', cat: 'Révision', type: 'COURSES', icon: '📚' },
        { id: 'flappy', name: '4. Flappy Bird', cat: 'Arcade', type: 'FLAPPY', icon: '🐦' },
        { id: '2048', name: '5. 2048 Ultimate', cat: 'Arcade', type: '2048', icon: '🔢' },
        { id: 'snake', name: '6. Snake Classic', cat: 'Arcade', type: 'SNAKE', icon: '🐍' },
        { id: 'pong', name: '7. Pong Retro', cat: 'Arcade', type: 'PONG', icon: '🏓' },
        { id: 'dino', name: '8. Chrome Dino', cat: 'Arcade', type: 'DINO', icon: '🦖' },
        { id: 'space_invaders', name: '9. Space Invaders', cat: 'Arcade', type: 'SPACE_INVADERS', icon: '👾' },
        { id: 'breakout', name: '10. Casse-Briques', cat: 'Arcade', type: 'BREAKOUT', icon: '🧱' },
        { id: 'puissance4', name: '11. Puissance 4', cat: 'Arcade', type: 'PUISSANCE4', icon: '🟡' },
        { id: 'settings', name: '12. Paramètres & Thèmes', cat: 'Options', type: 'SETTINGS', icon: '⚙️' }
      ];
    } else {
      this.apps = pack.map((app, i) => {
        let icon = app.icon_initial || '📦';
        const nameL = (app.name || '').toLowerCase();
        const idL = (app.id || '').toLowerCase();
        let type = app.type || 'GENERIC';

        if (idL.includes('mario') || nameL.includes('mario')) { type = 'MARIO'; icon = '🏎️'; }
        else if (idL.includes('period') || nameL.includes('period')) { type = 'PERIODIC'; icon = '🧪'; }
        else if (idL.includes('cours') || idL.includes('fiche') || nameL.includes('cours') || nameL.includes('fiche')) { type = 'COURSES'; icon = '📚'; }
        else if (idL.includes('math') || nameL.includes('math') || nameL.includes('solveur')) { type = 'GENERIC'; icon = '📐'; }
        else if (idL.includes('flappy') || nameL.includes('flappy')) { type = 'FLAPPY'; icon = '🐦'; }
        else if (idL.includes('2048') || nameL.includes('2048')) { type = '2048'; icon = '🔢'; }
        else if (idL.includes('snake') || nameL.includes('snake')) { type = 'SNAKE'; icon = '🐍'; }
        else if (idL.includes('tetris') || nameL.includes('tetris')) { type = 'GENERIC'; icon = '🧱'; }
        else if (idL.includes('mine') || nameL.includes('mine') || nameL.includes('demineur')) { type = 'GENERIC'; icon = '💣'; }
        else if (idL.includes('pong') || nameL.includes('pong')) { type = 'PONG'; icon = '🏓'; }
        else if (idL.includes('dino') || nameL.includes('dino')) { type = 'DINO'; icon = '🦖'; }
        else if (idL.includes('invader') || nameL.includes('space') || nameL.includes('invader')) { type = 'SPACE_INVADERS'; icon = '👾'; }
        else if (idL.includes('breakout') || idL.includes('brique') || nameL.includes('brique')) { type = 'BREAKOUT'; icon = '🧱'; }
        else if (idL.includes('puissance') || nameL.includes('puissance') || idL.includes('connect4') || nameL.includes('connect4')) { type = 'PUISSANCE4'; icon = '🟡'; }

        return {
          id: app.id,
          name: `${i + 1}. ${app.name.replace(/^[0-9]+\.\s*/, '')}`,
          cat: (app.category || 'Arcade').split('/')[0].trim(),
          type: type,
          icon: icon
        };
      });

      this.apps.push({
        id: 'settings',
        name: `${this.apps.length + 1}. Paramètres & Thèmes`,
        cat: 'Options',
        type: 'SETTINGS',
        icon: '⚙️'
      });
    }

    if (this.selectedIndex >= this.apps.length) this.selectedIndex = 0;
    if (this.currentView === 'MENU') this.renderMenu();
  }

  updatePack(selectedApps) {
    this.syncWithPack(selectedApps);
  }

  // ==================== MINI JEU FLAPPY BIRD ====================
  startFlappyGame() {
    this.title.textContent = 'Flappy Bird Arcade';
    this.topbar.style.backgroundColor = '#FE6020';

    this.content.innerHTML = `
      <div class="relative w-full h-full flex flex-col justify-between overflow-hidden bg-[#4ec0ca] rounded cursor-pointer" id="flappy-canvas-wrap">
        <canvas id="flappy-cvs" width="280" height="170" class="w-full h-full block"></canvas>
        <div id="flappy-overlay" class="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-white text-center p-2">
          <div class="font-extrabold text-xs text-amber-300 drop-shadow">FLAPPY BIRD</div>
          <div class="text-[9px] text-white mt-1">Appuyez sur OK ou Espace pour sauter !</div>
        </div>
      </div>
    `;

    const canvas = document.getElementById('flappy-cvs');
    const ctx = canvas.getContext('2d');
    const overlay = document.getElementById('flappy-overlay');

    let birdY = 70;
    let birdVy = 0;
    let score = 0;
    let started = false;
    let gameOver = false;
    let pipes = [
      { x: 300, gapY: 60, passed: false },
      { x: 460, gapY: 80, passed: false }
    ];

    this.flappyFlap = () => {
      window.soundFx?.playFlap?.();
      if (gameOver) {
        birdY = 70;
        birdVy = 0;
        score = 0;
        pipes = [
          { x: 300, gapY: 60, passed: false },
          { x: 460, gapY: 80, passed: false }
        ];
        gameOver = false;
        started = true;
        overlay.classList.add('hidden');
        return;
      }
      if (!started) {
        started = true;
        overlay.classList.add('hidden');
      }
      birdVy = -3.8;
    };

    document.getElementById('flappy-canvas-wrap').addEventListener('click', () => this.flappyFlap());

    const loop = () => {
      ctx.fillStyle = '#4ec0ca';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(30, 25, 40, 10);
      ctx.fillRect(160, 35, 45, 10);

      ctx.fillStyle = '#73bf2e';
      ctx.fillRect(0, 145, canvas.width, 4);
      ctx.fillStyle = '#ded895';
      ctx.fillRect(0, 149, canvas.width, 21);

      if (started && !gameOver) {
        birdVy += 0.22;
        birdY += birdVy;

        pipes.forEach(p => {
          p.x -= 2;
          if (p.x + 30 < 45 && !p.passed) {
            p.passed = true;
            score++;
            window.soundFx?.playScore?.();
          }
          if (p.x < -35) {
            p.x = 290;
            p.gapY = Math.floor(Math.random() * 65) + 35;
            p.passed = false;
          }
        });

        if (birdY < 0 || birdY > 135) {
          gameOver = true;
          window.soundFx?.playHit?.();
        }

        pipes.forEach(p => {
          if (45 + 14 > p.x && 45 < p.x + 30) {
            if (birdY < p.gapY || birdY + 10 > p.gapY + 45) {
              gameOver = true;
              window.soundFx?.playHit?.();
            }
          }
        });
      }

      pipes.forEach(p => {
        ctx.fillStyle = '#73bf2e';
        ctx.fillRect(p.x, 0, 30, p.gapY);
        ctx.fillRect(p.x, p.gapY + 45, 30, 145 - (p.gapY + 45));
        ctx.fillStyle = '#558a22';
        ctx.strokeRect(p.x, 0, 30, p.gapY);
        ctx.strokeRect(p.x, p.gapY + 45, 30, 145 - (p.gapY + 45));
      });

      ctx.fillStyle = '#ffe000';
      ctx.fillRect(45, birdY, 14, 10);
      ctx.fillStyle = '#fa4000';
      ctx.fillRect(55, birdY + 4, 6, 4);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(52, birdY + 1, 4, 4);
      ctx.fillStyle = '#000000';
      ctx.fillRect(54, birdY + 2, 2, 2);

      ctx.fillStyle = '#000000';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(`Score: ${score}`, 10, 16);

      this.gameLoopId = requestAnimationFrame(loop);
    };

    loop();
  }

  // ==================== MINI JEU 2048 ULTIMATE ====================
  start2048Game() {
    this.title.textContent = '2048 Ultimate';
    this.topbar.style.backgroundColor = '#edc22e';

    let grid = [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ];
    let score = 0;
    let bestScore = parseInt(safeStorageGet('equalib_2048_best', '0'), 10) || 0;
    let isGameOver = false;

    const spawnTile = () => {
      const empty = [];
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          if (grid[r][c] === 0) empty.push({ r, c });
        }
      }
      if (empty.length === 0) return false;
      const spot = empty[Math.floor(Math.random() * empty.length)];
      grid[spot.r][spot.c] = Math.random() < 0.9 ? 2 : 4;
      return true;
    };

    const canMove = () => {
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          if (grid[r][c] === 0) return true;
          if (r < 3 && grid[r][c] === grid[r + 1][c]) return true;
          if (c < 3 && grid[r][c] === grid[r][c + 1]) return true;
        }
      }
      return false;
    };

    const initGame = () => {
      grid = [
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0]
      ];
      score = 0;
      isGameOver = false;
      spawnTile();
      spawnTile();
      render();
    };

    this.restart2048 = () => {
      initGame();
    };

    const getTileStyle = (val) => {
      const styles = {
        0: 'bg-[#cdc1b4] text-transparent',
        2: 'bg-[#eee4da] text-[#776e65]',
        4: 'bg-[#ede0c8] text-[#776e65]',
        8: 'bg-[#f2b179] text-white font-black',
        16: 'bg-[#f59563] text-white font-black',
        32: 'bg-[#f67c5f] text-white font-black',
        64: 'bg-[#e95937] text-white font-black',
        128: 'bg-[#edcf72] text-white text-[9px] font-black',
        256: 'bg-[#edcc61] text-white text-[9px] font-black',
        512: 'bg-[#edc850] text-white text-[9px] font-black',
        1024: 'bg-[#edc53f] text-white text-[8px] font-black',
        2048: 'bg-[#edc22e] text-white text-[8px] font-black shadow-lg shadow-amber-500/50'
      };
      return styles[val] || 'bg-[#3c3a32] text-white text-[7px] font-black';
    };

    const render = () => {
      let cellsHtml = '';
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          const val = grid[r][c];
          const style = getTileStyle(val);
          cellsHtml += `
            <div class="h-8 rounded flex items-center justify-center font-bold text-[10px] ${style} shadow-sm transition-all select-none border border-black/5">
              ${val > 0 ? val : ''}
            </div>
          `;
        }
      }

      this.content.innerHTML = `
        <div class="flex flex-col justify-between h-full bg-[#faf8ef] p-1.5 rounded relative select-none" id="sim-2048-container">
          <div class="flex justify-between items-center text-[10px] font-bold text-slate-800">
            <span class="text-amber-700 tracking-wider font-black text-xs">2048</span>
            <div class="flex gap-1">
              <span class="bg-[#bbada0] text-white px-1.5 py-0.5 rounded text-[8px]">Score: ${score}</span>
              <span class="bg-[#8f7a66] text-white px-1.5 py-0.5 rounded text-[8px]">Max: ${bestScore}</span>
            </div>
          </div>
          <div class="grid grid-cols-4 gap-1 bg-[#bbada0] p-1 rounded-lg my-0.5 cursor-grab active:cursor-grabbing" id="sim-2048-grid">
            ${cellsHtml}
          </div>
          <!-- Commandes tactiles directes (Zéro freeze) -->
          <div class="flex items-center justify-between gap-1 text-[8px]">
            <button class="flex-1 py-0.5 bg-[#8f7a66] hover:bg-[#776e65] active:scale-95 text-white font-bold rounded cursor-pointer btn-2048-nav" data-dir="LEFT">◀</button>
            <button class="flex-1 py-0.5 bg-[#8f7a66] hover:bg-[#776e65] active:scale-95 text-white font-bold rounded cursor-pointer btn-2048-nav" data-dir="UP">▲</button>
            <button class="flex-1 py-0.5 bg-[#8f7a66] hover:bg-[#776e65] active:scale-95 text-white font-bold rounded cursor-pointer btn-2048-nav" data-dir="DOWN">▼</button>
            <button class="flex-1 py-0.5 bg-[#8f7a66] hover:bg-[#776e65] active:scale-95 text-white font-bold rounded cursor-pointer btn-2048-nav" data-dir="RIGHT">▶</button>
          </div>
          ${isGameOver ? `
            <div class="absolute inset-0 bg-[#eee4da]/95 backdrop-blur-[2px] flex flex-col items-center justify-center rounded z-10">
              <div class="text-xs font-black text-[#776e65] mb-1">GAME OVER !</div>
              <div class="text-[9px] text-[#8f7a66] mb-2 font-bold">Score Final : ${score}</div>
              <button onclick="window.simulator.restart2048()" class="px-3 py-1 bg-[#8f7a66] hover:bg-[#776e65] text-white text-[9px] font-bold rounded shadow transition cursor-pointer">
                Rejouer (OK)
              </button>
            </div>
          ` : `
            <div class="text-[7px] text-slate-500 text-center font-medium">
              Flèches / ZQSD / Glisser • Back : Hub
            </div>
          `}
        </div>
      `;

      // Liaison des boutons de contrôle tactiles directs
      const navBtns = this.content.querySelectorAll('.btn-2048-nav');
      navBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const d = btn.getAttribute('data-dir');
          if (d) this.slide2048(d);
        });
      });
    };

    const slideRow = (row) => {
      const nonZero = row.filter(v => v !== 0);
      const res = [];
      let sc = 0;
      let i = 0;
      while (i < nonZero.length) {
        if (i + 1 < nonZero.length && nonZero[i] === nonZero[i + 1]) {
          const val = nonZero[i] * 2;
          res.push(val);
          sc += val;
          i += 2;
        } else {
          res.push(nonZero[i]);
          i += 1;
        }
      }
      while (res.length < 4) res.push(0);
      return { row: res, score: sc };
    };

    this.slide2048 = (dir) => {
      if (isGameOver) return;
      window.soundFx?.playClick?.();

      const d = (dir || '').toUpperCase();
      let moved = false;
      let gained = 0;
      const newGrid = [
        [0,0,0,0],
        [0,0,0,0],
        [0,0,0,0],
        [0,0,0,0]
      ];

      if (d === 'LEFT' || d === 'ARROWLEFT') {
        for (let r = 0; r < 4; r++) {
          const res = slideRow(grid[r]);
          newGrid[r] = res.row;
          gained += res.score;
        }
      } else if (d === 'RIGHT' || d === 'ARROWRIGHT') {
        for (let r = 0; r < 4; r++) {
          const res = slideRow(grid[r].slice().reverse());
          newGrid[r] = res.row.reverse();
          gained += res.score;
        }
      } else if (d === 'UP' || d === 'ARROWUP') {
        for (let c = 0; c < 4; c++) {
          const col = [grid[0][c], grid[1][c], grid[2][c], grid[3][c]];
          const res = slideRow(col);
          gained += res.score;
          for (let r = 0; r < 4; r++) newGrid[r][c] = res.row[r];
        }
      } else if (d === 'DOWN' || d === 'ARROWDOWN') {
        for (let c = 0; c < 4; c++) {
          const col = [grid[0][c], grid[1][c], grid[2][c], grid[3][c]].reverse();
          const res = slideRow(col);
          gained += res.score;
          const rev = res.row.reverse();
          for (let r = 0; r < 4; r++) newGrid[r][c] = rev[r];
        }
      }

      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          if (newGrid[r][c] !== grid[r][c]) moved = true;
        }
      }

      if (moved) {
        grid = newGrid;
        score += gained;
        if (score > bestScore) {
          bestScore = score;
          safeStorageSet('equalib_2048_best', String(bestScore));
        }
        spawnTile();
        if (!canMove()) {
          isGameOver = true;
        }
        render();
      }
    };

    initGame();
  }

  // ==================== MINI JEU DU SERPENT ====================
  startSnakeGame() {
    this.title.textContent = 'Snake Classic';
    this.topbar.style.backgroundColor = '#16a34a';

    this.content.innerHTML = `
      <div class="w-full h-full flex flex-col justify-between bg-[#084110] p-1.5 rounded">
        <canvas id="snake-cvs" width="280" height="150" class="w-full h-full block bg-[#084110] rounded"></canvas>
        <div class="text-[8px] text-emerald-300 text-center mt-0.5">
          Flèches: Diriger | Back: Menu
        </div>
      </div>
    `;

    const canvas = document.getElementById('snake-cvs');
    const ctx = canvas.getContext('2d');

    let snake = [{x: 8, y: 7}, {x: 7, y: 7}, {x: 6, y: 7}];
    let dir = {x: 1, y: 0};
    let food = {x: 18, y: 7};
    let score = 0;
    let ticks = 0;

    this.snakeChangeDir = (key) => {
      window.soundFx?.playClick?.();
      if ((key === 'ArrowUp' || key === 'UP') && dir.y === 0) dir = {x: 0, y: -1};
      else if ((key === 'ArrowDown' || key === 'DOWN') && dir.y === 0) dir = {x: 0, y: 1};
      else if ((key === 'ArrowLeft' || key === 'LEFT') && dir.x === 0) dir = {x: -1, y: 0};
      else if ((key === 'ArrowRight' || key === 'RIGHT') && dir.x === 0) dir = {x: 1, y: 0};
    };

    const loop = () => {
      ticks++;
      if (ticks % 8 === 0) {
        const head = {x: snake[0].x + dir.x, y: snake[0].y + dir.y};
        if (head.x < 0) head.x = 27;
        if (head.x >= 28) head.x = 0;
        if (head.y < 0) head.y = 14;
        if (head.y >= 15) head.y = 0;

        snake.unshift(head);
        if (head.x === food.x && head.y === food.y) {
          score++;
          window.soundFx?.playScore?.();
          food = {
            x: Math.floor(Math.random() * 26) + 1,
            y: Math.floor(Math.random() * 13) + 1
          };
        } else {
          snake.pop();
        }
      }

      ctx.fillStyle = '#084110';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#f87171';
      ctx.fillRect(food.x * 10, food.y * 10, 9, 9);

      snake.forEach((seg, idx) => {
        ctx.fillStyle = idx === 0 ? '#4ade80' : '#22c55e';
        ctx.fillRect(seg.x * 10, seg.y * 10, 9, 9);
      });

      ctx.fillStyle = '#86efac';
      ctx.font = 'bold 9px monospace';
      ctx.fillText(`Score: ${score}`, 6, 12);

      this.gameLoopId = requestAnimationFrame(loop);
    };

    loop();
  }

  // ==================== MINI JEU PONG RETRO ARCADE ====================
  startPongGame() {
    this.title.textContent = 'Pong Retro Arcade';
    this.topbar.style.backgroundColor = '#6366f1';

    this.content.innerHTML = `
      <div class="w-full h-full flex flex-col justify-between bg-[#070913] p-1 rounded relative select-none">
        <canvas id="pong-cvs" width="300" height="175" class="w-full h-full block rounded cursor-ns-resize"></canvas>
        <div id="pong-overlay" class="hidden absolute inset-0 bg-black/85 flex flex-col items-center justify-center text-white text-center rounded z-10">
          <div id="pong-msg" class="font-black text-sm text-cyan-400 mb-1 drop-shadow">VICTOIRE !</div>
          <div class="text-[9px] text-slate-300 mb-2">Premier à 7 points gagne le match !</div>
          <button id="pong-restart-btn" class="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] font-bold rounded shadow transition cursor-pointer">
            Rejouer (OK / Espace)
          </button>
        </div>
        <div class="flex items-center justify-between px-1 text-[8px] text-slate-400">
          <span>Souris / ▲▼: Raquette</span>
          <div class="flex items-center gap-1">
            <button id="pong-up-btn" class="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-white rounded font-bold cursor-pointer">▲</button>
            <button id="pong-down-btn" class="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-white rounded font-bold cursor-pointer">▼</button>
          </div>
          <button id="pong-back-btn" class="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer">Hub</button>
        </div>
      </div>
    `;

    const canvas = document.getElementById('pong-cvs');
    const ctx = canvas.getContext('2d');
    const overlay = document.getElementById('pong-overlay');
    const msgEl = document.getElementById('pong-msg');
    const restartBtn = document.getElementById('pong-restart-btn');
    const upBtn = document.getElementById('pong-up-btn');
    const downBtn = document.getElementById('pong-down-btn');
    const backBtn = document.getElementById('pong-back-btn');

    let p1Y = 70;
    let cpuY = 70;
    const paddleH = 34;
    const paddleW = 6;
    let bx = 150;
    let by = 88;
    let bvx = 3.2;
    let bvy = 2.0;
    let s1 = 0;
    let sc = 0;
    let gameOver = false;
    let trail = [];

    this.pongMove = (dir) => {
      p1Y = Math.max(6, Math.min(canvas.height - paddleH - 6, p1Y + dir * 14));
    };

    this.pongRestart = () => {
      s1 = 0;
      sc = 0;
      bx = canvas.width / 2;
      by = canvas.height / 2;
      bvx = (Math.random() < 0.5 ? 3.2 : -3.2);
      bvy = (Math.random() * 2.4 - 1.2);
      if (Math.abs(bvy) < 1.2) bvy = (bvy >= 0 ? 1.4 : -1.4);
      trail = [];
      gameOver = false;
      overlay.classList.add('hidden');
    };

    if (restartBtn) restartBtn.addEventListener('click', () => this.pongRestart());
    if (upBtn) upBtn.addEventListener('click', () => this.pongMove(-1));
    if (downBtn) downBtn.addEventListener('click', () => this.pongMove(1));
    if (backBtn) backBtn.addEventListener('click', () => this.returnToMenu());

    const updateMousePaddle = (clientY) => {
      const rect = canvas.getBoundingClientRect();
      const scaleY = canvas.height / rect.height;
      const targetY = (clientY - rect.top) * scaleY - paddleH / 2;
      p1Y = Math.max(6, Math.min(canvas.height - paddleH - 6, targetY));
    };

    canvas.addEventListener('mousemove', (e) => {
      if (!gameOver) updateMousePaddle(e.clientY);
    });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (!gameOver && e.touches[0]) updateMousePaddle(e.touches[0].clientY);
    }, { passive: false });

    canvas.addEventListener('click', () => {
      if (gameOver) this.pongRestart();
    });

    const loop = () => {
      if (!gameOver) {
        trail.push({ x: bx, y: by });
        if (trail.length > 5) trail.shift();

        bx += bvx;
        by += bvy;

        if (by <= 4) {
          by = 4;
          bvy = Math.abs(bvy);
        } else if (by >= canvas.height - 10) {
          by = canvas.height - 10;
          bvy = -Math.abs(bvy);
        }

        const cpuCenter = cpuY + paddleH / 2;
        if (bvx > 0 && bx > 90) {
          const diff = by + 3 - cpuCenter;
          const cpuSpeed = Math.min(2.8, Math.max(-2.8, diff * 0.18));
          cpuY += cpuSpeed;
        } else {
          const centerDiff = (canvas.height / 2) - cpuCenter;
          cpuY += centerDiff * 0.04;
        }
        cpuY = Math.max(6, Math.min(canvas.height - paddleH - 6, cpuY));

        if (bvx < 0 && bx <= 12 + paddleW && bx >= 8 && by + 6 >= p1Y && by <= p1Y + paddleH) {
          bx = 12 + paddleW;
          bvx = Math.min(6.2, Math.abs(bvx) * 1.06);
          const rel = ((by + 3) - (p1Y + paddleH / 2)) / (paddleH / 2);
          bvy = rel * 3.8;
          if (Math.abs(bvy) < 1.4) bvy = (bvy >= 0 ? 1.4 : -1.4);
          window.soundFx?.playClick?.();
        }

        const cpuX = canvas.width - 18;
        if (bvx > 0 && bx + 6 >= cpuX && bx <= cpuX + paddleW + 4 && by + 6 >= cpuY && by <= cpuY + paddleH) {
          bx = cpuX - 6;
          bvx = -Math.min(6.2, Math.abs(bvx) * 1.06);
          const rel = ((by + 3) - (cpuY + paddleH / 2)) / (paddleH / 2);
          bvy = rel * 3.8;
          if (Math.abs(bvy) < 1.4) bvy = (bvy >= 0 ? 1.4 : -1.4);
          window.soundFx?.playClick?.();
        }

        if (bx < -10) {
          sc++;
          window.soundFx?.playHit?.();
          bx = canvas.width / 2;
          by = canvas.height / 2;
          bvx = 3.2;
          bvy = (Math.random() * 2 - 1) * 2;
          if (Math.abs(bvy) < 1.2) bvy = 1.4;
          trail = [];
          if (sc >= 7) {
            gameOver = true;
            msgEl.textContent = 'DÉFAITE ! (CPU GAGNE)';
            msgEl.className = 'font-black text-sm text-red-400 mb-1 drop-shadow';
            overlay.classList.remove('hidden');
          }
        } else if (bx > canvas.width + 10) {
          s1++;
          window.soundFx?.playScore?.();
          bx = canvas.width / 2;
          by = canvas.height / 2;
          bvx = -3.2;
          bvy = (Math.random() * 2 - 1) * 2;
          if (Math.abs(bvy) < 1.2) bvy = -1.4;
          trail = [];
          if (s1 >= 7) {
            gameOver = true;
            msgEl.textContent = 'VICTOIRE ÉCLATANTE !';
            msgEl.className = 'font-black text-sm text-cyan-400 mb-1 drop-shadow';
            overlay.classList.remove('hidden');
          }
        }
      }

      ctx.fillStyle = '#070913';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#1e293b';
      for (let y = 4; y < canvas.height; y += 14) {
        ctx.fillRect(canvas.width / 2 - 1, y, 2, 7);
      }

      trail.forEach((t, i) => {
        ctx.fillStyle = `rgba(0, 240, 255, ${(i + 1) * 0.12})`;
        ctx.fillRect(t.x, t.y, 6, 6);
      });

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(bx, by, 6, 6);

      ctx.fillStyle = '#00f0ff';
      ctx.fillRect(12, p1Y, paddleW, paddleH);
      ctx.fillStyle = '#e0f2fe';
      ctx.fillRect(13, p1Y + 2, 2, paddleH - 4);

      ctx.fillStyle = '#ff2a6d';
      ctx.fillRect(canvas.width - 18, cpuY, paddleW, paddleH);
      ctx.fillStyle = '#ffe4e6';
      ctx.fillRect(canvas.width - 17, cpuY + 2, 2, paddleH - 4);

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 16px monospace';
      ctx.fillText(`${s1}`, canvas.width / 2 - 40, 22);
      ctx.fillStyle = '#fb7185';
      ctx.fillText(`${sc}`, canvas.width / 2 + 30, 22);

      this.gameLoopId = requestAnimationFrame(loop);
    };

    loop();
  }

  // ==================== MINI JEU CHROME DINO RUNNER ====================
  startDinoGame() {
    this.title.textContent = 'Chrome Dino Runner';
    this.topbar.style.backgroundColor = '#78716c';

    this.content.innerHTML = `
      <div class="w-full h-full flex flex-col justify-between bg-[#f7f7f7] p-1 rounded relative select-none" id="dino-wrap">
        <canvas id="dino-cvs" width="300" height="175" class="w-full h-full block rounded cursor-pointer"></canvas>
        <div id="dino-overlay" class="hidden absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white text-center rounded z-10">
          <div class="font-black text-sm text-amber-400 mb-1 drop-shadow">G A M E   O V E R</div>
          <div id="dino-final-score" class="text-[9px] text-slate-200 mb-2">Score : 0</div>
          <button id="dino-restart-btn" class="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-bold rounded shadow transition cursor-pointer">
            Rejouer (OK / Espace)
          </button>
        </div>
        <div class="flex items-center justify-between px-1 text-[8px] text-slate-500">
          <span>Clic / Espace : Sauter • S : Baisser</span>
          <div class="flex items-center gap-1">
            <button id="dino-jump-btn" class="px-2.5 py-0.5 bg-slate-300 hover:bg-slate-400 text-slate-900 rounded font-bold cursor-pointer">⬆️ Sauter</button>
            <button id="dino-duck-btn" class="px-2.5 py-0.5 bg-slate-300 hover:bg-slate-400 text-slate-900 rounded font-bold cursor-pointer">⬇️ Baisser</button>
          </div>
          <button id="dino-back-btn" class="px-1.5 py-0.5 bg-slate-300 hover:bg-slate-400 text-slate-700 rounded cursor-pointer">Hub</button>
        </div>
      </div>
    `;

    const canvas = document.getElementById('dino-cvs');
    const ctx = canvas.getContext('2d');
    const overlay = document.getElementById('dino-overlay');
    const finalScoreEl = document.getElementById('dino-final-score');
    const restartBtn = document.getElementById('dino-restart-btn');
    const jumpBtn = document.getElementById('dino-jump-btn');
    const duckBtn = document.getElementById('dino-duck-btn');
    const backBtn = document.getElementById('dino-back-btn');

    const groundY = 145;
    let dinoY = groundY - 26;
    let velY = 0;
    let onGround = true;
    let ducking = false;
    let score = 0;
    let hiScore = parseInt(safeStorageGet('equalib_dino_hi', '0'), 10) || 0;
    let speed = 3.8;
    let tick = 0;
    let gameOver = false;

    let obstacles = [
      { x: 380, type: 0 }
    ];

    this.dinoJump = () => {
      if (gameOver) { this.dinoRestart(); return; }
      if (onGround) {
        velY = -8.6;
        onGround = false;
        window.soundFx?.playClick?.();
      }
    };

    this.dinoDuck = (val) => {
      ducking = val;
    };

    this.dinoRestart = () => {
      dinoY = groundY - 26;
      velY = 0;
      onGround = true;
      ducking = false;
      score = 0;
      speed = 3.8;
      tick = 0;
      obstacles = [{ x: 380, type: 0 }];
      gameOver = false;
      overlay.classList.add('hidden');
    };

    if (restartBtn) restartBtn.addEventListener('click', () => this.dinoRestart());
    if (jumpBtn) jumpBtn.addEventListener('click', () => this.dinoJump());
    if (duckBtn) {
      duckBtn.addEventListener('mousedown', () => this.dinoDuck(true));
      duckBtn.addEventListener('mouseup', () => this.dinoDuck(false));
      duckBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.dinoDuck(true); });
      duckBtn.addEventListener('touchend', () => this.dinoDuck(false));
    }
    if (backBtn) backBtn.addEventListener('click', () => this.returnToMenu());
    canvas.addEventListener('click', () => this.dinoJump());

    const loop = () => {
      tick++;

      if (!gameOver) {
        if (!onGround) {
          velY += 0.58;
          dinoY += velY;
          if (dinoY >= groundY - 26) {
            dinoY = groundY - 26;
            velY = 0;
            onGround = true;
          }
        }

        if (tick % 6 === 0) {
          score++;
          if (score > hiScore) {
            hiScore = score;
            safeStorageSet('equalib_dino_hi', hiScore.toString());
          }
          if (speed < 7.2) speed += 0.003;
        }

        obstacles.forEach(o => {
          o.x -= speed;
          const dW = ducking ? 28 : 18;
          const dH = ducking ? 14 : 26;
          const dY = ducking ? groundY - 14 : dinoY;
          const dX = 35;

          const oW = (o.type === 0 ? 12 : 20);
          const oH = (o.type === 0 ? 24 : 14);
          const oY = (o.type === 0 ? groundY - 24 : groundY - 36);

          if (dX < o.x + oW && dX + dW > o.x && dY < oY + oH && dY + dH > oY) {
            gameOver = true;
            window.soundFx?.playHit?.();
            if (finalScoreEl) finalScoreEl.textContent = `Score final : ${score} (Record : ${hiScore})`;
            overlay.classList.remove('hidden');
          }
        });

        if (obstacles.length > 0 && obstacles[0].x < -30) {
          obstacles.shift();
        }

        const lastObstacle = obstacles[obstacles.length - 1];
        if (!lastObstacle || lastObstacle.x < canvas.width - (160 + Math.random() * 100)) {
          const isPtero = (score > 120 && Math.random() < 0.35);
          obstacles.push({
            x: canvas.width + 30,
            type: isPtero ? 1 : 0
          });
        }
      }

      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#64748b';
      ctx.fillRect(0, groundY, canvas.width, 2);
      for (let x = 0; x < canvas.width; x += 16) {
        const offset = ((x - (tick * speed) % 16) + 16) % 16;
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(x + offset, groundY + 4, 3, 1);
        if (x % 32 === 0) ctx.fillRect(x + offset + 6, groundY + 8, 5, 1);
      }

      ctx.fillStyle = '#cbd5e1';
      const c1X = (320 - (tick * 0.4) % 360);
      const c2X = (160 - (tick * 0.4) % 360 + 360) % 360;
      ctx.fillRect(c1X, 28, 30, 8);
      ctx.fillRect(c1X + 8, 22, 16, 6);
      ctx.fillRect(c2X, 48, 26, 7);

      ctx.fillStyle = '#334155';
      const dX = 35;
      if (ducking && onGround) {
        ctx.fillRect(dX, groundY - 14, 28, 12);
        ctx.fillRect(dX + 26, groundY - 12, 6, 6);
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(dX + 28, groundY - 10, 2, 2);
      } else {
        ctx.fillRect(dX + 4, dinoY + 4, 14, 18);
        ctx.fillRect(dX + 12, dinoY, 12, 10);
        ctx.fillRect(dX + 16, dinoY + 2, 8, 4);
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(dX + 18, dinoY + 2, 2, 2);
        ctx.fillStyle = '#334155';
        ctx.fillRect(dX + 14, dinoY + 12, 4, 3);
        ctx.fillRect(dX, dinoY + 8, 4, 6);
        ctx.fillRect(dX - 2, dinoY + 6, 3, 4);

        if (onGround) {
          const legFrame = Math.floor(tick / 4) % 2;
          if (legFrame === 0) {
            ctx.fillRect(dX + 6, dinoY + 22, 3, 4);
            ctx.fillRect(dX + 13, dinoY + 20, 3, 3);
          } else {
            ctx.fillRect(dX + 6, dinoY + 20, 3, 3);
            ctx.fillRect(dX + 13, dinoY + 22, 3, 4);
          }
        } else {
          ctx.fillRect(dX + 6, dinoY + 21, 3, 3);
          ctx.fillRect(dX + 12, dinoY + 21, 3, 3);
        }
      }

      obstacles.forEach(o => {
        if (o.type === 0) {
          ctx.fillStyle = '#16a34a';
          ctx.fillRect(o.x + 4, groundY - 24, 5, 24);
          ctx.fillRect(o.x, groundY - 18, 4, 3);
          ctx.fillRect(o.x, groundY - 22, 3, 7);
          ctx.fillRect(o.x + 9, groundY - 14, 4, 3);
          ctx.fillRect(o.x + 10, groundY - 18, 3, 7);
        } else {
          ctx.fillStyle = '#dc2626';
          const pY = groundY - 36;
          const wingUp = (Math.floor(tick / 6) % 2 === 0);
          ctx.fillRect(o.x + 4, pY + 4, 14, 6);
          ctx.fillRect(o.x, pY + 2, 5, 4);
          if (wingUp) {
            ctx.fillRect(o.x + 8, pY - 6, 6, 10);
          } else {
            ctx.fillRect(o.x + 8, pY + 6, 6, 8);
          }
        }
      });

      ctx.fillStyle = '#475569';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(`HI ${String(hiScore).padStart(5, '0')}  ${String(score).padStart(5, '0')}`, canvas.width - 130, 18);

      this.gameLoopId = requestAnimationFrame(loop);
    };

    loop();
  }

  // ==================== MINI JEU SPACE INVADERS ====================
  startSpaceInvadersGame() {
    this.title.textContent = 'Space Invaders Retro';
    this.topbar.style.backgroundColor = '#10b981';

    this.content.innerHTML = `
      <div class="w-full h-full flex flex-col justify-between bg-[#04060d] p-1 rounded relative select-none">
        <canvas id="invaders-cvs" width="300" height="175" class="w-full h-full block rounded cursor-crosshair"></canvas>
        <div id="invaders-overlay" class="hidden absolute inset-0 bg-black/85 flex flex-col items-center justify-center text-white text-center rounded z-10">
          <div id="invaders-msg" class="font-black text-sm text-emerald-400 mb-1 drop-shadow">VICTOIRE !</div>
          <div id="invaders-score-final" class="text-[9px] text-slate-300 mb-2">Score : 0</div>
          <button id="invaders-restart-btn" class="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold rounded shadow transition cursor-pointer">
            Rejouer (OK / Espace)
          </button>
        </div>
        <div class="flex items-center justify-between px-1 text-[8px] text-slate-400">
          <span>Souris / ◄►: Canon • Clic / OK: Tirer</span>
          <div class="flex items-center gap-1">
            <button id="invaders-left-btn" class="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-white rounded font-bold cursor-pointer">◀</button>
            <button id="invaders-fire-btn" class="px-2.5 py-0.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded font-bold cursor-pointer">🔴 Tir</button>
            <button id="invaders-right-btn" class="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-white rounded font-bold cursor-pointer">▶</button>
          </div>
          <button id="invaders-back-btn" class="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer">Hub</button>
        </div>
      </div>
    `;

    const canvas = document.getElementById('invaders-cvs');
    const ctx = canvas.getContext('2d');
    const overlay = document.getElementById('invaders-overlay');
    const msgEl = document.getElementById('invaders-msg');
    const finalScoreEl = document.getElementById('invaders-score-final');
    const restartBtn = document.getElementById('invaders-restart-btn');
    const leftBtn = document.getElementById('invaders-left-btn');
    const rightBtn = document.getElementById('invaders-right-btn');
    const fireBtn = document.getElementById('invaders-fire-btn');
    const backBtn = document.getElementById('invaders-back-btn');

    let canX = 140;
    const canW = 20;
    let bullet = null;
    let alienBombs = [];
    let alienDir = 1;
    let alienX = 25;
    let alienY = 24;
    let alienSpeedX = 4;
    let score = 0;
    let gameOver = false;
    let tick = 0;

    let bunkers = [
      { x: 45, y: 130, hp: 4 },
      { x: 135, y: 130, hp: 4 },
      { x: 225, y: 130, hp: 4 }
    ];

    let aliens = [];
    const initAliens = () => {
      aliens = [];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 6; c++) {
          aliens.push({ r, c, alive: true, pts: (3 - r) * 10 });
        }
      }
    };
    initAliens();

    this.invadersMove = (dir) => {
      canX = Math.max(10, Math.min(canvas.width - canW - 10, canX + dir * 14));
    };

    this.invadersShoot = () => {
      if (gameOver) { this.invadersRestart(); return; }
      if (!bullet) {
        bullet = { x: canX + canW / 2 - 1, y: 150 };
        window.soundFx?.playClick?.();
      }
    };

    this.invadersRestart = () => {
      canX = 140;
      bullet = null;
      alienBombs = [];
      alienDir = 1;
      alienX = 25;
      alienY = 24;
      alienSpeedX = 4;
      score = 0;
      gameOver = false;
      tick = 0;
      bunkers = [
        { x: 45, y: 130, hp: 4 },
        { x: 135, y: 130, hp: 4 },
        { x: 225, y: 130, hp: 4 }
      ];
      initAliens();
      overlay.classList.add('hidden');
    };

    if (restartBtn) restartBtn.addEventListener('click', () => this.invadersRestart());
    if (leftBtn) leftBtn.addEventListener('click', () => this.invadersMove(-1));
    if (rightBtn) rightBtn.addEventListener('click', () => this.invadersMove(1));
    if (fireBtn) fireBtn.addEventListener('click', () => this.invadersShoot());
    if (backBtn) backBtn.addEventListener('click', () => this.returnToMenu());

    canvas.addEventListener('mousemove', (e) => {
      if (gameOver) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const targetX = (e.clientX - rect.left) * scaleX - canW / 2;
      canX = Math.max(10, Math.min(canvas.width - canW - 10, targetX));
    });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (gameOver || !e.touches[0]) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const targetX = (e.touches[0].clientX - rect.left) * scaleX - canW / 2;
      canX = Math.max(10, Math.min(canvas.width - canW - 10, targetX));
    }, { passive: false });

    canvas.addEventListener('click', () => this.invadersShoot());

    const loop = () => {
      tick++;

      if (!gameOver) {
        const aliveCount = aliens.filter(a => a.alive).length;
        const moveInterval = Math.max(6, Math.floor(aliveCount * 1.5));

        if (tick % moveInterval === 0) {
          alienX += alienDir * alienSpeedX;
          if (alienX > 90 || alienX < 15) {
            alienDir = -alienDir;
            alienY += 7;
          }
        }

        if (tick % 45 === 0 && aliveCount > 0 && alienBombs.length < 3) {
          const livingAliens = aliens.filter(a => a.alive);
          const shooter = livingAliens[Math.floor(Math.random() * livingAliens.length)];
          const sx = alienX + shooter.c * 32 + 8;
          const sy = alienY + shooter.r * 18 + 12;
          alienBombs.push({ x: sx, y: sy });
        }

        if (bullet) {
          bullet.y -= 6;
          if (bullet.y < 4) bullet = null;
          else {
            aliens.forEach(a => {
              if (a.alive && bullet) {
                const ax = alienX + a.c * 32;
                const ay = alienY + a.r * 18;
                if (bullet.x >= ax && bullet.x <= ax + 20 && bullet.y >= ay && bullet.y <= ay + 14) {
                  a.alive = false;
                  bullet = null;
                  score += a.pts;
                  window.soundFx?.playScore?.();
                }
              }
            });

            bunkers.forEach(b => {
              if (b.hp > 0 && bullet) {
                if (bullet.x >= b.x && bullet.x <= b.x + 28 && bullet.y >= b.y && bullet.y <= b.y + 12) {
                  b.hp--;
                  bullet = null;
                }
              }
            });
          }
        }

        alienBombs.forEach((b, idx) => {
          b.y += 3.2;

          bunkers.forEach(bk => {
            if (bk.hp > 0 && b.x >= bk.x && b.x <= bk.x + 28 && b.y >= bk.y && b.y <= bk.y + 12) {
              bk.hp--;
              alienBombs.splice(idx, 1);
            }
          });

          if (b && b.x >= canX && b.x <= canX + canW && b.y >= 152 && b.y <= 164) {
            gameOver = true;
            window.soundFx?.playHit?.();
            msgEl.textContent = 'VAISSEAU DÉTRUIT !';
            msgEl.className = 'font-black text-sm text-red-400 mb-1 drop-shadow';
            if (finalScoreEl) finalScoreEl.textContent = `Score final : ${score}`;
            overlay.classList.remove('hidden');
          }

          if (b && b.y > canvas.height) {
            alienBombs.splice(idx, 1);
          }
        });

        if (aliveCount === 0) {
          gameOver = true;
          msgEl.textContent = 'TERRE SAUVÉE ! VICTOIRE !';
          msgEl.className = 'font-black text-sm text-emerald-400 mb-1 drop-shadow';
          if (finalScoreEl) finalScoreEl.textContent = `Score final : ${score}`;
          overlay.classList.remove('hidden');
        } else if (aliens.some(a => a.alive && (alienY + a.r * 18 >= 134))) {
          gameOver = true;
          msgEl.textContent = 'INVASION RÉUSSIE ! GAME OVER';
          msgEl.className = 'font-black text-sm text-red-400 mb-1 drop-shadow';
          if (finalScoreEl) finalScoreEl.textContent = `Score final : ${score}`;
          overlay.classList.remove('hidden');
        }
      }

      ctx.fillStyle = '#04060d';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      for (let i = 0; i < 20; i++) {
        const sx = (i * 47 + tick * 0.2) % canvas.width;
        const sy = (i * 29) % (canvas.height - 30);
        ctx.fillRect(sx, sy, 1, 1);
      }

      bunkers.forEach(b => {
        if (b.hp > 0) {
          ctx.fillStyle = b.hp === 4 ? '#22c55e' : (b.hp === 3 ? '#84cc16' : (b.hp === 2 ? '#eab308' : '#ef4444'));
          ctx.fillRect(b.x, b.y, 28, 10);
          ctx.fillRect(b.x + 4, b.y - 3, 20, 3);
          ctx.fillStyle = '#04060d';
          ctx.fillRect(b.x + 9, b.y + 4, 10, 6);
        }
      });

      ctx.fillStyle = '#22c55e';
      ctx.fillRect(canX, 154, canW, 7);
      ctx.fillRect(canX + 4, 150, 12, 4);
      ctx.fillRect(canX + 8, 146, 4, 4);

      if (bullet) {
        ctx.fillStyle = '#facc15';
        ctx.fillRect(bullet.x, bullet.y, 2, 7);
      }

      ctx.fillStyle = '#f43f5e';
      alienBombs.forEach(b => {
        ctx.fillRect(b.x, b.y, 2, 5);
      });

      const animFrame = Math.floor(tick / 15) % 2;
      aliens.forEach(a => {
        if (a.alive) {
          const ax = alienX + a.c * 32;
          const ay = alienY + a.r * 18;
          ctx.fillStyle = (a.r === 0 ? '#facc15' : (a.r === 1 ? '#06b6d4' : '#ec4899'));

          ctx.fillRect(ax + 3, ay + 2, 14, 8);
          ctx.fillRect(ax + 5, ay, 2, 2);
          ctx.fillRect(ax + 13, ay, 2, 2);
          if (animFrame === 0) {
            ctx.fillRect(ax + 1, ay + 6, 2, 4);
            ctx.fillRect(ax + 17, ay + 6, 2, 4);
          } else {
            ctx.fillRect(ax + 4, ay + 10, 2, 3);
            ctx.fillRect(ax + 14, ay + 10, 2, 3);
          }
          ctx.fillStyle = '#04060d';
          ctx.fillRect(ax + 6, ay + 4, 2, 2);
          ctx.fillRect(ax + 12, ay + 4, 2, 2);
        }
      });

      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 166, canvas.width, 2);

      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(`SCORE: ${score}`, 10, 14);

      this.gameLoopId = requestAnimationFrame(loop);
    };

    loop();
  }

  // ==================== MINI JEU CASSE-BRIQUES ====================
  startBreakoutGame() {
    this.title.textContent = 'Casse-Briques (Breakout)';
    this.topbar.style.backgroundColor = '#f59e0b';

    this.content.innerHTML = `
      <div class="w-full h-full flex flex-col justify-between bg-[#080914] p-1 rounded relative select-none">
        <canvas id="breakout-cvs" width="300" height="175" class="w-full h-full block rounded cursor-pointer"></canvas>
        <div id="breakout-overlay" class="hidden absolute inset-0 bg-black/85 flex flex-col items-center justify-center text-white text-center rounded z-10">
          <div id="breakout-msg" class="font-black text-sm text-amber-400 mb-1 drop-shadow">VICTOIRE !</div>
          <div id="breakout-score-final" class="text-[9px] text-slate-300 mb-2">Score : 0</div>
          <button id="breakout-restart-btn" class="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-bold rounded shadow transition cursor-pointer">
            Rejouer (OK / Espace)
          </button>
        </div>
        <div class="flex items-center justify-between px-1 text-[8px] text-slate-400">
          <span>Souris / ◄►: Raquette • Clic / OK: Lancer</span>
          <div class="flex items-center gap-1">
            <button id="breakout-left-btn" class="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-white rounded font-bold cursor-pointer">◀</button>
            <button id="breakout-launch-btn" class="px-2.5 py-0.5 bg-amber-700 hover:bg-amber-600 text-white rounded font-bold cursor-pointer">🚀 Lancer</button>
            <button id="breakout-right-btn" class="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-white rounded font-bold cursor-pointer">▶</button>
          </div>
          <button id="breakout-back-btn" class="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer">Hub</button>
        </div>
      </div>
    `;

    const canvas = document.getElementById('breakout-cvs');
    const ctx = canvas.getContext('2d');
    const overlay = document.getElementById('breakout-overlay');
    const msgEl = document.getElementById('breakout-msg');
    const finalScoreEl = document.getElementById('breakout-score-final');
    const restartBtn = document.getElementById('breakout-restart-btn');
    const launchBtn = document.getElementById('breakout-launch-btn');
    const leftBtn = document.getElementById('breakout-left-btn');
    const rightBtn = document.getElementById('breakout-right-btn');
    const backBtn = document.getElementById('breakout-back-btn');

    let padX = 125;
    const padW = 46;
    const padH = 7;
    let bx = padX + padW / 2;
    let by = 150;
    let bvx = 2.6;
    let bvy = -2.8;
    let attached = true;
    let lives = 3;
    let score = 0;
    let gameOver = false;
    let autoLaunchTimer = 0;

    let bricks = [];
    const initBricks = () => {
      bricks = [];
      const cols = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4'];
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 8; c++) {
          bricks.push({ r, c, col: cols[r], alive: true, pts: (5 - r) * 10 });
        }
      }
    };
    initBricks();

    this.breakoutMove = (dir) => {
      padX = Math.max(8, Math.min(canvas.width - padW - 8, padX + dir * 16));
      if (attached) bx = padX + padW / 2;
      autoLaunchTimer++;
      if (attached && autoLaunchTimer > 12) {
        this.breakoutLaunch();
      }
    };

    this.breakoutLaunch = () => {
      if (gameOver) { this.breakoutRestart(); return; }
      if (attached) {
        attached = false;
        bvx = (Math.random() < 0.5 ? 2.5 : -2.5);
        bvy = -3.0;
        window.soundFx?.playClick?.();
      }
    };

    this.breakoutRestart = () => {
      padX = 125;
      bx = padX + padW / 2;
      by = 150;
      attached = true;
      lives = 3;
      score = 0;
      gameOver = false;
      autoLaunchTimer = 0;
      initBricks();
      overlay.classList.add('hidden');
    };

    if (restartBtn) restartBtn.addEventListener('click', () => this.breakoutRestart());
    if (launchBtn) launchBtn.addEventListener('click', () => this.breakoutLaunch());
    if (leftBtn) leftBtn.addEventListener('click', () => this.breakoutMove(-1));
    if (rightBtn) rightBtn.addEventListener('click', () => this.breakoutMove(1));
    if (backBtn) backBtn.addEventListener('click', () => this.returnToMenu());

    canvas.addEventListener('click', () => {
      if (attached) this.breakoutLaunch();
      else if (gameOver) this.breakoutRestart();
    });

    canvas.addEventListener('mousemove', (e) => {
      if (gameOver) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const targetX = (e.clientX - rect.left) * scaleX - padW / 2;
      padX = Math.max(8, Math.min(canvas.width - padW - 8, targetX));
      if (attached) bx = padX + padW / 2;
    });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (gameOver || !e.touches[0]) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const targetX = (e.touches[0].clientX - rect.left) * scaleX - padW / 2;
      padX = Math.max(8, Math.min(canvas.width - padW - 8, targetX));
      if (attached) bx = padX + padW / 2;
    }, { passive: false });

    let tick = 0;
    const loop = () => {
      tick++;

      if (!gameOver) {
        if (!attached) {
          bx += bvx;
          by += bvy;

          if (bx <= 4) {
            bx = 4;
            bvx = Math.abs(bvx);
          } else if (bx >= canvas.width - 10) {
            bx = canvas.width - 10;
            bvx = -Math.abs(bvx);
          }

          if (by <= 18) {
            by = 18;
            bvy = Math.abs(bvy);
          }

          if (bvy > 0 && by + 6 >= 156 && by <= 162 && bx + 6 >= padX && bx <= padX + padW) {
            by = 150;
            const rel = ((bx + 3) - (padX + padW / 2)) / (padW / 2);
            bvx = rel * 4.2;
            bvy = -Math.max(2.4, Math.sqrt(Math.max(4, 20 - bvx * bvx)));
            window.soundFx?.playClick?.();
          }

          bricks.forEach(b => {
            if (b.alive) {
              const rx = 10 + b.c * 35;
              const ry = 26 + b.r * 11;
              if (bx + 6 >= rx && bx <= rx + 32 && by + 6 >= ry && by <= ry + 8) {
                b.alive = false;
                bvy = -bvy;
                score += b.pts;
                window.soundFx?.playScore?.();
              }
            }
          });

          if (by > canvas.height) {
            lives--;
            window.soundFx?.playHit?.();
            attached = true;
            autoLaunchTimer = 0;
            bx = padX + padW / 2;
            by = 150;
            if (lives <= 0) {
              gameOver = true;
              msgEl.textContent = 'GAME OVER !';
              msgEl.className = 'font-black text-sm text-red-400 mb-1 drop-shadow';
              if (finalScoreEl) finalScoreEl.textContent = `Score final : ${score}`;
              overlay.classList.remove('hidden');
            }
          }

          if (bricks.every(b => !b.alive)) {
            gameOver = true;
            msgEl.textContent = 'TABLEAU VIDÉ ! VICTOIRE !';
            msgEl.className = 'font-black text-sm text-amber-400 mb-1 drop-shadow';
            if (finalScoreEl) finalScoreEl.textContent = `Score final : ${score}`;
            overlay.classList.remove('hidden');
          }
        }
      }

      ctx.fillStyle = '#080914';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      bricks.forEach(b => {
        if (b.alive) {
          const rx = 10 + b.c * 35;
          const ry = 26 + b.r * 11;
          ctx.fillStyle = b.col;
          ctx.fillRect(rx, ry, 32, 8);
          ctx.fillStyle = 'rgba(255,255,255,0.3)';
          ctx.fillRect(rx, ry, 32, 2);
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.fillRect(rx, ry + 6, 32, 2);
        }
      });

      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(padX, 156, padW, padH);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(padX + 2, 157, padW - 4, 2);

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(bx, by, 6, 6);

      if (attached && !gameOver) {
        ctx.fillStyle = (Math.floor(tick / 18) % 2 === 0) ? '#facc15' : '#e2e8f0';
        ctx.font = 'bold 9px monospace';
        ctx.fillText('[ CLIQUEZ ou OK : LANCER LA BALLE ]', 45, 142);
      }

      ctx.fillStyle = '#cbd5e1';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(`SCORE: ${score}`, 10, 14);

      let heartStr = '';
      for (let i = 0; i < lives; i++) heartStr += '❤️ ';
      ctx.fillText(heartStr, canvas.width - 70, 14);

      this.gameLoopId = requestAnimationFrame(loop);
    };

    loop();
  }

  // ==================== MINI JEU PUISSANCE 4 ====================
  startPuissance4Game() {
    this.title.textContent = 'Puissance 4';
    this.topbar.style.backgroundColor = '#3b82f6';

    this.content.innerHTML = `
      <div class="w-full h-full flex flex-col justify-between bg-[#0b132b] p-1 rounded relative select-none">
        <canvas id="p4-cvs" width="300" height="165" class="w-full h-full block rounded cursor-pointer"></canvas>
        <div id="p4-overlay" class="hidden absolute inset-0 bg-black/85 flex flex-col items-center justify-center text-white text-center rounded z-10">
          <div id="p4-msg" class="font-black text-sm text-yellow-400 mb-1 drop-shadow">VICTOIRE !</div>
          <div class="text-[9px] text-slate-300 mb-2">Alignement de 4 jetons réussi !</div>
          <button id="p4-restart-btn" class="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold rounded shadow transition cursor-pointer">
            Rejouer (OK / Espace)
          </button>
        </div>
        <div class="flex items-center justify-between px-1 text-[8px] text-slate-300 pt-0.5">
          <span id="p4-turn-status" class="font-bold text-yellow-400">À votre tour (Jaune)</span>
          <div class="flex items-center gap-0.5" id="p4-cols-bar">
            <button class="p4-col-btn px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-white rounded font-mono font-bold cursor-pointer" data-col="0">1</button>
            <button class="p4-col-btn px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-white rounded font-mono font-bold cursor-pointer" data-col="1">2</button>
            <button class="p4-col-btn px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-white rounded font-mono font-bold cursor-pointer" data-col="2">3</button>
            <button class="p4-col-btn px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-white rounded font-mono font-bold cursor-pointer" data-col="3">4</button>
            <button class="p4-col-btn px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-white rounded font-mono font-bold cursor-pointer" data-col="4">5</button>
            <button class="p4-col-btn px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-white rounded font-mono font-bold cursor-pointer" data-col="5">6</button>
            <button class="p4-col-btn px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-white rounded font-mono font-bold cursor-pointer" data-col="6">7</button>
          </div>
          <button id="p4-back-btn" class="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer">Hub</button>
        </div>
      </div>
    `;

    const canvas = document.getElementById('p4-cvs');
    const ctx = canvas.getContext('2d');
    const overlay = document.getElementById('p4-overlay');
    const msgEl = document.getElementById('p4-msg');
    const statusEl = document.getElementById('p4-turn-status');
    const restartBtn = document.getElementById('p4-restart-btn');
    const backBtn = document.getElementById('p4-back-btn');
    const colBtns = (this.content && this.content.querySelectorAll) ? this.content.querySelectorAll('.p4-col-btn') : (typeof document !== 'undefined' && document.querySelectorAll ? document.querySelectorAll('.p4-col-btn') : []);

    let board = [
      [0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0]
    ];
    let selCol = 3;
    let curPlayer = 1;
    let gameOver = false;
    let droppingPiece = null;
    let winLine = null;

    const checkWin = (p) => {
      for (let r = 0; r < 6; r++) {
        for (let c = 0; c < 4; c++) {
          if (board[r][c] === p && board[r][c+1] === p && board[r][c+2] === p && board[r][c+3] === p) {
            return [{r,c}, {r,c:c+1}, {r,c:c+2}, {r,c:c+3}];
          }
        }
      }
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 7; c++) {
          if (board[r][c] === p && board[r+1][c] === p && board[r+2][c] === p && board[r+3][c] === p) {
            return [{r,c}, {r:r+1,c}, {r:r+2,c}, {r:r+3,c}];
          }
        }
      }
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 4; c++) {
          if (board[r][c] === p && board[r+1][c+1] === p && board[r+2][c+2] === p && board[r+3][c+3] === p) {
            return [{r,c}, {r:r+1,c:c+1}, {r:r+2,c:c+2}, {r:r+3,c:c+3}];
          }
        }
      }
      for (let r = 3; r < 6; r++) {
        for (let c = 0; c < 4; c++) {
          if (board[r][c] === p && board[r-1][c+1] === p && board[r-2][c+2] === p && board[r-3][c+3] === p) {
            return [{r,c}, {r:r-1,c:c+1}, {r:r-2,c:c+2}, {r:r-3,c:c+3}];
          }
        }
      }
      return null;
    };

    const getLowest = (c) => {
      for (let r = 5; r >= 0; r--) {
        if (board[r][c] === 0) return r;
      }
      return -1;
    };

    this.p4Move = (dir) => {
      if (gameOver || curPlayer !== 1 || droppingPiece) return;
      selCol = Math.max(0, Math.min(6, selCol + dir));
      window.soundFx?.playClick?.();
    };

    this.p4DropCol = (c) => {
      if (gameOver || curPlayer !== 1 || droppingPiece) return;
      selCol = c;
      this.p4Drop();
    };

    this.p4Drop = () => {
      if (gameOver || curPlayer !== 1 || droppingPiece) return;
      const targetR = getLowest(selCol);
      if (targetR !== -1) {
        window.soundFx?.playClick?.();
        droppingPiece = {
          col: selCol,
          targetR: targetR,
          currentY: 10,
          vy: 2.0,
          player: 1
        };
      }
    };

    const runAiTurn = () => {
      if (gameOver) return;
      if (statusEl) {
        statusEl.textContent = "🤖 L'IA réfléchit...";
        statusEl.className = 'font-bold text-red-400';
      }

      setTimeout(() => {
        if (gameOver) return;
        let aiCol = -1;
        for (let c = 0; c < 7; c++) {
          const r = getLowest(c);
          if (r !== -1) {
            board[r][c] = 2;
            if (checkWin(2)) { aiCol = c; }
            board[r][c] = 0;
            if (aiCol !== -1) break;
          }
        }

        if (aiCol === -1) {
          for (let c = 0; c < 7; c++) {
            const r = getLowest(c);
            if (r !== -1) {
              board[r][c] = 1;
              if (checkWin(1)) { aiCol = c; }
              board[r][c] = 0;
              if (aiCol !== -1) break;
            }
          }
        }

        if (aiCol === -1) {
          const prefs = [3, 2, 4, 1, 5, 0, 6];
          for (const p of prefs) {
            if (getLowest(p) !== -1) {
              aiCol = p;
              break;
            }
          }
        }

        if (aiCol !== -1) {
          const targetR = getLowest(aiCol);
          droppingPiece = {
            col: aiCol,
            targetR: targetR,
            currentY: 10,
            vy: 2.0,
            player: 2
          };
        }
      }, 350);
    };

    this.p4Restart = () => {
      board = [
        [0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0]
      ];
      selCol = 3;
      curPlayer = 1;
      gameOver = false;
      droppingPiece = null;
      winLine = null;
      if (statusEl) {
        statusEl.textContent = 'À votre tour (Jaune)';
        statusEl.className = 'font-bold text-yellow-400';
      }
      overlay.classList.add('hidden');
    };

    if (restartBtn) restartBtn.addEventListener('click', () => this.p4Restart());
    if (backBtn) backBtn.addEventListener('click', () => this.returnToMenu());

    colBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const c = parseInt(btn.getAttribute('data-col'), 10);
        this.p4DropCol(c);
      });
    });

    canvas.addEventListener('click', (e) => {
      if (gameOver) { this.p4Restart(); return; }
      if (curPlayer !== 1 || droppingPiece) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const clickX = (e.clientX - rect.left) * scaleX;
      const col = Math.floor((clickX - 30) / 34);
      if (col >= 0 && col <= 6) {
        this.p4DropCol(col);
      }
    });

    canvas.addEventListener('mousemove', (e) => {
      if (gameOver || curPlayer !== 1 || droppingPiece) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const clickX = (e.clientX - rect.left) * scaleX;
      const col = Math.floor((clickX - 30) / 34);
      if (col >= 0 && col <= 6 && col !== selCol) {
        selCol = col;
      }
    });

    let tick = 0;
    const loop = () => {
      tick++;

      if (droppingPiece) {
        droppingPiece.vy += 0.8;
        droppingPiece.currentY += droppingPiece.vy;
        const targetY = 32 + droppingPiece.targetR * 21;

        if (droppingPiece.currentY >= targetY) {
          board[droppingPiece.targetR][droppingPiece.col] = droppingPiece.player;
          const p = droppingPiece.player;
          droppingPiece = null;

          const win = checkWin(p);
          if (win) {
            gameOver = true;
            winLine = win;
            window.soundFx?.playScore?.();
            if (p === 1) {
              msgEl.textContent = 'VOUS AVEZ GAGNÉ ! 🏆';
              msgEl.className = 'font-black text-sm text-yellow-400 mb-1 drop-shadow';
            } else {
              msgEl.textContent = "L'IA A GAGNÉ !";
              msgEl.className = 'font-black text-sm text-red-400 mb-1 drop-shadow';
            }
            overlay.classList.remove('hidden');
          } else {
            const isFull = board[0].every(val => val !== 0);
            if (isFull) {
              gameOver = true;
              msgEl.textContent = 'MATCH NUL !';
              msgEl.className = 'font-black text-sm text-slate-300 mb-1 drop-shadow';
              overlay.classList.remove('hidden');
            } else if (p === 1) {
              curPlayer = 2;
              runAiTurn();
            } else {
              curPlayer = 1;
              if (statusEl) {
                statusEl.textContent = 'À votre tour (Jaune)';
                statusEl.className = 'font-bold text-yellow-400';
              }
            }
          }
        }
      }

      ctx.fillStyle = '#0b132b';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (curPlayer === 1 && !droppingPiece && !gameOver) {
        const cx = 30 + selCol * 34 + 17;
        const bounce = Math.sin(tick * 0.15) * 2;
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(cx, 14 + bounce, 7, 0, Math.PI * 2);
        ctx.fill();
        if (ctx.moveTo && ctx.lineTo) {
          ctx.beginPath();
          ctx.moveTo(cx - 4, 22 + bounce);
          ctx.lineTo(cx + 4, 22 + bounce);
          ctx.lineTo(cx, 26 + bounce);
          ctx.fill();
        }
      }

      ctx.fillStyle = '#1e40af';
      ctx.fillRect(25, 26, 250, 134);
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.strokeRect(25, 26, 250, 134);

      for (let r = 0; r < 6; r++) {
        for (let c = 0; c < 7; c++) {
          const x = 30 + c * 34 + 17;
          const y = 32 + r * 21 + 10;
          const val = board[r][c];

          ctx.beginPath();
          ctx.arc(x, y, 9, 0, Math.PI * 2);
          if (val === 0) {
            ctx.fillStyle = '#0b132b';
          } else if (val === 1) {
            ctx.fillStyle = '#facc15';
          } else {
            ctx.fillStyle = '#ef4444';
          }
          ctx.fill();

          if (val !== 0) {
            ctx.beginPath();
            ctx.arc(x - 3, y - 3, 3, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.fill();
          }
        }
      }

      if (droppingPiece) {
        const x = 30 + droppingPiece.col * 34 + 17;
        const y = droppingPiece.currentY;
        ctx.beginPath();
        ctx.arc(x, y, 9, 0, Math.PI * 2);
        ctx.fillStyle = droppingPiece.player === 1 ? '#facc15' : '#ef4444';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x - 3, y - 3, 3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fill();
      }

      if (winLine && winLine.length === 4) {
        ctx.strokeStyle = (Math.floor(tick / 8) % 2 === 0) ? '#ffffff' : '#4ade80';
        ctx.lineWidth = 4;
        if (ctx.moveTo && ctx.lineTo) {
          ctx.beginPath();
          const pStart = winLine[0];
          const pEnd = winLine[3];
          ctx.moveTo(30 + pStart.c * 34 + 17, 32 + pStart.r * 21 + 10);
          ctx.lineTo(30 + pEnd.c * 34 + 17, 32 + pEnd.r * 21 + 10);
          ctx.stroke();
        }
      }

      this.gameLoopId = requestAnimationFrame(loop);
    };

    loop();
  }

  // ==================== FICHES DE COURS & FORMULAIRES ====================
  startCoursesViewer() {
    this.title.textContent = 'Fiches de Cours';
    this.topbar.style.backgroundColor = '#f59e0b';
    let curPage = 0;
    const pages = [
      {
        title: "Dérivées Usuelles",
        sub: "Mathématiques",
        lines: [
          "(k)' = 0   |   (xⁿ)' = n·xⁿ⁻¹",
          "(1/x)' = -1/x²   |   (√x)' = 1/(2√x)",
          "(eˣ)' = eˣ   |   (eᵃˣ)' = a·eᵃˣ",
          "(ln x)' = 1/x   |   (sin x)' = cos x",
          "(u·v)' = u'v + uv'   |   (u/v)' = (u'v-uv')/v²"
        ]
      },
      {
        title: "Primitives Usuelles",
        sub: "Mathématiques",
        lines: [
          "xⁿ  →  xⁿ⁺¹ / (n+1)   (n ≠ -1)",
          "1/x  →  ln|x|   |   1/√x  →  2√x",
          "eᵃˣ  →  (1/a)·eᵃˣ",
          "u'·eᵘ  →  eᵘ",
          "u'/u  →  ln|u|"
        ]
      },
      {
        title: "Trigonométrie",
        sub: "Formulaire",
        lines: [
          "cos²(x) + sin²(x) = 1",
          "cos(a+b) = cos a cos b - sin a sin b",
          "sin(a+b) = sin a cos b + cos a sin b",
          "cos(2a) = 2 cos²(a) - 1",
          "sin(2a) = 2 sin(a) cos(a)"
        ]
      }
    ];

    const render = () => {
      const p = pages[curPage];
      this.content.innerHTML = `
        <div class="h-full flex flex-col justify-between bg-white p-2 rounded text-slate-800 text-[10px] font-mono select-none">
          <div>
            <div class="text-[9px] text-amber-600 font-bold uppercase">${p.sub}</div>
            <div class="font-extrabold text-xs text-slate-900 border-b border-amber-300 pb-0.5">${p.title}</div>
            <div class="space-y-1 pt-1.5 text-[9px] text-slate-700">
              ${p.lines.map(l => `<div class="bg-amber-50/80 p-1 rounded border border-amber-200/50">${l}</div>`).join('')}
            </div>
          </div>
          <div class="flex justify-between items-center text-[8px] text-slate-400 pt-1 border-t border-slate-200">
            <span>◄ ► : Page ${curPage + 1}/${pages.length}</span>
            <span class="font-bold text-amber-600">Back : Hub</span>
          </div>
        </div>
      `;
    };

    this.nextCoursePage = (dir) => {
      window.soundFx?.playClick?.();
      curPage = (curPage + dir + pages.length) % pages.length;
      render();
    };

    render();
  }

  // ==================== TABLEAU PÉRIODIQUE ====================
  startPeriodicViewer() {
    this.title.textContent = 'Tableau Périodique';
    this.topbar.style.backgroundColor = '#10b981';

    const elements = [
      { z: 1, s: 'H', n: 'Hydrogène', m: '1.008', cat: 'Non-métal' },
      { z: 2, s: 'He', n: 'Hélium', m: '4.003', cat: 'Gaz noble' },
      { z: 6, s: 'C', n: 'Carbone', m: '12.011', cat: 'Non-métal' },
      { z: 7, s: 'N', n: 'Azote', m: '14.007', cat: 'Non-métal' },
      { z: 8, s: 'O', n: 'Oxygène', m: '15.999', cat: 'Non-métal' },
      { z: 11, s: 'Na', n: 'Sodium', m: '22.990', cat: 'Alcalin' },
      { z: 26, s: 'Fe', n: 'Fer', m: '55.845', cat: 'Métal trans.' },
      { z: 79, s: 'Au', n: 'Or', m: '196.97', cat: 'Métal noble' }
    ];

    let currentZ = 0;

    const render = () => {
      const el = elements[currentZ];
      this.content.innerHTML = `
        <div class="h-full flex flex-col justify-between bg-slate-900 text-white p-2 rounded font-mono select-none">
          <div class="flex items-center gap-3">
            <div class="w-14 h-14 rounded-lg bg-emerald-600 flex flex-col items-center justify-center font-bold text-lg border-2 border-emerald-400 shadow">
              <span class="text-[9px] text-emerald-200">Z=${el.z}</span>
              <span>${el.s}</span>
            </div>
            <div>
              <div class="font-extrabold text-xs text-emerald-400">${el.n}</div>
              <div class="text-[9px] text-slate-300">Masse: ${el.m} g/mol</div>
              <div class="text-[9px] text-emerald-300/80">${el.cat}</div>
            </div>
          </div>
          <div class="bg-slate-800 p-1.5 rounded text-[9px] text-slate-300 space-y-0.5">
            <div>118 éléments chargés en mémoire C native.</div>
            <div>Navigation immédiate sur NumWorks N0120.</div>
          </div>
          <div class="text-[8px] text-slate-400 text-center flex justify-between">
            <button id="el-prev" class="text-emerald-400 font-bold cursor-pointer">◄ Précédent</button>
            <span>Back : Hub</span>
            <button id="el-next" class="text-emerald-400 font-bold cursor-pointer">Suivant ►</button>
          </div>
        </div>
      `;

      document.getElementById('el-prev').addEventListener('click', () => {
        window.soundFx?.playClick?.();
        currentZ = (currentZ - 1 + elements.length) % elements.length;
        render();
      });
      document.getElementById('el-next').addEventListener('click', () => {
        window.soundFx?.playClick?.();
        currentZ = (currentZ + 1) % elements.length;
        render();
      });
    };

    render();
  }

  // ==================== MARIO KART PREVIEW ====================
  startMarioKartPreview() {
    this.title.textContent = 'Super Mario Kart 3D';
    this.topbar.style.backgroundColor = '#ef4444';

    this.content.innerHTML = `
      <div class="w-full h-full flex flex-col justify-between bg-sky-300 rounded overflow-hidden relative">
        <canvas id="mario-cvs" width="280" height="150" class="w-full h-full block"></canvas>
        <div class="absolute bottom-1 w-full text-center text-[8px] text-white font-bold drop-shadow">
          Mode 7 3D Temps Réel (MathDS) • Back : Hub
        </div>
      </div>
    `;

    const canvas = document.getElementById('mario-cvs');
    const ctx = canvas.getContext('2d');
    let offset = 0;

    const loop = () => {
      offset += 2;
      ctx.fillStyle = '#60a5fa';
      ctx.fillRect(0, 0, canvas.width, 60);

      ctx.fillStyle = '#15803d';
      ctx.fillRect(0, 60, canvas.width, 90);

      for (let y = 60; y < 150; y += 4) {
        const stripe = ((y + offset) % 16 < 8);
        ctx.fillStyle = stripe ? '#e2e8f0' : '#94a3b8';
        const w = (y - 50) * 2;
        ctx.fillRect((canvas.width - w) / 2, y, w, 4);
      }

      ctx.fillStyle = '#dc2626';
      ctx.fillRect(132, 115, 16, 12);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(136, 118, 8, 4);

      this.gameLoopId = requestAnimationFrame(loop);
    };

    loop();
  }


  startGenericPreview(type) {
    this.title.textContent = 'EquaLib Application';
    this.topbar.style.backgroundColor = '#FFBB00';
    this.content.innerHTML = `
      <div class="h-full flex flex-col items-center justify-center text-center p-3 text-slate-700 bg-white rounded">
        <div class="text-2xl mb-1">🎮</div>
        <div class="font-bold text-xs text-slate-900">${type}</div>
        <div class="text-[9px] text-slate-500 mt-1">Application compilée en C natif pour NumWorks N0120.</div>
        <div class="text-[8px] text-amber-600 mt-2 font-bold">Appuyez sur Back pour revenir au Hub.</div>
      </div>
    `;
  }
}

window.NumWorksSimulator = NumWorksSimulator;

/**
 * EquaLib Interactive Virtual NumWorks Simulator
 * Moteur de simulation en direct des jeux et applications pour le web
 */
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

    this.displayMode = (window.userSettings && window.userSettings.displayMode) || 'gallery';
    this.theme = (window.userSettings && window.userSettings.theme) || 'default';
    this.showTooltips = (window.userSettings && window.userSettings.showTooltips !== undefined) ? window.userSettings.showTooltips : true;
    this.settingsSubIndex = 0;

    this.gameLoopId = null;
    this.init();
  }

  init() {
    this.renderMenu();
    this.bindControls();
    this.bindTouchGestures();
  }

  bindTouchGestures() {
    let startX = 0;
    let startY = 0;
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
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      if (Math.max(absX, absY) > 25) {
        if (absX > absY) {
          if (dx > 0) this.handleInput('RIGHT');
          else this.handleInput('LEFT');
        } else {
          if (dy > 0) this.handleInput('DOWN');
          else this.handleInput('UP');
        }
      }
    }, { passive: true });
  }

  bindControls() {
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

      if (this.currentView === 'MENU') {
        if (e.key === 'ArrowUp') { e.preventDefault(); this.handleInput('UP'); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); this.handleInput('DOWN'); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); this.handleInput('LEFT'); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); this.handleInput('RIGHT'); }
        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.launchSelected(); }
        else if (e.key.toLowerCase() === 't' || e.key.toLowerCase() === 'p') { e.preventDefault(); this.launchApp('SETTINGS'); }
      } else if (this.currentView === 'SETTINGS') {
        if (e.key === 'ArrowUp') { e.preventDefault(); this.settingsMove(-1); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); this.settingsMove(1); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); this.settingsChange(-1); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); this.settingsChange(1); }
        else if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape' || e.key === 'Backspace') {
          e.preventDefault();
          this.returnToMenu();
        }
      } else if (this.currentView === 'FLAPPY') {
        if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'Enter') {
          e.preventDefault();
          this.flappyFlap();
        } else if (e.key === 'Escape' || e.key === 'Backspace') {
          e.preventDefault();
          this.returnToMenu();
        }
      } else if (this.currentView === 'SNAKE') {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
          e.preventDefault();
          this.snakeChangeDir(e.key);
        } else if (e.key === 'Escape' || e.key === 'Backspace') {
          e.preventDefault();
          this.returnToMenu();
        }
      } else if (this.currentView === '2048') {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', '8', '2', '4', '6'].includes(e.key)) {
          e.preventDefault();
          const dirMap = { 'ArrowUp': 'UP', 'ArrowDown': 'DOWN', 'ArrowLeft': 'LEFT', 'ArrowRight': 'RIGHT', '8': 'UP', '2': 'DOWN', '4': 'LEFT', '6': 'RIGHT' };
          this.slide2048(dirMap[e.key] || e.key);
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.restart2048?.();
        } else if (e.key === 'Escape' || e.key === 'Backspace') {
          e.preventDefault();
          this.returnToMenu();
        }
      } else if (this.currentView === 'PONG') {
        if (e.key === 'ArrowUp' || e.key === 'w' || e.key === '8') { e.preventDefault(); this.pongMove(-1); }
        else if (e.key === 'ArrowDown' || e.key === 's' || e.key === '2') { e.preventDefault(); this.pongMove(1); }
        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.pongRestart?.(); }
        else if (e.key === 'Escape' || e.key === 'Backspace') { e.preventDefault(); this.returnToMenu(); }
      } else if (this.currentView === 'DINO') {
        if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === '8') { e.preventDefault(); this.dinoJump?.(); }
        else if (e.key === 'ArrowDown' || e.key === '2') { e.preventDefault(); this.dinoDuck?.(true); }
        else if (e.key === 'Escape' || e.key === 'Backspace') { e.preventDefault(); this.returnToMenu(); }
      } else if (this.currentView === 'SPACE_INVADERS') {
        if (e.key === 'ArrowLeft' || e.key === '4') { e.preventDefault(); this.invadersMove?.(-1); }
        else if (e.key === 'ArrowRight' || e.key === '6') { e.preventDefault(); this.invadersMove?.(1); }
        else if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowUp') { e.preventDefault(); this.invadersShoot?.(); }
        else if (e.key === 'Escape' || e.key === 'Backspace') { e.preventDefault(); this.returnToMenu(); }
      } else if (this.currentView === 'BREAKOUT') {
        if (e.key === 'ArrowLeft' || e.key === '4') { e.preventDefault(); this.breakoutMove?.(-1); }
        else if (e.key === 'ArrowRight' || e.key === '6') { e.preventDefault(); this.breakoutMove?.(1); }
        else if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowUp') { e.preventDefault(); this.breakoutLaunch?.(); }
        else if (e.key === 'Escape' || e.key === 'Backspace') { e.preventDefault(); this.returnToMenu(); }
      } else if (this.currentView === 'PUISSANCE4') {
        if (e.key === 'ArrowLeft' || e.key === '4') { e.preventDefault(); this.p4Move?.(-1); }
        else if (e.key === 'ArrowRight' || e.key === '6') { e.preventDefault(); this.p4Move?.(1); }
        else if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); this.p4Drop?.(); }
        else if (e.key === 'Escape' || e.key === 'Backspace') { e.preventDefault(); this.returnToMenu(); }
      } else if (this.currentView === 'COURSES') {
        if (e.key === 'ArrowRight') { e.preventDefault(); this.nextCoursePage(1); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); this.nextCoursePage(-1); }
        else if (e.key === 'Escape' || e.key === 'Backspace') { e.preventDefault(); this.returnToMenu(); }
      } else {
        if (e.key === 'Escape' || e.key === 'Backspace') {
          e.preventDefault();
          this.returnToMenu();
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      if (this.currentView === 'DINO' && (e.key === 'ArrowDown' || e.key === '2')) {
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
        document.body.classList.toggle('hide-tooltips', !this.showTooltips);
      }
    } else if (this.settingsSubIndex === 2) {
      const themesList = ['default', 'sakura', 'hacker', 'bee', 'mario', 'gameboy'];
      let curIdx = themesList.indexOf(this.theme);
      if (curIdx === -1) curIdx = 0;
      const nextIdx = (curIdx + dir + themesList.length) % themesList.length;
      this.theme = themesList[nextIdx];
      if (typeof window.setAppTheme === 'function') {
        window.setAppTheme(this.theme);
      }
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

    const selApp = this.apps[this.selectedIndex] || this.apps[0];
    let html = '';

    if (this.displayMode === 'gallery') {
      const page = Math.floor(this.selectedIndex / 6);
      const pageStart = page * 6;
      const visibleApps = this.apps.slice(pageStart, pageStart + 6);

      html += `<div class="grid grid-cols-3 gap-1 mb-1">`;
      visibleApps.forEach((app, relIdx) => {
        const absIdx = pageStart + relIdx;
        const isSel = (absIdx === this.selectedIndex);
        html += `
          <div class="sim-item sim-gallery-card cursor-pointer p-1 rounded-lg border text-center flex flex-col items-center justify-between transition-all select-none"
            data-index="${absIdx}"
            style="background-color: ${isSel ? pal.cardSel : pal.card}; border-color: ${isSel ? pal.border : 'rgba(0,0,0,0.1)'}; ${isSel ? 'box-shadow: 0 0 8px ' + pal.border + '66; transform: scale(1.02);' : ''} height: 50px;">
            <span class="text-base leading-none">${app.icon}</span>
            <span class="text-[9px] font-bold truncate max-w-full leading-tight" style="color: ${isSel ? pal.border : pal.text}">${app.name.replace(/^[0-9]+\.\s*/, '')}</span>
          </div>
        `;
      });
      html += `</div>`;

      html += `
        <div class="flex justify-between items-center text-[8px] px-1" style="color: ${pal.descText}">
          <span>Page ${page + 1}/${Math.ceil(this.apps.length / 6)}</span>
          <span>${pal.badge}</span>
        </div>
      `;
    } else {
      html += `<div class="space-y-1 overflow-y-auto max-h-[110px] pr-1">`;
      this.apps.forEach((app, idx) => {
        const isSel = idx === this.selectedIndex;
        html += `
          <div class="sim-item cursor-pointer p-1 rounded ${
            isSel 
              ? 'font-bold shadow-sm' 
              : 'hover:opacity-80'
          } text-[10px] flex justify-between items-center transition-all border"
            data-index="${idx}"
            style="background-color: ${isSel ? pal.cardSel : pal.card}; border-color: ${isSel ? pal.border : 'rgba(0,0,0,0.1)'};">
            <span class="truncate flex items-center gap-1" style="color: ${isSel ? pal.border : pal.text}">
              <span>${app.icon}</span> ${app.name}
            </span>
            <span class="text-[9px] shrink-0 ml-1 font-mono" style="color: ${pal.descText}">${app.cat}</span>
          </div>
        `;
      });
      html += `</div>`;
    }

    /* BANDEAU EN BAS AU CENTRE : APPLI ACTIVE */
    html += `
      <div class="sim-bottom-dock p-1.5 rounded-lg border shadow-sm flex items-center justify-between text-[10px] select-none transition-all mt-1"
        style="background-color: ${pal.card}; border-color: ${pal.border};">
        <div class="flex items-center gap-1.5 min-w-0">
          <span class="text-sm shrink-0">${selApp.icon || '📦'}</span>
          <span class="font-extrabold truncate" style="color: ${pal.text}">${selApp.name}</span>
        </div>
        <span class="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold shrink-0 ml-1 border"
          style="background-color: ${pal.border}22; color: ${pal.border}; border-color: ${pal.border}55;">${selApp.cat}</span>
      </div>
    `;

    /* RACCOURCIS / TOOLTIPS AU BAS DE L'ÉCRAN */
    if (this.showTooltips) {
      html += `
        <div class="text-[8px] text-center truncate pt-0.5" style="color: ${pal.descText}">
          ▲▼◀▶: Naviguer | OK: Lancer | Back: Hub
        </div>
      `;
    }

    this.content.innerHTML = html;

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
    let bestScore = 0;
    try {
      bestScore = parseInt(localStorage.getItem('equalib_2048_best') || '0', 10) || 0;
    } catch (_) {}
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
        8: 'bg-[#f2b179] text-white',
        16: 'bg-[#f59563] text-white',
        32: 'bg-[#f67c5f] text-white',
        64: 'bg-[#e95937] text-white',
        128: 'bg-[#edcf72] text-white text-[9px]',
        256: 'bg-[#edcc61] text-white text-[9px]',
        512: 'bg-[#edc850] text-white text-[9px]',
        1024: 'bg-[#edc53f] text-white text-[8px]',
        2048: 'bg-[#edc22e] text-white text-[8px]'
      };
      return styles[val] || 'bg-[#3c3a32] text-white text-[7px]';
    };

    const render = () => {
      let cellsHtml = '';
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          const val = grid[r][c];
          const style = getTileStyle(val);
          cellsHtml += `
            <div class="h-8 rounded flex items-center justify-center font-bold text-[10px] ${style} shadow-sm transition-all duration-75 select-none">
              ${val > 0 ? val : ''}
            </div>
          `;
        }
      }

      this.content.innerHTML = `
        <div class="flex flex-col justify-between h-full bg-[#faf8ef] p-2 rounded relative select-none">
          <div class="flex justify-between items-center text-[10px] font-bold text-slate-800">
            <span class="text-amber-700 tracking-wider font-black">2048</span>
            <div class="flex gap-1">
              <span class="bg-[#bbada0] text-white px-1.5 py-0.5 rounded text-[8px]">Score: ${score}</span>
              <span class="bg-[#8f7a66] text-white px-1.5 py-0.5 rounded text-[8px]">Best: ${bestScore}</span>
            </div>
          </div>
          <div class="grid grid-cols-4 gap-1.5 bg-[#bbada0] p-1.5 rounded-lg my-1">
            ${cellsHtml}
          </div>
          ${isGameOver ? `
            <div class="absolute inset-0 bg-[#eee4da]/90 backdrop-blur-[1px] flex flex-col items-center justify-center rounded z-10">
              <div class="text-sm font-extrabold text-[#776e65] mb-1">GAME OVER !</div>
              <div class="text-[9px] text-[#8f7a66] mb-2 font-bold">Score Final : ${score}</div>
              <button onclick="window.simulator.restart2048()" class="px-3 py-1 bg-[#8f7a66] hover:bg-[#776e65] text-white text-[9px] font-bold rounded shadow transition cursor-pointer">
                Rejouer (OK)
              </button>
            </div>
          ` : `
            <div class="text-[8px] text-slate-500 text-center font-medium">
              Flèches / Swipe : Glisser • Back : Hub
            </div>
          `}
        </div>
      `;
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

      const d = dir.toUpperCase();
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
          try { localStorage.setItem('equalib_2048_best', String(bestScore)); } catch (_) {}
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
      <div class="w-full h-full flex flex-col justify-between bg-[#0a0c12] p-1 rounded relative">
        <canvas id="pong-cvs" width="280" height="150" class="w-full h-full block rounded"></canvas>
        <div id="pong-overlay" class="hidden absolute inset-0 bg-black/75 flex flex-col items-center justify-center text-white text-center rounded">
          <div id="pong-msg" class="font-black text-xs text-cyan-400 mb-1">VICTOIRE !</div>
          <button onclick="window.simulator.pongRestart()" class="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white text-[9px] font-bold rounded shadow transition cursor-pointer">
            Rejouer (OK)
          </button>
        </div>
        <div class="text-[8px] text-slate-400 text-center">▲▼ : Raquette • Back : Hub</div>
      </div>
    `;

    const canvas = document.getElementById('pong-cvs');
    const ctx = canvas.getContext('2d');
    const overlay = document.getElementById('pong-overlay');
    const msgEl = document.getElementById('pong-msg');

    let p1Y = 55;
    let cpuY = 55;
    let bx = 140;
    let by = 75;
    let bvx = 3.0;
    let bvy = 1.8;
    let s1 = 0;
    let sc = 0;
    let gameOver = false;

    this.pongMove = (dir) => {
      p1Y = Math.max(10, Math.min(105, p1Y + dir * 12));
    };

    this.pongRestart = () => {
      s1 = 0;
      sc = 0;
      bx = 140;
      by = 75;
      bvx = 3.0;
      gameOver = false;
      overlay.classList.add('hidden');
    };

    const loop = () => {
      if (!gameOver) {
        bx += bvx;
        by += bvy;

        if (by <= 4 || by >= canvas.height - 10) bvy = -bvy;

        if (bvx > 0 && bx > 90) {
          if (cpuY + 20 < by - 4) cpuY += 2.4;
          else if (cpuY + 20 > by + 4) cpuY -= 2.4;
        }

        // Collision P1 (x = 12)
        if (bvx < 0 && bx <= 18 && bx >= 8 && by + 6 >= p1Y && by <= p1Y + 36) {
          bx = 18;
          bvx = Math.min(5.5, -bvx * 1.05);
          bvy = ((by - (p1Y + 18)) / 18) * 3.5;
          window.soundFx?.playClick?.();
        }

        // Collision CPU (x = 262)
        if (bvx > 0 && bx >= 256 && bx <= 266 && by + 6 >= cpuY && by <= cpuY + 36) {
          bx = 256;
          bvx = -Math.min(5.5, Math.abs(bvx) * 1.05);
          bvy = ((by - (cpuY + 18)) / 18) * 3.5;
          window.soundFx?.playClick?.();
        }

        if (bx < 0) {
          sc++;
          bx = 140;
          by = 75;
          bvx = 3.0;
          if (sc >= 7) { gameOver = true; msgEl.textContent = 'DEFAITE !'; msgEl.className = 'font-black text-xs text-red-400 mb-1'; overlay.classList.remove('hidden'); }
        } else if (bx > canvas.width) {
          s1++;
          bx = 140;
          by = 75;
          bvx = -3.0;
          if (s1 >= 7) { gameOver = true; msgEl.textContent = 'VICTOIRE !'; msgEl.className = 'font-black text-xs text-emerald-400 mb-1'; overlay.classList.remove('hidden'); }
        }
      }

      ctx.fillStyle = '#0a0c12';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Filet central
      ctx.fillStyle = '#374151';
      for (let y = 0; y < canvas.height; y += 12) {
        ctx.fillRect(139, y, 2, 6);
      }

      // Raquettes
      ctx.fillStyle = '#00e5ff';
      ctx.fillRect(10, p1Y, 6, 36);
      ctx.fillStyle = '#ff4757';
      ctx.fillRect(264, cpuY, 6, 36);

      // Balle
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(bx, by, 6, 6);

      // Score
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(`${s1}`, 110, 16);
      ctx.fillText(`${sc}`, 160, 16);

      this.gameLoopId = requestAnimationFrame(loop);
    };

    loop();
  }

  // ==================== MINI JEU CHROME DINO RUNNER ====================
  startDinoGame() {
    this.title.textContent = 'Chrome Dino Runner';
    this.topbar.style.backgroundColor = '#78716c';

    this.content.innerHTML = `
      <div class="w-full h-full flex flex-col justify-between bg-[#f7f7f7] p-1 rounded relative cursor-pointer" id="dino-wrap">
        <canvas id="dino-cvs" width="280" height="150" class="w-full h-full block rounded"></canvas>
        <div id="dino-overlay" class="hidden absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white text-center rounded">
          <div class="font-black text-xs text-slate-100 mb-1">G A M E   O V E R</div>
          <button onclick="window.simulator.dinoRestart()" class="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white text-[9px] font-bold rounded shadow transition cursor-pointer">
            Rejouer (OK)
          </button>
        </div>
        <div class="text-[8px] text-slate-500 text-center">OK / Espace : Sauter • Bas : Baisser • Back : Hub</div>
      </div>
    `;

    const canvas = document.getElementById('dino-cvs');
    const ctx = canvas.getContext('2d');
    const overlay = document.getElementById('dino-overlay');

    let dinoY = 110;
    let velY = 0;
    let onGround = true;
    let ducking = false;
    let score = 0;
    let hiScore = 0;
    let obstacles = [{ x: 300, type: 0 }];
    let gameOver = false;
    let speed = 4.0;
    let tick = 0;

    this.dinoJump = () => {
      if (gameOver) { this.dinoRestart(); return; }
      if (onGround) {
        velY = -8.5;
        onGround = false;
        window.soundFx?.playClick?.();
      }
    };

    this.dinoDuck = (val) => {
      ducking = val;
    };

    this.dinoRestart = () => {
      dinoY = 110;
      velY = 0;
      onGround = true;
      score = 0;
      speed = 4.0;
      obstacles = [{ x: 300, type: 0 }];
      gameOver = false;
      overlay.classList.add('hidden');
    };

    document.getElementById('dino-wrap').addEventListener('click', () => this.dinoJump());

    const loop = () => {
      tick++;
      if (!gameOver) {
        if (!onGround) {
          velY += 0.65;
          dinoY += velY;
          if (dinoY >= 110) {
            dinoY = 110;
            velY = 0;
            onGround = true;
          }
        }

        obstacles.forEach(o => {
          o.x -= speed;
          if (o.x < -20) {
            o.x = canvas.width + Math.floor(Math.random() * 80) + 40;
            o.type = Math.random() < 0.3 ? 1 : 0;
            score += 10;
            if (score > hiScore) hiScore = score;
            if (speed < 7.5) speed += 0.05;
          }

          // Hitbox
          const dW = ducking ? 20 : 14;
          const dH = ducking ? 10 : 20;
          const dY = ducking ? dinoY + 10 : dinoY;
          const oW = o.type === 0 ? 10 : 16;
          const oH = o.type === 0 ? 20 : 16;
          const oY = o.type === 0 ? 110 : (Math.random() < 0.5 ? 95 : 110);

          if (30 < o.x + oW && 30 + dW > o.x && dY < oY + oH && dY + dH > oY) {
            gameOver = true;
            window.soundFx?.playHit?.();
            overlay.classList.remove('hidden');
          }
        });
      }

      ctx.fillStyle = '#f7f7f7';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Sol
      ctx.fillStyle = '#535353';
      ctx.fillRect(0, 130, canvas.width, 2);

      // Nuages
      ctx.fillStyle = '#d4d4d4';
      ctx.fillRect((280 - (tick % 280)), 30, 24, 6);
      ctx.fillRect((140 - (tick % 280) + 280) % 280, 50, 28, 6);

      // Dino
      ctx.fillStyle = '#535353';
      if (ducking && onGround) {
        ctx.fillRect(30, dinoY + 10, 22, 10);
      } else {
        ctx.fillRect(30, dinoY, 14, 20);
        ctx.fillRect(38, dinoY - 4, 8, 8); // tête
      }

      // Obstacles
      obstacles.forEach(o => {
        if (o.type === 0) {
          ctx.fillStyle = '#22c55e';
          ctx.fillRect(o.x, 110, 10, 20);
        } else {
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(o.x, 95, 14, 8); // Ptéro
        }
      });

      // Score
      ctx.fillStyle = '#535353';
      ctx.font = 'bold 9px monospace';
      ctx.fillText(`HI ${String(hiScore).padStart(5, '0')}  ${String(score).padStart(5, '0')}`, 170, 15);

      this.gameLoopId = requestAnimationFrame(loop);
    };

    loop();
  }

  // ==================== MINI JEU SPACE INVADERS ====================
  startSpaceInvadersGame() {
    this.title.textContent = 'Space Invaders Retro';
    this.topbar.style.backgroundColor = '#10b981';

    this.content.innerHTML = `
      <div class="w-full h-full flex flex-col justify-between bg-[#050610] p-1 rounded relative">
        <canvas id="invaders-cvs" width="280" height="150" class="w-full h-full block rounded"></canvas>
        <div id="invaders-overlay" class="hidden absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white text-center rounded">
          <div id="invaders-msg" class="font-black text-xs text-emerald-400 mb-1">VICTOIRE !</div>
          <button onclick="window.simulator.invadersRestart()" class="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[9px] font-bold rounded shadow transition cursor-pointer">
            Rejouer (OK)
          </button>
        </div>
        <div class="text-[8px] text-slate-400 text-center">◄ ► : Vaisseau • OK / Espace : Tirer • Back : Hub</div>
      </div>
    `;

    const canvas = document.getElementById('invaders-cvs');
    const ctx = canvas.getContext('2d');
    const overlay = document.getElementById('invaders-overlay');
    const msgEl = document.getElementById('invaders-msg');

    let canX = 130;
    let bullet = null;
    let alienDir = 1;
    let alienX = 20;
    let alienY = 20;
    let score = 0;
    let gameOver = false;

    let aliens = [];
    const initAliens = () => {
      aliens = [];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 6; c++) {
          aliens.push({ r, c, alive: true });
        }
      }
    };
    initAliens();

    this.invadersMove = (dir) => {
      canX = Math.max(10, Math.min(canvas.width - 26, canX + dir * 12));
    };

    this.invadersShoot = () => {
      if (gameOver) { this.invadersRestart(); return; }
      if (!bullet) {
        bullet = { x: canX + 7, y: 130 };
        window.soundFx?.playClick?.();
      }
    };

    this.invadersRestart = () => {
      canX = 130;
      bullet = null;
      alienDir = 1;
      alienX = 20;
      alienY = 20;
      score = 0;
      gameOver = false;
      initAliens();
      overlay.classList.add('hidden');
    };

    let tick = 0;
    const loop = () => {
      tick++;
      if (!gameOver) {
        if (tick % 20 === 0) {
          alienX += alienDir * 6;
          if (alienX > 80 || alienX < 10) {
            alienDir = -alienDir;
            alienY += 6;
          }
        }

        if (bullet) {
          bullet.y -= 5;
          if (bullet.y < 0) bullet = null;
          else {
            aliens.forEach(a => {
              if (a.alive) {
                const ax = alienX + a.c * 28;
                const ay = alienY + a.r * 16;
                if (bullet && bullet.x >= ax && bullet.x <= ax + 18 && bullet.y >= ay && bullet.y <= ay + 12) {
                  a.alive = false;
                  bullet = null;
                  score += 20;
                  window.soundFx?.playScore?.();
                }
              }
            });
          }
        }

        const aliveCount = aliens.filter(a => a.alive).length;
        if (aliveCount === 0) {
          gameOver = true;
          msgEl.textContent = 'VICTOIRE !';
          msgEl.className = 'font-black text-xs text-emerald-400 mb-1';
          overlay.classList.remove('hidden');
        } else if (aliens.some(a => a.alive && (alienY + a.r * 16 >= 125))) {
          gameOver = true;
          msgEl.textContent = 'GAME OVER !';
          msgEl.className = 'font-black text-xs text-red-400 mb-1';
          overlay.classList.remove('hidden');
        }
      }

      ctx.fillStyle = '#050610';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Canon Joueur
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(canX, 136, 16, 8);
      ctx.fillRect(canX + 6, 131, 4, 5);

      // Tir
      if (bullet) {
        ctx.fillStyle = '#facc15';
        ctx.fillRect(bullet.x, bullet.y, 2, 6);
      }

      // Aliens
      aliens.forEach(a => {
        if (a.alive) {
          const ax = alienX + a.c * 28;
          const ay = alienY + a.r * 16;
          ctx.fillStyle = a.r === 0 ? '#facc15' : (a.r === 1 ? '#06b6d4' : '#ef4444');
          ctx.fillRect(ax + 2, ay, 14, 10);
        }
      });

      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 9px monospace';
      ctx.fillText(`Score: ${score}`, 6, 12);

      this.gameLoopId = requestAnimationFrame(loop);
    };

    loop();
  }

  // ==================== MINI JEU CASSE-BRIQUES ====================
  startBreakoutGame() {
    this.title.textContent = 'Casse-Briques (Breakout)';
    this.topbar.style.backgroundColor = '#f59e0b';

    this.content.innerHTML = `
      <div class="w-full h-full flex flex-col justify-between bg-[#0a0c18] p-1 rounded relative">
        <canvas id="breakout-cvs" width="280" height="150" class="w-full h-full block rounded"></canvas>
        <div id="breakout-overlay" class="hidden absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white text-center rounded">
          <div id="breakout-msg" class="font-black text-xs text-amber-400 mb-1">VICTOIRE !</div>
          <button onclick="window.simulator.breakoutRestart()" class="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white text-[9px] font-bold rounded shadow transition cursor-pointer">
            Rejouer (OK)
          </button>
        </div>
        <div class="text-[8px] text-slate-400 text-center">◄ ► : Raquette • OK : Lancer • Back : Hub</div>
      </div>
    `;

    const canvas = document.getElementById('breakout-cvs');
    const ctx = canvas.getContext('2d');
    const overlay = document.getElementById('breakout-overlay');
    const msgEl = document.getElementById('breakout-msg');

    let padX = 120;
    let bx = 138;
    let by = 132;
    let bvx = 2.4;
    let bvy = -2.8;
    let attached = true;
    let lives = 3;
    let score = 0;
    let gameOver = false;

    let bricks = [];
    const initBricks = () => {
      bricks = [];
      const cols = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4'];
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 7; c++) {
          bricks.push({ r, c, col: cols[r], alive: true });
        }
      }
    };
    initBricks();

    this.breakoutMove = (dir) => {
      padX = Math.max(6, Math.min(canvas.width - 46, padX + dir * 14));
      if (attached) bx = padX + 17;
    };

    this.breakoutLaunch = () => {
      if (gameOver) { this.breakoutRestart(); return; }
      if (attached) {
        attached = false;
        bvx = (Math.random() < 0.5 ? 2.2 : -2.2);
        bvy = -2.8;
      }
    };

    this.breakoutRestart = () => {
      padX = 120;
      bx = 138;
      by = 132;
      attached = true;
      lives = 3;
      score = 0;
      gameOver = false;
      initBricks();
      overlay.classList.add('hidden');
    };

    const loop = () => {
      if (!gameOver) {
        if (!attached) {
          bx += bvx;
          by += bvy;

          if (bx <= 2 || bx >= canvas.width - 6) bvx = -bvx;
          if (by <= 16) bvy = -bvy;

          // Paddle hit
          if (bvy > 0 && by + 6 >= 136 && by <= 142 && bx + 6 >= padX && bx <= padX + 40) {
            by = 130;
            const rel = ((bx + 3) - (padX + 20)) / 20;
            bvx = rel * 3.8;
            bvy = -Math.max(2.2, Math.sqrt(Math.max(4, 16 - bvx * bvx)));
            window.soundFx?.playClick?.();
          }

          // Brick collision
          bricks.forEach(b => {
            if (b.alive) {
              const rx = 12 + b.c * 37;
              const ry = 24 + b.r * 12;
              if (bx + 6 >= rx && bx <= rx + 33 && by + 6 >= ry && by <= ry + 9) {
                b.alive = false;
                bvy = -bvy;
                score += (5 - b.r) * 10;
                window.soundFx?.playScore?.();
              }
            }
          });

          if (by > canvas.height) {
            lives--;
            attached = true;
            bx = padX + 17;
            by = 132;
            if (lives <= 0) {
              gameOver = true;
              msgEl.textContent = 'GAME OVER !';
              msgEl.className = 'font-black text-xs text-red-400 mb-1';
              overlay.classList.remove('hidden');
            }
          }

          if (bricks.every(b => !b.alive)) {
            gameOver = true;
            msgEl.textContent = 'VICTOIRE !';
            msgEl.className = 'font-black text-xs text-emerald-400 mb-1';
            overlay.classList.remove('hidden');
          }
        }
      }

      ctx.fillStyle = '#0a0c18';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Briques
      bricks.forEach(b => {
        if (b.alive) {
          ctx.fillStyle = b.col;
          ctx.fillRect(12 + b.c * 37, 24 + b.r * 12, 33, 9);
        }
      });

      // Raquette
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(padX, 136, 40, 6);

      // Balle
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(bx, by, 6, 6);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = 'bold 9px monospace';
      ctx.fillText(`Score: ${score}  Vies: ${lives}`, 10, 12);

      this.gameLoopId = requestAnimationFrame(loop);
    };

    loop();
  }

  // ==================== MINI JEU PUISSANCE 4 ====================
  startPuissance4Game() {
    this.title.textContent = 'Puissance 4';
    this.topbar.style.backgroundColor = '#3b82f6';

    this.content.innerHTML = `
      <div class="w-full h-full flex flex-col justify-between bg-[#0e1630] p-1 rounded relative">
        <canvas id="p4-cvs" width="280" height="150" class="w-full h-full block rounded"></canvas>
        <div id="p4-overlay" class="hidden absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white text-center rounded">
          <div id="p4-msg" class="font-black text-xs text-yellow-400 mb-1">VICTOIRE !</div>
          <button onclick="window.simulator.p4Restart()" class="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-[9px] font-bold rounded shadow transition cursor-pointer">
            Rejouer (OK)
          </button>
        </div>
        <div class="text-[8px] text-slate-300 text-center">◄ ► : Choisir colonne • OK / Bas : Lâcher • Back : Hub</div>
      </div>
    `;

    const canvas = document.getElementById('p4-cvs');
    const ctx = canvas.getContext('2d');
    const overlay = document.getElementById('p4-overlay');
    const msgEl = document.getElementById('p4-msg');

    let board = [
      [0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0]
    ];
    let selCol = 3;
    let curPlayer = 1; // 1: Jaune, 2: Rouge (IA)
    let gameOver = false;

    const checkWin = (p) => {
      for (let r = 0; r < 6; r++) {
        for (let c = 0; c < 4; c++) {
          if (board[r][c] === p && board[r][c+1] === p && board[r][c+2] === p && board[r][c+3] === p) return true;
        }
      }
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 7; c++) {
          if (board[r][c] === p && board[r+1][c] === p && board[r+2][c] === p && board[r+3][c] === p) return true;
        }
      }
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 4; c++) {
          if (board[r][c] === p && board[r+1][c+1] === p && board[r+2][c+2] === p && board[r+3][c+3] === p) return true;
        }
      }
      for (let r = 3; r < 6; r++) {
        for (let c = 0; c < 4; c++) {
          if (board[r][c] === p && board[r-1][c+1] === p && board[r-2][c+2] === p && board[r-3][c+3] === p) return true;
        }
      }
      return false;
    };

    const getLowest = (c) => {
      for (let r = 5; r >= 0; r--) {
        if (board[r][c] === 0) return r;
      }
      return -1;
    };

    this.p4Move = (dir) => {
      if (gameOver || curPlayer !== 1) return;
      selCol = Math.max(0, Math.min(6, selCol + dir));
      window.soundFx?.playClick?.();
      render();
    };

    this.p4Drop = () => {
      if (gameOver || curPlayer !== 1) return;
      const targetR = getLowest(selCol);
      if (targetR !== -1) {
        board[targetR][selCol] = 1;
        window.soundFx?.playClick?.();
        if (checkWin(1)) {
          gameOver = true;
          msgEl.textContent = 'VOUS AVEZ GAGNE !';
          msgEl.className = 'font-black text-xs text-yellow-400 mb-1';
          overlay.classList.remove('hidden');
          render();
          return;
        }
        curPlayer = 2;
        render();

        setTimeout(() => {
          if (gameOver) return;
          // Tour de l'IA intelligente
          let aiCol = 3;
          // 1. Victoire immédiate
          for (let c = 0; c < 7; c++) {
            const r = getLowest(c);
            if (r !== -1) {
              board[r][c] = 2;
              if (checkWin(2)) { aiCol = c; board[r][c] = 0; break; }
              board[r][c] = 0;
            }
          }
          // 2. Bloquer joueur
          if (aiCol === 3) {
            for (let c = 0; c < 7; c++) {
              const r = getLowest(c);
              if (r !== -1) {
                board[r][c] = 1;
                if (checkWin(1)) { aiCol = c; board[r][c] = 0; break; }
                board[r][c] = 0;
              }
            }
          }
          // 3. Choix préférentiel
          if (getLowest(aiCol) === -1) {
            const prefs = [3, 2, 4, 1, 5, 0, 6];
            for (const p of prefs) {
              if (getLowest(p) !== -1) { aiCol = p; break; }
            }
          }

          const aiR = getLowest(aiCol);
          if (aiR !== -1) {
            board[aiR][aiCol] = 2;
            if (checkWin(2)) {
              gameOver = true;
              msgEl.textContent = "L'IA A GAGNE !";
              msgEl.className = 'font-black text-xs text-red-400 mb-1';
              overlay.classList.remove('hidden');
            }
          }
          curPlayer = 1;
          render();
        }, 350);
      }
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
      overlay.classList.add('hidden');
      render();
    };

    const render = () => {
      ctx.fillStyle = '#0e1630';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Curseur joueur
      const cx = 35 + selCol * 30 + 10;
      ctx.fillStyle = curPlayer === 1 ? '#facc15' : '#ef4444';
      ctx.fillRect(cx - 5, 6, 10, 8);

      // Grille bleue
      ctx.fillStyle = '#1d4ed8';
      ctx.fillRect(25, 18, 230, 126);

      // Jetons
      for (let r = 0; r < 6; r++) {
        for (let c = 0; c < 7; c++) {
          const x = 35 + c * 30;
          const y = 24 + r * 19;
          const val = board[r][c];
          ctx.fillStyle = val === 0 ? '#0e1630' : (val === 1 ? '#facc15' : '#ef4444');
          ctx.beginPath();
          ctx.arc(x + 10, y + 8, 8, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    render();
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

  updatePack(selectedApps) {
    if (!selectedApps || selectedApps.length === 0) {
      this.apps = [
        { id: 'mariokart', name: '1. Mario Kart', cat: 'Arcade', type: 'MARIO' },
        { id: 'periodique', name: '2. Tableau Périodique', cat: 'Chimie', type: 'PERIODIC' },
        { id: 'fiches', name: '3. Fiches de Cours', cat: 'Révision', type: 'COURSES' },
        { id: 'flappy', name: '4. Flappy Bird', cat: 'Arcade', type: 'FLAPPY' },
        { id: '2048', name: '5. 2048 Ultimate', cat: 'Arcade', type: '2048' },
        { id: 'snake', name: '6. Snake Classic', cat: 'Arcade', type: 'SNAKE' },
        { id: 'pong', name: '7. Pong Retro', cat: 'Arcade', type: 'PONG' },
        { id: 'dino', name: '8. Chrome Dino', cat: 'Arcade', type: 'DINO' },
        { id: 'space_invaders', name: '9. Space Invaders', cat: 'Arcade', type: 'SPACE_INVADERS' },
        { id: 'breakout', name: '10. Casse-Briques', cat: 'Arcade', type: 'BREAKOUT' },
        { id: 'puissance4', name: '11. Puissance 4', cat: 'Arcade', type: 'PUISSANCE4' }
      ];
    } else {
      this.apps = selectedApps.map((a, i) => {
        let t = 'GENERIC';
        const id = (a.id || '').toLowerCase();
        const nm = (a.name || '').toLowerCase();
        if (id.includes('flappy') || nm.includes('flappy')) t = 'FLAPPY';
        else if (id.includes('2048') || nm.includes('2048')) t = '2048';
        else if (id.includes('snake') || nm.includes('snake')) t = 'SNAKE';
        else if (id.includes('pong') || nm.includes('pong')) t = 'PONG';
        else if (id.includes('dino') || nm.includes('dino')) t = 'DINO';
        else if (id.includes('space') || nm.includes('space') || id.includes('invader') || nm.includes('invader')) t = 'SPACE_INVADERS';
        else if (id.includes('breakout') || nm.includes('breakout') || id.includes('brique') || nm.includes('brique')) t = 'BREAKOUT';
        else if (id.includes('puissance') || nm.includes('puissance') || id.includes('connect4') || nm.includes('connect4')) t = 'PUISSANCE4';
        else if (id.includes('mario') || nm.includes('mario')) t = 'MARIO';
        else if (id.includes('period') || nm.includes('tableau') || nm.includes('chimie')) t = 'PERIODIC';
        else if (id.includes('fiche') || nm.includes('cours') || nm.includes('revision')) t = 'COURSES';

        return {
          id: a.id,
          name: `${i + 1}. ${a.name}`,
          cat: (a.category || 'App').split('/')[0].trim(),
          type: t
        };
      });
    }

    if (this.selectedIndex >= this.apps.length) {
      this.selectedIndex = Math.max(0, this.apps.length - 1);
    }

    if (this.currentView === 'MENU') {
      this.renderMenu();
    }
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

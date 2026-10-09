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
    this.examTag = document.getElementById('sim-exam-tag');
    this.content = document.getElementById('sim-content');

    this.selectedIndex = 0;
    this.currentView = 'MENU'; // 'MENU', 'FLAPPY', '2048', 'SNAKE', 'COURSES', 'STEALTH', 'PERIODIC', 'MARIO'
    this.examActive = false;
    this.panicActive = false;

    this.apps = [
      { id: 'mariokart', name: '1. Mario Kart', cat: 'Arcade', type: 'MARIO' },
      { id: 'periodique', name: '2. Tableau Periodique', cat: 'Chimie', type: 'PERIODIC' },
      { id: 'fiches', name: '3. Fiches de Cours', cat: 'Revision', type: 'COURSES' },
      { id: 'math_solver', name: '4. Solveur de Maths', cat: 'Algebre', type: 'SOLVER' },
      { id: 'stealth_calc', name: '5. Mode Furtif Panique', cat: 'Securite', type: 'STEALTH' },
      { id: 'flappy', name: '6. Flappy Bird', cat: 'Arcade', type: 'FLAPPY' },
      { id: '2048', name: '7. 2048 Ultimate', cat: 'Arcade', type: '2048' },
      { id: 'snake', name: '8. Snake Classic', cat: 'Arcade', type: 'SNAKE' },
      { id: 'tetris', name: '9. Tetris NumWorks', cat: 'Arcade', type: 'TETRIS' },
      { id: 'demineur', name: '10. Demineur NW', cat: 'Arcade', type: 'MINESWEEPER' }
    ];

    this.gameLoopId = null;
    this.init();
  }

  init() {
    this.renderMenu();
    this.bindControls();
  }

  bindControls() {
    // Événements clavier quand le simulateur ou un bouton est actif
    window.addEventListener('keydown', (e) => {
      // Si l'utilisateur est en train de taper dans un champ texte de recherche, ne pas intercepter
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

      if (this.currentView === 'MENU') {
        if (e.key === 'ArrowUp') { e.preventDefault(); this.moveSelection(-1); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); this.moveSelection(1); }
        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.launchSelected(); }
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
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
          e.preventDefault();
          this.slide2048(e.key);
        } else if (e.key === 'Escape' || e.key === 'Backspace') {
          e.preventDefault();
          this.returnToMenu();
        }
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

    // Boutons physiques sous le simulateur
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

  handleInput(action) {
    if (this.currentView === 'MENU') {
      if (action === 'UP') this.moveSelection(-1);
      else if (action === 'DOWN') this.moveSelection(1);
      else if (action === 'OK') this.launchSelected();
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
      if (action === 'UP') this.slide2048('ArrowUp');
      else if (action === 'DOWN') this.slide2048('ArrowDown');
      else if (action === 'LEFT') this.slide2048('ArrowLeft');
      else if (action === 'RIGHT') this.slide2048('ArrowRight');
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
    this.launchApp(app.type);
  }

  launchApp(type) {
    if (this.gameLoopId) {
      cancelAnimationFrame(this.gameLoopId);
      this.gameLoopId = null;
    }

    this.currentView = type;
    if (type === 'FLAPPY') this.startFlappyGame();
    else if (type === '2048') this.start2048Game();
    else if (type === 'SNAKE') this.startSnakeGame();
    else if (type === 'COURSES') this.startCoursesViewer();
    else if (type === 'PERIODIC') this.startPeriodicViewer();
    else if (type === 'STEALTH') this.startStealthCalc();
    else if (type === 'MARIO') this.startMarioKartPreview();
    else this.startGenericPreview(type);
  }

  returnToMenu() {
    window.soundFx?.playClick();
    if (this.gameLoopId) {
      cancelAnimationFrame(this.gameLoopId);
      this.gameLoopId = null;
    }
    this.currentView = 'MENU';
    this.topbar.style.backgroundColor = '#FFBB00';
    this.title.textContent = 'EquaLib Hub (Cameleon & Gemini)';
    this.renderMenu();
  }

  renderMenu() {
    this.topbar.style.backgroundColor = '#FFBB00';
    this.title.textContent = 'EquaLib Hub (Cameleon & Gemini)';

    let html = `<div class="space-y-1 overflow-y-auto max-h-[160px] pr-1">`;
    this.apps.forEach((app, idx) => {
      const isSel = idx === this.selectedIndex;
      html += `
        <div class="sim-item cursor-pointer p-1 rounded ${
          isSel 
            ? 'bg-amber-200 border-l-4 border-amber-600 font-bold text-slate-900 shadow-sm' 
            : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
        } text-[10px] flex justify-between items-center transition-all" data-index="${idx}">
          <span class="truncate">${app.name}</span>
          <span class="text-[9px] ${isSel ? 'text-amber-800' : 'text-slate-400'} shrink-0 ml-1">${app.cat}</span>
        </div>
      `;
    });
    html += `</div>`;
    html += `
      <div class="text-[8px] text-slate-500 bg-white p-1 rounded border border-slate-200 text-center truncate mt-1 flex justify-between items-center">
        <span>▲▼: Naviguer</span>
        <span class="font-bold text-amber-600">OK: Lancer</span>
        <span>Back: Hub</span>
      </div>
    `;

    this.content.innerHTML = html;

    // Clic direct sur une application dans le menu
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
      window.soundFx?.playFlap();
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

      // Nuages
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(30, 25, 40, 10);
      ctx.fillRect(160, 35, 45, 10);

      // Sol
      ctx.fillStyle = '#73bf2e';
      ctx.fillRect(0, 145, canvas.width, 4);
      ctx.fillStyle = '#ded895';
      ctx.fillRect(0, 149, canvas.width, 21);

      if (started && !gameOver) {
        birdVy += 0.28;
        birdY += birdVy;

        if (birdY > 132) {
          birdY = 132;
          gameOver = true;
          window.soundFx?.playHit();
          overlay.innerHTML = `
            <div class="font-bold text-red-400 text-xs">GAME OVER</div>
            <div class="text-[10px] text-white">Score : ${score}</div>
            <div class="text-[9px] text-amber-300 mt-1">OK / Espace : Rejouer | Back : Menu</div>
          `;
          overlay.classList.remove('hidden');
        }

        // Tuyaux
        pipes.forEach(p => {
          p.x -= 1.8;
          if (!p.passed && p.x + 28 < 45) {
            p.passed = true;
            score++;
            window.soundFx?.playScore();
          }
          if (p.x < -36) {
            p.x = 280;
            p.gapY = 40 + Math.random() * 55;
            p.passed = false;
          }

          // Dessin tuyaux
          ctx.fillStyle = '#73bf2e';
          // Haut
          ctx.fillRect(p.x, 0, 26, p.gapY);
          ctx.fillRect(p.x - 2, p.gapY - 10, 30, 10);
          // Bas
          ctx.fillRect(p.x, p.gapY + 54, 26, 145 - (p.gapY + 54));
          ctx.fillRect(p.x - 2, p.gapY + 54, 30, 10);

          // Contour
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 1;
          ctx.strokeRect(p.x, 0, 26, p.gapY);
          ctx.strokeRect(p.x, p.gapY + 54, 26, 145 - (p.gapY + 54));

          // Collision
          if (45 + 14 > p.x && 45 < p.x + 26) {
            if (birdY < p.gapY || birdY + 11 > p.gapY + 54) {
              gameOver = true;
              window.soundFx?.playHit();
              overlay.innerHTML = `
                <div class="font-bold text-red-400 text-xs">GAME OVER</div>
                <div class="text-[10px] text-white">Score : ${score}</div>
                <div class="text-[9px] text-amber-300 mt-1">OK : Rejouer | Back : Hub</div>
              `;
              overlay.classList.remove('hidden');
            }
          }
        });
      }

      // Dessin Oiseau
      ctx.fillStyle = '#ffe000';
      ctx.fillRect(45, birdY, 14, 10);
      ctx.fillStyle = '#fa4000';
      ctx.fillRect(55, birdY + 4, 6, 4); // bec
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(52, birdY + 1, 4, 4); // oeil
      ctx.fillStyle = '#000000';
      ctx.fillRect(54, birdY + 2, 2, 2); // pupille
      ctx.strokeRect(45, birdY, 14, 10);

      // Score
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(`Score: ${score}`, 10, 16);

      this.gameLoopId = requestAnimationFrame(loop);
    };

    loop();
  }

  // ==================== MINI 2048 PUZZLE ====================
  start2048Game() {
    this.title.textContent = '2048 Ultimate';
    this.topbar.style.backgroundColor = '#f97316';

    let grid = [
      [0, 2, 0, 0],
      [0, 4, 2, 0],
      [0, 0, 8, 0],
      [0, 0, 0, 0]
    ];
    let score = 14;

    const render = () => {
      let cellsHtml = '';
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          const val = grid[r][c];
          const color = val === 0 ? 'bg-[#cdc1b4]' :
                        val === 2 ? 'bg-[#eee4da] text-[#776e65]' :
                        val === 4 ? 'bg-[#ede0c8] text-[#776e65]' :
                        val === 8 ? 'bg-[#f2b179] text-white' :
                        val === 16 ? 'bg-[#f59563] text-white' :
                        val === 32 ? 'bg-[#f67c5f] text-white' : 'bg-[#ecc440] text-white';
          cellsHtml += `
            <div class="h-8 rounded flex items-center justify-center font-bold text-[10px] ${color} shadow-sm">
              ${val > 0 ? val : ''}
            </div>
          `;
        }
      }

      this.content.innerHTML = `
        <div class="flex flex-col justify-between h-full bg-[#faf8ef] p-2 rounded">
          <div class="flex justify-between items-center text-[10px] font-bold text-slate-800">
            <span>2048 ULTIMATE</span>
            <span class="bg-[#bbada0] text-white px-2 py-0.5 rounded">Score: ${score}</span>
          </div>
          <div class="grid grid-cols-4 gap-1 bg-[#bbada0] p-1.5 rounded-lg my-1">
            ${cellsHtml}
          </div>
          <div class="text-[8px] text-slate-500 text-center">
            Flèches: Glisser les tuiles | Back: Hub
          </div>
        </div>
      `;
    };

    this.slide2048 = (dir) => {
      window.soundFx?.playClick();
      // Simulation simple de glissement
      score += 4;
      if (Math.random() > 0.4) {
        for (let r = 0; r < 4; r++) {
          for (let c = 0; c < 4; c++) {
            if (grid[r][c] === 2 && Math.random() > 0.5) grid[r][c] = 4;
            else if (grid[r][c] === 4 && Math.random() > 0.5) grid[r][c] = 8;
            else if (grid[r][c] === 8 && Math.random() > 0.5) grid[r][c] = 16;
          }
        }
      }
      render();
    };

    render();
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
      window.soundFx?.playClick();
      if (key === 'ArrowUp' && dir.y === 0) dir = {x: 0, y: -1};
      else if (key === 'ArrowDown' && dir.y === 0) dir = {x: 0, y: 1};
      else if (key === 'ArrowLeft' && dir.x === 0) dir = {x: -1, y: 0};
      else if (key === 'ArrowRight' && dir.x === 0) dir = {x: 1, y: 0};
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
          window.soundFx?.playScore();
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

      // Pomme
      ctx.fillStyle = '#f87171';
      ctx.fillRect(food.x * 10, food.y * 10, 9, 9);

      // Serpent
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
        <div class="h-full flex flex-col justify-between bg-white p-2 rounded text-slate-800 text-[10px] font-mono">
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
      window.soundFx?.playClick();
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
      { z: 1, s: 'H', n: 'Hydrogene', m: '1.008', cat: 'Non-metal' },
      { z: 2, s: 'He', n: 'Helium', m: '4.003', cat: 'Gaz noble' },
      { z: 6, s: 'C', n: 'Carbone', m: '12.011', cat: 'Non-metal' },
      { z: 7, s: 'N', n: 'Azote', m: '14.007', cat: 'Non-metal' },
      { z: 8, s: 'O', n: 'Oxygene', m: '15.999', cat: 'Non-metal' },
      { z: 11, s: 'Na', n: 'Sodium', m: '22.990', cat: 'Alcalin' },
      { z: 26, s: 'Fe', n: 'Fer', m: '55.845', cat: 'Metal trans.' },
      { z: 79, s: 'Au', n: 'Or', m: '196.97', cat: 'Metal noble' }
    ];

    let currentZ = 0;

    const render = () => {
      const el = elements[currentZ];
      this.content.innerHTML = `
        <div class="h-full flex flex-col justify-between bg-slate-900 text-white p-2 rounded font-mono">
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
            <div>Recherche par Z, symbole ou famille.</div>
          </div>
          <div class="text-[8px] text-slate-400 text-center flex justify-between">
            <button id="el-prev" class="text-emerald-400 font-bold">◄ Précédent</button>
            <span>Back : Hub</span>
            <button id="el-next" class="text-emerald-400 font-bold">Suivant ►</button>
          </div>
        </div>
      `;

      document.getElementById('el-prev').addEventListener('click', () => {
        window.soundFx?.playClick();
        currentZ = (currentZ - 1 + elements.length) % elements.length;
        render();
      });
      document.getElementById('el-next').addEventListener('click', () => {
        window.soundFx?.playClick();
        currentZ = (currentZ + 1) % elements.length;
        render();
      });
    };

    render();
  }

  // ==================== CALCULATRICE FURTIVE ====================
  startStealthCalc() {
    this.title.textContent = 'Calculs [EXAMEN]';
    this.topbar.style.backgroundColor = '#3b82f6';

    this.content.innerHTML = `
      <div class="h-full flex flex-col justify-between bg-slate-100 p-2 rounded text-slate-900 font-mono text-[10px]">
        <div class="space-y-1.5">
          <div class="bg-white p-1.5 rounded border border-slate-300 shadow-inner">
            <div class="text-slate-500 text-[9px]">cos(pi/3) + ln(e^2)</div>
            <div class="text-right font-bold text-black text-xs">2.5</div>
          </div>
          <div class="bg-white p-1.5 rounded border border-slate-300 shadow-inner">
            <div class="text-slate-500 text-[9px]">sqrt(144) * 3!</div>
            <div class="text-right font-bold text-blue-700 text-xs">72</div>
          </div>
        </div>
        <div class="text-center text-[8px] text-red-600 font-bold bg-red-100 p-1 rounded border border-red-300">
          [MODE EXAMEN ACTIF] • LED 1 Hz Active • Back : Hub
        </div>
      </div>
    `;
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
      // Ciel
      ctx.fillStyle = '#60a5fa';
      ctx.fillRect(0, 0, canvas.width, 60);

      // Sol pseudo 3D
      ctx.fillStyle = '#15803d';
      ctx.fillRect(0, 60, canvas.width, 90);

      // Piste
      for (let y = 60; y < 150; y += 4) {
        const stripe = ((y + offset) % 16 < 8);
        ctx.fillStyle = stripe ? '#e2e8f0' : '#94a3b8';
        const w = (y - 50) * 2;
        ctx.fillRect((canvas.width - w) / 2, y, w, 4);
      }

      // Kart
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
        { id: 'periodique', name: '2. Tableau Periodique', cat: 'Chimie', type: 'PERIODIC' },
        { id: 'fiches', name: '3. Fiches de Cours', cat: 'Revision', type: 'COURSES' },
        { id: 'math_solver', name: '4. Solveur de Maths', cat: 'Algebre', type: 'SOLVER' },
        { id: 'stealth_calc', name: '5. Mode Furtif Panique', cat: 'Securite', type: 'STEALTH' },
        { id: 'flappy', name: '6. Flappy Bird', cat: 'Arcade', type: 'FLAPPY' },
        { id: '2048', name: '7. 2048 Ultimate', cat: 'Arcade', type: '2048' },
        { id: 'snake', name: '8. Snake Classic', cat: 'Arcade', type: 'SNAKE' }
      ];
    } else {
      this.apps = selectedApps.map((a, i) => {
        let t = 'GENERIC';
        const id = (a.id || '').toLowerCase();
        const nm = (a.name || '').toLowerCase();
        if (id.includes('flappy') || nm.includes('flappy')) t = 'FLAPPY';
        else if (id.includes('2048') || nm.includes('2048')) t = '2048';
        else if (id.includes('snake') || nm.includes('snake')) t = 'SNAKE';
        else if (id.includes('mario') || nm.includes('mario')) t = 'MARIO';
        else if (id.includes('period') || nm.includes('tableau') || nm.includes('chimie')) t = 'PERIODIC';
        else if (id.includes('fiche') || nm.includes('cours') || nm.includes('revision')) t = 'COURSES';
        else if (id.includes('stealth') || id.includes('panic') || nm.includes('furtif')) t = 'STEALTH';
        else if (id.includes('math') || nm.includes('solveur')) t = 'SOLVER';

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

/**
 * EquaLib CRT & Interactive Math Background Engine
 * - Grille dense de symboles mathématiques et chiffres avec effet phosphore rétro
 * - Illumination dynamique des caractères sous le curseur de la souris (plus sombres par défaut mais bien visibles)
 * - Lueur lumineuse fluide autour du curseur (Cursor Glow)
 * - Rendu 60 FPS optimisé via Canvas 2D
 */

(function () {
  'use strict';

  // Symboles mathématiques et chiffres
  const MATH_SYMBOLS = [
    'π', '∑', '∫', '√', '∞', '∂', 'λ', 'θ', 'Ω', 'Δ', '∇', 'μ', 'ε', '≈',
    '≠', '≤', '≥', '±', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
    'x', 'y', 'z', 'f(x)', 'e', 'φ', 'ħ', '∈', '∀', '∃', '∏', '∩', '∪',
    'dx', 'dt', 'ℂ', 'ℝ', 'ℤ', 'ℕ', 'lim', '→', '∑n²', 'e^iπ', '√2', 'cos', 'sin'
  ];

  let canvas, ctx;
  let width = 0, height = 0;
  let cols = 0, rows = 0;
  const CELL_SIZE = 28; // Espacement de la grille

  let mouseX = -1000, mouseY = -1000;
  let targetMouseX = -1000, targetMouseY = -1000;
  const ILLUMINATION_RADIUS = 160; // Rayon d'illumination de la souris

  // Paramètres de la vague d'ambiance
  const WAVE_LENGTH = 720;       // Étalement de la crête de vague en pixels
  const WAVE_SPEED = 0.92;       // Vitesse angulaire : cycle complet en ~6.8 secondes (lent mais fluide)
  const WAVE_DIR_X = 0.80;       // Direction oblique douce (~36°)
  const WAVE_DIR_Y = 0.60;
  const WAVE_BOOST_MAX = 0.12;   // Illumination très subtile à peine visible (+0.12 d'opacité max)

  // Grille de symboles
  let grid = [];

  function initGrid() {
    cols = Math.ceil(width / CELL_SIZE);
    rows = Math.ceil(height / CELL_SIZE);
    grid = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const symbol = MATH_SYMBOLS[Math.floor(Math.random() * MATH_SYMBOLS.length)];
        grid.push({
          x: c * CELL_SIZE + CELL_SIZE / 2,
          y: r * CELL_SIZE + CELL_SIZE / 2,
          char: symbol,
          baseOpacity: 0.13 + Math.random() * 0.09, // Phosphore tamisé au repos
          currentOpacity: 0.16,
          glow: 0,
          colorType: Math.random() < 0.25 ? 'accent' : 'cyan' // Nuances bleutées / cyan / violette
        });
      }
    }
  }

  function resize() {
    if (!canvas) return;
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    initGrid();
  }

  // Animation loop
  function draw(timestamp) {
    if (!timestamp) timestamp = performance.now();
    const timeSec = timestamp * 0.001;

    // Interpolation fluide de la souris
    mouseX += (targetMouseX - mouseX) * 0.15;
    mouseY += (targetMouseY - mouseY) * 0.15;

    ctx.clearRect(0, 0, width, height);

    ctx.font = '13px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const radiusSq = ILLUMINATION_RADIUS * ILLUMINATION_RADIUS;
    const waveFreq = (Math.PI * 2) / WAVE_LENGTH;
    const wavePhaseTime = timeSec * WAVE_SPEED;

    for (let i = 0; i < grid.length; i++) {
      const p = grid[i];

      // 1. Calcul de l'onde de vague se propageant en continu
      // Trajectoire diagonale fluide avec légère ondulation organique
      const waveCoord = (p.x * WAVE_DIR_X + p.y * WAVE_DIR_Y) + 36 * Math.sin(p.y * 0.004 + timeSec * 0.5);
      const phase = waveCoord * waveFreq - wavePhaseTime;
      const sinWave = Math.sin(phase);
      
      // Crête douce en cloche : actif sur la phase positive, nul sur le creux
      const waveFactor = sinWave > 0 ? Math.pow(sinWave, 2.5) : 0;
      const waveBoost = waveFactor * WAVE_BOOST_MAX;
      const waveGlow = waveFactor * 0.22; // Halo très léger sur la crête

      // 2. Interaction avec la souris
      const dx = p.x - mouseX;
      const dy = p.y - mouseY;
      const distSq = dx * dx + dy * dy;

      let mouseBoost = 0;
      let mouseGlow = 0;

      if (distSq < radiusSq) {
        const dist = Math.sqrt(distSq);
        const norm = 1 - dist / ILLUMINATION_RADIUS;
        // Illumination vive sous le curseur
        mouseBoost = norm * (1.0 - p.baseOpacity);
        mouseGlow = Math.pow(norm, 1.6);
      }

      // Combinaison : l'effet de souris est prioritaire, la vague prend le relais en fond
      const targetOpacity = Math.min(1.0, p.baseOpacity + Math.max(waveBoost, mouseBoost));
      const targetGlow = Math.max(waveGlow, mouseGlow);

      // Transition douce pour éviter tout clignotement
      p.currentOpacity += (targetOpacity - p.currentOpacity) * 0.22;
      p.glow += (targetGlow - p.glow) * 0.22;

      // 3. Rendu optimisé sans save/restore systématique
      if (p.glow > 0.05) {
        // Caractère illuminé (par la vague ou par la souris)
        ctx.shadowBlur = Math.round(p.glow * 13);
        if (p.colorType === 'accent') {
          ctx.shadowColor = '#C084FC'; // Violet néon
          ctx.fillStyle = 'rgba(216, 180, 254, ' + p.currentOpacity.toFixed(2) + ')';
        } else {
          ctx.shadowColor = '#38BDF8'; // Cyan électrique
          ctx.fillStyle = 'rgba(186, 230, 253, ' + p.currentOpacity.toFixed(2) + ')';
        }
      } else {
        // Caractère au repos tamisé (phosphore discret)
        ctx.shadowBlur = 0;
        if (p.colorType === 'accent') {
          ctx.fillStyle = 'rgba(168, 85, 247, ' + p.currentOpacity.toFixed(2) + ')';
        } else {
          ctx.fillStyle = 'rgba(56, 189, 248, ' + p.currentOpacity.toFixed(2) + ')';
        }
      }

      ctx.fillText(p.char, p.x, p.y);
    }

    requestAnimationFrame(draw);
  }

  // Initialisation au chargement du DOM
  document.addEventListener('DOMContentLoaded', () => {
    canvas = document.getElementById('math-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'math-canvas';
      canvas.className = 'fixed inset-0 pointer-events-none z-0';
      document.body.prepend(canvas);
    }
    ctx = canvas.getContext('2d');

    // Lueur fluide du curseur (Cursor Glow)
    let glow = document.getElementById('cursor-glow');
    if (!glow) {
      glow = document.createElement('div');
      glow.id = 'cursor-glow';
      glow.className = 'pointer-events-none fixed -translate-x-1/2 -translate-y-1/2 rounded-full w-[450px] h-[450px] bg-[radial-gradient(circle,rgba(56,189,248,0.20)_0%,rgba(168,85,247,0.12)_35%,transparent_70%)] blur-2xl z-[1]';
      glow.style.transform = 'translate(-50%, -50%)';
      document.body.appendChild(glow);
    }

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', (e) => {
      targetMouseX = e.clientX;
      targetMouseY = e.clientY;
      if (glow) {
        glow.style.left = e.clientX + 'px';
        glow.style.top = e.clientY + 'px';
      }
    });

    window.addEventListener('mouseleave', () => {
      targetMouseX = -1000;
      targetMouseY = -1000;
    });

    resize();
    requestAnimationFrame(draw);
  });
})();

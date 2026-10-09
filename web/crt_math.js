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

  // Paramètres de la vague physique réaliste
  const WAVE_CYCLE = 1100;         // Distance de répétition de l'onde en pixels
  const WAVE_HALF_WIDTH = 85;      // Ligne de vague plus petite/serrée (~170px de largeur totale active)
  const WAVE_SPEED = 135;          // Vitesse de propagation en px/sec (~8 sec par passage)
  const WAVE_DIR_X = 0.82;         // Direction diagonale fluide (~35°)
  const WAVE_DIR_Y = 0.58;
  const WAVE_BOOST_MAX = 0.14;     // Illumination très subtile à peine visible (+0.14 max)
  const WAVE_SCALE_MAX = 0.28;     // Grossissement fluide (+28% max à la crête)

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
          baseOpacity: 0.13 + Math.random() * 0.08, // Phosphore tamisé au repos
          currentOpacity: 0.16,
          scale: 1.0,
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
    
    // Position du front de la vague (mouvement fluide continu)
    const waveCenter = (timeSec * WAVE_SPEED) % WAVE_CYCLE;

    for (let i = 0; i < grid.length; i++) {
      const p = grid[i];

      // 1. Calcul de l'onde de vague physique (trajectoire oblique avec courbure réaliste)
      const waveCoord = (p.x * WAVE_DIR_X + p.y * WAVE_DIR_Y) 
                      + 26 * Math.sin(p.y * 0.005 + timeSec * 0.8) 
                      + 12 * Math.cos(p.x * 0.004 + timeSec * 0.5);

      // Distance à la crête la plus proche (modulo WAVE_CYCLE)
      let distToCrest = ((waveCoord - waveCenter) % WAVE_CYCLE + WAVE_CYCLE) % WAVE_CYCLE;
      if (distToCrest > WAVE_CYCLE * 0.5) {
        distToCrest -= WAVE_CYCLE;
      }

      const absDist = Math.abs(distToCrest);
      let waveFactor = 0;
      if (absDist < WAVE_HALF_WIDTH) {
        // Profil en cloche cosinus (C^1 continu, départ et retour à zéro parfaits)
        const u = absDist / WAVE_HALF_WIDTH;
        const cosVal = Math.cos(u * Math.PI * 0.5);
        waveFactor = cosVal * cosVal;
      }

      // 2. Interaction avec la souris
      const dx = p.x - mouseX;
      const dy = p.y - mouseY;
      const distSq = dx * dx + dy * dy;

      let mouseBoost = 0;
      let mouseGlow = 0;
      let mouseScale = 0;

      if (distSq < radiusSq) {
        const dist = Math.sqrt(distSq);
        const norm = 1 - dist / ILLUMINATION_RADIUS;
        // Illumination vive & légère loupe sous le curseur
        mouseBoost = norm * (1.0 - p.baseOpacity);
        mouseGlow = Math.pow(norm, 1.6);
        mouseScale = norm * 0.22;
      }

      // Combinaison : l'effet de souris s'ajoute en priorité
      const targetOpacity = Math.min(1.0, p.baseOpacity + Math.max(waveFactor * WAVE_BOOST_MAX, mouseBoost));
      const targetGlow = Math.max(waveFactor * 0.22, mouseGlow);
      const targetScale = 1.0 + Math.max(waveFactor * WAVE_SCALE_MAX, mouseScale);

      // Transitions fluides (interpolation exponentielle sans à-coups)
      p.currentOpacity += (targetOpacity - p.currentOpacity) * 0.22;
      p.glow += (targetGlow - p.glow) * 0.22;
      p.scale += (targetScale - p.scale) * 0.22;

      // 3. Rendu
      const isTransformed = p.scale > 1.015;

      if (isTransformed) {
        // Caractère en cours de pulsation/grossissement
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(p.scale, p.scale);

        if (p.glow > 0.05) {
          ctx.shadowBlur = Math.round(p.glow * 12);
          if (p.colorType === 'accent') {
            ctx.shadowColor = '#C084FC';
            ctx.fillStyle = 'rgba(216, 180, 254, ' + p.currentOpacity.toFixed(2) + ')';
          } else {
            ctx.shadowColor = '#38BDF8';
            ctx.fillStyle = 'rgba(186, 230, 253, ' + p.currentOpacity.toFixed(2) + ')';
          }
        } else {
          ctx.shadowBlur = 0;
          if (p.colorType === 'accent') {
            ctx.fillStyle = 'rgba(168, 85, 247, ' + p.currentOpacity.toFixed(2) + ')';
          } else {
            ctx.fillStyle = 'rgba(56, 189, 248, ' + p.currentOpacity.toFixed(2) + ')';
          }
        }

        ctx.fillText(p.char, 0, 0);
        ctx.restore();
      } else {
        // Caractère standard au repos (rendu direct ultra-rapide)
        ctx.shadowBlur = 0;
        if (p.colorType === 'accent') {
          ctx.fillStyle = 'rgba(147, 51, 234, ' + p.currentOpacity.toFixed(2) + ')';
        } else {
          ctx.fillStyle = 'rgba(56, 189, 248, ' + p.currentOpacity.toFixed(2) + ')';
        }
        ctx.fillText(p.char, p.x, p.y);
      }
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

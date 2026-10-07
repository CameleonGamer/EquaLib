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
          baseOpacity: 0.16 + Math.random() * 0.12, // Sombre mais visible par défaut
          currentOpacity: 0.2,
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
  function draw() {
    // Interpolation fluide de la souris
    mouseX += (targetMouseX - mouseX) * 0.15;
    mouseY += (targetMouseY - mouseY) * 0.15;

    ctx.clearRect(0, 0, width, height);

    ctx.font = '13px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const radiusSq = ILLUMINATION_RADIUS * ILLUMINATION_RADIUS;

    for (let i = 0; i < grid.length; i++) {
      const p = grid[i];
      const dx = p.x - mouseX;
      const dy = p.y - mouseY;
      const distSq = dx * dx + dy * dy;

      let targetOpacity = p.baseOpacity;
      let targetGlow = 0;

      if (distSq < radiusSq) {
        const dist = Math.sqrt(distSq);
        const norm = 1 - dist / ILLUMINATION_RADIUS;
        // Illumination vive quand la souris approche
        targetOpacity = p.baseOpacity + norm * (1.0 - p.baseOpacity);
        targetGlow = Math.pow(norm, 1.6);
      }

      // Transition progressive
      p.currentOpacity += (targetOpacity - p.currentOpacity) * 0.2;
      p.glow += (targetGlow - p.glow) * 0.2;

      ctx.save();
      if (p.glow > 0.05) {
        // Caractère illuminé sous le curseur
        ctx.shadowBlur = Math.round(p.glow * 14);
        if (p.colorType === 'accent') {
          ctx.shadowColor = '#C084FC'; // Violet néon
          ctx.fillStyle = 'rgba(216, 180, 254, ' + p.currentOpacity.toFixed(2) + ')';
        } else {
          ctx.shadowColor = '#38BDF8'; // Cyan électrique
          ctx.fillStyle = 'rgba(186, 230, 253, ' + p.currentOpacity.toFixed(2) + ')';
        }
      } else {
        // Caractère sombre au repos (phosphore tamisé)
        ctx.shadowBlur = 0;
        if (p.colorType === 'accent') {
          ctx.fillStyle = 'rgba(147, 51, 234, ' + p.currentOpacity.toFixed(2) + ')';
        } else {
          ctx.fillStyle = 'rgba(56, 189, 248, ' + p.currentOpacity.toFixed(2) + ')';
        }
      }

      ctx.fillText(p.char, p.x, p.y);
      ctx.restore();
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

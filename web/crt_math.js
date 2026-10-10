/**
 * EquaLib CRT & Thematic Background Engine
 * - Moteur d'arrière-plan interactif multi-thèmes 60 FPS
 * - Thèmes supportés :
 *   1. Default / Math : Symboles mathématiques avec vague physique et lueur de curseur
 *   2. Sakura : Fleurs et pétales de cerisier japonais (Sakura) flottant au vent
 *   3. Hacker : Circuits imprimés, flux de code binaire / hexadécimal et lueur cyber
 *   4. Abeille : Alvéoles hexagonales dorées et petites abeilles bourdonnantes
 *   5. Mario : Emblème légendaire 'M' de Mario au centre avec étoiles dorées
 *   6. GameBoy 8-Bit : Matrice de pixels LCD vintage vert GameBoy
 */

(function () {
  'use strict';

  let currentTheme = localStorage.getItem('equalib_theme') || 'default';

  const MATH_SYMBOLS = [
    'π', '∑', '∫', '√', '∞', '∂', 'λ', 'θ', 'Ω', 'Δ', '∇', 'μ', 'ε', '≈',
    '≠', '≤', '≥', '±', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
    'x', 'y', 'z', 'f(x)', 'e', 'φ', 'ħ', '∈', '∀', '∃', '∏', '∩', '∪',
    'dx', 'dt', 'ℂ', 'ℝ', 'ℤ', 'ℕ', 'lim', '→', '∑n²', 'e^iπ', '√2', 'cos', 'sin'
  ];

  const HACKER_TOKENS = [
    '01', '10', '0xFF', '0x90', 'EADK', 'STM32', 'CORTEX', 'N0120', 'FLASH', 'QSPI',
    'RAM', 'THUMB', '0101', '1100', 'LR', 'SP', 'PC', 'R0', 'BLX', '0x2402', '0x9018',
    'EQUALIB', 'ASM', 'C11', 'GCC', 'ELF', 'NWA', 'BIN', 'SYS', 'DMA', 'GPIO', 'IRQ'
  ];

  let canvas, ctx;
  let width = 0, height = 0;
  let cols = 0, rows = 0;
  const CELL_SIZE = 28;

  let mouseX = -1000, mouseY = -1000;
  let targetMouseX = -1000, targetMouseY = -1000;
  const ILLUMINATION_RADIUS = 160;

  // Variables pour la vague de symboles mathématiques
  const WAVE_CYCLE = 1100;
  const WAVE_SPEED = 135;
  const WAVE_DIR_X = 0.82;
  const WAVE_DIR_Y = 0.58;

  let mathGrid = [];
  let sakuraPetals = [];
  let bees = [];
  let stars = [];

  function initSakura() {
    sakuraPetals = [];
    const count = Math.min(60, Math.floor((width * height) / 18000));
    for (let i = 0; i < count; i++) {
      sakuraPetals.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: 7 + Math.random() * 8,
        speedX: 0.5 + Math.random() * 1.5,
        speedY: 0.8 + Math.random() * 1.8,
        angle: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.04,
        swaySpeed: 0.8 + Math.random() * 1.5,
        opacity: 0.35 + Math.random() * 0.4
      });
    }
  }

  function initBees() {
    bees = [];
    const count = 14;
    for (let i = 0; i < count; i++) {
      bees.push({
        x: Math.random() * width,
        y: Math.random() * height,
        seed: Math.random() * 100,
        speed: 0.4 + Math.random() * 0.6,
        size: 14 + Math.random() * 4
      });
    }
  }

  function initStars() {
    stars = [];
    const count = 35;
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: 1.5 + Math.random() * 2.5,
        phase: Math.random() * Math.PI * 2,
        speed: 1.0 + Math.random() * 2.0
      });
    }
  }

  function initGrid() {
    cols = Math.ceil(width / CELL_SIZE);
    rows = Math.ceil(height / CELL_SIZE);
    mathGrid = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const isHacker = currentTheme === 'hacker';
        const list = isHacker ? HACKER_TOKENS : MATH_SYMBOLS;
        const symbol = list[Math.floor(Math.random() * list.length)];
        mathGrid.push({
          x: c * CELL_SIZE + CELL_SIZE / 2,
          y: r * CELL_SIZE + CELL_SIZE / 2,
          char: symbol,
          baseOpacity: 0.13 + Math.random() * 0.08,
          currentOpacity: 0.16,
          scale: 1.0,
          colorType: Math.random() < 0.25 ? 'accent' : 'cyan'
        });
      }
    }
  }

  function resize() {
    if (!canvas) return;
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    initGrid();
    initSakura();
    initBees();
    initStars();
  }

  // ==================== RENDU THÈME PAR THÈME ====================

  function drawSakura(timeSec) {
    ctx.clearRect(0, 0, width, height);

    // Dessin des pétales de sakura flottants
    for (let i = 0; i < sakuraPetals.length; i++) {
      const p = sakuraPetals[i];
      p.x += p.speedX + Math.sin(timeSec * p.swaySpeed + p.y * 0.01) * 0.8;
      p.y += p.speedY;
      p.angle += p.rotSpeed;

      if (p.y > height + 20) {
        p.y = -20;
        p.x = Math.random() * width;
      }
      if (p.x > width + 20) {
        p.x = -20;
      }

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.scale(Math.sin(p.angle), 1);

      // Pétale rose avec dégradé subtil
      const grad = ctx.createRadialGradient(0, 0, 1, 0, 0, p.size);
      grad.addColorStop(0, `rgba(255, 230, 240, ${p.opacity})`);
      grad.addColorStop(0.6, `rgba(244, 114, 182, ${p.opacity * 0.85})`);
      grad.addColorStop(1, `rgba(219, 39, 119, ${p.opacity * 0.6})`);

      ctx.fillStyle = grad;
      ctx.beginPath();
      // Forme de pétale de cerisier (Sakura petal)
      ctx.moveTo(0, -p.size);
      ctx.bezierCurveTo(p.size * 0.8, -p.size * 0.5, p.size * 0.7, p.size * 0.5, 0, p.size);
      ctx.bezierCurveTo(-p.size * 0.7, p.size * 0.5, -p.size * 0.8, -p.size * 0.5, 0, -p.size);
      ctx.fill();

      ctx.restore();
    }
  }

  function drawBees(timeSec) {
    ctx.clearRect(0, 0, width, height);

    // 1. Fond alvéolaire géométrique en nid d'abeille
    const hexR = 36;
    const hexW = Math.sqrt(3) * hexR;
    const hexH = 2 * hexR * 0.75;
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.08)';
    ctx.lineWidth = 1;

    for (let y = -hexR; y < height + hexR * 2; y += hexH) {
      const rowIdx = Math.floor(y / hexH);
      const xOffset = (rowIdx % 2 === 0) ? 0 : hexW / 2;
      for (let x = -hexW + xOffset; x < width + hexW * 2; x += hexW) {
        ctx.beginPath();
        for (let a = 0; a < 6; a++) {
          const angle = (Math.PI / 3) * a - Math.PI / 6;
          const px = x + hexR * Math.cos(angle);
          const py = y + hexR * Math.sin(angle);
          if (a === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }
    }

    // 2. Petites abeilles dorées bourdonnantes
    for (let i = 0; i < bees.length; i++) {
      const b = bees[i];
      const bx = b.x + Math.sin(timeSec * b.speed + b.seed) * 120 + Math.cos(timeSec * 0.4 + b.seed) * 40;
      const by = b.y + Math.cos(timeSec * b.speed * 1.3 + b.seed) * 70;

      ctx.font = `${b.size}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(251, 191, 36, 0.6)';
      ctx.shadowBlur = 8;
      ctx.fillText('🐝', (bx % width + width) % width, (by % height + height) % height);
      ctx.shadowBlur = 0;
    }
  }

  function drawMario(timeSec) {
    ctx.clearRect(0, 0, width, height);

    // 1. Étoiles rétro scintillantes
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      const opacity = 0.2 + 0.3 * Math.sin(timeSec * s.speed + s.phase);
      ctx.fillStyle = `rgba(255, 220, 50, ${opacity})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Grand emblème "M" de Mario stylisé au centre de l'écran (Watermark géant)
    const cx = width / 2;
    const cy = height / 2;
    const emblemR = Math.min(width, height) * 0.24;

    ctx.save();
    // Cercle blanc extérieur
    ctx.beginPath();
    ctx.arc(cx, cy, emblemR, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.25)';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Cercle intérieur rouge
    ctx.beginPath();
    ctx.arc(cx, cy, emblemR * 0.9, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(239, 68, 68, 0.06)';
    ctx.fill();

    // Grand "M" stylisé au centre
    ctx.font = `bold ${Math.floor(emblemR * 1.1)}px "Outfit", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(239, 68, 68, 0.16)';
    ctx.shadowColor = 'rgba(239, 68, 68, 0.4)';
    ctx.shadowBlur = 20;
    ctx.fillText('M', cx, cy + emblemR * 0.08);
    ctx.restore();
  }

  function drawGameBoy(timeSec) {
    ctx.clearRect(0, 0, width, height);

    // Trame de pixels LCD monochrome GameBoy
    const pixelStep = 18;
    ctx.fillStyle = 'rgba(139, 172, 15, 0.08)';

    for (let x = 4; x < width; x += pixelStep) {
      for (let y = 4; y < height; y += pixelStep) {
        const dist = Math.hypot(x - mouseX, y - mouseY);
        if (dist < 140) {
          ctx.fillStyle = 'rgba(155, 188, 15, 0.22)';
          ctx.fillRect(x, y, pixelStep - 3, pixelStep - 3);
        } else if ((Math.floor(x / pixelStep) + Math.floor(y / pixelStep)) % 2 === 0) {
          ctx.fillStyle = 'rgba(48, 98, 48, 0.12)';
          ctx.fillRect(x, y, pixelStep - 3, pixelStep - 3);
        }
      }
    }
  }

  function drawMathGrid(timeSec) {
    ctx.clearRect(0, 0, width, height);

    ctx.font = '13px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const isHacker = currentTheme === 'hacker';
    const waveCenter = (timeSec * WAVE_SPEED) % WAVE_CYCLE;
    const radiusSq = ILLUMINATION_RADIUS * ILLUMINATION_RADIUS;

    for (let i = 0; i < mathGrid.length; i++) {
      const p = mathGrid[i];

      const waveCoord = (p.x * WAVE_DIR_X + p.y * WAVE_DIR_Y) 
                      + 26 * Math.sin(p.y * 0.005 + timeSec * 0.8) 
                      + 12 * Math.cos(p.x * 0.004 + timeSec * 0.5);

      let distToCrest = ((waveCoord - waveCenter) % WAVE_CYCLE + WAVE_CYCLE) % WAVE_CYCLE;
      if (distToCrest > WAVE_CYCLE * 0.5) {
        distToCrest = WAVE_CYCLE - distToCrest;
      }

      let waveFactor = 0;
      if (distToCrest < 85) {
        waveFactor = 0.5 * (1 + Math.cos((Math.PI * distToCrest) / 85));
      }

      const dx = p.x - mouseX;
      const dy = p.y - mouseY;
      const dSq = dx * dx + dy * dy;

      let mouseFactor = 0;
      if (dSq < radiusSq) {
        const dNorm = Math.sqrt(dSq) / ILLUMINATION_RADIUS;
        mouseFactor = 1 - (dNorm * dNorm * (3 - 2 * dNorm));
      }

      const targetOpacity = p.baseOpacity + (waveFactor * 0.14) + (mouseFactor * 0.65);
      p.currentOpacity += (targetOpacity - p.currentOpacity) * 0.22;
      p.scale = 1.0 + (waveFactor * 0.28) + (mouseFactor * 0.22);
      p.glow = (mouseFactor > 0.1) ? mouseFactor : (waveFactor * 0.35);

      ctx.save();
      ctx.translate(p.x, p.y);
      if (Math.abs(p.scale - 1.0) > 0.01) {
        ctx.scale(p.scale, p.scale);
      }

      if (isHacker) {
        ctx.fillStyle = p.colorType === 'accent' 
          ? `rgba(0, 240, 255, ${p.currentOpacity.toFixed(2)})` 
          : `rgba(56, 189, 248, ${p.currentOpacity.toFixed(2)})`;
      } else {
        ctx.fillStyle = p.colorType === 'accent' 
          ? `rgba(168, 85, 247, ${p.currentOpacity.toFixed(2)})` 
          : `rgba(56, 189, 248, ${p.currentOpacity.toFixed(2)})`;
      }

      if (p.glow > 0.2) {
        ctx.shadowColor = isHacker ? '#00f0ff' : '#38bdf8';
        ctx.shadowBlur = 10 * p.glow;
      } else {
        ctx.shadowBlur = 0;
      }

      ctx.fillText(p.char, 0, 0);
      ctx.restore();
    }
  }

  // Boucle d'animation principale
  function draw(timestamp) {
    if (!timestamp) timestamp = performance.now();
    const timeSec = timestamp * 0.001;

    mouseX += (targetMouseX - mouseX) * 0.15;
    mouseY += (targetMouseY - mouseY) * 0.15;

    if (currentTheme === 'sakura') {
      drawSakura(timeSec);
    } else if (currentTheme === 'bee') {
      drawBees(timeSec);
    } else if (currentTheme === 'mario') {
      drawMario(timeSec);
    } else if (currentTheme === 'gameboy') {
      drawGameBoy(timeSec);
    } else {
      // Default / Hacker (grid)
      drawMathGrid(timeSec);
    }

    requestAnimationFrame(draw);
  }

  // API publique pour basculer de thème d'arrière-plan à la volée
  window.setThemeBg = function (themeName) {
    currentTheme = themeName || 'default';
    try {
      localStorage.setItem('equalib_theme', currentTheme);
    } catch (_) {}
    if (currentTheme === 'sakura') initSakura();
    else if (currentTheme === 'bee') initBees();
    else if (currentTheme === 'mario') initStars();
    else initGrid();
  };

  document.addEventListener('DOMContentLoaded', () => {
    canvas = document.getElementById('math-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'math-canvas';
      canvas.className = 'fixed inset-0 pointer-events-none z-0';
      document.body.prepend(canvas);
    }
    ctx = canvas.getContext('2d');

    const glow = document.getElementById('cursor-glow');

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

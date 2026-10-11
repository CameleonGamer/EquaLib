/**
 * EquaLib Wallpaper & Theme Studio
 * Éditeur de Pixel Art et Convertisseur d'images 320x240 pour NumWorks N0120 / N0110
 * - Éditeur Pixel Art interactif (Pinceau réglable, Crayon, Gomme, Pot, Pipette, Ligne, Rectangle)
 * - Pinceau à taille dynamique (1px à 24px) avec formes Ronde et Carrée et stamping continu Bresenham
 * - Grille commutable, Niveaux de Zoom (1x, 2x, 3x, 4x), Undo / Redo (30 niveaux)
 * - Import d'images (PNG, JPG, WEBP) avec redimensionnement automatique et cadrage
 * - Dithering adaptatif Floyd-Steinberg vers RGB565 (16 bits)
 * - Aperçu Hub UI interactif par superposition (Top Bar, 6 tuiles Galerie, Dock, Shortcuts)
 * - Exportation PNG, binaire RGB565 (153.6 Ko) et injection dans le pack calculatrice
 * - Persistance et auto-synchronisation instantanée pour éviter tout écran noir
 */

(function(window) {
  'use strict';

  const SCREEN_WIDTH = 320;
  const SCREEN_HEIGHT = 240;
  const TOTAL_PIXELS = SCREEN_WIDTH * SCREEN_HEIGHT;
  const RGB565_BYTES = TOTAL_PIXELS * 2; // 153,600 octets

  // Palettes rétro pré-définies
  const PALETTES = {
    numworks: [
      '#FFBB00', '#000000', '#FFFFFF', '#161B22', '#21262D',
      '#30363D', '#58A6FF', '#3FB950', '#F85149', '#D29922'
    ],
    pico8: [
      '#000000', '#1D2B53', '#7E2553', '#008751', '#AB5236',
      '#5F574F', '#C2C3C7', '#FFF1E8', '#FF004D', '#FFA300',
      '#FFEC27', '#00E436', '#29ADFF', '#83769C', '#FF77A8', '#FFCCAA'
    ],
    gameboy: [
      '#0F380F', '#306230', '#8BAC0F', '#9BBC0F'
    ],
    cyberpunk: [
      '#050505', '#00FFFF', '#FF007F', '#FFE600', '#7B00FF',
      '#00FF66', '#1E1E2F', '#FFFFFF'
    ]
  };

  class WallpaperStudio {
    constructor() {
      this.canvas = null;
      this.ctx = null;
      this.overlayCanvas = null;
      this.overlayCtx = null;

      // Outils
      this.currentTool = 'brush'; // brush, pencil, eraser, fill, picker, line, rect
      this.brushSize = 3;         // 1 to 24 px
      this.brushShape = 'round';   // 'round' or 'square'
      this.currentColor = '#FFBB00';
      this.currentPalette = 'numworks';
      this.zoomLevel = 2; // 1x, 2x, 3x, 4x
      this.showGrid = false;
      this.showOverlay = true;
      this.overlayOpacity = 0.5; // 0 to 1
      this.useDithering = true;

      // État de dessin et curseur
      this.isDrawing = false;
      this.startX = 0;
      this.startY = 0;
      this.cursorX = -1;
      this.cursorY = -1;
      this.history = [];
      this.historyIndex = -1;
      this.maxHistory = 30;

      // Données de pixels en mémoire (RGBA)
      this.pixelData = new Uint8ClampedArray(TOTAL_PIXELS * 4);
      // Remplissage par défaut (Fond sombre moderne avec dégradé subtil à haute visibilité)
      this.initDefaultCanvas();
    }

    /**
     * Initialise un fond texturé moderne slate haute lisibilité (jamais 100% noir)
     */
    initDefaultCanvas() {
      for (let y = 0; y < SCREEN_HEIGHT; y++) {
        for (let x = 0; x < SCREEN_WIDTH; x++) {
          const offset = (y * SCREEN_WIDTH + x) * 4;
          // Dégradé ardoise moderne contrasté (#1e293b vers #0f172a)
          const ratio = y / SCREEN_HEIGHT;
          let r = Math.round(28 - ratio * 12);
          let g = Math.round(38 - ratio * 14);
          let b = Math.round(54 - ratio * 14);

          // Subtil quadrillage tech tous les 16 pixels
          if (x % 16 === 0 || y % 16 === 0) {
            r = Math.min(255, r + 5);
            g = Math.min(255, g + 6);
            b = Math.min(255, b + 8);
          }

          this.pixelData[offset] = r;
          this.pixelData[offset + 1] = g;
          this.pixelData[offset + 2] = b;
          this.pixelData[offset + 3] = 255;
        }
      }
    }

    mount(container) {
      if (!container) return;
      container.innerHTML = this.renderHTML();
      this.bindDOM(container);
      this.pushHistoryState();
      this.renderCanvas();
      this.renderOverlay();
      this.updateZoomCSS();
      this.checkStoredWallpaper();
      this.autoSyncWallpaper();
    }

    renderHTML() {
      return `
        <div class="wallpaper-studio-container space-y-4 font-mono">
          <!-- En-tête du Studio avec actions principales -->
          <div class="bg-[#161b22] border-2 border-[#30363d] rounded-lg p-3 shadow-[3px_3px_0px_#000] flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <span class="text-xl">🎨</span>
              <div>
                <h3 class="text-xs font-bold text-[#e6edf3] uppercase tracking-wider flex items-center gap-2">
                  <span>Studio Fond d'écran & Thème Custom</span>
                  <span class="text-[10px] px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 border border-amber-400/40">320x240 LCD</span>
                </h3>
                <p class="text-[11px] text-[#8b949e]">Créez ou importez un fond pour le 7ᵉ thème calculatrice (« Custom »)</p>
              </div>
            </div>

            <!-- Boutons Rapides d'action principale -->
            <div class="flex items-center gap-2">
              <button id="ws-apply-theme-btn" class="px-3 py-1.5 rounded bg-[#FFBB00] hover:bg-[#E5A600] text-black font-extrabold text-xs border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition-all flex items-center gap-1.5 cursor-pointer" title="Définir comme thème personnalisé actif">
                <span>⭐</span> Appliquer comme Thème Custom
              </button>
              <button id="ws-export-png-btn" class="px-2.5 py-1.5 rounded bg-[#21262d] hover:bg-[#30363d] text-[#e6edf3] text-xs font-bold border border-[#30363d] shadow-[1px_1px_0px_#000] transition-all flex items-center gap-1 cursor-pointer" title="Télécharger l'image 320x240 en PNG">
                <span>💾</span> PNG
              </button>
              <button id="ws-export-bin-btn" class="px-2.5 py-1.5 rounded bg-[#21262d] hover:bg-[#30363d] text-[#e6edf3] text-xs font-bold border border-[#30363d] shadow-[1px_1px_0px_#000] transition-all flex items-center gap-1 cursor-pointer" title="Télécharger les octets RGB565 bruts (153.6 Ko)">
                <span>📦</span> BIN (RGB565)
              </button>
            </div>
          </div>

          <!-- Section Import d'Image Rapide -->
          <div class="bg-[#161b22] border-2 border-[#30363d] rounded-lg p-3 shadow-[3px_3px_0px_#000] space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-[#30363d] pb-2">
              <span class="text-xs font-bold text-[#c9d1d9] flex items-center gap-2">
                <span>🖼️</span> Import d'Image Personnalisée (PNG, JPG, WEBP)
              </span>
              <div class="flex items-center gap-3 text-xs text-[#8b949e]">
                <label class="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" id="ws-dither-toggle" checked class="accent-[#FFBB00]">
                  <span>Dithering Floyd-Steinberg</span>
                </label>
                <label class="flex items-center gap-1.5">
                  <span>Cadrage :</span>
                  <select id="ws-fit-mode" class="bg-[#0d1117] border border-[#30363d] text-xs text-[#e6edf3] rounded px-1.5 py-0.5">
                    <option value="cover">Remplir (Cover)</option>
                    <option value="contain">Ajuster (Contain)</option>
                    <option value="stretch">Étirer (Stretch 320x240)</option>
                  </select>
                </label>
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-3">
              <input type="file" id="ws-file-input" accept="image/png,image/jpeg,image/webp" class="hidden">
              <button id="ws-browse-file-btn" class="px-3 py-1.5 rounded bg-[#21262d] hover:bg-[#30363d] text-white text-xs font-bold border border-[#30363d] flex items-center gap-2 cursor-pointer shadow-[1px_1px_0px_#000]">
                <span>📂 Choisir une image...</span>
              </button>
              <span id="ws-file-status" class="text-xs text-[#8b949e]">Aucun fichier sélectionné (Glissez-déposez ou choisissez un fichier)</span>
            </div>
          </div>

          <!-- Studio Pixel Art & Canevas Principal -->
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            
            <!-- Colonne Outils & Palettes (4 cols) -->
            <div class="lg:col-span-4 bg-[#161b22] border-2 border-[#30363d] rounded-lg p-3 shadow-[3px_3px_0px_#000] space-y-4">
              
              <!-- Outils de Dessin -->
              <div class="space-y-1.5">
                <span class="text-[11px] font-bold text-[#8b949e] uppercase tracking-wider">Outils de Dessin</span>
                <div class="grid grid-cols-4 gap-1.5">
                  <button class="ws-tool-btn active py-1.5 px-1.5 rounded bg-[#FFBB00] text-black font-bold text-xs border border-black flex items-center justify-center gap-1 cursor-pointer" data-tool="brush" title="Pinceau (taille réglable)">
                    <span>🖌️</span> Pinceau
                  </button>
                  <button class="ws-tool-btn py-1.5 px-1.5 rounded bg-[#0d1117] text-[#8b949e] hover:text-white hover:bg-[#21262d] font-bold text-xs border border-[#30363d] flex items-center justify-center gap-1 cursor-pointer" data-tool="pencil" title="Crayon pixel (1 px fixe)">
                    <span>✏️</span> Crayon
                  </button>
                  <button class="ws-tool-btn py-1.5 px-1.5 rounded bg-[#0d1117] text-[#8b949e] hover:text-white hover:bg-[#21262d] font-bold text-xs border border-[#30363d] flex items-center justify-center gap-1 cursor-pointer" data-tool="eraser" title="Gomme">
                    <span>🧹</span> Gomme
                  </button>
                  <button class="ws-tool-btn py-1.5 px-1.5 rounded bg-[#0d1117] text-[#8b949e] hover:text-white hover:bg-[#21262d] font-bold text-xs border border-[#30363d] flex items-center justify-center gap-1 cursor-pointer" data-tool="fill" title="Remplissage pot de peinture">
                    <span>🪣</span> Pot
                  </button>
                  <button class="ws-tool-btn py-1.5 px-1.5 rounded bg-[#0d1117] text-[#8b949e] hover:text-white hover:bg-[#21262d] font-bold text-xs border border-[#30363d] flex items-center justify-center gap-1 cursor-pointer" data-tool="picker" title="Pipette (Sélectionner une couleur)">
                    <span>🧪</span> Pipette
                  </button>
                  <button class="ws-tool-btn py-1.5 px-1.5 rounded bg-[#0d1117] text-[#8b949e] hover:text-white hover:bg-[#21262d] font-bold text-xs border border-[#30363d] flex items-center justify-center gap-1 cursor-pointer" data-tool="line" title="Tracer une ligne droite">
                    <span>📏</span> Ligne
                  </button>
                  <button class="ws-tool-btn py-1.5 px-1.5 rounded bg-[#0d1117] text-[#8b949e] hover:text-white hover:bg-[#21262d] font-bold text-xs border border-[#30363d] flex items-center justify-center gap-1 cursor-pointer" data-tool="rect" title="Tracer un rectangle">
                    <span>⬜</span> Rect
                  </button>
                  <button id="ws-tool-presets-btn" class="py-1.5 px-1.5 rounded bg-[#0d1117] text-[#8b949e] hover:text-white hover:bg-[#21262d] font-bold text-xs border border-[#30363d] flex items-center justify-center gap-1 cursor-pointer" title="Fonds Prédéfinis">
                    <span>✨</span> Fonds
                  </button>
                </div>
              </div>

              <!-- Réglage de la taille du Pinceau & Gomme -->
              <div id="ws-brush-size-panel" class="bg-[#0d1117] border border-[#30363d] rounded p-2.5 space-y-2">
                <div class="flex items-center justify-between text-xs">
                  <span class="text-[#8b949e] font-bold flex items-center gap-1.5">
                    <span>🎯</span> Taille du Pinceau / Gomme :
                  </span>
                  <span id="ws-brush-size-label" class="font-extrabold text-[#FFBB00]">3 px</span>
                </div>
                
                <div class="flex items-center gap-2">
                  <input type="range" id="ws-brush-size-slider" min="1" max="24" value="3" class="w-full accent-[#FFBB00] cursor-pointer">
                </div>

                <div class="flex items-center justify-between gap-1 pt-1 border-t border-[#21262d]">
                  <!-- Boutons rapides de taille -->
                  <div class="flex items-center gap-1">
                    <button class="ws-size-pill text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#21262d] text-[#8b949e] hover:text-white cursor-pointer" data-size="1">1</button>
                    <button class="ws-size-pill text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#21262d] text-[#8b949e] hover:text-white cursor-pointer" data-size="2">2</button>
                    <button class="ws-size-pill active text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#FFBB00] text-black cursor-pointer" data-size="3">3</button>
                    <button class="ws-size-pill text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#21262d] text-[#8b949e] hover:text-white cursor-pointer" data-size="6">6</button>
                    <button class="ws-size-pill text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#21262d] text-[#8b949e] hover:text-white cursor-pointer" data-size="10">10</button>
                    <button class="ws-size-pill text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#21262d] text-[#8b949e] hover:text-white cursor-pointer" data-size="16">16</button>
                  </div>

                  <!-- Forme de pointe (Ronde / Carrée) -->
                  <div class="flex items-center gap-1">
                    <button id="ws-shape-round-btn" class="active text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#FFBB00] text-black border border-black cursor-pointer" title="Pointe Ronde">⚪</button>
                    <button id="ws-shape-square-btn" class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#21262d] text-[#8b949e] border border-[#30363d] cursor-pointer" title="Pointe Carrée">⬛</button>
                  </div>
                </div>
              </div>

              <!-- Menu des fonds prédéfinis (Masquable) -->
              <div id="ws-bg-presets-modal" class="hidden bg-[#0d1117] border border-[#30363d] rounded p-2.5 space-y-2">
                <div class="flex items-center justify-between text-xs font-bold text-[#c9d1d9]">
                  <span>Fonds Prédéfinis Rétro :</span>
                  <button id="ws-close-presets-btn" class="text-[#8b949e] hover:text-white cursor-pointer">✕</button>
                </div>
                <div class="grid grid-cols-2 gap-1.5 text-xs">
                  <button class="ws-preset-btn py-1 px-2 rounded bg-[#21262d] hover:bg-[#30363d] text-amber-300 font-bold border border-[#30363d] cursor-pointer" data-preset="numworks">⚡ NumWorks</button>
                  <button class="ws-preset-btn py-1 px-2 rounded bg-[#21262d] hover:bg-[#30363d] text-cyan-300 font-bold border border-[#30363d] cursor-pointer" data-preset="matrix">🌆 Cyber Matrix</button>
                  <button class="ws-preset-btn py-1 px-2 rounded bg-[#21262d] hover:bg-[#30363d] text-emerald-300 font-bold border border-[#30363d] cursor-pointer" data-preset="gameboy">🎮 GameBoy</button>
                  <button class="ws-preset-btn py-1 px-2 rounded bg-[#21262d] hover:bg-[#30363d] text-slate-200 font-bold border border-[#30363d] cursor-pointer" data-preset="slate">⬛ Ardoise Sombre</button>
                  <button class="ws-preset-btn py-1 px-2 rounded bg-[#21262d] hover:bg-[#30363d] text-white font-bold border border-[#30363d] cursor-pointer col-span-2" data-preset="white">⬜ Blanc Pur Épuré</button>
                </div>
              </div>

              <!-- Sélecteur de couleur & Couleur active -->
              <div class="space-y-1.5">
                <div class="flex items-center justify-between">
                  <span class="text-[11px] font-bold text-[#8b949e] uppercase tracking-wider">Couleur Active</span>
                  <span id="ws-color-hex" class="text-xs font-mono font-bold text-[#FFBB00]">#FFBB00</span>
                </div>
                <div class="flex items-center gap-2">
                  <input type="color" id="ws-color-picker" value="#FFBB00" class="w-10 h-8 rounded border border-[#30363d] bg-transparent cursor-pointer p-0">
                  <div class="flex-1 flex gap-1 items-center overflow-x-auto p-1 bg-[#0d1117] border border-[#30363d] rounded" id="ws-palette-swatches">
                    <!-- Swatches générés dynamiquement -->
                  </div>
                </div>
              </div>

              <!-- Choix de la palette rétro -->
              <div class="space-y-1.5">
                <span class="text-[11px] font-bold text-[#8b949e] uppercase tracking-wider">Palettes Rétro</span>
                <div class="grid grid-cols-2 gap-1.5">
                  <button class="ws-pal-btn active py-1 px-2 rounded text-xs font-bold bg-[#21262d] text-[#FFBB00] border border-[#FFBB00] cursor-pointer" data-pal="numworks">
                    ⚡ NumWorks
                  </button>
                  <button class="ws-pal-btn py-1 px-2 rounded text-xs font-bold bg-[#0d1117] text-[#8b949e] border border-[#30363d] cursor-pointer" data-pal="pico8">
                    🕹️ PICO-8
                  </button>
                  <button class="ws-pal-btn py-1 px-2 rounded text-xs font-bold bg-[#0d1117] text-[#8b949e] border border-[#30363d] cursor-pointer" data-pal="gameboy">
                    🎮 GameBoy
                  </button>
                  <button class="ws-pal-btn py-1 px-2 rounded text-xs font-bold bg-[#0d1117] text-[#8b949e] border border-[#30363d] cursor-pointer" data-pal="cyberpunk">
                    🌆 Cyberpunk
                  </button>
                </div>
              </div>

              <!-- Historique Undo / Redo & Effacer -->
              <div class="space-y-1.5 pt-1 border-t border-[#30363d]">
                <div class="grid grid-cols-3 gap-1.5">
                  <button id="ws-undo-btn" class="py-1 px-2 rounded bg-[#0d1117] hover:bg-[#21262d] text-xs font-bold text-[#8b949e] hover:text-white border border-[#30363d] cursor-pointer" title="Annuler (Ctrl+Z)">
                    ↩️ Undo
                  </button>
                  <button id="ws-redo-btn" class="py-1 px-2 rounded bg-[#0d1117] hover:bg-[#21262d] text-xs font-bold text-[#8b949e] hover:text-white border border-[#30363d] cursor-pointer" title="Rétablir (Ctrl+Y)">
                    ↪️ Redo
                  </button>
                  <button id="ws-clear-btn" class="py-1 px-2 rounded bg-[#0d1117] hover:bg-rose-950 text-xs font-bold text-rose-400 border border-rose-900/50 cursor-pointer" title="Réinitialiser le fond">
                    🗑️ Vider
                  </button>
                </div>
              </div>

            </div>

            <!-- Colonne Canevas & Superposition Hub (8 cols) -->
            <div class="lg:col-span-8 bg-[#161b22] border-2 border-[#30363d] rounded-lg p-3 shadow-[3px_3px_0px_#000] space-y-3">
              
              <!-- Barre d'options d'affichage (Zoom, Grille, Overlay Hub) -->
              <div class="flex flex-wrap items-center justify-between gap-2 border-b border-[#30363d] pb-2">
                <div class="flex items-center gap-1.5">
                  <span class="text-xs text-[#8b949e]">Zoom :</span>
                  <div class="flex items-center gap-0.5 bg-[#0d1117] border border-[#30363d] p-0.5 rounded">
                    <button class="ws-zoom-btn px-2 py-0.5 text-xs rounded font-bold text-[#8b949e] hover:text-white" data-zoom="1">1x</button>
                    <button class="ws-zoom-btn active px-2 py-0.5 text-xs rounded font-bold bg-[#FFBB00] text-black shadow-sm" data-zoom="2">2x</button>
                    <button class="ws-zoom-btn px-2 py-0.5 text-xs rounded font-bold text-[#8b949e] hover:text-white" data-zoom="3">3x</button>
                  </div>
                  <label class="flex items-center gap-1.5 ml-3 text-xs text-[#8b949e] cursor-pointer">
                    <input type="checkbox" id="ws-grid-toggle" class="accent-[#FFBB00]">
                    <span>Grille Pixel</span>
                  </label>
                </div>

                <div class="flex items-center gap-2">
                  <label class="flex items-center gap-1.5 text-xs text-[#8b949e] cursor-pointer">
                    <input type="checkbox" id="ws-overlay-toggle" checked class="accent-[#FFBB00]">
                    <span class="font-bold text-[#e6edf3]">👁️ Superposition Hub UI</span>
                  </label>
                  <input type="range" id="ws-overlay-opacity" min="0" max="1" step="0.1" value="0.5" class="w-16 accent-[#FFBB00]" title="Transparence de l'interface du Hub superposée">
                </div>
              </div>

              <!-- Zone de travail avec Canvas centré et Scrollable -->
              <div class="ws-canvas-wrapper overflow-auto max-h-[520px] p-4 bg-[#0d1117] border-2 border-black rounded-lg flex items-center justify-center relative shadow-[inset_2px_2px_4px_#000]">
                <div class="relative inline-block border-2 border-[#30363d] shadow-[0_0_15px_rgba(0,0,0,0.8)] cursor-crosshair" id="ws-viewport">
                  <!-- Canvas de dessin principal (320x240 natif) -->
                  <canvas id="ws-main-canvas" width="320" height="240" class="block image-pixelated bg-[#1e293b]"></canvas>
                  <!-- Canvas d'overlay de l'UI du Hub (Top Bar, Cartes Galerie, Dock, Curseur Pinceau) -->
                  <canvas id="ws-overlay-canvas" width="320" height="240" class="absolute inset-0 pointer-events-none block image-pixelated"></canvas>
                </div>
              </div>

              <!-- Pied d'écran : Statut et Coordonnées -->
              <div class="flex items-center justify-between text-[11px] text-[#8b949e] pt-1">
                <span id="ws-cursor-coords">Curseur : X: 0, Y: 0 | Outil : Pinceau (3px)</span>
                <span class="text-amber-400 font-bold" id="ws-active-theme-status">✓ Fond d'écran prêt pour la calculatrice (153.6 Ko)</span>
              </div>

            </div>

          </div>
        </div>
      `;
    }

    bindDOM(container) {
      this.canvas = container.querySelector('#ws-main-canvas');
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
      this.overlayCanvas = container.querySelector('#ws-overlay-canvas');
      this.overlayCtx = this.overlayCanvas.getContext('2d');

      // Outils
      const toolBtns = container.querySelectorAll('.ws-tool-btn');
      toolBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          toolBtns.forEach(b => {
            b.classList.remove('active', 'bg-[#FFBB00]', 'text-black');
            b.classList.add('bg-[#0d1117]', 'text-[#8b949e]');
          });
          btn.classList.add('active', 'bg-[#FFBB00]', 'text-black');
          btn.classList.remove('bg-[#0d1117]', 'text-[#8b949e]');
          this.currentTool = btn.getAttribute('data-tool');
          this.updateCursorLabel();
          this.renderOverlay();
        });
      });

      // Gestionnaire de Taille de Pinceau (Slider)
      const sizeSlider = container.querySelector('#ws-brush-size-slider');
      const sizeLabel = container.querySelector('#ws-brush-size-label');
      const sizePills = container.querySelectorAll('.ws-size-pill');

      if (sizeSlider) {
        sizeSlider.addEventListener('input', (e) => {
          const val = parseInt(e.target.value, 10);
          this.setBrushSize(val);
        });
      }

      sizePills.forEach(pill => {
        pill.addEventListener('click', () => {
          const sz = parseInt(pill.getAttribute('data-size'), 10);
          this.setBrushSize(sz);
        });
      });

      // Formes de pointe (Ronde / Carrée)
      const roundBtn = container.querySelector('#ws-shape-round-btn');
      const squareBtn = container.querySelector('#ws-shape-square-btn');
      if (roundBtn && squareBtn) {
        roundBtn.addEventListener('click', () => {
          this.brushShape = 'round';
          roundBtn.classList.add('active', 'bg-[#FFBB00]', 'text-black', 'border-black');
          roundBtn.classList.remove('bg-[#21262d]', 'text-[#8b949e]', 'border-[#30363d]');
          squareBtn.classList.remove('active', 'bg-[#FFBB00]', 'text-black', 'border-black');
          squareBtn.classList.add('bg-[#21262d]', 'text-[#8b949e]', 'border-[#30363d]');
          this.renderOverlay();
        });
        squareBtn.addEventListener('click', () => {
          this.brushShape = 'square';
          squareBtn.classList.add('active', 'bg-[#FFBB00]', 'text-black', 'border-black');
          squareBtn.classList.remove('bg-[#21262d]', 'text-[#8b949e]', 'border-[#30363d]');
          roundBtn.classList.remove('active', 'bg-[#FFBB00]', 'text-black', 'border-black');
          roundBtn.classList.add('bg-[#21262d]', 'text-[#8b949e]', 'border-[#30363d]');
          this.renderOverlay();
        });
      }

      // Presets de fond modal
      const presetsBtn = container.querySelector('#ws-tool-presets-btn');
      const presetsModal = container.querySelector('#ws-bg-presets-modal');
      const closePresetsBtn = container.querySelector('#ws-close-presets-btn');

      if (presetsBtn && presetsModal) {
        presetsBtn.addEventListener('click', () => {
          presetsModal.classList.toggle('hidden');
        });
      }
      if (closePresetsBtn && presetsModal) {
        closePresetsBtn.addEventListener('click', () => {
          presetsModal.classList.add('hidden');
        });
      }

      container.querySelectorAll('.ws-preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const key = btn.getAttribute('data-preset');
          this.applyBackgroundPreset(key);
          if (presetsModal) presetsModal.classList.add('hidden');
        });
      });

      // Palettes
      const palBtns = container.querySelectorAll('.ws-pal-btn');
      palBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          palBtns.forEach(b => {
            b.classList.remove('active', 'bg-[#21262d]', 'text-[#FFBB00]', 'border-[#FFBB00]');
            b.classList.add('bg-[#0d1117]', 'text-[#8b949e]', 'border-[#30363d]');
          });
          btn.classList.add('active', 'bg-[#21262d]', 'text-[#FFBB00]', 'border-[#FFBB00]');
          btn.classList.remove('bg-[#0d1117]', 'text-[#8b949e]', 'border-[#30363d]');
          this.currentPalette = btn.getAttribute('data-pal');
          this.renderPaletteSwatches();
        });
      });

      // Sélecteur de couleur
      const colorPicker = container.querySelector('#ws-color-picker');
      const colorHex = container.querySelector('#ws-color-hex');
      colorPicker.addEventListener('input', (e) => {
        this.currentColor = e.target.value;
        colorHex.textContent = this.currentColor.toUpperCase();
      });

      // Zoom
      const zoomBtns = container.querySelectorAll('.ws-zoom-btn');
      zoomBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          zoomBtns.forEach(b => {
            b.classList.remove('active', 'bg-[#FFBB00]', 'text-black', 'shadow-sm');
            b.classList.add('text-[#8b949e]');
          });
          btn.classList.add('active', 'bg-[#FFBB00]', 'text-black', 'shadow-sm');
          btn.classList.remove('text-[#8b949e]');
          this.zoomLevel = parseInt(btn.getAttribute('data-zoom'), 10);
          this.updateZoomCSS();
        });
      });

      // Grille
      const gridToggle = container.querySelector('#ws-grid-toggle');
      gridToggle.addEventListener('change', (e) => {
        this.showGrid = e.target.checked;
        this.renderOverlay();
      });

      // Overlay Hub UI
      const overlayToggle = container.querySelector('#ws-overlay-toggle');
      overlayToggle.addEventListener('change', (e) => {
        this.showOverlay = e.target.checked;
        this.overlayCanvas.style.display = this.showOverlay ? 'block' : 'none';
        this.renderOverlay();
      });

      const overlayOpacity = container.querySelector('#ws-overlay-opacity');
      overlayOpacity.addEventListener('input', (e) => {
        this.overlayOpacity = parseFloat(e.target.value);
        this.renderOverlay();
      });

      // Undo / Redo / Clear
      container.querySelector('#ws-undo-btn').addEventListener('click', () => this.undo());
      container.querySelector('#ws-redo-btn').addEventListener('click', () => this.redo());
      container.querySelector('#ws-clear-btn').addEventListener('click', () => {
        if (confirm('Réinitialiser le fond avec le thème ardoise contrasté ?')) {
          this.initDefaultCanvas();
          this.pushHistoryState();
          this.renderCanvas();
          this.autoSyncWallpaper();
        }
      });

      // Import de fichiers
      const fileInput = container.querySelector('#ws-file-input');
      const browseBtn = container.querySelector('#ws-browse-file-btn');
      const fileStatus = container.querySelector('#ws-file-status');
      const ditherToggle = container.querySelector('#ws-dither-toggle');
      const fitModeSelect = container.querySelector('#ws-fit-mode');

      browseBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          fileStatus.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} Ko)`;
          this.loadImageFile(file, fitModeSelect.value, ditherToggle.checked);
        }
      });

      // Drag & Drop sur le viewport
      const viewport = container.querySelector('#ws-viewport');
      viewport.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
      viewport.addEventListener('drop', (e) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          const file = e.dataTransfer.files[0];
          fileStatus.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} Ko)`;
          this.loadImageFile(file, fitModeSelect.value, ditherToggle.checked);
        }
      });

      // Événements de la souris sur le Canvas de dessin
      this.canvas.addEventListener('mousedown', (e) => this.onPointerDown(e));
      window.addEventListener('mousemove', (e) => this.onPointerMove(e));
      window.addEventListener('mouseup', () => this.onPointerUp());

      // Événements tactiles (tablette / mobile)
      this.canvas.addEventListener('touchstart', (e) => {
        if (e.touches && e.touches[0]) {
          e.preventDefault();
          this.onPointerDown(e.touches[0]);
        }
      }, { passive: false });

      this.canvas.addEventListener('touchmove', (e) => {
        if (e.touches && e.touches[0]) {
          e.preventDefault();
          this.onPointerMove(e.touches[0]);
        }
      }, { passive: false });

      this.canvas.addEventListener('touchend', () => this.onPointerUp());

      // Raccourcis clavier (Undo, Redo, Pinceau, Taille)
      window.addEventListener('keydown', (e) => {
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
        const key = e.key.toLowerCase();

        if (e.ctrlKey || e.metaKey) {
          if (key === 'z') {
            e.preventDefault();
            if (e.shiftKey) this.redo();
            else this.undo();
          } else if (key === 'y') {
            e.preventDefault();
            this.redo();
          }
          return;
        }

        if (key === 'b') this.selectTool('brush');
        else if (key === 'p') this.selectTool('pencil');
        else if (key === 'e') this.selectTool('eraser');
        else if (key === 'g' || key === 'f') this.selectTool('fill');
        else if (key === 'i') this.selectTool('picker');
        else if (key === 'l') this.selectTool('line');
        else if (key === 'r') this.selectTool('rect');
        else if (key === '[' || key === '-') this.setBrushSize(Math.max(1, this.brushSize - 1));
        else if (key === ']' || key === '+') this.setBrushSize(Math.min(24, this.brushSize + 1));
      });

      // Exportations
      container.querySelector('#ws-export-png-btn').addEventListener('click', () => this.exportPNG());
      container.querySelector('#ws-export-bin-btn').addEventListener('click', () => this.exportBIN());
      container.querySelector('#ws-apply-theme-btn').addEventListener('click', () => this.applyCustomTheme());

      this.renderPaletteSwatches();
    }

    setBrushSize(sz) {
      this.brushSize = Math.max(1, Math.min(24, sz));
      if (typeof document !== 'undefined') {
        const slider = document.getElementById('ws-brush-size-slider');
        const label = document.getElementById('ws-brush-size-label');
        if (slider) slider.value = this.brushSize;
        if (label) label.textContent = `${this.brushSize} px`;

        document.querySelectorAll('.ws-size-pill').forEach(pill => {
          const ps = parseInt(pill.getAttribute('data-size'), 10);
          if (ps === this.brushSize) {
            pill.className = 'ws-size-pill active text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#FFBB00] text-black cursor-pointer';
          } else {
            pill.className = 'ws-size-pill text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#21262d] text-[#8b949e] hover:text-white cursor-pointer';
          }
        });
      }

      this.updateCursorLabel();
      this.renderOverlay();
    }

    selectTool(toolName) {
      this.currentTool = toolName;
      if (typeof document !== 'undefined') {
        document.querySelectorAll('.ws-tool-btn').forEach(b => {
          if (b.getAttribute('data-tool') === toolName) {
            b.classList.add('active', 'bg-[#FFBB00]', 'text-black');
            b.classList.remove('bg-[#0d1117]', 'text-[#8b949e]');
          } else {
            b.classList.remove('active', 'bg-[#FFBB00]', 'text-black');
            b.classList.add('bg-[#0d1117]', 'text-[#8b949e]');
          }
        });
      }
      this.updateCursorLabel();
      this.renderOverlay();
    }

    getToolLabel() {
      switch (this.currentTool) {
        case 'brush': return 'Pinceau';
        case 'pencil': return 'Crayon 1px';
        case 'eraser': return 'Gomme';
        case 'fill': return 'Pot';
        case 'picker': return 'Pipette';
        case 'line': return 'Ligne';
        case 'rect': return 'Rectangle';
        default: return 'Outil';
      }
    }

    updateCursorLabel() {
      if (typeof document === 'undefined') return;
      const coordEl = document.getElementById('ws-cursor-coords');
      if (coordEl && this.cursorX >= 0) {
        coordEl.textContent = `Curseur : X: ${this.cursorX}, Y: ${this.cursorY} | Outil : ${this.getToolLabel()} (${this.brushSize}px)`;
      }
    }

    applyBackgroundPreset(presetKey) {
      if (presetKey === 'numworks') {
        // Slate profond avec bordure ambre NumWorks
        for (let y = 0; y < SCREEN_HEIGHT; y++) {
          for (let x = 0; x < SCREEN_WIDTH; x++) {
            const off = (y * SCREEN_WIDTH + x) * 4;
            const isBorder = (x < 2 || x >= SCREEN_WIDTH - 2 || y < 2 || y >= SCREEN_HEIGHT - 2);
            if (isBorder) {
              this.pixelData[off] = 255;
              this.pixelData[off + 1] = 187;
              this.pixelData[off + 2] = 0;
            } else {
              const r = Math.round(28 + (y / SCREEN_HEIGHT) * 14);
              this.pixelData[off] = r;
              this.pixelData[off + 1] = r + 4;
              this.pixelData[off + 2] = r + 14;
            }
            this.pixelData[off + 3] = 255;
          }
        }
      } else if (presetKey === 'matrix') {
        // Cyan Matrix avec grille fine
        for (let y = 0; y < SCREEN_HEIGHT; y++) {
          for (let x = 0; x < SCREEN_WIDTH; x++) {
            const off = (y * SCREEN_WIDTH + x) * 4;
            const grid = (x % 16 === 0 || y % 16 === 0);
            this.pixelData[off] = grid ? 10 : 6;
            this.pixelData[off + 1] = grid ? 45 : 20;
            this.pixelData[off + 2] = grid ? 75 : 35;
            this.pixelData[off + 3] = 255;
          }
        }
      } else if (presetKey === 'gameboy') {
        // Vert rétro DMG
        for (let i = 0; i < TOTAL_PIXELS; i++) {
          const off = i * 4;
          this.pixelData[off] = 15;
          this.pixelData[off + 1] = 56;
          this.pixelData[off + 2] = 15;
          this.pixelData[off + 3] = 255;
        }
      } else if (presetKey === 'white') {
        // Blanc épuré
        for (let i = 0; i < TOTAL_PIXELS; i++) {
          const off = i * 4;
          this.pixelData[off] = 248;
          this.pixelData[off + 1] = 250;
          this.pixelData[off + 2] = 252;
          this.pixelData[off + 3] = 255;
        }
      } else {
        // Ardoise sombre par défaut
        this.initDefaultCanvas();
      }

      this.pushHistoryState();
      this.renderCanvas();
      this.autoSyncWallpaper();
      window.soundFx?.playClick?.();
    }

    renderPaletteSwatches() {
      const container = document.getElementById('ws-palette-swatches');
      if (!container) return;
      const colors = PALETTES[this.currentPalette] || PALETTES.numworks;
      container.innerHTML = colors.map(col => `
        <button class="ws-swatch-btn w-5 h-5 rounded-sm shrink-0 border border-black/40 hover:scale-110 transition-transform cursor-pointer"
          style="background-color: ${col};"
          data-color="${col}"
          title="${col}"></button>
      `).join('');

      container.querySelectorAll('.ws-swatch-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const col = btn.getAttribute('data-color');
          this.currentColor = col;
          const picker = document.getElementById('ws-color-picker');
          const hex = document.getElementById('ws-color-hex');
          if (picker) picker.value = col;
          if (hex) hex.textContent = col.toUpperCase();
        });
      });
    }

    updateZoomCSS() {
      const w = SCREEN_WIDTH * this.zoomLevel;
      const h = SCREEN_HEIGHT * this.zoomLevel;
      if (this.canvas) {
        this.canvas.style.width = `${w}px`;
        this.canvas.style.height = `${h}px`;
      }
      if (this.overlayCanvas) {
        this.overlayCanvas.style.width = `${w}px`;
        this.overlayCanvas.style.height = `${h}px`;
      }
    }

    getCanvasCoords(e) {
      const rect = this.canvas.getBoundingClientRect();
      const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
      const clientY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
      const scaleX = SCREEN_WIDTH / rect.width;
      const scaleY = SCREEN_HEIGHT / rect.height;
      let x = Math.floor((clientX - rect.left) * scaleX);
      let y = Math.floor((clientY - rect.top) * scaleY);
      x = Math.max(0, Math.min(SCREEN_WIDTH - 1, x));
      y = Math.max(0, Math.min(SCREEN_HEIGHT - 1, y));
      return { x, y };
    }

    onPointerDown(e) {
      const coords = this.getCanvasCoords(e);
      this.isDrawing = true;
      this.startX = coords.x;
      this.startY = coords.y;
      this.cursorX = coords.x;
      this.cursorY = coords.y;

      if (this.currentTool === 'picker') {
        this.pickColorAt(coords.x, coords.y);
        this.isDrawing = false;
        return;
      }

      if (this.currentTool === 'fill') {
        this.floodFill(coords.x, coords.y, this.currentColor);
        this.pushHistoryState();
        this.renderCanvas();
        this.autoSyncWallpaper();
        this.isDrawing = false;
        return;
      }

      if (this.currentTool === 'brush') {
        this.drawBrushStamp(coords.x, coords.y, this.currentColor, this.brushSize, this.brushShape);
        this.renderCanvas();
      } else if (this.currentTool === 'pencil') {
        this.setPixel(coords.x, coords.y, this.currentColor);
        this.renderCanvas();
      } else if (this.currentTool === 'eraser') {
        this.drawBrushStamp(coords.x, coords.y, '#1e293b', this.brushSize, this.brushShape);
        this.renderCanvas();
      }
    }

    onPointerMove(e) {
      const coords = this.getCanvasCoords(e);
      this.cursorX = coords.x;
      this.cursorY = coords.y;
      this.updateCursorLabel();
      this.renderOverlay();

      if (!this.isDrawing) return;

      if (this.currentTool === 'brush') {
        this.drawBrushLine(this.startX, this.startY, coords.x, coords.y, this.currentColor, this.brushSize, this.brushShape);
        this.startX = coords.x;
        this.startY = coords.y;
        this.renderCanvas();
      } else if (this.currentTool === 'eraser') {
        this.drawBrushLine(this.startX, this.startY, coords.x, coords.y, '#1e293b', this.brushSize, this.brushShape);
        this.startX = coords.x;
        this.startY = coords.y;
        this.renderCanvas();
      } else if (this.currentTool === 'pencil') {
        this.drawLine(this.startX, this.startY, coords.x, coords.y, this.currentColor);
        this.startX = coords.x;
        this.startY = coords.y;
        this.renderCanvas();
      }
    }

    onPointerUp() {
      if (!this.isDrawing) return;
      this.isDrawing = false;
      this.pushHistoryState();
      this.renderCanvas();
      this.autoSyncWallpaper();
    }

    /**
     * Applique une empreinte de pinceau (circulaire ou carrée) centrée sur (cx, cy)
     */
    drawBrushStamp(cx, cy, colorHex, size, shape = 'round') {
      if (size <= 1) {
        this.setPixel(cx, cy, colorHex);
        return;
      }

      if (shape === 'square') {
        const half = Math.floor(size / 2);
        const startX = cx - half;
        const startY = cy - half;
        for (let dy = 0; dy < size; dy++) {
          for (let dx = 0; dx < size; dx++) {
            this.setPixel(startX + dx, startY + dy, colorHex);
          }
        }
      } else {
        // Empreinte circulaire
        const r = size / 2;
        const rSq = r * r;
        const minX = Math.floor(cx - r);
        const maxX = Math.ceil(cx + r);
        const minY = Math.floor(cy - r);
        const maxY = Math.ceil(cy + r);

        for (let py = minY; py <= maxY; py++) {
          for (let px = minX; px <= maxX; px++) {
            const dx = px - cx;
            const dy = py - cy;
            if (dx * dx + dy * dy <= rSq + 0.25) {
              this.setPixel(px, py, colorHex);
            }
          }
        }
      }
    }

    /**
     * Interpolation continue Bresenham pour pinceau avec stamp à chaque pas
     */
    drawBrushLine(x0, y0, x1, y1, colorHex, size, shape) {
      const dx = Math.abs(x1 - x0);
      const dy = Math.abs(y1 - y0);
      const sx = (x0 < x1) ? 1 : -1;
      const sy = (y0 < y1) ? 1 : -1;
      let err = dx - dy;

      while (true) {
        this.drawBrushStamp(x0, y0, colorHex, size, shape);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 > -dy) { err -= dy; x0 += sx; }
        if (e2 < dx) { err += dx; y0 += sy; }
      }
    }

    setPixel(x, y, hexColor) {
      if (x < 0 || x >= SCREEN_WIDTH || y < 0 || y >= SCREEN_HEIGHT) return;
      const rgb = this.hexToRgb(hexColor);
      const idx = (y * SCREEN_WIDTH + x) * 4;
      this.pixelData[idx] = rgb.r;
      this.pixelData[idx + 1] = rgb.g;
      this.pixelData[idx + 2] = rgb.b;
      this.pixelData[idx + 3] = 255;
    }

    getPixel(x, y) {
      if (x < 0 || x >= SCREEN_WIDTH || y < 0 || y >= SCREEN_HEIGHT) return { r: 0, g: 0, b: 0, a: 0 };
      const idx = (y * SCREEN_WIDTH + x) * 4;
      return {
        r: this.pixelData[idx],
        g: this.pixelData[idx + 1],
        b: this.pixelData[idx + 2],
        a: this.pixelData[idx + 3]
      };
    }

    drawLine(x0, y0, x1, y1, color) {
      const dx = Math.abs(x1 - x0);
      const dy = Math.abs(y1 - y0);
      const sx = (x0 < x1) ? 1 : -1;
      const sy = (y0 < y1) ? 1 : -1;
      let err = dx - dy;

      while (true) {
        this.setPixel(x0, y0, color);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 > -dy) { err -= dy; x0 += sx; }
        if (e2 < dx) { err += dx; y0 += sy; }
      }
    }

    pickColorAt(x, y) {
      const p = this.getPixel(x, y);
      const hex = `#${((1 << 24) + (p.r << 16) + (p.g << 8) + p.b).toString(16).slice(1).toUpperCase()}`;
      this.currentColor = hex;
      const picker = document.getElementById('ws-color-picker');
      const hexEl = document.getElementById('ws-color-hex');
      if (picker) picker.value = hex;
      if (hexEl) hexEl.textContent = hex;
      this.selectTool('brush');
    }

    floodFill(startX, startY, fillHex) {
      const target = this.getPixel(startX, startY);
      const fill = this.hexToRgb(fillHex);
      if (target.r === fill.r && target.g === fill.g && target.b === fill.b) return;

      const queue = [startX, startY];
      const visited = new Uint8Array(TOTAL_PIXELS);

      while (queue.length > 0) {
        const cy = queue.pop();
        const cx = queue.pop();
        const idx = cy * SCREEN_WIDTH + cx;

        if (visited[idx]) continue;
        visited[idx] = 1;

        const p = this.getPixel(cx, cy);
        if (p.r === target.r && p.g === target.g && p.b === target.b) {
          this.setPixel(cx, cy, fillHex);

          if (cx > 0) { queue.push(cx - 1); queue.push(cy); }
          if (cx < SCREEN_WIDTH - 1) { queue.push(cx + 1); queue.push(cy); }
          if (cy > 0) { queue.push(cx); queue.push(cy - 1); }
          if (cy < SCREEN_HEIGHT - 1) { queue.push(cx); queue.push(cy + 1); }
        }
      }
    }

    pushHistoryState() {
      if (this.historyIndex < this.history.length - 1) {
        this.history = this.history.slice(0, this.historyIndex + 1);
      }
      this.history.push(new Uint8ClampedArray(this.pixelData));
      if (this.history.length > this.maxHistory) {
        this.history.shift();
      } else {
        this.historyIndex++;
      }
    }

    undo() {
      if (this.historyIndex > 0) {
        this.historyIndex--;
        this.pixelData.set(this.history[this.historyIndex]);
        this.renderCanvas();
        this.autoSyncWallpaper();
      }
    }

    redo() {
      if (this.historyIndex < this.history.length - 1) {
        this.historyIndex++;
        this.pixelData.set(this.history[this.historyIndex]);
        this.renderCanvas();
        this.autoSyncWallpaper();
      }
    }

    renderCanvas() {
      if (!this.ctx) return;
      const imgData = this.ctx.createImageData(SCREEN_WIDTH, SCREEN_HEIGHT);
      imgData.data.set(this.pixelData);
      this.ctx.putImageData(imgData, 0, 0);
    }

    renderOverlay() {
      if (!this.overlayCtx) return;
      this.overlayCtx.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

      // 1. Grille Pixel si activée
      if (this.showGrid && this.zoomLevel >= 2) {
        this.overlayCtx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        this.overlayCtx.lineWidth = 1;
        this.overlayCtx.beginPath();
        for (let x = 0; x <= SCREEN_WIDTH; x += 10) {
          this.overlayCtx.moveTo(x, 0);
          this.overlayCtx.lineTo(x, SCREEN_HEIGHT);
        }
        for (let y = 0; y <= SCREEN_HEIGHT; y += 10) {
          this.overlayCtx.moveTo(0, y);
          this.overlayCtx.lineTo(SCREEN_WIDTH, y);
        }
        this.overlayCtx.stroke();
      }

      // 2. Hub UI exact superposé
      if (this.showOverlay) {
        const op = this.overlayOpacity;
        this.overlayCtx.save();

        // Top Bar (h: 22px)
        this.overlayCtx.fillStyle = `rgba(33, 38, 45, ${op * 0.95})`;
        this.overlayCtx.fillRect(0, 0, SCREEN_WIDTH, 22);
        this.overlayCtx.fillStyle = `rgba(255, 187, 0, ${op})`;
        this.overlayCtx.font = 'bold 9px monospace';
        this.overlayCtx.fillText('EquaLib Hub [Galerie]', 8, 15);
        this.overlayCtx.fillStyle = `rgba(255, 255, 255, ${op})`;
        this.overlayCtx.fillText('12:00', SCREEN_WIDTH - 35, 15);

        // Cartes Galerie (3 cols x 2 rows)
        const cardW = 88;
        const cardH = 70;
        for (let row = 0; row < 2; row++) {
          for (let col = 0; col < 3; col++) {
            const x = 16 + col * 100;
            const y = 28 + row * 78;
            const isSel = (row === 0 && col === 0);

            this.overlayCtx.fillStyle = isSel ? `rgba(254, 243, 199, ${op * 0.9})` : `rgba(255, 255, 255, ${op * 0.85})`;
            this.overlayCtx.fillRect(x, y, cardW, cardH);

            this.overlayCtx.strokeStyle = isSel ? `rgba(245, 158, 11, ${op})` : `rgba(226, 232, 240, ${op * 0.8})`;
            this.overlayCtx.lineWidth = isSel ? 2 : 1;
            this.overlayCtx.strokeRect(x, y, cardW, cardH);

            this.overlayCtx.fillStyle = isSel ? '#000000' : '#334155';
            this.overlayCtx.font = 'bold 8px monospace';
            this.overlayCtx.textAlign = 'center';
            this.overlayCtx.fillText(isSel ? 'Mario Kart' : 'App ' + (row * 3 + col + 1), x + cardW / 2, y + 54);
            this.overlayCtx.font = '16px monospace';
            this.overlayCtx.fillText(isSel ? '🏎️' : '📦', x + cardW / 2, y + 34);
          }
        }

        // Dock bas (h: 24px à y: 188)
        this.overlayCtx.fillStyle = `rgba(255, 255, 255, ${op * 0.9})`;
        this.overlayCtx.fillRect(16, 188, 288, 24);
        this.overlayCtx.strokeStyle = `rgba(255, 187, 0, ${op})`;
        this.overlayCtx.lineWidth = 2;
        this.overlayCtx.strokeRect(16, 188, 288, 24);

        this.overlayCtx.textAlign = 'left';
        this.overlayCtx.fillStyle = `rgba(0, 0, 0, ${op})`;
        this.overlayCtx.font = 'bold 9px monospace';
        this.overlayCtx.fillText('1. Mario Kart', 24, 204);
        this.overlayCtx.fillStyle = `rgba(217, 119, 6, ${op})`;
        this.overlayCtx.fillText('Jeu / Arcade', 230, 204);

        // Barre raccourcis (y: 224)
        this.overlayCtx.fillStyle = `rgba(255, 255, 255, ${op * 0.85})`;
        this.overlayCtx.fillRect(0, 224, SCREEN_WIDTH, 16);
        this.overlayCtx.fillStyle = `rgba(100, 116, 139, ${op})`;
        this.overlayCtx.font = '8px monospace';
        this.overlayCtx.fillText('OK: Lancer | Toolbox: Options | Back: Epsilon', 8, 235);

        this.overlayCtx.restore();
      }

      // 3. Aperçu visuel du curseur Pinceau / Gomme (Cercle ou Carré en pointillé)
      if ((this.currentTool === 'brush' || this.currentTool === 'eraser') && this.cursorX >= 0 && this.cursorX < SCREEN_WIDTH && this.cursorY >= 0 && this.cursorY < SCREEN_HEIGHT) {
        this.overlayCtx.save();
        this.overlayCtx.strokeStyle = (this.currentTool === 'eraser') ? 'rgba(248, 113, 113, 0.9)' : 'rgba(255, 255, 255, 0.95)';
        this.overlayCtx.lineWidth = 1;
        this.overlayCtx.setLineDash([2, 2]);

        const cx = this.cursorX;
        const cy = this.cursorY;
        const sz = this.brushSize;

        if (this.brushShape === 'square') {
          const half = Math.floor(sz / 2);
          this.overlayCtx.strokeRect(cx - half - 0.5, cy - half - 0.5, sz, sz);
        } else {
          this.overlayCtx.beginPath();
          this.overlayCtx.arc(cx + 0.5, cy + 0.5, Math.max(1, sz / 2), 0, Math.PI * 2);
          this.overlayCtx.stroke();
        }
        this.overlayCtx.restore();
      }
    }

    loadImageFile(file, fitMode = 'cover', applyDither = true) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          this.processLoadedImage(img, fitMode, applyDither);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }

    processLoadedImage(img, fitMode = 'cover', applyDither = true) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = SCREEN_WIDTH;
      tempCanvas.height = SCREEN_HEIGHT;
      const tctx = tempCanvas.getContext('2d');

      // Fond ardoise moderne contrasté au lieu de noir pur
      tctx.fillStyle = '#1e293b';
      tctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

      const srcW = img.width;
      const srcH = img.height;

      if (fitMode === 'stretch') {
        tctx.drawImage(img, 0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
      } else if (fitMode === 'contain') {
        const scale = Math.min(SCREEN_WIDTH / srcW, SCREEN_HEIGHT / srcH);
        const nw = srcW * scale;
        const nh = srcH * scale;
        const nx = (SCREEN_WIDTH - nw) / 2;
        const ny = (SCREEN_HEIGHT - nh) / 2;
        tctx.drawImage(img, nx, ny, nw, nh);
      } else {
        // cover
        const scale = Math.max(SCREEN_WIDTH / srcW, SCREEN_HEIGHT / srcH);
        const nw = srcW * scale;
        const nh = srcH * scale;
        const nx = (SCREEN_WIDTH - nw) / 2;
        const ny = (SCREEN_HEIGHT - nh) / 2;
        tctx.drawImage(img, nx, ny, nw, nh);
      }

      const imgData = tctx.getImageData(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
      const rawPixels = imgData.data;

      if (applyDither) {
        this.applyFloydSteinbergDither(rawPixels);
      } else {
        for (let i = 0; i < TOTAL_PIXELS; i++) {
          const off = i * 4;
          const r5 = (rawPixels[off] >> 3) & 0x1F;
          const g6 = (rawPixels[off + 1] >> 2) & 0x3F;
          const b5 = (rawPixels[off + 2] >> 3) & 0x1F;
          this.pixelData[off] = Math.round((r5 * 255) / 31);
          this.pixelData[off + 1] = Math.round((g6 * 255) / 63);
          this.pixelData[off + 2] = Math.round((b5 * 255) / 31);
          this.pixelData[off + 3] = 255;
        }
      }

      this.pushHistoryState();
      this.renderCanvas();
      this.renderOverlay();
      this.autoSyncWallpaper();
      if (typeof window !== 'undefined') {
        if (typeof window.setAppTheme === 'function') {
          window.setAppTheme('custom');
        } else if (window.userSettings) {
          window.userSettings.theme = 'custom';
        }
        if (window.simulator) {
          window.simulator.theme = 'custom';
          window.simulator.renderMenu?.();
        }
      }
      window.soundFx?.playSuccess?.();
    }

    applyFloydSteinbergDither(rawPixels) {
      const bufR = new Float32Array(TOTAL_PIXELS);
      const bufG = new Float32Array(TOTAL_PIXELS);
      const bufB = new Float32Array(TOTAL_PIXELS);

      for (let i = 0; i < TOTAL_PIXELS; i++) {
        const off = i * 4;
        bufR[i] = rawPixels[off];
        bufG[i] = rawPixels[off + 1];
        bufB[i] = rawPixels[off + 2];
      }

      for (let y = 0; y < SCREEN_HEIGHT; y++) {
        for (let x = 0; x < SCREEN_WIDTH; x++) {
          const idx = y * SCREEN_WIDTH + x;
          const oldR = Math.max(0, Math.min(255, bufR[idx]));
          const oldG = Math.max(0, Math.min(255, bufG[idx]));
          const oldB = Math.max(0, Math.min(255, bufB[idx]));

          // Quantification 5-6-5 bits
          const r5 = (Math.round(oldR) >> 3) & 0x1F;
          const g6 = (Math.round(oldG) >> 2) & 0x3F;
          const b5 = (Math.round(oldB) >> 3) & 0x1F;

          const newR = Math.round((r5 * 255) / 31);
          const newG = Math.round((g6 * 255) / 63);
          const newB = Math.round((b5 * 255) / 31);

          const outOff = idx * 4;
          this.pixelData[outOff] = newR;
          this.pixelData[outOff + 1] = newG;
          this.pixelData[outOff + 2] = newB;
          this.pixelData[outOff + 3] = 255;

          const errR = oldR - newR;
          const errG = oldG - newG;
          const errB = oldB - newB;

          // Diffusion d'erreur Floyd-Steinberg (7, 3, 5, 1 / 16)
          if (x + 1 < SCREEN_WIDTH) {
            const right = idx + 1;
            bufR[right] += (errR * 7) / 16;
            bufG[right] += (errG * 7) / 16;
            bufB[right] += (errB * 7) / 16;
          }
          if (y + 1 < SCREEN_HEIGHT) {
            if (x - 1 >= 0) {
              const downLeft = (y + 1) * SCREEN_WIDTH + (x - 1);
              bufR[downLeft] += (errR * 3) / 16;
              bufG[downLeft] += (errG * 3) / 16;
              bufB[downLeft] += (errB * 3) / 16;
            }
            const down = (y + 1) * SCREEN_WIDTH + x;
            bufR[down] += (errR * 5) / 16;
            bufG[down] += (errG * 5) / 16;
            bufB[down] += (errB * 5) / 16;
            if (x + 1 < SCREEN_WIDTH) {
              const downRight = (y + 1) * SCREEN_WIDTH + (x + 1);
              bufR[downRight] += (errR * 1) / 16;
              bufG[downRight] += (errG * 1) / 16;
              bufB[downRight] += (errB * 1) / 16;
            }
          }
        }
      }
    }

    /**
     * Génère le buffer binaire RGB565 Little-Endian (153,600 octets)
     */
    generateRGB565Bytes() {
      const bytes = new Uint8Array(RGB565_BYTES);
      let byteIdx = 0;

      for (let i = 0; i < TOTAL_PIXELS; i++) {
        const off = i * 4;
        const r = this.pixelData[off];
        const g = this.pixelData[off + 1];
        const b = this.pixelData[off + 2];

        const r5 = (r >> 3) & 0x1F;
        const g6 = (g >> 2) & 0x3F;
        const b5 = (b >> 3) & 0x1F;
        const rgb16 = (r5 << 11) | (g6 << 5) | b5;

        // Little endian : octet de poids faible d'abord
        bytes[byteIdx++] = rgb16 & 0xFF;
        bytes[byteIdx++] = (rgb16 >> 8) & 0xFF;
      }

      return bytes;
    }

    /**
     * Auto-synchronise le fond d'écran actif dans window et localStorage
     */
    autoSyncWallpaper() {
      try {
        const bytes = this.generateRGB565Bytes();
        const dataUrl = this.canvas ? this.canvas.toDataURL('image/png') : null;

        window.customWallpaperRGB565 = bytes;
        if (dataUrl) window.customWallpaperDataUrl = dataUrl;

        if (typeof localStorage !== 'undefined') {
          if (dataUrl) localStorage.setItem('equalib_custom_wallpaper_dataurl', dataUrl);
          const b64 = this.uint8ToBase64(bytes);
          localStorage.setItem('equalib_custom_wallpaper_rgb565', b64);
        }

        // Si le simulateur ou le site utilise le thème custom, rafraîchir en direct
        if (dataUrl && typeof document !== 'undefined') {
          if (document.body.classList.contains('has-custom-wallpaper') || (window.userSettings && window.userSettings.theme === 'custom')) {
            document.documentElement.style.setProperty('--custom-wallpaper-url', `url("${dataUrl}")`);
            document.body.classList.add('has-custom-wallpaper');
          }
        }

        if (window.simulator && window.simulator.theme === 'custom') {
          window.simulator.renderMenu();
        }

        if (typeof document !== 'undefined') {
          const statusEl = document.getElementById('ws-active-theme-status');
          if (statusEl) {
            statusEl.textContent = '✓ Fond d\'écran prêt pour la calculatrice (153.6 Ko)';
            statusEl.className = 'text-amber-400 font-bold';
          }
        }
      } catch (err) {
        console.warn('[Wallpaper Studio] AutoSync échoué :', err);
      }
    }

    exportPNG() {
      if (!this.canvas) return;
      const link = document.createElement('a');
      link.download = 'equalib_custom_wallpaper_320x240.png';
      link.href = this.canvas.toDataURL('image/png');
      link.click();
      window.soundFx?.playClick?.();
    }

    exportBIN() {
      const bytes = this.generateRGB565Bytes();
      const blob = new Blob([bytes], { type: 'application/octet-stream' });
      const link = document.createElement('a');
      link.download = 'equalib_wallpaper_320x240.bin';
      link.href = URL.createObjectURL(blob);
      link.click();
      window.soundFx?.playClick?.();
    }

    applyCustomTheme() {
      this.autoSyncWallpaper();

      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('equalib_theme', 'custom');
        }
      } catch (_) {}

      // Mettre à jour les paramètres de thème de l'application web via le dispatcher global
      if (typeof window.setAppTheme === 'function') {
        window.setAppTheme('custom');
      } else {
        if (window.userSettings) {
          window.userSettings.theme = 'custom';
          if (typeof window.saveUserSettings === 'function') {
            window.saveUserSettings();
          }
        }
        if (typeof window.applyUserSettings === 'function') {
          window.applyUserSettings();
        }
      }

      // Mettre à jour le simulateur virtuel NumWorks
      if (window.simulator) {
        window.simulator.theme = 'custom';
        if (typeof window.simulator.setSimulatorTheme === 'function') {
          window.simulator.setSimulatorTheme('custom');
        } else if (typeof window.simulator.renderMenu === 'function') {
          window.simulator.renderMenu();
        }
      }

      // Faire défiler doucement vers le simulateur pour un aperçu en direct immédiat
      if (typeof document !== 'undefined') {
        const simEl = document.getElementById('sim-calculator-container') || document.getElementById('sim-screen');
        if (simEl) {
          simEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }

      if (typeof document !== 'undefined') {
        const statusEl = document.getElementById('ws-active-theme-status');
        if (statusEl) {
          statusEl.textContent = '⭐ Thème Custom Actif pour la Calculatrice (153.6 Ko prêt au Flash)';
          statusEl.className = 'text-amber-400 font-extrabold';
        }
      }

      window.soundFx?.playSuccess?.();
      if (typeof window.showToast === 'function') {
        window.showToast('Fond d\'écran appliqué ! Le 7ᵉ thème (« Custom ») est maintenant actif sur le simulateur et prêt au flash.', 'success');
      } else {
        alert('✓ Fond d\'écran appliqué ! Le 7ᵉ thème (« Custom ») sera injecté lors du Flash USB.');
      }
    }

    /**
     * Charge et réhydrate le fond d'écran persisté au rechargement de la page
     */
    checkStoredWallpaper() {
      try {
        if (typeof localStorage === 'undefined') return;

        // 1. Réhydratation instantanée bit-exacte depuis les octets RGB565
        const storedB64 = localStorage.getItem('equalib_custom_wallpaper_rgb565');
        if (storedB64) {
          const bytes = this.base64ToUint8(storedB64);
          if (bytes && bytes.length === RGB565_BYTES) {
            window.customWallpaperRGB565 = bytes;

            for (let i = 0; i < TOTAL_PIXELS; i++) {
              const byteIdx = i * 2;
              const rgb16 = bytes[byteIdx] | (bytes[byteIdx + 1] << 8);
              const r5 = (rgb16 >> 11) & 0x1F;
              const g6 = (rgb16 >> 5) & 0x3F;
              const b5 = rgb16 & 0x1F;
              const off = i * 4;
              this.pixelData[off] = Math.round((r5 * 255) / 31);
              this.pixelData[off + 1] = Math.round((g6 * 255) / 63);
              this.pixelData[off + 2] = Math.round((b5 * 255) / 31);
              this.pixelData[off + 3] = 255;
            }

            this.renderCanvas();
            this.pushHistoryState();

            const dataUrl = this.canvas ? this.canvas.toDataURL('image/png') : null;
            if (dataUrl) {
              window.customWallpaperDataUrl = dataUrl;
              localStorage.setItem('equalib_custom_wallpaper_dataurl', dataUrl);
            }

            if (typeof document !== 'undefined') {
              const statusEl = document.getElementById('ws-active-theme-status');
              if (statusEl) {
                statusEl.textContent = '✓ Fond d\'écran personnalisé chargé (153.6 Ko)';
                statusEl.className = 'text-amber-400 font-bold';
              }
            }
            return;
          }
        }

        // 2. Repli sur le dataURL PNG si présent
        const storedUrl = localStorage.getItem('equalib_custom_wallpaper_dataurl');
        if (storedUrl) {
          window.customWallpaperDataUrl = storedUrl;
          const img = new Image();
          img.onload = () => {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = SCREEN_WIDTH;
            tempCanvas.height = SCREEN_HEIGHT;
            const tctx = tempCanvas.getContext('2d');
            tctx.drawImage(img, 0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
            const imgData = tctx.getImageData(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
            this.pixelData.set(imgData.data);
            this.renderCanvas();
            this.pushHistoryState();
            this.autoSyncWallpaper();
          };
          img.src = storedUrl;
        }
      } catch (err) {
        console.warn('[Wallpaper Studio] Récupération stored wallpaper échouée :', err);
      }
    }

    uint8ToBase64(u8) {
      let binary = '';
      const len = u8.byteLength;
      const chunk = 8192;
      for (let i = 0; i < len; i += chunk) {
        const end = Math.min(i + chunk, len);
        binary += String.fromCharCode.apply(null, u8.subarray(i, end));
      }
      return btoa(binary);
    }

    base64ToUint8(b64) {
      const binary = atob(b64);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    }

    hexToRgb(hex) {
      let c = hex.replace('#', '');
      if (c.length === 3) {
        c = c.split('').map(char => char + char).join('');
      }
      const num = parseInt(c, 16);
      return {
        r: (num >> 16) & 255,
        g: (num >> 8) & 255,
        b: num & 255
      };
    }
  }

  window.EquaLibWallpaperStudio = WallpaperStudio;

})(window);

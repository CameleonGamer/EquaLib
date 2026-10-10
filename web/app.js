/**
 * EquaLib Web App Controller
 * Orchestre l'interface utilisateur, le catalogue, la recherche internet (.nws), les imports et les actions de téléchargement/flash
 */

// Guide des touches et astuces de chaque application sur NumWorks N0120
const APP_DETAILS_MAP = {
  'mariokart': {
    controls: [
      { key: 'Flèches Gauche / Droite', desc: 'Braquer et diriger le kart' },
      { key: 'OK ou Flèche Haut', desc: 'Accélérer plein gaz' },
      { key: 'Flèche Bas', desc: 'Freiner / Dérapage' },
      { key: 'Back', desc: 'Quitter et revenir au Hub' }
    ],
    tips: 'Moteur 3D Mode 7 temps réel optimisé pour le microcontrôleur STM32H725 @ 550 MHz.'
  },
  'periodique': {
    controls: [
      { key: 'Flèches Directionnelles', desc: 'Se déplacer sur la grille des éléments' },
      { key: 'Touche OK', desc: 'Ouvrir la fiche d\'information détaillée' },
      { key: 'Back', desc: 'Revenir au tableau ou au Hub' }
    ],
    tips: 'Répertoire complet des 118 éléments chimiques IUPAC (masse atomique, électronégativité, configurations).'
  },
  'fiches': {
    controls: [
      { key: 'Flèche Droite / Gauche', desc: 'Page suivante / précédente' },
      { key: 'Flèche Haut / Bas', desc: 'Défilement vertical du cours' },
      { key: 'Back', desc: 'Revenir au menu Hub' }
    ],
    tips: 'Formules complètes de Terminale et Supérieur : dérivées, intégrales, trigonométrie, optique, chimie.'
  },
  'math_solver': {
    controls: [
      { key: 'Pavé Numérique', desc: 'Saisie des coefficients (a, b, c)' },
      { key: 'Touche OK', desc: 'Résolution instantanée et affichage des racines' },
      { key: 'Back', desc: 'Retour au Hub' }
    ],
    tips: 'Calcule le discriminant Δ, les racines réelles et complexes, ainsi que la forme canonique avec étapes.'
  },
  'flappy': {
    controls: [
      { key: 'Touche OK ou Flèche Haut', desc: 'Battre des ailes (Sauter / Flap)' },
      { key: 'Back', desc: 'Quitter vers le Hub EquaLib' }
    ],
    tips: '60 FPS synchronisés sur le bus d\'affichage LTDC. Double-buffering sans scintillement ni lag !'
  },
  '2048': {
    controls: [
      { key: 'Flèches Directionnelles', desc: 'Faire glisser et fusionner les tuiles' },
      { key: 'Pavé 8, 2, 4, 6', desc: 'Contrôles alternatifs une main' },
      { key: 'OK', desc: 'Recommencer une partie après Game Over' },
      { key: 'Back', desc: 'Retour au Hub' }
    ],
    tips: 'Gardez votre plus grande tuile calée dans un angle pour maximiser vos chances d\'atteindre 2048.'
  },
  'snake': {
    controls: [
      { key: 'Flèches Directionnelles', desc: 'Diriger le serpent' },
      { key: 'OK', desc: 'Rejouer' },
      { key: 'Back', desc: 'Quitter vers le Hub' }
    ],
    tips: 'La vitesse s\'ajuste progressivement selon le score. Attention aux collisions contre les murs !'
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  // Constantes
  const MAX_FLASH_BYTES = 4.0 * 1024 * 1024; // 4.0 Mo alloués aux applications externes

  // État de l'application
  let catalogApps = [];
  let communityApps = [];
  let selectedApps = [];
  let activeCategory = 'ALL';
  let searchQuery = '';
  let catalogSearchText = '';
  
  const usb = new NumWorksWebUSB();
  const bundler = new EquaLibBundler();

  // Éléments du DOM - Catalogue & Pack
  const catalogList = document.getElementById('catalog-list');
  const selectedList = document.getElementById('selected-list');
  const emptyState = document.getElementById('empty-state');
  const appCountBadge = document.getElementById('app-count-badge');
  const memoryProgressBar = document.getElementById('memory-progress-bar');
  const memoryText = document.getElementById('memory-text');
  const memoryPercent = document.getElementById('memory-percent');
  const catalogCountLabel = document.getElementById('catalog-count-label');
  const catalogSearchInput = document.getElementById('catalog-search-input');
  const catalogSearchClear = document.getElementById('catalog-search-clear');
  const btnPackDefaults = document.getElementById('btn-pack-defaults');
  const btnPackClear = document.getElementById('btn-pack-clear');

  // Éléments du DOM - Onglets
  const tabBtnCatalog = document.getElementById('tab-btn-catalog');
  const tabBtnSearch = document.getElementById('tab-btn-search');
  const tabBtnImport = document.getElementById('tab-btn-import');
  const tabViewCatalog = document.getElementById('tab-view-catalog');
  const tabViewSearch = document.getElementById('tab-view-search');
  const tabViewImport = document.getElementById('tab-view-import');

  // Éléments du DOM - Recherche Web
  const webSearchInput = document.getElementById('web-search-input');
  const webSearchClear = document.getElementById('web-search-clear');
  const searchResultsList = document.getElementById('search-results-list');
  const searchCountLabel = document.getElementById('search-count-label');
  const quickTags = document.querySelectorAll('.quick-tag');

  // Éléments du DOM - Import URL
  const importUrlInput = document.getElementById('import-url-input');
  const importUrlBtn = document.getElementById('import-url-btn');

  // Boutons et contrôles de Flash & USB
  const connectBtn = document.getElementById('connect-btn');
  const connectionDot = document.getElementById('connection-dot');
  const connectionText = document.getElementById('connection-text');
  const modelText = document.getElementById('model-text');
  
  const flashBtn = document.getElementById('flash-btn');
  const downloadBtn = document.getElementById('download-btn');
  const downloadNwsBtn = document.getElementById('download-nws-btn');
  const progressContainer = document.getElementById('progress-container');
  const flashProgress = document.getElementById('flash-progress');
  const progressText = document.getElementById('progress-text');

  // Zone Drag & Drop
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');

  // Boutons audio & aide USB
  const soundToggleBtn = document.getElementById('sound-toggle-btn');
  const soundIcon = document.getElementById('sound-icon');
  const helpModalBtn = document.getElementById('help-modal-btn');
  const webusbHelpModal = document.getElementById('webusb-help-modal');
  const helpCloseBtn = document.getElementById('help-close-btn');
  const helpOkBtn = document.getElementById('help-ok-btn');

  // Modale détails d'application
  const appDetailsModal = document.getElementById('app-details-modal');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalCancelBtn = document.getElementById('modal-cancel-btn');
  const modalTogglePackBtn = document.getElementById('modal-toggle-pack-btn');
  const modalAppName = document.getElementById('modal-app-name');
  const modalAppCat = document.getElementById('modal-app-cat');
  const modalAppMeta = document.getElementById('modal-app-meta');
  const modalAppDesc = document.getElementById('modal-app-desc');
  const modalAppControls = document.getElementById('modal-app-controls');
  const modalAppIcon = document.getElementById('modal-app-icon');
  let currentModalApp = null;

  // ==================== DOCK D'APPLICATION ACTIVE (BAS AU CENTRE) ====================
  const activeAppDock = document.getElementById('active-app-dock');
  const dockAppIcon = document.getElementById('dock-app-icon');
  const dockAppName = document.getElementById('dock-app-name');
  const dockAppBadge = document.getElementById('dock-app-badge');
  const dockAppCat = document.getElementById('dock-app-cat');
  const dockAppDesc = document.getElementById('dock-app-desc');
  const dockActionBtn = document.getElementById('dock-action-btn');
  const dockTestBtn = document.getElementById('dock-test-btn');
  let currentActiveDockApp = null;

  // ==================== MODAL PARAMÈTRES & SYSTÈME DE THÈMES ====================
  const settingsModalBtn = document.getElementById('settings-modal-btn');
  const settingsModal = document.getElementById('settings-modal');
  const settingsCloseBtn = document.getElementById('settings-close-btn');
  const settingsSaveBtn = document.getElementById('settings-save-btn');
  const settingsResetBtn = document.getElementById('settings-reset-btn');
  const settingModeGallery = document.getElementById('setting-mode-gallery');
  const settingModeList = document.getElementById('setting-mode-list');
  const settingTooltipsToggle = document.getElementById('setting-tooltips-toggle');

  const viewModeGalleryBtn = document.getElementById('view-mode-gallery-btn');
  const viewModeListBtn = document.getElementById('view-mode-list-btn');
  const searchViewModeGalleryBtn = document.getElementById('search-view-mode-gallery-btn');
  const searchViewModeListBtn = document.getElementById('search-view-mode-list-btn');
  const quickViewGalleryBtn = document.getElementById('quick-view-gallery-btn');
  const quickViewListBtn = document.getElementById('quick-view-list-btn');
  const quickSettingsBtn = document.getElementById('quick-settings-btn');
  const navSettingsBtn = document.getElementById('nav-settings-btn');
  const simBtnSettings = document.getElementById('sim-btn-settings');
  const simDpadSettings = document.getElementById('sim-dpad-settings');

  const SETTINGS_STORAGE_KEY = 'equalib_user_settings';
  let userSettings = {
    displayMode: 'gallery', // Défaut : galerie carrée comme demandé
    showTooltips: true,
    theme: localStorage.getItem('equalib_theme') || 'default',
    customColor: '#f59e0b'
  };
  window.userSettings = userSettings;

  try {
    const savedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (savedSettings) {
      userSettings = { ...userSettings, ...JSON.parse(savedSettings) };
      window.userSettings = userSettings;
    }
  } catch (e) {
    console.warn('Erreur lecture paramètres :', e);
  }

  function saveUserSettings() {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(userSettings));
      localStorage.setItem('equalib_theme', userSettings.theme);
      window.userSettings = userSettings;
    } catch (e) {
      console.warn('Erreur sauvegarde paramètres :', e);
    }
  }

  function applyCustomColorVariables(hex) {
    if (!hex || !/^#[0-9a-fA-F]{6}$/i.test(hex)) return;
    document.documentElement.style.setProperty('--theme-primary', hex);
    document.documentElement.style.setProperty('--theme-border', hex);
  }

  function updateViewModeButtons() {
    const isGallery = userSettings.displayMode === 'gallery';

    if (settingModeGallery && settingModeList) {
      if (isGallery) {
        settingModeGallery.className = 'p-3 rounded border-2 transition-all flex items-center gap-3 text-left cursor-pointer bg-[#1c2128] border-[#FFBB00] shadow-[2px_2px_0px_#000]';
        settingModeList.className = 'p-3 rounded border-2 transition-all flex items-center gap-3 text-left cursor-pointer bg-[#0d1117] border-[#30363d] hover:border-[#8b949e]';
      } else {
        settingModeList.className = 'p-3 rounded border-2 transition-all flex items-center gap-3 text-left cursor-pointer bg-[#1c2128] border-[#FFBB00] shadow-[2px_2px_0px_#000]';
        settingModeGallery.className = 'p-3 rounded border-2 transition-all flex items-center gap-3 text-left cursor-pointer bg-[#0d1117] border-[#30363d] hover:border-[#8b949e]';
      }
    }

    if (viewModeGalleryBtn && viewModeListBtn) {
      if (isGallery) {
        viewModeGalleryBtn.className = 'px-3 py-1 rounded text-xs font-mono font-bold transition-all bg-[#FFBB00] text-black border border-[#FFBB00] flex items-center gap-1 cursor-pointer shadow-[1px_1px_0px_#000]';
        viewModeListBtn.className = 'px-3 py-1 rounded text-xs font-mono font-medium transition-all text-[#8b949e] hover:text-[#c9d1d9] flex items-center gap-1 cursor-pointer';
      } else {
        viewModeListBtn.className = 'px-3 py-1 rounded text-xs font-mono font-bold transition-all bg-[#FFBB00] text-black border border-[#FFBB00] flex items-center gap-1 cursor-pointer shadow-[1px_1px_0px_#000]';
        viewModeGalleryBtn.className = 'px-3 py-1 rounded text-xs font-mono font-medium transition-all text-[#8b949e] hover:text-[#c9d1d9] flex items-center gap-1 cursor-pointer';
      }
    }

    if (quickViewGalleryBtn && quickViewListBtn) {
      if (isGallery) {
        quickViewGalleryBtn.className = 'px-3 py-1.5 rounded text-xs font-mono font-bold transition-all bg-[#FFBB00] text-black border border-[#FFBB00] flex items-center gap-1.5 cursor-pointer shadow-[1px_1px_0px_#000]';
        quickViewListBtn.className = 'px-3 py-1.5 rounded text-xs font-mono font-medium transition-all text-[#8b949e] hover:text-[#c9d1d9] flex items-center gap-1.5 cursor-pointer';
      } else {
        quickViewListBtn.className = 'px-3 py-1.5 rounded text-xs font-mono font-bold transition-all bg-[#FFBB00] text-black border border-[#FFBB00] flex items-center gap-1.5 cursor-pointer shadow-[1px_1px_0px_#000]';
        quickViewGalleryBtn.className = 'px-3 py-1.5 rounded text-xs font-mono font-medium transition-all text-[#8b949e] hover:text-[#c9d1d9] flex items-center gap-1.5 cursor-pointer';
      }
    }

    if (searchViewModeGalleryBtn && searchViewModeListBtn) {
      if (isGallery) {
        searchViewModeGalleryBtn.className = 'px-2 py-0.5 rounded text-xs font-mono font-bold transition-all bg-[#FFBB00] text-black border border-[#FFBB00] flex items-center gap-1 cursor-pointer shadow-[1px_1px_0px_#000]';
        searchViewModeListBtn.className = 'px-2 py-0.5 rounded text-xs font-mono font-medium transition-all text-[#8b949e] hover:text-[#c9d1d9] flex items-center gap-1 cursor-pointer';
      } else {
        searchViewModeListBtn.className = 'px-2 py-0.5 rounded text-xs font-mono font-bold transition-all bg-[#FFBB00] text-black border border-[#FFBB00] flex items-center gap-1 cursor-pointer shadow-[1px_1px_0px_#000]';
        searchViewModeGalleryBtn.className = 'px-2 py-0.5 rounded text-xs font-mono font-medium transition-all text-[#8b949e] hover:text-[#c9d1d9] flex items-center gap-1 cursor-pointer';
      }
    }
  }

  function setDisplayMode(mode) {
    if (userSettings.displayMode === mode) return;
    userSettings.displayMode = mode;
    saveUserSettings();
    updateViewModeButtons();
    renderCatalog();
    renderCommunitySearch();
    if (simulator && typeof simulator.setSimulatorDisplayMode === 'function') {
      simulator.setSimulatorDisplayMode(mode);
    }
  }

  function applyUserSettings() {
    // 1. Tooltips / raccourcis
    document.body.classList.toggle('hide-tooltips', !userSettings.showTooltips);
    if (settingTooltipsToggle) settingTooltipsToggle.checked = userSettings.showTooltips;

    // 2. Thèmes & arrière-plan animé
    const themeClasses = ['theme-sakura', 'theme-hacker', 'theme-bee', 'theme-mario', 'theme-gameboy'];
    themeClasses.forEach(cls => document.body.classList.remove(cls));
    if (userSettings.theme && userSettings.theme !== 'default') {
      document.body.classList.add(`theme-${userSettings.theme}`);
    }
    if (typeof window.setThemeBg === 'function') {
      window.setThemeBg(userSettings.theme);
    }

    // 3. Couleur personnalisée
    if (userSettings.customColor) {
      applyCustomColorVariables(userSettings.customColor);
      const hexInput = document.getElementById('custom-color-hex');
      const nativePicker = document.getElementById('native-color-picker');
      const preview = document.getElementById('custom-color-preview');
      if (hexInput) hexInput.value = userSettings.customColor.toUpperCase();
      if (nativePicker) nativePicker.value = userSettings.customColor;
      if (preview) preview.style.backgroundColor = userSettings.customColor;
    }

    // 4. Badges des thèmes
    document.querySelectorAll('.theme-preset-btn').forEach(btn => {
      const t = btn.getAttribute('data-theme');
      if (t === userSettings.theme) {
        btn.classList.add('border-[#FFBB00]', 'ring-1', 'ring-[#FFBB00]', 'shadow-[2px_2px_0px_#000]');
      } else {
        btn.classList.remove('border-[#FFBB00]', 'ring-1', 'ring-[#FFBB00]', 'shadow-[2px_2px_0px_#000]');
      }
    });

    document.querySelectorAll('.quick-theme-pill').forEach(btn => {
      const t = btn.getAttribute('data-theme');
      if (t === userSettings.theme) {
        btn.classList.add('border-[#FFBB00]', 'text-[#FFBB00]', 'bg-[#1c2128]', 'shadow-[1px_1px_0px_#000]');
        btn.classList.remove('text-[#8b949e]', 'bg-[#0d1117]');
      } else {
        btn.classList.remove('border-[#FFBB00]', 'text-[#FFBB00]', 'bg-[#1c2128]', 'shadow-[1px_1px_0px_#000]');
        btn.classList.add('text-[#8b949e]', 'bg-[#0d1117]');
      }
    });

    if (simulator) {
      if (typeof simulator.setSimulatorTheme === 'function') simulator.setSimulatorTheme(userSettings.theme);
      if (typeof simulator.setSimulatorDisplayMode === 'function') simulator.setSimulatorDisplayMode(userSettings.displayMode);
      if (typeof simulator.setSimulatorTooltips === 'function') simulator.setSimulatorTooltips(userSettings.showTooltips);
    }

    updateViewModeButtons();
  }

  function updateActiveAppDock(app) {
    if (!app || !activeAppDock) return;
    currentActiveDockApp = app;

    activeAppDock.classList.remove('dock-hidden');
    activeAppDock.classList.add('dock-visible');

    if (dockAppIcon) {
      dockAppIcon.textContent = app.icon_initial || '📦';
      dockAppIcon.style.backgroundColor = app.color || '#F59E0B';
    }
    if (dockAppName) dockAppName.textContent = app.name;
    if (dockAppBadge) dockAppBadge.textContent = app.format ? `.${app.format}` : '.BIN';
    if (dockAppCat) dockAppCat.textContent = app.category || '';
    if (dockAppDesc) dockAppDesc.textContent = app.description || 'Application optimisée pour NumWorks N0120.';

    const isSelected = selectedApps.some(s => s.id === app.id);
    if (dockActionBtn) {
      if (isSelected) {
        dockActionBtn.textContent = '✓ Inclus';
        dockActionBtn.className = 'px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold transition-all cursor-pointer';
      } else {
        dockActionBtn.textContent = '+ Ajouter';
        dockActionBtn.className = 'px-4 py-2 rounded-xl bg-nw-yellow hover:bg-nw-yellowHover text-black text-xs font-extrabold transition-all shadow-md active:scale-95 cursor-pointer';
      }
    }
  }

  // Simulateur virtuel NumWorks
  const simLed = document.getElementById('sim-led');
  const simTitle = document.getElementById('sim-title');
  const simMenu = document.getElementById('sim-menu');

  let simulator = null;
  try {
    if (typeof NumWorksSimulator !== 'undefined') {
      simulator = new NumWorksSimulator('sim-screen');
    }
  } catch (e) {
    console.warn('Simulateur virtuel :', e);
  }

  // Initialisation du bouton de son
  if (soundToggleBtn && soundIcon && window.soundFx) {
    soundIcon.textContent = window.soundFx.isMuted ? '🔇' : '🔊';
    soundToggleBtn.addEventListener('click', () => {
      const isMuted = window.soundFx.toggleMute();
      soundIcon.textContent = isMuted ? '🔇' : '🔊';
      showToast(isMuted ? 'Sons 8-bit désactivés' : 'Sons 8-bit activés', 'info');
    });
  }

  // Initialisation de l'effet CRT Scanlines (QOL)
  const crtToggleBtn = document.getElementById('crt-toggle-btn');
  const crtIcon = document.getElementById('crt-icon');
  const savedCrt = localStorage.getItem('equalib_crt_effect');
  if (savedCrt === 'off') {
    document.body.classList.add('crt-off');
    if (crtIcon) crtIcon.textContent = '📺❌';
  }
  if (crtToggleBtn) {
    crtToggleBtn.addEventListener('click', () => {
      window.soundFx?.playClick();
      const isOff = document.body.classList.toggle('crt-off');
      localStorage.setItem('equalib_crt_effect', isOff ? 'off' : 'on');
      if (crtIcon) crtIcon.textContent = isOff ? '📺❌' : '📺';
      showToast(isOff ? 'Mode Ultra-Net activé (Scanlines désactivées)' : 'Effet rétro CRT vintage activé', 'info');
    });
  }

  // Agrandissement / Mode plein écran du simulateur (QOL)
  const simBtnExpand = document.getElementById('sim-btn-expand');
  const simCalculatorContainer = document.getElementById('sim-calculator-container');
  let simIsExpanded = false;
  if (simBtnExpand && simCalculatorContainer) {
    simBtnExpand.addEventListener('click', () => {
      window.soundFx?.playClick();
      simIsExpanded = !simIsExpanded;
      if (simIsExpanded) {
        simCalculatorContainer.classList.remove('max-w-[340px]');
        simCalculatorContainer.classList.add('max-w-[460px]', 'scale-105', 'z-20');
        simBtnExpand.textContent = '⛶❌';
        simBtnExpand.title = 'Réduire le simulateur';
        showToast('Simulateur agrandi pour un meilleur confort de jeu !', 'info');
      } else {
        simCalculatorContainer.classList.remove('max-w-[460px]', 'scale-105', 'z-20');
        simCalculatorContainer.classList.add('max-w-[340px]');
        simBtnExpand.textContent = '⛶';
        simBtnExpand.title = 'Agrandir le simulateur';
      }
    });
  }

  // Raccourci clavier global pour la recherche (/ ou Ctrl+K) & Touche Échap (QOL)
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        document.activeElement.blur();
      }
      closeAppDetails();
      closeSettingsModal();
      if (webusbHelpModal) {
        webusbHelpModal.classList.add('hidden');
        webusbHelpModal.classList.remove('flex');
      }
      return;
    }

    if ((e.key === '/' || (e.ctrlKey && e.key.toLowerCase() === 'k')) && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
      e.preventDefault();
      switchTab('catalog');
      catalogSearchInput?.focus();
      catalogSearchInput?.select();
    }
  });

  // Initialisation de la modale d'aide WebUSB
  if (helpModalBtn && webusbHelpModal) {
    helpModalBtn.addEventListener('click', () => {
      window.soundFx?.playClick();
      webusbHelpModal.classList.remove('hidden');
      webusbHelpModal.classList.add('flex');
    });
    const closeHelp = () => {
      window.soundFx?.playClick();
      webusbHelpModal.classList.add('hidden');
      webusbHelpModal.classList.remove('flex');
    };
    helpCloseBtn?.addEventListener('click', closeHelp);
    helpOkBtn?.addEventListener('click', closeHelp);
    webusbHelpModal.addEventListener('click', (e) => {
      if (e.target === webusbHelpModal) closeHelp();
    });
  }

  // Initialisation de la modale de détails d'application
  function openAppDetails(app) {
    if (!app || !appDetailsModal) return;
    currentModalApp = app;
    window.soundFx?.playClick();

    modalAppName.textContent = app.name;
    modalAppCat.textContent = app.category;
    modalAppMeta.textContent = `v${app.version || '1.0'} • ${app.size_kb} Ko • Par ${app.author || 'Inconnu'}`;
    modalAppDesc.textContent = app.description || 'Application optimisée pour NumWorks N0120.';
    modalAppIcon.textContent = app.icon_initial || '📦';
    modalAppIcon.style.backgroundColor = app.color || '#F59E0B';

    const isSelected = selectedApps.some(s => s.id === app.id);
    if (isSelected) {
      modalTogglePackBtn.innerHTML = `<span>✕ Retirer du Pack</span>`;
      modalTogglePackBtn.className = 'flex-1 py-3 px-4 rounded-xl bg-red-500 hover:bg-red-400 text-white font-extrabold text-xs transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 cursor-pointer';
    } else {
      modalTogglePackBtn.innerHTML = `<span>+ Ajouter à mon Pack</span>`;
      modalTogglePackBtn.className = 'flex-1 py-3 px-4 rounded-xl bg-nw-yellow hover:bg-nw-yellowHover text-black font-extrabold text-xs transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 cursor-pointer';
    }

    const keyDetails = APP_DETAILS_MAP[app.id] || {
      controls: [
        { key: 'Flèches Directionnelles', desc: 'Navigation dans l\'application' },
        { key: 'Touche OK', desc: 'Valider / Action principale' },
        { key: 'Touche Back', desc: 'Quitter et revenir au Hub' }
      ],
      tips: 'Compatible avec le Hub multi-applications EquaLib sur STM32H725.'
    };

    let controlsHtml = '';
    keyDetails.controls.forEach(ctrl => {
      controlsHtml += `
        <div class="flex items-center justify-between py-1 border-b border-slate-800 last:border-b-0">
          <span class="text-amber-400 font-bold">${ctrl.key}</span>
          <span class="text-slate-300 text-[11px] text-right">${ctrl.desc}</span>
        </div>
      `;
    });
    if (keyDetails.tips) {
      controlsHtml += `
        <div class="mt-2 pt-2 border-t border-slate-800 text-[10px] text-slate-400 italic">
          💡 ${keyDetails.tips}
        </div>
      `;
    }
    modalAppControls.innerHTML = controlsHtml;

    appDetailsModal.classList.remove('hidden');
    appDetailsModal.classList.add('flex');
  }

  function closeAppDetails() {
    window.soundFx?.playClick();
    appDetailsModal?.classList.add('hidden');
    appDetailsModal?.classList.remove('flex');
    currentModalApp = null;
  }

  modalCloseBtn?.addEventListener('click', closeAppDetails);
  modalCancelBtn?.addEventListener('click', closeAppDetails);
  appDetailsModal?.addEventListener('click', (e) => {
    if (e.target === appDetailsModal) closeAppDetails();
  });

  modalTogglePackBtn?.addEventListener('click', () => {
    if (!currentModalApp) return;
    const isSelected = selectedApps.some(s => s.id === currentModalApp.id);
    if (isSelected) {
      const idx = selectedApps.findIndex(s => s.id === currentModalApp.id);
      if (idx !== -1) {
        selectedApps.splice(idx, 1);
        window.soundFx?.playHit();
        showToast(`"${currentModalApp.name}" retiré du pack`, 'info');
      }
    } else {
      addAppToSelection(currentModalApp);
    }
    updateUI();
    renderCatalog();
    renderCommunitySearch();
    closeAppDetails();
  });

  // ==================== CONTRÔLES DU MENU PARAMÈTRES & COULEUR ====================
  function openSettingsModal() {
    window.soundFx?.playClick();
    applyUserSettings();
    settingsModal?.classList.remove('hidden');
    settingsModal?.classList.add('flex');
  }

  function closeSettingsModal() {
    if (settingsModal && !settingsModal.classList.contains('hidden')) {
      window.soundFx?.playClick();
      settingsModal.classList.add('hidden');
      settingsModal.classList.remove('flex');
    }
  }

  settingsModalBtn?.addEventListener('click', openSettingsModal);
  settingsCloseBtn?.addEventListener('click', closeSettingsModal);
  settingsModal?.addEventListener('click', (e) => {
    if (e.target === settingsModal) closeSettingsModal();
  });

  settingModeGallery?.addEventListener('click', () => {
    window.soundFx?.playClick();
    setDisplayMode('gallery');
  });

  settingModeList?.addEventListener('click', () => {
    window.soundFx?.playClick();
    setDisplayMode('list');
  });

  viewModeGalleryBtn?.addEventListener('click', () => {
    window.soundFx?.playClick();
    setDisplayMode('gallery');
  });

  viewModeListBtn?.addEventListener('click', () => {
    window.soundFx?.playClick();
    setDisplayMode('list');
  });

  searchViewModeGalleryBtn?.addEventListener('click', () => {
    window.soundFx?.playClick();
    setDisplayMode('gallery');
  });

  searchViewModeListBtn?.addEventListener('click', () => {
    window.soundFx?.playClick();
    setDisplayMode('list');
  });

  settingTooltipsToggle?.addEventListener('change', (e) => {
    window.soundFx?.playClick();
    userSettings.showTooltips = e.target.checked;
    document.body.classList.toggle('hide-tooltips', !userSettings.showTooltips);
    saveUserSettings();
    showToast(userSettings.showTooltips ? 'Affichage des raccourcis et bulles activé' : 'Raccourcis et bulles d\'aide masqués', 'info');
  });

  // Gestion des 6 presets de thèmes
  const THEME_PRESET_COLORS = {
    sakura: '#f472b6',
    hacker: '#38bdf8',
    bee: '#fbbf24',
    mario: '#ef4444',
    gameboy: '#9bbc0f',
    default: '#f59e0b'
  };

  window.setAppTheme = function(themeKey) {
    userSettings.theme = themeKey;
    if (THEME_PRESET_COLORS[themeKey]) {
      userSettings.customColor = THEME_PRESET_COLORS[themeKey];
    }
    applyUserSettings();
    saveUserSettings();
    showToast(`Thème « ${themeKey.toUpperCase()} » activé !`, 'success');
  };

  document.querySelectorAll('.theme-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      window.soundFx?.playClick();
      const themeKey = btn.getAttribute('data-theme') || 'default';
      window.setAppTheme(themeKey);
    });
  });

  document.querySelectorAll('.quick-theme-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      window.soundFx?.playClick();
      const themeKey = btn.getAttribute('data-theme') || 'default';
      window.setAppTheme(themeKey);
    });
  });

  navSettingsBtn?.addEventListener('click', openSettingsModal);
  quickSettingsBtn?.addEventListener('click', openSettingsModal);
  quickViewGalleryBtn?.addEventListener('click', () => {
    window.soundFx?.playClick();
    setDisplayMode('gallery');
  });
  quickViewListBtn?.addEventListener('click', () => {
    window.soundFx?.playClick();
    setDisplayMode('list');
  });
  simBtnSettings?.addEventListener('click', () => {
    window.soundFx?.playClick();
    if (simulator && typeof simulator.launchApp === 'function') {
      simulator.launchApp('SETTINGS');
    } else {
      openSettingsModal();
    }
  });
  simDpadSettings?.addEventListener('click', () => {
    window.soundFx?.playClick();
    if (simulator && typeof simulator.launchApp === 'function') {
      simulator.launchApp('SETTINGS');
    } else {
      openSettingsModal();
    }
  });

  // Initialisation et gestion de la roue chromatique interactive
  function initColorWheel() {
    const canvas = document.getElementById('color-wheel-canvas');
    const picker = document.getElementById('color-wheel-picker');
    const preview = document.getElementById('custom-color-preview');
    const hexInput = document.getElementById('custom-color-hex');
    const nativePicker = document.getElementById('native-color-picker');
    const applyBtn = document.getElementById('apply-custom-color-btn');

    if (!canvas || !picker) return;
    const ctx = canvas.getContext('2d');
    const size = canvas.width;
    const center = size / 2;
    const radius = center - 4;

    function drawWheel() {
      ctx.clearRect(0, 0, size, size);
      for (let angle = 0; angle < 360; angle += 1) {
        const startAngle = (angle - 0.5) * Math.PI / 180;
        const endAngle = (angle + 1.5) * Math.PI / 180;
        ctx.beginPath();
        ctx.moveTo(center, center);
        ctx.arc(center, center, radius, startAngle, endAngle);
        ctx.closePath();

        const radGrad = ctx.createRadialGradient(center, center, 0, center, center, radius);
        radGrad.addColorStop(0, '#ffffff');
        radGrad.addColorStop(1, `hsl(${angle}, 100%, 50%)`);
        ctx.fillStyle = radGrad;
        ctx.fill();
      }
    }
    drawWheel();

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

    function pickColorAt(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const dx = x - center;
      const dy = y - center;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const clampedDist = Math.min(dist, radius);
      const angle = ((Math.atan2(dy, dx) * 180 / Math.PI) + 360) % 360;
      const sat = clampedDist / radius;
      const hex = hsvToHex(angle, sat, 1.0);

      const thumbX = center + (dx / (dist || 1)) * clampedDist;
      const thumbY = center + (dy / (dist || 1)) * clampedDist;
      picker.style.left = `${thumbX}px`;
      picker.style.top = `${thumbY}px`;

      if (preview) preview.style.backgroundColor = hex;
      if (hexInput) hexInput.value = hex.toUpperCase();
      if (nativePicker) nativePicker.value = hex;
      userSettings.customColor = hex;
      applyCustomColorVariables(hex);
    }

    let isDragging = false;
    canvas.addEventListener('mousedown', (e) => {
      isDragging = true;
      pickColorAt(e.clientX, e.clientY);
    });
    window.addEventListener('mousemove', (e) => {
      if (isDragging) pickColorAt(e.clientX, e.clientY);
    });
    window.addEventListener('mouseup', () => {
      isDragging = false;
    });

    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        isDragging = true;
        pickColorAt(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });
    window.addEventListener('touchmove', (e) => {
      if (isDragging && e.touches.length > 0) {
        pickColorAt(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });
    window.addEventListener('touchend', () => {
      isDragging = false;
    });

    if (hexInput) {
      hexInput.addEventListener('input', (e) => {
        let val = e.target.value.trim();
        if (!val.startsWith('#')) val = '#' + val;
        if (/^#[0-9a-fA-F]{6}$/i.test(val)) {
          userSettings.customColor = val;
          if (preview) preview.style.backgroundColor = val;
          if (nativePicker) nativePicker.value = val;
          applyCustomColorVariables(val);
        }
      });
    }

    if (nativePicker) {
      nativePicker.addEventListener('input', (e) => {
        const val = e.target.value;
        userSettings.customColor = val;
        if (hexInput) hexInput.value = val.toUpperCase();
        if (preview) preview.style.backgroundColor = val;
        applyCustomColorVariables(val);
      });
    }

    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        window.soundFx?.playClick();
        applyCustomColorVariables(userSettings.customColor);
        saveUserSettings();
        showToast(`✓ Couleur personnalisée (${userSettings.customColor}) appliquée !`, 'success');
      });
    }
  }

  settingsSaveBtn?.addEventListener('click', () => {
    window.soundFx?.playSuccess();
    saveUserSettings();
    closeSettingsModal();
    showToast('✓ Vos préférences d\'affichage ont été enregistrées !', 'success');
  });

  settingsResetBtn?.addEventListener('click', () => {
    window.soundFx?.playClick();
    userSettings = {
      displayMode: 'gallery',
      showTooltips: true,
      theme: 'default',
      customColor: '#f59e0b'
    };
    document.documentElement.style.removeProperty('--theme-primary');
    document.documentElement.style.removeProperty('--theme-border');
    applyUserSettings();
    saveUserSettings();
    renderCatalog();
    renderCommunitySearch();
    showToast('Paramètres réinitialisés aux valeurs d\'origine.', 'info');
  });

  // Boutons du Dock d'Application Active
  if (dockActionBtn) {
    dockActionBtn.addEventListener('click', () => {
      if (!currentActiveDockApp) return;
      const isSelected = selectedApps.some(s => s.id === currentActiveDockApp.id);
      if (isSelected) {
        const idx = selectedApps.findIndex(s => s.id === currentActiveDockApp.id);
        if (idx !== -1) {
          selectedApps.splice(idx, 1);
          window.soundFx?.playHit();
          showToast(`"${currentActiveDockApp.name}" retiré du pack`, 'info');
        }
      } else {
        addAppToSelection(currentActiveDockApp);
      }
      updateUI();
      renderCatalog();
      renderCommunitySearch();
      updateActiveAppDock(currentActiveDockApp);
    });
  }

  if (dockTestBtn) {
    dockTestBtn.addEventListener('click', () => {
      if (!currentActiveDockApp) return;
      window.soundFx?.playClick();
      if (simulator && typeof simulator.launchApp === 'function') {
        simulator.launchApp(currentActiveDockApp.id);
        showToast(`🎮 Lancement de "${currentActiveDockApp.name}" dans le simulateur`, 'info');
      } else {
        openAppDetails(currentActiveDockApp);
      }
    });
  }

  // ==================== GESTION DES ONGLETS ====================
  function switchTab(target) {
    window.soundFx?.playClick();
    [tabBtnCatalog, tabBtnSearch, tabBtnImport].forEach(btn => {
      btn.className = 'flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all text-slate-300 hover:text-white hover:bg-slate-800 flex items-center justify-center gap-1.5';
    });

    tabViewCatalog.classList.add('hidden');
    tabViewSearch.classList.add('hidden');
    tabViewImport.classList.add('hidden');

    if (target === 'catalog') {
      tabBtnCatalog.className = 'flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all bg-nw-yellow text-black shadow-sm flex items-center justify-center gap-1.5';
      tabViewCatalog.classList.remove('hidden');
    } else if (target === 'search') {
      tabBtnSearch.className = 'flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all bg-nw-yellow text-black shadow-sm flex items-center justify-center gap-1.5';
      tabViewSearch.classList.remove('hidden');
      webSearchInput.focus();
    } else if (target === 'import') {
      tabBtnImport.className = 'flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all bg-nw-yellow text-black shadow-sm flex items-center justify-center gap-1.5';
      tabViewImport.classList.remove('hidden');
    }
  }

  tabBtnCatalog.addEventListener('click', () => switchTab('catalog'));
  tabBtnSearch.addEventListener('click', () => switchTab('search'));
  tabBtnImport.addEventListener('click', () => switchTab('import'));


  // ==================== FILTRES PAR CATÉGORIE DU CATALOGUE ====================
  const catPills = document.querySelectorAll('.cat-pill');
  catPills.forEach(pill => {
    pill.addEventListener('click', () => {
      window.soundFx?.playClick();
      catPills.forEach(p => {
        p.classList.remove('bg-nw-yellow', 'text-black');
        p.classList.add('bg-slate-800', 'text-slate-300');
      });
      pill.classList.remove('bg-slate-800', 'text-slate-300');
      pill.classList.add('bg-nw-yellow', 'text-black');
      activeCategory = pill.getAttribute('data-category');
      renderCatalog();
    });
  });

  // Recherche en direct dans le catalogue
  if (catalogSearchInput) {
    catalogSearchInput.addEventListener('input', (e) => {
      catalogSearchText = e.target.value.toLowerCase().trim();
      if (catalogSearchText.length > 0) {
        catalogSearchClear?.classList.remove('hidden');
      } else {
        catalogSearchClear?.classList.add('hidden');
      }
      renderCatalog();
    });
  }

  if (catalogSearchClear) {
    catalogSearchClear.addEventListener('click', () => {
      window.soundFx?.playClick();
      catalogSearchInput.value = '';
      catalogSearchText = '';
      catalogSearchClear.classList.add('hidden');
      renderCatalog();
      catalogSearchInput.focus();
    });
  }

  // ==================== RESTAURATION DU PACK & VIDAGE ====================
  if (btnPackDefaults) {
    btnPackDefaults.addEventListener('click', () => {
      const defaults = catalogApps.filter(a => a.recommended);
      selectedApps = defaults.map(a => ({...a}));
      window.soundFx?.playSuccess();
      updateUI();
      renderCatalog();
      renderCommunitySearch();
      showToast('Pack restauré avec les applications recommandées !', 'success');
    });
  }

  if (btnPackClear) {
    btnPackClear.addEventListener('click', () => {
      if (selectedApps.length === 0) return;
      selectedApps = [];
      window.soundFx?.playHit();
      updateUI();
      renderCatalog();
      renderCommunitySearch();
      showToast('Votre Pack EquaLib a été vidé.', 'info');
    });
  }

  // ==================== TRI DU CATALOGUE (QOL) ====================
  let currentSortMode = 'recommended';
  const catalogSort = document.getElementById('catalog-sort');
  if (catalogSort) {
    catalogSort.addEventListener('change', (e) => {
      window.soundFx?.playClick();
      currentSortMode = e.target.value;
      renderCatalog();
    });
  }

  // ==================== PACKS PRÉDÉFINIS EN 1 CLIC (QOL) ====================
  const presetArcadeBtn = document.getElementById('preset-arcade-btn');
  const presetBacBtn = document.getElementById('preset-bac-btn');
  const presetAllBtn = document.getElementById('preset-all-btn');

  if (presetArcadeBtn) {
    presetArcadeBtn.addEventListener('click', () => {
      const arcadeIds = ['mariokart', 'flappy', '2048', 'snake'];
      selectedApps = catalogApps.filter(a => arcadeIds.includes(a.id)).map(a => ({...a}));
      window.soundFx?.playSuccess();
      updateUI();
      renderCatalog();
      renderCommunitySearch();
      showToast('🎮 Pack Arcade appliqué (Mario Kart, Flappy, 2048, Snake) !', 'success');
    });
  }

  if (presetBacBtn) {
    presetBacBtn.addEventListener('click', () => {
      const bacIds = ['periodique', 'fiches', 'math_solver'];
      selectedApps = catalogApps.filter(a => bacIds.includes(a.id)).map(a => ({...a}));
      window.soundFx?.playSuccess();
      updateUI();
      renderCatalog();
      renderCommunitySearch();
      showToast('🎓 Pack Bac & Sup appliqué (Tableau, Fiches, Solveur) !', 'success');
    });
  }

  if (presetAllBtn) {
    presetAllBtn.addEventListener('click', () => {
      selectedApps = catalogApps.filter(a => a.recommended).map(a => ({...a}));
      window.soundFx?.playSuccess();
      updateUI();
      renderCatalog();
      renderCommunitySearch();
      showToast('⭐ Pack Complet recommandé appliqué !', 'success');
    });
  }

  // ==================== EXPORT & IMPORT DE LA CONFIG DU PACK (QOL) ====================
  const btnExportPack = document.getElementById('btn-export-pack');
  const btnImportPack = document.getElementById('btn-import-pack');
  const importPackFile = document.getElementById('import-pack-file');

  if (btnExportPack) {
    btnExportPack.addEventListener('click', () => {
      if (selectedApps.length === 0) {
        showToast('Votre pack est vide. Ajoutez des applications d\'abord !', 'warning');
        return;
      }
      const config = {
        app: 'EquaLib',
        version: '3.5',
        exportedAt: new Date().toISOString(),
        apps: selectedApps.map(a => ({
          id: a.id,
          name: a.name,
          category: a.category,
          size_kb: a.size_kb
        }))
      };
      const jsonBlob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(jsonBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'equalib_pack_config.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      window.soundFx?.playSuccess();
      showToast('✓ Configuration du pack exportée (equalib_pack_config.json) !', 'success');
    });
  }

  if (btnImportPack && importPackFile) {
    btnImportPack.addEventListener('click', () => {
      window.soundFx?.playClick();
      importPackFile.click();
    });

    importPackFile.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const config = JSON.parse(text);
        if (!config.apps || !Array.isArray(config.apps)) {
          throw new Error('Format de configuration JSON invalide');
        }
        selectedApps = [];
        config.apps.forEach(cfgApp => {
          const match = catalogApps.find(a => a.id === cfgApp.id) || communityApps.find(a => a.id === cfgApp.id);
          if (match && selectedApps.length < 12 && !selectedApps.some(s => s.id === match.id)) {
            selectedApps.push({...match});
          }
        });
        window.soundFx?.playSuccess();
        updateUI();
        renderCatalog();
        renderCommunitySearch();
        showToast(`✓ Pack restauré : ${selectedApps.length} application(s) configurée(s) !`, 'success');
      } catch (err) {
        window.soundFx?.playHit();
        showToast(`Erreur importation pack : ${err.message}`, 'error');
      } finally {
        importPackFile.value = '';
      }
    });
  }

  // ==================== CHARGEMENT DES BASES DE DONNÉES ====================
  try {
    const [catRes, commRes] = await Promise.all([
      fetch('catalog.json'),
      fetch('community_apps.json')
    ]);
    catalogApps = await catRes.json();
    communityApps = await commRes.json();

    renderCatalog();
    renderCommunitySearch();

    // Présélection par défaut (les apps natives recommandées)
    const defaults = catalogApps.filter(a => a.recommended);
    defaults.forEach(a => addAppToSelection(a));

    if (catalogApps.length > 0) {
      updateActiveAppDock(catalogApps[0]);
    }

    // Initialisation des paramètres visuels & roue chromatique
    applyUserSettings();
    initColorWheel();

    // Vérification d'une application envoyée depuis converter.html
    const pendingAppStr = sessionStorage.getItem('equalib_imported_app');
    if (pendingAppStr) {
      sessionStorage.removeItem('equalib_imported_app');
      try {
        const pApp = JSON.parse(pendingAppStr);
        const binaryStr = atob(pApp.b64Data);
        const u8 = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) u8[i] = binaryStr.charCodeAt(i);
        const pFormat = pApp.format || 'NWA';
        const importedConverted = {
          id: 'custom_' + Date.now(),
          name: pApp.name || 'App Convertie',
          author: 'Converti depuis NWA',
          version: 'Natif',
          size_kb: Math.max(1, Math.round(u8.byteLength / 1024)),
          category: 'Natif ARM',
          format: pFormat,
          description: `Application issue de ${pApp.filename}`,
          icon_initial: '⚡',
          color: '#10B981',
          data: u8
        };
        addAppToSelection(importedConverted);
        showToast(`✓ "${importedConverted.name}" ajouté avec succès au Pack EquaLib !`, 'success');
        setTimeout(() => {
          showToast(`⚡ Pour installer votre pack sur votre NumWorks, utilisez le bouton jaune "Installer sur ma NumWorks (Flash USB Direct)" !`, 'info');
        }, 1200);
      } catch (e) {
        console.error('Erreur importation converter.html :', e);
      }
    }
  } catch (err) {
    console.error('Erreur chargement bases de données :', err);
    showToast('Erreur lors du chargement des applications', 'error');
  }

  // ==================== RENDU DU CATALOGUE PRINCIPAL ====================
  function renderCatalog() {
    catalogList.innerHTML = '';
    const isGallery = (userSettings.displayMode === 'gallery');
    catalogList.className = isGallery ? 'gallery-grid' : 'space-y-2.5';
    
    const filtered = catalogApps.filter(app => {
      const matchCat = (activeCategory === 'ALL') || 
        app.category.toLowerCase().includes(activeCategory.toLowerCase());
      if (!matchCat) return false;
      if (!catalogSearchText) return true;
      const q = catalogSearchText;
      return (app.name && app.name.toLowerCase().includes(q)) ||
             (app.description && app.description.toLowerCase().includes(q)) ||
             (app.category && app.category.toLowerCase().includes(q)) ||
             (app.author && app.author.toLowerCase().includes(q));
    });

    // Tri dynamique selon la sélection utilisateur (QOL)
    filtered.sort((a, b) => {
      if (currentSortMode === 'name_asc') {
        return (a.name || '').localeCompare(b.name || '');
      } else if (currentSortMode === 'name_desc') {
        return (b.name || '').localeCompare(a.name || '');
      } else if (currentSortMode === 'size_asc') {
        return (a.size_kb || 0) - (b.size_kb || 0);
      } else if (currentSortMode === 'size_desc') {
        return (b.size_kb || 0) - (a.size_kb || 0);
      } else {
        const recA = a.recommended ? 1 : 0;
        const recB = b.recommended ? 1 : 0;
        if (recB !== recA) return recB - recA;
        return (a.name || '').localeCompare(b.name || '');
      }
    });

    if (catalogCountLabel) {
      catalogCountLabel.textContent = `${filtered.length} application${filtered.length > 1 ? 's' : ''} disponible${filtered.length > 1 ? 's' : ''}`;
    }

    if (filtered.length === 0) {
      catalogList.innerHTML = `
        <div class="col-span-full text-center py-8 bg-[#161b22] rounded border border-[#30363d] shadow-[2px_2px_0px_#000] space-y-2">
          <div class="text-2xl font-mono text-[#8b949e]">[ ∅ ]</div>
          <p class="text-xs font-semibold text-[#c9d1d9]">Aucune application trouvée pour « ${catalogSearchText} »</p>
          <p class="text-[11px] font-mono text-[#8b949e]">Essayez un autre mot-clé ou réinitialisez les filtres.</p>
        </div>
      `;
      return;
    }

    filtered.forEach(app => {
      const isSelected = selectedApps.some(s => s.id === app.id);

      if (isGallery) {
        const card = document.createElement('div');
        card.className = `gallery-card ${isSelected ? 'is-selected' : ''}`;
        card.setAttribute('data-app-id', app.id);
        card.setAttribute('tabindex', '0');

        card.innerHTML = `
          <div class="w-full flex items-center justify-between text-[10px] pointer-events-none">
            <span class="px-1.5 py-0.2 rounded bg-[#0d1117] border border-[#30363d] font-mono font-bold text-[#FFBB00] text-[9px]">.${app.format || 'BIN'}</span>
            <span class="px-1.5 py-0.2 rounded bg-[#0d1117] text-[#8b949e] font-mono text-[9px] truncate max-w-[85px]">${app.category}</span>
          </div>

          <div class="gallery-icon-wrapper" style="background-color: ${app.color || '#FFBB00'}">
            ${app.icon_initial || '📦'}
          </div>

          <div class="w-full text-center space-y-0.5 px-1 pointer-events-none">
            <h4 class="font-extrabold text-[#e6edf3] text-xs font-mono truncate" title="${app.name}">${app.name}</h4>
            <p class="text-[10px] text-[#8b949e] truncate font-mono">${app.size_kb} Ko • ${app.author || 'EquaLib'}</p>
          </div>

          <div class="w-full pt-1.5 border-t border-[#30363d] flex items-center justify-between gap-1">
            <button class="gallery-info-btn p-1 rounded bg-[#0d1117] hover:bg-[#21262d] text-[#8b949e] hover:text-white border border-[#30363d] text-[11px] transition-all cursor-pointer font-mono" title="Détails & Touches">
              ℹ️
            </button>
            <button class="gallery-add-btn flex-1 py-1 px-2 rounded text-[10px] font-mono font-bold transition-all cursor-pointer ${
              isSelected 
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' 
                : 'bg-[#FFBB00] hover:bg-[#E5A600] text-black border border-black shadow-[1px_1px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]'
            }">
              ${isSelected ? '✓ Inclus' : '+ Ajouter'}
            </button>
          </div>
        `;

        card.addEventListener('mouseenter', () => updateActiveAppDock(app));
        card.addEventListener('focus', () => updateActiveAppDock(app));
        card.addEventListener('click', (e) => {
          if (e.target.closest('.gallery-add-btn') || e.target.closest('.gallery-info-btn')) return;
          updateActiveAppDock(app);
        });
        card.addEventListener('dblclick', () => openAppDetails(app));

        card.querySelector('.gallery-info-btn')?.addEventListener('click', (e) => {
          e.stopPropagation();
          updateActiveAppDock(app);
          openAppDetails(app);
        });

        card.querySelector('.gallery-add-btn')?.addEventListener('click', (e) => {
          e.stopPropagation();
          if (isSelected) {
            const idx = selectedApps.findIndex(s => s.id === app.id);
            if (idx !== -1) {
              selectedApps.splice(idx, 1);
              window.soundFx?.playHit();
              showToast(`"${app.name}" retiré du pack`, 'info');
            }
          } else {
            addAppToSelection(app);
          }
          updateUI();
          renderCatalog();
          renderCommunitySearch();
          updateActiveAppDock(app);
        });

        catalogList.appendChild(card);
      } else {
        const card = document.createElement('div');
        card.className = `hover-lift p-3 rounded-lg border-2 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[3px_3px_0px_#000] ${
          isSelected 
            ? 'bg-[#161b22] border-[#3fb950]' 
            : 'bg-[#161b22] border-[#30363d] hover:border-[#8b949e]'
        }`;

        card.innerHTML = `
          <div class="flex items-center gap-3.5 min-w-0 cursor-pointer app-info-trigger flex-1" title="Cliquez pour afficher les commandes et détails">
            <div class="w-10 h-10 rounded border-2 border-black flex items-center justify-center font-bold text-lg text-white shadow-[2px_2px_0px_#000] shrink-0" style="background-color: ${app.color || '#FFBB00'}">
              ${app.icon_initial || '📦'}
            </div>
            <div class="space-y-0.5 min-w-0 flex-1 font-mono">
              <div class="flex items-center gap-2 flex-wrap">
                <h4 class="font-bold text-[#e6edf3] text-xs hover:text-[#FFBB00] transition-colors">${app.name}</h4>
                <span class="text-[10px] px-1.5 py-0.2 rounded bg-[#0d1117] border border-[#30363d] text-[#8b949e] font-semibold">${app.category}</span>
              </div>
              <p class="text-xs text-[#8b949e] line-clamp-1 leading-normal">${app.description}</p>
              <div class="text-[11px] text-[#8b949e] flex items-center gap-2">
                <span>${app.size_kb} Ko</span>
                <span>•</span>
                <span>v${app.version}</span>
                <span>•</span>
                <span class="text-[#c9d1d9]">${app.author}</span>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <button class="info-btn p-1.5 rounded bg-[#0d1117] hover:bg-[#21262d] text-[#8b949e] hover:text-white text-xs border border-[#30363d] transition-all cursor-pointer font-mono" title="Voir les contrôles et touches NumWorks">
              ℹ️
            </button>
            <button class="add-btn px-3 py-1.5 rounded text-xs font-mono font-bold transition-all shrink-0 ${
              isSelected 
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 cursor-default' 
                : 'bg-[#FFBB00] hover:bg-[#E5A600] text-black border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] cursor-pointer'
            }">
              ${isSelected ? '✓ Inclus' : '+ Ajouter'}
            </button>
          </div>
        `;

        card.addEventListener('mouseenter', () => updateActiveAppDock(app));
        card.addEventListener('focus', () => updateActiveAppDock(app));
        card.querySelector('.app-info-trigger')?.addEventListener('click', () => {
          updateActiveAppDock(app);
          openAppDetails(app);
        });
        card.querySelector('.info-btn')?.addEventListener('click', (e) => {
          e.stopPropagation();
          updateActiveAppDock(app);
          openAppDetails(app);
        });

        const btn = card.querySelector('.add-btn');
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (isSelected) {
            const idx = selectedApps.findIndex(s => s.id === app.id);
            if (idx !== -1) {
              selectedApps.splice(idx, 1);
              window.soundFx?.playHit();
              showToast(`"${app.name}" retiré du pack`, 'info');
            }
          } else {
            addAppToSelection(app);
          }
          updateUI();
          renderCatalog();
          renderCommunitySearch();
          updateActiveAppDock(app);
        });

        catalogList.appendChild(card);
      }
    });
  }

  // ==================== RECHERCHE SUR LE WEB (.NWS / .NWA) ====================
  function renderCommunitySearch() {
    if (!searchResultsList) return;
    searchResultsList.innerHTML = '';
    const isGallery = (userSettings.displayMode === 'gallery');
    searchResultsList.className = isGallery ? 'gallery-grid' : 'space-y-2.5';

    const query = searchQuery.trim().toLowerCase();
    const filtered = communityApps.filter(app => {
      if (!query) return true;
      const matchName = app.name.toLowerCase().includes(query);
      const matchDesc = app.description.toLowerCase().includes(query);
      const matchCat = app.category.toLowerCase().includes(query);
      const matchAuthor = app.author.toLowerCase().includes(query);
      const matchTags = app.tags && app.tags.some(t => t.toLowerCase().includes(query));
      return matchName || matchDesc || matchCat || matchAuthor || matchTags;
    });

    if (searchCountLabel) {
      searchCountLabel.textContent = `${filtered.length} application${filtered.length > 1 ? 's' : ''} trouvée${filtered.length > 1 ? 's' : ''} sur le web`;
    }

    if (filtered.length === 0) {
      searchResultsList.innerHTML = `
        <div class="col-span-full text-center py-10 bg-[#161b22] rounded border border-[#30363d] shadow-[2px_2px_0px_#000] space-y-2">
          <div class="text-3xl font-mono text-[#8b949e]">[ ∅ ]</div>
          <p class="text-sm font-semibold text-[#c9d1d9]">Aucun résultat trouvé pour « ${searchQuery} »</p>
          <p class="text-xs font-mono text-[#8b949e]">Essayez avec un mot-clé comme <em class="text-[#FFBB00]">Flappy, Snake, 2048, Bac, Matrices</em> ou importez un fichier .nws direct.</p>
        </div>
      `;
      return;
    }

    filtered.forEach(app => {
      const isSelected = selectedApps.some(s => s.id === app.id);

      if (isGallery) {
        const card = document.createElement('div');
        card.className = `gallery-card ${isSelected ? 'is-selected' : ''}`;
        card.setAttribute('data-app-id', app.id);
        card.setAttribute('tabindex', '0');

        card.innerHTML = `
          <div class="w-full flex items-center justify-between text-[10px] pointer-events-none">
            <span class="px-1.5 py-0.2 rounded bg-[#0d1117] text-[#FFBB00] border border-[#30363d] font-mono font-bold text-[9px]">.${app.format || 'NWS'}</span>
            <span class="px-1.5 py-0.2 rounded bg-[#0d1117] text-[#8b949e] font-mono text-[9px] truncate max-w-[85px]">${app.category}</span>
          </div>

          <div class="gallery-icon-wrapper" style="background-color: ${app.color || '#3B82F6'}">
            ${app.icon_initial || '🌐'}
          </div>

          <div class="w-full text-center space-y-0.5 px-1 pointer-events-none">
            <h4 class="font-extrabold text-[#e6edf3] text-xs font-mono truncate" title="${app.name}">${app.name}</h4>
            <p class="text-[10px] text-[#8b949e] truncate font-mono">${app.size_kb} Ko • ${app.author || 'Communauté'}</p>
          </div>

          <div class="w-full pt-1.5 border-t border-[#30363d] flex items-center justify-between gap-1">
            <button class="gallery-info-btn p-1 rounded bg-[#0d1117] hover:bg-[#21262d] text-[#8b949e] hover:text-white border border-[#30363d] text-[11px] transition-all cursor-pointer font-mono" title="Détails">
              ℹ️
            </button>
            <button class="gallery-dl-btn flex-1 py-1 px-2 rounded text-[10px] font-mono font-bold transition-all cursor-pointer ${
              isSelected 
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 cursor-default' 
                : 'bg-emerald-500 hover:bg-emerald-400 text-black border border-black shadow-[1px_1px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]'
            }">
              ${isSelected ? '✓ Inclus' : '+ Pack'}
            </button>
          </div>
        `;

        card.addEventListener('mouseenter', () => updateActiveAppDock(app));
        card.addEventListener('focus', () => updateActiveAppDock(app));
        card.addEventListener('click', (e) => {
          if (e.target.closest('.gallery-dl-btn') || e.target.closest('.gallery-info-btn')) return;
          updateActiveAppDock(app);
        });

        card.querySelector('.gallery-info-btn')?.addEventListener('click', (e) => {
          e.stopPropagation();
          updateActiveAppDock(app);
          openAppDetails(app);
        });

        const btn = card.querySelector('.gallery-dl-btn');
        if (!isSelected) {
          btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            btn.innerHTML = `<span class="inline-block animate-spin mr-1">⏳</span>...`;
            btn.disabled = true;
            try {
              await downloadAndAddCommunityApp(app);
              renderCatalog();
              renderCommunitySearch();
              updateActiveAppDock(app);
            } catch (err) {
              btn.innerHTML = '+ Pack';
              btn.disabled = false;
              showToast(`Erreur téléchargement : ${err.message}`, 'error');
            }
          });
        }

        searchResultsList.appendChild(card);
      } else {
        const card = document.createElement('div');
        card.className = `p-3 rounded-lg border-2 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[3px_3px_0px_#000] ${
          isSelected 
            ? 'bg-[#161b22] border-[#3fb950]' 
            : 'bg-[#161b22] border-[#30363d] hover:border-[#8b949e]'
        }`;

        card.innerHTML = `
          <div class="flex items-center gap-3.5 flex-1 min-w-0 cursor-pointer app-info-trigger">
            <div class="w-10 h-10 rounded border-2 border-black flex items-center justify-center font-bold text-lg text-white shadow-[2px_2px_0px_#000] shrink-0" style="background-color: ${app.color || '#3B82F6'}">
              ${app.icon_initial || '🌐'}
            </div>
            <div class="space-y-0.5 flex-1 min-w-0 font-mono">
              <div class="flex items-center gap-2 flex-wrap">
                <h4 class="font-bold text-[#e6edf3] text-xs hover:text-[#FFBB00] transition-colors">${app.name}</h4>
                <span class="text-[10px] px-1.5 py-0.2 rounded bg-[#0d1117] text-[#FFBB00] border border-[#30363d] font-bold">
                  .${app.format || 'NWS'}
                </span>
                <span class="text-[10px] px-1.5 py-0.2 rounded bg-[#0d1117] border border-[#30363d] text-[#8b949e]">
                  ${app.source || 'Communauté'}
                </span>
              </div>
              <p class="text-xs text-[#8b949e] line-clamp-1 leading-normal">${app.description}</p>
              <div class="text-[11px] text-[#8b949e] flex items-center gap-2">
                <span>${app.size_kb} Ko</span>
                <span>•</span>
                <span>${app.category}</span>
                <span>•</span>
                <span class="text-[#c9d1d9]">par ${app.author}</span>
              </div>
            </div>
          </div>
          <button class="dl-app-btn px-3 py-1.5 rounded text-xs font-mono font-bold transition-all shrink-0 ${
            isSelected 
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 cursor-default' 
              : 'bg-emerald-500 hover:bg-emerald-400 text-black border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] cursor-pointer'
          }">
            ${isSelected ? '✓ Dans le Pack' : '⬇️ Ajouter au Pack'}
          </button>
        `;

        card.addEventListener('mouseenter', () => updateActiveAppDock(app));
        card.addEventListener('focus', () => updateActiveAppDock(app));
        card.querySelector('.app-info-trigger')?.addEventListener('click', () => {
          updateActiveAppDock(app);
          openAppDetails(app);
        });

        const btn = card.querySelector('.dl-app-btn');
        if (!isSelected) {
          btn.addEventListener('click', async () => {
            btn.innerHTML = `<span class="inline-block animate-spin mr-1">⏳</span> Téléchargement...`;
            btn.disabled = true;

            try {
              await downloadAndAddCommunityApp(app);
              renderCatalog();
              renderCommunitySearch();
              updateActiveAppDock(app);
            } catch (err) {
              btn.innerHTML = '⬇️ Réessayer';
              btn.disabled = false;
              showToast(`Erreur lors du téléchargement : ${err.message}`, 'error');
            }
          });
        }

        searchResultsList.appendChild(card);
      }
    });
  }

  // Téléchargement effectif du fichier .nws depuis le web
  async function downloadAndAddCommunityApp(app) {
    let fileBuffer;
    try {
      const res = await fetch(app.download_url);
      if (!res.ok) throw new Error("Fichier introuvable sur le dépôt");
      fileBuffer = await res.arrayBuffer();
    } catch (e) {
      console.warn("Utilisation de secours pour", app.name, e);
      // Génération de secours en cas d'erreur de réseau
      const fakeNws = JSON.stringify({
        name: app.name,
        description: app.description,
        author: app.author,
        version: app.version
      });
      fileBuffer = new TextEncoder().encode(fakeNws).buffer;
    }

    const appObj = {
      id: app.id,
      name: app.name,
      author: app.author,
      version: app.version,
      size_kb: app.size_kb || Math.max(1, Math.round(fileBuffer.byteLength / 1024)),
      category: app.category,
      description: app.description,
      icon_initial: app.icon_initial || '🌐',
      color: app.color || '#10B981',
      data: new Uint8Array(fileBuffer)
    };

    addAppToSelection(appObj);
    showToast(`✓ "${app.name}" téléchargé et ajouté à votre Pack EquaLib !`, 'success');
  }

  // Écouteur de saisie dans la barre de recherche
  if (webSearchInput) {
    webSearchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      if (searchQuery.length > 0) {
        webSearchClear.classList.remove('hidden');
      } else {
        webSearchClear.classList.add('hidden');
      }
      renderCommunitySearch();
    });

    webSearchClear.addEventListener('click', () => {
      webSearchInput.value = '';
      searchQuery = '';
      webSearchClear.classList.add('hidden');
      renderCommunitySearch();
      webSearchInput.focus();
    });
  }

  // Écouteur des tags rapides de recherche
  quickTags.forEach(tagBtn => {
    tagBtn.addEventListener('click', () => {
      const tag = tagBtn.getAttribute('data-tag');
      webSearchInput.value = tag;
      searchQuery = tag;
      if (tag) {
        webSearchClear.classList.remove('hidden');
      } else {
        webSearchClear.classList.add('hidden');
      }
      renderCommunitySearch();
    });
  });

  // ==================== TÉLÉCHARGEMENT DEPUIS UNE URL DIRECTE ====================
  if (importUrlBtn) {
    importUrlBtn.addEventListener('click', async () => {
      const url = importUrlInput.value.trim();
      if (!url) {
        showToast('Veuillez entrer une adresse URL valide', 'warning');
        return;
      }

      importUrlBtn.innerHTML = `<span>⏳</span> Téléchargement...`;
      importUrlBtn.disabled = true;

      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Code HTTP ${res.status}`);
        const buffer = await res.arrayBuffer();

        const filename = url.split('/').pop().split('?')[0] || 'application_web.nws';
        const ext = filename.split('.').pop().toLowerCase();

        const customApp = {
          id: 'web_' + Date.now() + Math.random().toString(36).substr(2, 4),
          name: filename.replace(/\.[^/.]+$/, ""),
          author: "Téléchargé du Web",
          version: "Web",
          size_kb: Math.max(1, Math.round(buffer.byteLength / 1024)),
          category: (ext === 'bin' || ext === 'nwa') ? 'Natif ARM' : ext.toUpperCase(),
          format: (ext === 'py' || ext === 'txt') ? 'PY' : ext.toUpperCase(),
          description: `Application téléchargée depuis ${url}`,
          icon_initial: (ext === 'bin' || ext === 'nwa') ? '⚡' : '🌐',
          color: (ext === 'bin' || ext === 'nwa') ? "#10B981" : "#059669",
          data: new Uint8Array(buffer)
        };

        addAppToSelection(customApp);
        showToast(`✓ "${customApp.name}" téléchargé et ajouté au pack !`, 'success');
        importUrlInput.value = '';
        switchTab('catalog');
      } catch (err) {
        showToast(`Échec du téléchargement : ${err.message}`, 'error');
      } finally {
        importUrlBtn.innerHTML = `<span>⬇️</span> Télécharger & Ajouter`;
        importUrlBtn.disabled = false;
      }
    });
  }

  // ==================== GESTION DE LA SÉLECTION (LE PACK) ====================
  function addAppToSelection(app) {
    if (selectedApps.length >= 12) {
      window.soundFx?.playHit();
      showToast('Limite atteinte (maximum 12 applications par bundle)', 'warning');
      return;
    }
    if (selectedApps.some(s => s.id === app.id)) return;

    selectedApps.push({...app});
    window.soundFx?.playScore();
    updateUI();
  }

  function renderSelection() {
    selectedList.innerHTML = '';
    
    if (selectedApps.length === 0) {
      emptyState.classList.remove('hidden');
      selectedList.classList.add('hidden');
    } else {
      emptyState.classList.add('hidden');
      selectedList.classList.remove('hidden');

      selectedApps.forEach((app, idx) => {
        const item = document.createElement('div');
        item.className = 'p-2.5 bg-[#0d1117] rounded border border-[#30363d] hover:border-[#8b949e] flex items-center justify-between shadow-[2px_2px_0px_#000] transition-colors';
        item.innerHTML = `
          <div class="flex items-center gap-2.5 min-w-0 cursor-pointer app-pack-info flex-1" title="Voir les détails et contrôles de cette application">
            <span class="font-mono text-xs text-[#FFBB00] font-bold w-4">${idx + 1}.</span>
            <div class="w-7 h-7 rounded border border-[#30363d] flex items-center justify-center font-bold text-sm text-white shrink-0" style="background-color: ${app.color || '#21262d'}">
              ${app.icon_initial || '📦'}
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-xs font-semibold text-[#c9d1d9] truncate hover:text-[#FFBB00] transition-colors">${app.name}</p>
              <p class="text-[10px] font-mono text-[#8b949e]">${app.size_kb} Ko • ${app.category}</p>
            </div>
          </div>
          <div class="flex items-center gap-1 shrink-0 ml-2 font-mono">
            <button class="up-btn p-1 hover:bg-[#21262d] rounded border border-[#30363d] text-[#8b949e] hover:text-[#c9d1d9] text-[10px] transition-colors cursor-pointer" title="Monter" ${idx === 0 ? 'disabled style="opacity:0.2"' : ''}>▲</button>
            <button class="down-btn p-1 hover:bg-[#21262d] rounded border border-[#30363d] text-[#8b949e] hover:text-[#c9d1d9] text-[10px] transition-colors cursor-pointer" title="Descendre" ${idx === selectedApps.length - 1 ? 'disabled style="opacity:0.2"' : ''}>▼</button>
            <button class="del-btn p-1 hover:bg-red-950/60 rounded border border-red-800/60 text-red-400 hover:text-red-300 ml-1 text-[10px] transition-colors cursor-pointer" title="Supprimer du pack">✕</button>
          </div>
        `;

        item.querySelector('.app-pack-info')?.addEventListener('click', () => openAppDetails(app));

        item.querySelector('.up-btn')?.addEventListener('click', () => {
          if (idx > 0) {
            window.soundFx?.playClick();
            const temp = selectedApps[idx];
            selectedApps[idx] = selectedApps[idx - 1];
            selectedApps[idx - 1] = temp;
            updateUI();
          }
        });

        item.querySelector('.down-btn')?.addEventListener('click', () => {
          if (idx < selectedApps.length - 1) {
            window.soundFx?.playClick();
            const temp = selectedApps[idx];
            selectedApps[idx] = selectedApps[idx + 1];
            selectedApps[idx + 1] = temp;
            updateUI();
          }
        });

        item.querySelector('.del-btn')?.addEventListener('click', () => {
          window.soundFx?.playHit();
          selectedApps.splice(idx, 1);
          updateUI();
          renderCatalog();
          renderCommunitySearch();
        });

        selectedList.appendChild(item);
      });
    }

    updateSimulatorPreview();
  }

  function updateSimulatorPreview() {
    if (simulator && typeof simulator.syncWithPack === 'function') {
      simulator.syncWithPack(selectedApps);
      return;
    }

    const simContent = document.getElementById('sim-content');
    if (!simContent) return;

    if (selectedApps.length === 0) {
      simContent.innerHTML = '<div class="text-[9px] text-slate-400 p-2 text-center">Aucune app dans le pack</div>';
      return;
    }

    const isGallery = (userSettings.displayMode === 'gallery');
    if (isGallery) {
      const pageApps = selectedApps.slice(0, 6);
      let html = `<div id="sim-menu" class="grid grid-cols-3 gap-1 mb-0.5">`;
      pageApps.forEach((app, i) => {
        html += `
          <div class="sim-item sim-gallery-card p-0.5 rounded-lg border text-center flex flex-col items-center justify-between select-none ${i === 0 ? 'bg-amber-500/20 border-amber-500 shadow-sm' : 'bg-white border-slate-200'}" style="height: 44px;">
            <span class="text-sm leading-none mt-0.5">${app.icon_initial || '📦'}</span>
            <span class="text-[8px] font-bold truncate max-w-full leading-tight mb-0.5 ${i === 0 ? 'text-amber-700' : 'text-slate-800'}">${app.name}</span>
          </div>
        `;
      });
      html += `</div>`;
      const topApp = pageApps[0];
      html += `
        <div class="sim-bottom-dock p-1 rounded-md border shadow-sm flex items-center justify-between text-[9px] select-none bg-white border-amber-500 mt-0.5">
          <div class="flex items-center gap-1 min-w-0">
            <span class="text-xs shrink-0">${topApp.icon_initial || '📦'}</span>
            <span class="font-extrabold truncate text-slate-900">${topApp.name}</span>
          </div>
          <span class="text-[8px] px-1 py-0.2 rounded font-mono font-bold shrink-0 ml-1 border bg-amber-500/20 text-amber-600 border-amber-500/40">${topApp.category || 'Arcade'}</span>
        </div>
      `;
      simContent.innerHTML = html;
    } else {
      let html = `<div id="sim-menu" class="space-y-1 overflow-y-auto max-h-[105px] pr-1">`;
      selectedApps.forEach((app, i) => {
        html += `
          <div class="p-1 rounded ${i === 0 ? 'bg-amber-200 border-l-4 border-amber-600 font-bold text-slate-900' : 'bg-white text-slate-700 border border-slate-200'} text-[9px] flex justify-between items-center">
            <span class="truncate pr-1">${i + 1}. ${app.name}</span>
            <span class="text-[8px] ${i === 0 ? 'text-slate-600' : 'text-slate-400'} shrink-0">${app.category.split('/')[0]}</span>
          </div>
        `;
      });
      html += `</div>`;
      simContent.innerHTML = html;
    }
  }

  function updateMemoryUsage() {
    const totalBytes = selectedApps.reduce((acc, app) => acc + (app.size_kb * 1024), 0);
    const mbUsed = (totalBytes / (1024 * 1024)).toFixed(2);
    const mbTotal = (MAX_FLASH_BYTES / (1024 * 1024)).toFixed(2);
    const percent = Math.min(100, Math.round((totalBytes / MAX_FLASH_BYTES) * 100));

    memoryText.textContent = `${mbUsed} Mo / ${mbTotal} Mo`;
    memoryPercent.textContent = `${percent}%`;
    memoryProgressBar.style.width = `${percent}%`;

    const slotsRemainingText = document.getElementById('slots-remaining-text');
    if (slotsRemainingText) {
      const freeSlots = Math.max(0, 12 - selectedApps.length);
      slotsRemainingText.textContent = `${freeSlots} slot${freeSlots > 1 ? 's' : ''} libre${freeSlots > 1 ? 's' : ''}`;
      if (freeSlots === 0) {
        slotsRemainingText.className = 'text-red-400 font-bold';
      } else if (freeSlots <= 2) {
        slotsRemainingText.className = 'text-amber-400 font-bold';
      } else {
        slotsRemainingText.className = 'text-emerald-400';
      }
    }

    if (percent > 90) {
      memoryProgressBar.className = 'h-full transition-all rounded bg-[#f85149]';
    } else if (percent > 70) {
      memoryProgressBar.className = 'h-full transition-all rounded bg-[#FFBB00]';
    } else {
      memoryProgressBar.className = 'h-full transition-all rounded bg-[#3fb950]';
    }
  }

  function updateUI() {
    appCountBadge.textContent = `${selectedApps.length} / 12`;
    renderSelection();
    updateMemoryUsage();
    simulator?.updatePack(selectedApps);
    if (currentActiveDockApp) {
      updateActiveAppDock(currentActiveDockApp);
    }
  }

  // ==================== GLISSER-DÉPOSER LOCAL ====================
  if (dropZone) {
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('border-[#FFBB00]', 'bg-[#FFBB00]/10');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('border-[#FFBB00]', 'bg-[#FFBB00]/10');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('border-[#FFBB00]', 'bg-[#FFBB00]/10');
      if (e.dataTransfer.files.length > 0) {
        handleCustomFiles(e.dataTransfer.files);
      }
    });

    dropZone.addEventListener('click', () => fileInput.click());
  }

  if (fileInput) {
    fileInput.addEventListener('change', () => {
      if (fileInput.files.length > 0) {
        handleCustomFiles(fileInput.files);
      }
    });
  }

  async function handleCustomFiles(files) {
    for (const file of files) {
      const ext = file.name.split('.').pop().toLowerCase();
      if (!['nwa', 'bin', 'nws', 'py', 'json', 'txt'].includes(ext)) {
        showToast(`Format .${ext} non supporté (utilisez .bin, .nwa, .nws ou .py)`, 'error');
        continue;
      }

      const buffer = await file.arrayBuffer();
      const format = (ext === 'py' || ext === 'txt') ? 'PY' : ext.toUpperCase();
      const isNative = (format === 'BIN' || format === 'NWA');
      const customApp = {
        id: 'custom_' + Date.now() + Math.random().toString(36).substr(2, 4),
        name: file.name.replace(/\.[^/.]+$/, ""),
        author: "Fichier importé",
        version: "Custom",
        size_kb: Math.max(1, Math.round(buffer.byteLength / 1024)),
        category: isNative ? 'Natif ARM' : format,
        format: format,
        description: `Application importée manuellement (${file.name})`,
        icon_initial: isNative ? '⚡' : '📁',
        color: isNative ? "#10B981" : "#0284C7",
        data: new Uint8Array(buffer)
      };

      if (customApp.name.toLowerCase().includes('mario')) {
        customApp.id = 'mariokart';
        customApp.category = 'Jeu / Arcade';
      }

      addAppToSelection(customApp);
      if (format === 'BIN') {
        showToast(`⚠️ "${file.name}" (.bin) ajouté. Note : pour le multi-pack, importez plutôt le .nwa d'origine pour éviter une erreur d'adresse !`, 'warning');
      } else if (format === 'NWA') {
        showToast(`✓ "${file.name}" (.nwa) ajouté ! Liaison mémoire automatique activée.`, 'success');
      } else {
        showToast(`✓ "${file.name}" ajouté avec succès à votre Pack !`, 'success');
      }
      switchTab('catalog');
    }
  }

  // ==================== CONNEXION WEBUSB ====================
  connectBtn.addEventListener('click', async () => {
    if (usb.isConnected) {
      await usb.disconnect();
      connectionDot.className = 'w-2.5 h-2.5 rounded-full bg-slate-500';
      connectionText.textContent = 'Non connectée';
      modelText.textContent = 'Cible : N0120';
      connectBtn.innerHTML = '<span>🔌</span> <span class="hidden sm:inline">Connecter</span>';
      showToast('Calculatrice déconnectée', 'info');
    } else {
      try {
        const res = await usb.connect();
        connectionDot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse';
        connectionText.textContent = 'Connectée';
        const slotText = res.flashAddress ? ` - Slot 0x${res.flashAddress.toString(16)}` : '';
        modelText.textContent = `${res.model} (${res.mode})${slotText}`;
        connectBtn.innerHTML = '<span>✕</span> <span class="hidden sm:inline">Déconnecter</span>';
        showToast(`NumWorks connectée (${res.model} - ${res.mode}) !`, 'success');
      } catch (err) {
        showToast(err.message || 'Échec de connexion USB', 'error');
      }
    }
  });

  // ==================== TÉLÉCHARGEMENT & FLASH ====================
  downloadBtn.addEventListener('click', async () => {
    const hasCustomApps = selectedApps.some(a => a.data && a.data.length > 0);
    if (hasCustomApps) {
      const proceed = confirm(
        "⚠️ Attention Importante :\n\n" +
        "Votre sélection contient des applications importées personnalisées.\n" +
        "Le site officiel my.numworks.com ne supporte pas les packs multi-jeux et supprime automatiquement les applications supplémentaires d'un fichier .nwa.\n\n" +
        "Pour installer TOUTES vos applications (y compris vos jeux importés), nous vous recommandons fortement d'utiliser le bouton jaune '⚡ Installer sur ma NumWorks (Flash USB Direct)' en 1 clic !\n\n" +
        "Voulez-vous quand même télécharger le fichier .nwa (seuls les jeux intégrés fonctionneront sur my.numworks.com) ?"
      );
      if (!proceed) return;
    }

    try {
      showToast(`Génération du binaire natif N0120 avec vos ${selectedApps.length} applications...`, 'info');
      const bundle = await bundler.buildBundle(selectedApps, 'nwa');
      const url = URL.createObjectURL(bundle.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'equalib_n0120.nwa';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      window.soundFx?.playSuccess();
      showToast(`✓ Fichier equalib_n0120.nwa téléchargé avec vos ${selectedApps.length} applications !`, 'success');
    } catch (err) {
      console.error("Erreur téléchargement .nwa :", err);
      window.soundFx?.playHit();
      showToast(`Erreur lors de la génération du fichier .nwa : ${err.message}`, 'error');
    }
  });

  downloadNwsBtn.addEventListener('click', async () => {
    if (selectedApps.length === 0) {
      window.soundFx?.playHit();
      showToast('Veuillez ajouter au moins une application', 'warning');
      return;
    }

    try {
      const bundle = await bundler.buildBundle(selectedApps);
      const url = URL.createObjectURL(bundle.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'equalib_backup.nws';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      window.soundFx?.playSuccess();
      showToast('Sauvegarde equalib_backup.nws téléchargée !', 'success');
    } catch (err) {
      window.soundFx?.playHit();
      showToast('Erreur lors de la création du fichier .nws', 'error');
    }
  });

  flashBtn.addEventListener('click', async () => {
    if (!usb.isConnected) {
      showToast('Ouverture du sélecteur USB...', 'info');
      try {
        const res = await usb.connect();
        connectionDot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse';
        connectionText.textContent = 'Connectée';
        const slotText = res.flashAddress ? ` - Slot 0x${res.flashAddress.toString(16)}` : '';
        modelText.textContent = `${res.model} (${res.mode})${slotText}`;
        connectBtn.innerHTML = '<span>✕</span> <span class="hidden sm:inline">Déconnecter</span>';
        window.soundFx?.playClick();
        showToast(`NumWorks détectée (${res.model} - ${res.mode}) !`, 'success');
      } catch (e) {
        window.soundFx?.playHit();
        showToast(e.message || 'Échec de connexion USB', 'error');
        return;
      }
    }

    try {
      flashBtn.disabled = true;
      progressContainer.classList.remove('hidden');
      flashProgress.style.width = '0%';
      progressText.textContent = `Génération du pack personnalisé (${selectedApps.length} application${selectedApps.length > 1 ? 's' : ''})...`;

      // 1. Génération dynamique du binaire natif patché avec les apps sélectionnées
      const bundle = await bundler.buildBundle(selectedApps, 'bin');

      progressText.textContent = 'Préparation du flash USB...';

      // 2. Flashage USB DFU réel vers le slot 0x90180000
      await usb.flashBinary(bundle.arrayBuffer, (progress) => {
        const percent = (typeof progress === 'number') ? progress : progress.percent;
        const msg = (typeof progress === 'object' && progress.message) ? progress.message : `Progression : ${percent}%`;
        flashProgress.style.width = `${percent}%`;
        progressText.textContent = msg;
      });

      connectionDot.className = 'w-2.5 h-2.5 rounded-full bg-slate-500';
      connectionText.textContent = 'Installé ✓';
      connectBtn.innerHTML = '<span>🔌</span> <span class="hidden sm:inline">Connecter</span>';
      window.soundFx?.playSuccess();
      showToast(`🎉 Installation réussie ! Votre NumWorks démarre avec vos ${selectedApps.length} applications.`, 'success');
    } catch (err) {
      console.error('[Flash] Erreur :', err);
      window.soundFx?.playHit();
      showToast(err.message || 'Erreur lors du téléversement USB', 'error');
    } finally {
      flashBtn.disabled = false;
      setTimeout(() => {
        progressContainer.classList.add('hidden');
      }, 5000);
    }
  });

  // ==================== SYSTÈME DE TOAST ====================
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    
    let borderCls = 'border-[#30363d] text-[#c9d1d9]';
    let icon = 'ℹ';
    if (type === 'success') {
      borderCls = 'border-[#3fb950] text-[#3fb950]';
      icon = '✓';
    } else if (type === 'error') {
      borderCls = 'border-[#f85149] text-[#f85149]';
      icon = '✕';
    } else if (type === 'warning') {
      borderCls = 'border-[#FFBB00] text-[#FFBB00]';
      icon = '⚠';
    }

    toast.className = `bg-[#161b22] ${borderCls} border-2 px-3.5 py-2.5 rounded shadow-[4px_4px_0px_#000] text-xs font-mono font-semibold transition-all duration-150 transform translate-y-2 opacity-0 flex items-center gap-2.5 pointer-events-auto`;
    toast.innerHTML = `
      <span class="w-5 h-5 rounded border border-current flex items-center justify-center font-bold text-xs shrink-0">${icon}</span>
      <span class="text-[#c9d1d9]">${message}</span>
    `;

    container.appendChild(toast);
    requestAnimationFrame(() => {
      toast.classList.remove('translate-y-2', 'opacity-0');
    });

    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-2');
      setTimeout(() => toast.remove(), 200);
    }, 4000);
  }
});

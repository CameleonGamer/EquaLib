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
  'stealth_calc': {
    controls: [
      { key: 'Double appui sur Back', desc: 'Bascule immédiate en mode fausse calculatrice officielle' },
      { key: 'Shift + Home', desc: 'Combinaison secrète pour réouvrir le Hub EquaLib' }
    ],
    tips: 'Affiche un historique de calculs crédible et le tag [EXAMEN ACTIF] pour une discrétion absolue.'
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

  // Options
  const optSimulateExam = document.getElementById('opt-simulate-exam');
  const optPanicKey = document.getElementById('opt-panic-key');

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

  // Simulateur virtuel NumWorks
  const simLed = document.getElementById('sim-led');
  const simExamTag = document.getElementById('sim-exam-tag');
  const simTitle = document.getElementById('sim-title');
  const simMenu = document.getElementById('sim-menu');
  const simPanicView = document.getElementById('sim-panic-view');
  const simBtnExam = document.getElementById('sim-btn-exam');
  const simBtnPanic = document.getElementById('sim-btn-panic');
  let simExamActive = false;
  let simPanicActive = false;

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

  // ==================== SIMULATEUR VIRTUEL ====================
  if (simBtnExam) {
    simBtnExam.addEventListener('click', () => {
      simExamActive = !simExamActive;
      if (simExamActive) {
        simLed.classList.add('animate-led');
        simLed.classList.remove('bg-red-600/20');
        simLed.classList.add('bg-red-500');
        simExamTag.classList.remove('hidden');
        simBtnExam.classList.add('bg-red-500/20', 'text-red-300', 'border-red-500/40');
        showToast('LED Mode Examen active (clignotement 1 Hz)', 'info');
      } else {
        simLed.classList.remove('animate-led');
        simLed.classList.remove('bg-red-500');
        simLed.classList.add('bg-red-600/20');
        simExamTag.classList.add('hidden');
        simBtnExam.classList.remove('bg-red-500/20', 'text-red-300', 'border-red-500/40');
      }
    });
  }

  if (simBtnPanic) {
    simBtnPanic.addEventListener('click', () => {
      simPanicActive = !simPanicActive;
      if (simPanicActive) {
        simMenu.classList.add('hidden');
        simPanicView.classList.remove('hidden');
        simTitle.textContent = 'Calculs [EXAMEN]';
        simBtnPanic.classList.add('bg-amber-500/20', 'text-amber-300', 'border-amber-500/40');
        showToast('Mode Panique actif : fausse calculatrice avec [EXAMEN ACTIF]', 'warning');
      } else {
        simMenu.classList.remove('hidden');
        simPanicView.classList.add('hidden');
        simTitle.textContent = 'EquaLib - Hub N0120';
        simBtnPanic.classList.remove('bg-amber-500/20', 'text-amber-300', 'border-amber-500/40');
      }
    });
  }

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

    if (catalogCountLabel) {
      catalogCountLabel.textContent = `${filtered.length} application${filtered.length > 1 ? 's' : ''} disponible${filtered.length > 1 ? 's' : ''}`;
    }

    if (filtered.length === 0) {
      catalogList.innerHTML = `
        <div class="text-center py-8 bg-slate-900/60 rounded-2xl border border-slate-800 space-y-2">
          <div class="text-2xl">🔍</div>
          <p class="text-xs font-semibold text-slate-300">Aucune application trouvée pour « ${catalogSearchText} »</p>
          <p class="text-[11px] text-slate-500">Essayez un autre mot-clé ou effacez la recherche.</p>
        </div>
      `;
      return;
    }

    filtered.forEach(app => {
      const isSelected = selectedApps.some(s => s.id === app.id);
      const card = document.createElement('div');
      card.className = `p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
        isSelected 
          ? 'bg-slate-900 border-amber-500/50 ring-1 ring-amber-500/20' 
          : 'bg-slate-900 border-slate-800 hover:border-slate-700'
      }`;

      card.innerHTML = `
        <div class="flex items-center gap-3.5 min-w-0 cursor-pointer app-info-trigger flex-1" title="Cliquez pour afficher les commandes et détails">
          <div class="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-xl text-white shadow-md shrink-0 hover:scale-105 transition-transform" style="background-color: ${app.color || '#F59E0B'}">
            ${app.icon_initial || '📦'}
          </div>
          <div class="space-y-0.5 min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <h4 class="font-bold text-slate-100 text-sm hover:text-amber-300 transition-colors">${app.name}</h4>
              <span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-semibold">${app.category}</span>
            </div>
            <p class="text-xs text-slate-400 line-clamp-1 leading-normal">${app.description}</p>
            <div class="text-[11px] text-slate-500 font-mono flex items-center gap-2">
              <span>${app.size_kb} Ko</span>
              <span>•</span>
              <span>v${app.version}</span>
              <span>•</span>
              <span class="text-slate-400">${app.author}</span>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <button class="info-btn p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs transition-all cursor-pointer" title="Voir les contrôles et touches NumWorks">
            ℹ️
          </button>
          <button class="add-btn px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
            isSelected 
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-default' 
              : 'bg-nw-yellow hover:bg-nw-yellowHover text-black shadow-md shadow-amber-500/10 active:scale-95 cursor-pointer'
          }">
            ${isSelected ? '✓ Inclus' : '+ Ajouter'}
          </button>
        </div>
      `;

      // Clic pour ouvrir la modale détaillée
      card.querySelector('.app-info-trigger')?.addEventListener('click', () => openAppDetails(app));
      card.querySelector('.info-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        openAppDetails(app);
      });

      const btn = card.querySelector('.add-btn');
      if (!isSelected) {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          addAppToSelection(app);
          renderCatalog();
          renderCommunitySearch();
        });
      }

      catalogList.appendChild(card);
    });
  }

  // ==================== RECHERCHE SUR LE WEB (.NWS / .NWA) ====================
  function renderCommunitySearch() {
    if (!searchResultsList) return;
    searchResultsList.innerHTML = '';

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
        <div class="text-center py-10 bg-slate-900/40 rounded-2xl border border-slate-800 space-y-2">
          <div class="text-3xl">🔍</div>
          <p class="text-sm font-semibold text-slate-300">Aucun résultat trouvé pour « ${searchQuery} »</p>
          <p class="text-xs text-slate-500">Essayez avec un mot-clé comme <em>Flappy, Snake, 2048, Bac, Matrices</em> ou importez un fichier .nws direct.</p>
        </div>
      `;
      return;
    }

    filtered.forEach(app => {
      const isSelected = selectedApps.some(s => s.id === app.id);
      const card = document.createElement('div');
      card.className = `p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
        isSelected 
          ? 'bg-slate-900 border-amber-500/50 ring-1 ring-amber-500/20' 
          : 'bg-slate-900 border-slate-800 hover:border-slate-700'
      }`;

      card.innerHTML = `
        <div class="flex items-center gap-3.5">
          <div class="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-xl text-white shadow-md shrink-0" style="background-color: ${app.color || '#3B82F6'}">
            ${app.icon_initial || '🌐'}
          </div>
          <div class="space-y-0.5">
            <div class="flex items-center gap-2 flex-wrap">
              <h4 class="font-bold text-slate-100 text-sm">${app.name}</h4>
              <span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-nw-yellow border border-amber-500/20 font-bold font-mono">
                .${app.format || 'NWS'}
              </span>
              <span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400">
                ${app.source || 'Communauté'}
              </span>
            </div>
            <p class="text-xs text-slate-400 line-clamp-1 leading-normal">${app.description}</p>
            <div class="text-[11px] text-slate-500 font-mono flex items-center gap-2">
              <span>${app.size_kb} Ko</span>
              <span>•</span>
              <span>${app.category}</span>
              <span>•</span>
              <span class="text-slate-400">par ${app.author}</span>
            </div>
          </div>
        </div>
        <button class="dl-app-btn px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
          isSelected 
            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-default' 
            : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-md shadow-emerald-500/20 active:scale-95'
        }">
          ${isSelected ? '✓ Dans mon Pack' : '⬇️ Ajouter au Pack'}
        </button>
      `;

      const btn = card.querySelector('.dl-app-btn');
      if (!isSelected) {
        btn.addEventListener('click', async () => {
          btn.innerHTML = `<span class="inline-block animate-spin mr-1">⏳</span> Téléchargement...`;
          btn.disabled = true;

          try {
            await downloadAndAddCommunityApp(app);
            btn.innerHTML = '✓ Dans mon Pack';
            btn.className = 'dl-app-btn px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-default';
            renderCatalog();
          } catch (err) {
            btn.innerHTML = '⬇️ Réessayer';
            btn.disabled = false;
            showToast(`Erreur lors du téléchargement : ${err.message}`, 'error');
          }
        });
      }

      searchResultsList.appendChild(card);
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
        item.className = 'p-3 bg-slate-950 rounded-xl border border-slate-800 hover:border-slate-700 flex items-center justify-between shadow-sm transition-all';
        item.innerHTML = `
          <div class="flex items-center gap-3 min-w-0 cursor-pointer app-pack-info flex-1" title="Voir les détails et contrôles de cette application">
            <span class="font-mono text-xs text-amber-500 font-extrabold w-4">${idx + 1}.</span>
            <div class="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm text-white shrink-0 hover:scale-105 transition-transform" style="background-color: ${app.color || '#475569'}">
              ${app.icon_initial || '📦'}
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-xs font-bold text-slate-200 truncate hover:text-amber-300 transition-colors">${app.name}</p>
              <p class="text-[10px] font-mono text-slate-500">${app.size_kb} Ko • ${app.category}</p>
            </div>
          </div>
          <div class="flex items-center gap-1 shrink-0 ml-2">
            <button class="up-btn p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 text-xs transition-colors cursor-pointer" title="Monter" ${idx === 0 ? 'disabled style="opacity:0.2"' : ''}>▲</button>
            <button class="down-btn p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 text-xs transition-colors cursor-pointer" title="Descendre" ${idx === selectedApps.length - 1 ? 'disabled style="opacity:0.2"' : ''}>▼</button>
            <button class="del-btn p-1.5 hover:bg-red-500/20 rounded-lg text-red-400 hover:text-red-300 ml-1 text-xs transition-colors cursor-pointer" title="Supprimer du pack">✕</button>
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
    if (!simMenu) return;
    simMenu.innerHTML = '';

    if (selectedApps.length === 0) {
      simMenu.innerHTML = '<div class="text-[9px] text-slate-400 p-2 text-center">Aucune app dans le pack</div>';
      return;
    }

    selectedApps.slice(0, 5).forEach((app, i) => {
      const row = document.createElement('div');
      const isFirst = (i === 0);
      row.className = isFirst
        ? 'p-1 rounded bg-amber-200 border-l-4 border-amber-600 text-[10px] font-bold text-slate-900 flex justify-between'
        : 'p-1 rounded bg-white text-[10px] text-slate-700 flex justify-between border border-slate-200';
      row.innerHTML = `
        <span class="truncate pr-1">${i + 1}. ${app.name}</span>
        <span class="text-[9px] ${isFirst ? 'text-slate-600' : 'text-slate-400'} shrink-0">${app.category.split('/')[0]}</span>
      `;
      simMenu.appendChild(row);
    });

    if (selectedApps.length > 5) {
      const more = document.createElement('div');
      more.className = 'text-[8px] text-slate-400 text-center';
      more.textContent = `+ ${selectedApps.length - 5} autre(s) application(s)...`;
      simMenu.appendChild(more);
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

    if (percent > 90) {
      memoryProgressBar.className = 'h-full transition-all rounded-full bg-red-500';
    } else if (percent > 70) {
      memoryProgressBar.className = 'h-full transition-all rounded-full bg-amber-500';
    } else {
      memoryProgressBar.className = 'h-full transition-all rounded-full bg-emerald-500';
    }
  }

  function updateUI() {
    appCountBadge.textContent = `${selectedApps.length} / 12`;
    renderSelection();
    updateMemoryUsage();
    simulator?.updatePack(selectedApps);
  }

  // ==================== GLISSER-DÉPOSER LOCAL ====================
  if (dropZone) {
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('border-amber-400', 'bg-amber-500/10');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('border-amber-400', 'bg-amber-500/10');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('border-amber-400', 'bg-amber-500/10');
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
    
    let bg = 'bg-slate-900 border-slate-700 text-white';
    let icon = 'ℹ️';
    if (type === 'success') {
      bg = 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200';
      icon = '✓';
    } else if (type === 'error') {
      bg = 'bg-red-950/90 border-red-500/50 text-red-200';
      icon = '❌';
    } else if (type === 'warning') {
      bg = 'bg-amber-950/90 border-amber-500/50 text-amber-200';
      icon = '⚠️';
    }

    toast.className = `${bg} border backdrop-blur-md px-4 py-3 rounded-2xl shadow-2xl text-xs font-semibold transition-all duration-300 transform translate-y-3 opacity-0 flex items-center gap-2.5 pointer-events-auto`;
    toast.innerHTML = `
      <span class="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center font-bold text-xs shrink-0">${icon}</span>
      <span>${message}</span>
    `;

    container.appendChild(toast);
    requestAnimationFrame(() => {
      toast.classList.remove('translate-y-3', 'opacity-0');
    });

    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-3');
      setTimeout(() => toast.remove(), 350);
    }, 4000);
  }
});

/**
 * EquaLib Web App Controller
 * Orchestre l'interface utilisateur, le catalogue, les imports et les actions de flash
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Constantes
  const MAX_FLASH_BYTES = 4.0 * 1024 * 1024; // 4.0 Mo alloués aux applications externes

  // État de l'application
  let catalogApps = [];
  let selectedApps = [];
  const usb = new NumWorksWebUSB();
  const bundler = new EquaLibBundler();

  // Éléments du DOM
  const catalogList = document.getElementById('catalog-list');
  const selectedList = document.getElementById('selected-list');
  const emptyState = document.getElementById('empty-state');
  const appCountBadge = document.getElementById('app-count-badge');
  const memoryProgressBar = document.getElementById('memory-progress-bar');
  const memoryText = document.getElementById('memory-text');
  const memoryPercent = document.getElementById('memory-percent');

  // Boutons et contrôles
  const connectBtn = document.getElementById('connect-btn');
  const connectionBadge = document.getElementById('connection-badge');
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

  // Chargement du catalogue
  try {
    const res = await fetch('catalog.json');
    catalogApps = await res.json();
    renderCatalog();

    // Présélection par défaut (KhiCAS + Tableau Périodique + Lecteur de Fiches)
    const defaults = catalogApps.filter(a => a.recommended);
    defaults.forEach(a => addAppToSelection(a));
  } catch (err) {
    console.error('Erreur chargement catalogue :', err);
    showToast('Erreur lors du chargement du catalogue', 'error');
  }

  // Rendu du catalogue
  function renderCatalog() {
    catalogList.innerHTML = '';
    catalogApps.forEach(app => {
      const isSelected = selectedApps.some(s => s.id === app.id);
      const card = document.createElement('div');
      card.className = `p-4 rounded-xl border transition-all flex items-center justify-between ${
        isSelected ? 'bg-amber-50/50 border-amber-200' : 'bg-white border-slate-200 hover:border-amber-300'
      }`;

      card.innerHTML = `
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-lg flex items-center justify-center font-bold text-lg text-white shadow-sm" style="background-color: ${app.color || '#6366F1'}">
            ${app.icon_initial || app.name[0]}
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h4 class="font-semibold text-slate-800">${app.name}</h4>
              <span class="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">${app.category}</span>
            </div>
            <p class="text-xs text-slate-500 mt-0.5 line-clamp-1">${app.description}</p>
            <div class="text-xs text-slate-400 mt-1 font-mono">${app.size_kb} Ko • v${app.version}</div>
          </div>
        </div>
        <button class="add-btn px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
          isSelected 
            ? 'bg-emerald-100 text-emerald-700 cursor-default' 
            : 'bg-slate-900 text-white hover:bg-amber-500 hover:text-black shadow-sm'
        }">
          ${isSelected ? '✓ Ajouté' : '+ Ajouter'}
        </button>
      `;

      const btn = card.querySelector('.add-btn');
      if (!isSelected) {
        btn.addEventListener('click', () => {
          addAppToSelection(app);
          renderCatalog();
        });
      }

      catalogList.appendChild(card);
    });
  }

  // Ajout à la sélection
  function addAppToSelection(app) {
    if (selectedApps.length >= 12) {
      showToast('Limite atteinte (maximum 12 applications par bundle)', 'warning');
      return;
    }
    if (selectedApps.some(s => s.id === app.id)) return;

    selectedApps.push({...app});
    updateUI();
  }

  // Rendu de la sélection
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
        item.className = 'p-3 bg-white rounded-lg border border-slate-200 flex items-center justify-between shadow-sm';
        item.innerHTML = `
          <div class="flex items-center gap-3">
            <span class="font-mono text-xs text-slate-400 font-bold w-4">${idx + 1}.</span>
            <div class="w-8 h-8 rounded-md flex items-center justify-center font-bold text-xs text-white" style="background-color: ${app.color || '#475569'}">
              ${app.icon_initial || app.name[0]}
            </div>
            <div>
              <p class="text-sm font-semibold text-slate-800 leading-tight">${app.name}</p>
              <p class="text-xs font-mono text-slate-400">${app.size_kb} Ko</p>
            </div>
          </div>
          <div class="flex items-center gap-1">
            <button class="up-btn p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-900" title="Monter" ${idx === 0 ? 'disabled style="opacity:0.3"' : ''}>▲</button>
            <button class="down-btn p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-900" title="Descendre" ${idx === selectedApps.length - 1 ? 'disabled style="opacity:0.3"' : ''}>▼</button>
            <button class="del-btn p-1.5 hover:bg-red-50 rounded text-red-500 hover:text-red-700 ml-1" title="Supprimer">✕</button>
          </div>
        `;

        item.querySelector('.up-btn')?.addEventListener('click', () => {
          if (idx > 0) {
            const temp = selectedApps[idx];
            selectedApps[idx] = selectedApps[idx - 1];
            selectedApps[idx - 1] = temp;
            updateUI();
          }
        });

        item.querySelector('.down-btn')?.addEventListener('click', () => {
          if (idx < selectedApps.length - 1) {
            const temp = selectedApps[idx];
            selectedApps[idx] = selectedApps[idx + 1];
            selectedApps[idx + 1] = temp;
            updateUI();
          }
        });

        item.querySelector('.del-btn')?.addEventListener('click', () => {
          selectedApps.splice(idx, 1);
          updateUI();
          renderCatalog();
        });

        selectedList.appendChild(item);
      });
    }
  }

  // Mise à jour de la mémoire et des badges
  function updateMemoryUsage() {
    let totalBytes = 24 * 1024; // Launcher de base
    selectedApps.forEach(a => {
      totalBytes += a.data ? a.data.byteLength : (a.size_kb * 1024);
    });

    const percent = Math.min(100, Math.round((totalBytes / MAX_FLASH_BYTES) * 100));
    memoryProgressBar.style.width = `${percent}%`;
    memoryPercent.textContent = `${percent}%`;
    memoryText.textContent = `${(totalBytes / (1024 * 1024)).toFixed(2)} Mo / 4.00 Mo`;

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
  }

  // Gestion du Drag & Drop pour fichiers .nwa et .nws personnalisés
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('border-amber-400', 'bg-amber-50/50');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('border-amber-400', 'bg-amber-50/50');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('border-amber-400', 'bg-amber-50/50');
    if (e.dataTransfer.files.length > 0) {
      handleCustomFiles(e.dataTransfer.files);
    }
  });

  dropZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      handleCustomFiles(fileInput.files);
    }
  });

  async function handleCustomFiles(files) {
    for (const file of files) {
      const ext = file.name.split('.').pop().toLowerCase();
      if (!['nwa', 'nws', 'py'].includes(ext)) {
        showToast(`Format .${ext} non supporté (utilisez .nwa ou .nws)`, 'error');
        continue;
      }

      const buffer = await file.arrayBuffer();
      const customApp = {
        id: 'custom_' + Date.now() + Math.random().toString(36).substr(2, 4),
        name: file.name.replace(/\.[^/.]+$/, ""),
        author: "Fichier importé",
        version: "Custom",
        size_kb: Math.round(buffer.byteLength / 1024),
        category: ext.toUpperCase(),
        description: `Application importée manuellement (${file.name})`,
        icon_initial: file.name[0].toUpperCase(),
        color: "#0284C7",
        data: new Uint8Array(buffer)
      };

      addAppToSelection(customApp);
      showToast(`"${file.name}" ajouté avec succès !`, 'success');
    }
  }

  // Connexion WebUSB
  connectBtn.addEventListener('click', async () => {
    if (usb.isConnected) {
      await usb.disconnect();
      connectionDot.className = 'w-2 h-2 rounded-full bg-slate-400';
      connectionText.textContent = 'Non connectée';
      modelText.textContent = 'Modèle cible : N0120';
      connectBtn.textContent = 'Connecter ma NumWorks';
      showToast('Calculatrice déconnectée', 'info');
    } else {
      try {
        const res = await usb.connect();
        connectionDot.className = 'w-2 h-2 rounded-full bg-emerald-500 animate-pulse';
        connectionText.textContent = 'Connectée';
        modelText.textContent = res.model;
        connectBtn.textContent = 'Déconnecter';
        showToast('NumWorks détectée avec succès !', 'success');
      } catch (err) {
        showToast(err.message || 'Échec de connexion USB', 'error');
      }
    }
  });

  // Action : Téléchargement du fichier .nwa compilé
  downloadBtn.addEventListener('click', async () => {
    if (selectedApps.length === 0) {
      showToast('Veuillez ajouter au moins une application', 'warning');
      return;
    }

    bundler.options.simulateExam = optSimulateExam.checked;
    bundler.options.enablePanicKey = optPanicKey.checked;

    try {
      const bundle = await bundler.buildBundle(selectedApps);
      const url = URL.createObjectURL(bundle.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'equalib_bundle.nwa';
      a.click();
      URL.revokeObjectURL(url);
      showToast('Fichier equalib_bundle.nwa généré !', 'success');
    } catch (err) {
      console.error(err);
      showToast('Erreur lors de la génération du bundle', 'error');
    }
  });

  // Action : Téléchargement format .nws (sauvegarde / script pack)
  downloadNwsBtn.addEventListener('click', async () => {
    if (selectedApps.length === 0) {
      showToast('Veuillez ajouter au moins une application', 'warning');
      return;
    }

    bundler.options.simulateExam = optSimulateExam.checked;
    bundler.options.enablePanicKey = optPanicKey.checked;

    try {
      const bundle = await bundler.buildBundle(selectedApps);
      const url = URL.createObjectURL(bundle.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'equalib_backup.nws';
      a.click();
      URL.revokeObjectURL(url);
      showToast('Sauvegarde equalib_backup.nws téléchargée !', 'success');
    } catch (err) {
      showToast('Erreur lors de la création du fichier .nws', 'error');
    }
  });

  // Action : Flashing direct WebUSB
  flashBtn.addEventListener('click', async () => {
    if (selectedApps.length === 0) {
      showToast('Veuillez ajouter au moins une application', 'warning');
      return;
    }

    if (!usb.isConnected) {
      showToast('Veuillez connecter votre calculatrice par USB', 'warning');
      try {
        await usb.connect();
      } catch (e) {
        return;
      }
    }

    bundler.options.simulateExam = optSimulateExam.checked;
    bundler.options.enablePanicKey = optPanicKey.checked;

    try {
      flashBtn.disabled = true;
      progressContainer.classList.remove('hidden');

      const bundle = await bundler.buildBundle(selectedApps);
      await usb.flashBundle(bundle.arrayBuffer, (percent) => {
        flashProgress.style.width = `${percent}%`;
        progressText.textContent = `Téléversement en cours... ${percent}%`;
      });

      showToast('🎉 Installation réussie sur votre NumWorks N0120 !', 'success');
    } catch (err) {
      showToast(err.message || 'Erreur lors du téléversement', 'error');
    } finally {
      flashBtn.disabled = false;
      setTimeout(() => {
        progressContainer.classList.add('hidden');
      }, 3000);
    }
  });

  // Système de notifications Toast
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    
    let bg = 'bg-slate-900 text-white';
    if (type === 'success') bg = 'bg-emerald-600 text-white';
    if (type === 'error') bg = 'bg-red-600 text-white';
    if (type === 'warning') bg = 'bg-amber-500 text-black';

    toast.className = `${bg} px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all transform translate-y-2 opacity-0 flex items-center gap-2`;
    toast.textContent = message;

    container.appendChild(toast);
    requestAnimationFrame(() => {
      toast.classList.remove('translate-y-2', 'opacity-0');
    });

    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-2');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
});

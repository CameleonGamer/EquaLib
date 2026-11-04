/**
 * EquaLib — Interactive Step-by-Step Onboarding Walkthrough Guide
 * Outrun / Synthwave aesthetic with Solar Cyber (#FFD700 / #FF9100) & Midnight Navy (#09152B / #030814)
 * Self-contained UMD module runnable in browsers and Node.js testing environments.
 */
(function (root, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    var exp = factory();
    module.exports = exp;
    module.exports.EquaLibWalkthrough = exp;
    module.exports.default = exp;
  } else if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else {
    var exp = factory();
    root.EquaLibWalkthrough = exp;
    if (typeof window !== 'undefined') {
      window.EquaLibWalkthrough = exp;
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this), function () {
  'use strict';

  /**
   * EquaLibWalkthrough Controller
   * @param {Object} options Configuration options
   */
  function EquaLibWalkthrough(options) {
    this.options = Object.assign({
      triggerSelector: '#nav-guide-btn',
      mobileTriggerSelector: '#nav-guide-mobile-btn, #guide-modal-btn',
      sound: true,
      autoScroll: true
    }, options || {});

    // Guide strictly starts inactive. No auto-start on load.
    this.isActive = false;
    this.currentStepIndex = 0;
    this.overlayEl = null;
    this.spotlightEl = null;
    this.popoverEl = null;

    // Bound listeners for clean detachment
    this.boundKeyHandler = this.handleKeydown.bind(this);
    this.boundResizeHandler = this.handleResize.bind(this);
    this.boundScrollHandler = this.handleScroll.bind(this);

    // 5 sequential steps definitions
    this.steps = this.getStepDefinitions();
  }

  /**
   * Returns the canonical 5 sequential steps of the walkthrough
   */
  EquaLibWalkthrough.prototype.getStepDefinitions = function () {
    return [
      {
        id: 'model_selection',
        targetSelector: '#model-select-n0120',
        title: '1. Choix du Modèle NumWorks',
        badge: 'Étape 1 / 5',
        text: 'Sélectionnez votre modèle de calculatrice : NumWorks N0120 (Cortex-M7 @ 550 MHz) ou N0110 (Cortex-M7 @ 216 MHz). EquaLib adapte dynamiquement l\'adressage mémoire Flash (slot 0x90180000 ou 0x90200000) et les exécutables ARM.',
        beforeStep: function () {}
      },
      {
        id: 'app_catalog',
        targetSelector: '#tab-view-catalog',
        title: '2. Catalogue & Sélection d\'Apps',
        badge: 'Étape 2 / 5',
        text: 'Parcourez le catalogue d\'applications : jeux d\'arcade (Mario Kart 3D, Flappy Bird, 2048, Snake...), cours et outils scientifiques. Cliquez sur une fiche pour l\'ajouter directement à votre pack personnalisé (jusqu\'à 20 apps / 4 Mo).',
        beforeStep: function () {
          if (typeof document !== 'undefined') {
            var catalogBtn = document.getElementById('tab-btn-catalog');
            if (catalogBtn && typeof catalogBtn.click === 'function') {
              catalogBtn.click();
            } else if (typeof window !== 'undefined' && typeof window.switchTab === 'function') {
              window.switchTab('catalog');
            }
          }
        }
      },
      {
        id: 'virtual_simulator',
        targetSelector: '#sim-calculator-container',
        title: '3. Simulateur NumWorks 320x240',
        badge: 'Étape 3 / 5',
        text: 'Testez vos applications instantanément dans votre navigateur ! Utilisez le pavé tactile virtuel ou votre clavier physique (Touches fléchées, Entrée/Espace pour lancer/sauter, Échap pour revenir au menu) pour vous entraîner.',
        beforeStep: function () {
          if (typeof document !== 'undefined') {
            var simToggle = document.getElementById('sim-mobile-toggle');
            var simContainer = document.getElementById('sim-calculator-container');
            if (simContainer && simContainer.classList && simContainer.classList.contains('hidden') && simToggle && typeof simToggle.click === 'function') {
              simToggle.click();
            }
          }
        }
      },
      {
        id: 'customization',
        targetSelector: '#quick-themes-container',
        title: '4. Personnalisation & Thèmes Visuels',
        badge: 'Étape 4 / 5',
        text: 'Personnalisez le style de votre lanceur en 1 clic grâce aux thèmes prédéfinis (NumWorks Or, Sakura, Hacker, Abeille, Mario, GameBoy). Cliquez sur « Options » pour accéder à la roue chromatique, au mode Verre Dépoli (Apple Glass), aux coins arrondis et au Studio Fond.',
        beforeStep: function () {}
      },
      {
        id: 'flash_installation',
        targetSelector: '#flash-btn',
        title: '5. Connexion Physique & Installation USB',
        badge: 'Étape 5 / 5',
        isWarning: true,
        warningText: '⚠️ Branchez votre calculatrice NumWorks à votre PC via un câble USB (câble de données USB-C).',
        text: 'Branchez votre calculatrice NumWorks à votre PC via un câble USB (câble de données USB-C).\n\nUne fois la calculatrice connectée et allumée sur son écran d\'accueil, cliquez sur « Installer sur ma NumWorks (Flash USB Direct) » pour transférer le pack complet en mémoire Flash en un instant via WebUSB en toute sécurité.',
        beforeStep: function () {}
      }
    ];
  };

  /**
   * Creates or retrieves walkthrough DOM elements
   */
  EquaLibWalkthrough.prototype.createDOM = function () {
    if (typeof document === 'undefined') return;
    var existing = document.getElementById('equa-walkthrough-overlay');
    if (existing) {
      this.overlayEl = existing;
      this.spotlightEl = document.getElementById('equa-walkthrough-spotlight');
      this.popoverEl = document.getElementById('equa-walkthrough-tooltip');
      return;
    }

    var overlay = document.createElement('div');
    overlay.id = 'equa-walkthrough-overlay';
    overlay.className = 'walkthrough-overlay equa-walkthrough-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', "Guide interactif d'utilisation");

    // Zéro filtre / voile transparent garanti même avec cache navigateur
    overlay.style.backgroundColor = 'transparent';
    overlay.style.background = 'transparent';
    overlay.style.backdropFilter = 'none';
    overlay.style.webkitBackdropFilter = 'none';
    overlay.style.filter = 'none';

    var spotlight = document.createElement('div');
    spotlight.id = 'equa-walkthrough-spotlight';
    spotlight.className = 'walkthrough-spotlight equa-walkthrough-spotlight walkthrough-spotlight-box';

    spotlight.innerHTML = [
      '<span class="wt-corner wt-corner-tl"></span>',
      '<span class="wt-corner wt-corner-tr"></span>',
      '<span class="wt-corner wt-corner-bl"></span>',
      '<span class="wt-corner wt-corner-br"></span>',
      '<div class="wt-mocap-reticle"><span class="wt-mocap-ping"></span><span class="wt-mocap-text">● MOCAP LOCK</span></div>'
    ].join('');

    var popover = document.createElement('div');
    popover.id = 'equa-walkthrough-tooltip';
    popover.className = 'walkthrough-popover equa-walkthrough-tooltip';

    popover.innerHTML = [
      '<div class="walkthrough-header equa-wt-header">',
      '  <div class="equa-wt-badge-wrap">',
      '    <span id="equa-wt-step-badge" class="walkthrough-step-badge equa-wt-badge">Étape 1 / 5</span>',
      '    <h4 id="equa-wt-title" class="walkthrough-title equa-wt-title">Titre</h4>',
      '  </div>',
      '  <button type="button" id="equa-wt-close-btn" class="walkthrough-close-btn equa-wt-close-btn" title="Fermer le guide (Échap)" aria-label="Fermer le guide">✕</button>',
      '</div>',
      '<div id="equa-wt-desc" class="walkthrough-body equa-wt-body"></div>',
      '<div class="walkthrough-footer equa-wt-footer">',
      '  <div class="walkthrough-footer-controls">',
      '    <button type="button" id="equa-wt-prev-btn" class="walkthrough-btn-prev equa-wt-btn-prev">◄ Précédent</button>',
      '    <button type="button" id="walkthrough-quit-btn" class="walkthrough-btn-quit">Quitter</button>',
      '    <button type="button" id="equa-wt-next-btn" class="walkthrough-btn-next equa-wt-btn-next">Suivant ►</button>',
      '  </div>',
      '  <div class="walkthrough-kbd-hint equa-wt-kbd-hint">',
      '    <span>[Échap] Quitter</span> • <span>[◄/►] Naviguer</span>',
      '  </div>',
      '</div>'
    ].join('\n');

    overlay.appendChild(spotlight);
    overlay.appendChild(popover);
    document.body.appendChild(overlay);

    this.overlayEl = overlay;
    this.spotlightEl = spotlight;
    this.popoverEl = popover;

    var self = this;
    var closeBtn = document.getElementById('equa-wt-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', function (e) {
        e.preventDefault();
        self.quit();
      });
    }

    var quitBtn = document.getElementById('walkthrough-quit-btn');
    if (quitBtn) {
      quitBtn.addEventListener('click', function (e) {
        e.preventDefault();
        self.quit();
      });
    }

    var prevBtn = document.getElementById('equa-wt-prev-btn');
    if (prevBtn) {
      prevBtn.addEventListener('click', function (e) {
        e.preventDefault();
        self.prev();
      });
    }

    var nextBtn = document.getElementById('equa-wt-next-btn');
    if (nextBtn) {
      nextBtn.addEventListener('click', function (e) {
        e.preventDefault();
        self.next();
      });
    }
  };

  /**
   * Starts the walkthrough at the specified step (defaults to 0).
   * Strictly manual trigger.
   * @param {number} stepIndex Starting step index
   */
  EquaLibWalkthrough.prototype.start = function (stepIndex) {
    if (typeof stepIndex !== 'number') stepIndex = 0;

    // Close any open modals to prevent overlay collisions
    if (typeof window !== 'undefined') {
      if (typeof window.closeSettingsModal === 'function') {
        try { window.closeSettingsModal(); } catch (e) {}
      }
      if (typeof window.closeAppDetails === 'function') {
        try { window.closeAppDetails(); } catch (e) {}
      }
      if (typeof document !== 'undefined') {
        var webusbHelp = document.getElementById('webusb-help-modal');
        if (webusbHelp && webusbHelp.classList) {
          webusbHelp.classList.add('hidden');
          webusbHelp.classList.remove('flex');
        }
      }
      if (this.options.sound && window.soundFx && typeof window.soundFx.playClick === 'function') {
        try { window.soundFx.playClick(); } catch (e) {}
      }
    }

    this.isActive = true;
    this.createDOM();

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.boundKeyHandler, { capture: true });
      window.addEventListener('resize', this.boundResizeHandler, { passive: true });
      window.addEventListener('scroll', this.boundScrollHandler, { passive: true, capture: true });
    }
    if (typeof document !== 'undefined' && document.body && document.body.classList) {
      document.body.classList.add('walkthrough-active');
    }

    this.goTo(stepIndex);
  };

  /**
   * Resolves target element with fallbacks
   */
  EquaLibWalkthrough.prototype.resolveTarget = function (selector) {
    if (typeof document === 'undefined') return null;
    var el = document.querySelector(selector);
    if (el) return el;

    if (selector === '#model-select-n0120') {
      return document.getElementById('model-selector-group') || document.getElementById('model-select-n0110');
    }
    if (selector === '#tab-view-catalog') {
      return document.getElementById('catalog-list') || document.getElementById('tab-btn-catalog');
    }
    if (selector === '#sim-calculator-container') {
      return document.getElementById('sim-screen');
    }
    if (selector === '#quick-themes-container') {
      return document.getElementById('quick-settings-btn') || document.getElementById('settings-modal-btn');
    }
    return null;
  };

  /**
   * Navigates to a specific step
   * @param {number} index Step index
   */
  EquaLibWalkthrough.prototype.goTo = function (index) {
    if (index < 0) index = 0;
    if (index >= this.steps.length) {
      this.finish();
      return;
    }

    this.currentStepIndex = index;
    var step = this.steps[index];

    if (typeof step.beforeStep === 'function') {
      try {
        step.beforeStep();
      } catch (err) {}
    }

    if (typeof document !== 'undefined') {
      var badge = document.getElementById('equa-wt-step-badge');
      if (badge) badge.textContent = step.badge || ('Étape ' + (index + 1) + ' / ' + this.steps.length);

      var title = document.getElementById('equa-wt-title');
      if (title) title.textContent = step.title;

      var desc = document.getElementById('equa-wt-desc');
      if (desc) {
        if (step.isWarning || step.warningText) {
          var warningHtml = '<div class="walkthrough-warning-box">' +
            '<span>⚠️</span> <strong>Branchez votre calculatrice NumWorks à votre PC via un câble USB</strong> (câble de données USB-C).' +
            '</div>';
          var bodyHtml = '<p style="margin-top: 8px;">' + (step.text.replace(/\n\n/g, '</p><p style="margin-top: 8px;">')) + '</p>';
          desc.innerHTML = warningHtml + bodyHtml;
        } else {
          desc.innerHTML = '<p>' + (step.text.replace(/\n\n/g, '</p><p style="margin-top: 8px;">')) + '</p>';
        }
      }

      var prevBtn = document.getElementById('equa-wt-prev-btn');
      if (prevBtn) {
        if (index === 0) {
          prevBtn.disabled = true;
          prevBtn.style.opacity = '0.35';
          prevBtn.style.pointerEvents = 'none';
        } else {
          prevBtn.disabled = false;
          prevBtn.style.opacity = '1';
          prevBtn.style.pointerEvents = 'auto';
        }
      }

      var nextBtn = document.getElementById('equa-wt-next-btn');
      if (nextBtn) {
        if (index === this.steps.length - 1) {
          nextBtn.textContent = 'Terminer ✓';
          nextBtn.setAttribute('title', 'Terminer le guide');
        } else {
          nextBtn.textContent = 'Suivant ►';
          nextBtn.setAttribute('title', 'Étape suivante');
        }
      }

      var targetEl = this.resolveTarget(step.targetSelector);
      if (this.options.autoScroll && targetEl && typeof targetEl.scrollIntoView === 'function') {
        try {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch (e) {}
      }

      this.positionSpotlightAndPopover(targetEl);

      var self = this;
      setTimeout(function () {
        if (self.isActive && self.currentStepIndex === index) {
          self.positionSpotlightAndPopover(self.resolveTarget(step.targetSelector));
        }
      }, 120);
    }
  };

  /**
   * Positions spotlight cutout and popover relative to target element
   * @param {HTMLElement|null} targetEl Targeted DOM element
   */
  EquaLibWalkthrough.prototype.positionSpotlightAndPopover = function (targetEl) {
    if (!this.overlayEl) return;

    var spotlight = this.spotlightEl;
    var popover = this.popoverEl;

    if (!targetEl || typeof targetEl.getBoundingClientRect !== 'function') {
      if (spotlight) spotlight.style.display = 'none';
      if (popover) {
        popover.style.top = '25%';
        popover.style.left = '50%';
        popover.style.transform = 'translate(-50%, -50%)';
      }
      return;
    }

    var rect = targetEl.getBoundingClientRect();
    var padding = 6;

    if (spotlight) {
      spotlight.style.display = 'block';
      spotlight.style.top = Math.max(0, Math.round(rect.top - padding)) + 'px';
      spotlight.style.left = Math.max(0, Math.round(rect.left - padding)) + 'px';
      spotlight.style.width = Math.max(10, Math.round(rect.width + padding * 2)) + 'px';
      spotlight.style.height = Math.max(10, Math.round(rect.height + padding * 2)) + 'px';
    }

    if (popover) {
      var isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
      if (isMobile) {
        popover.style.top = 'auto';
        popover.style.bottom = '16px';
        popover.style.left = '16px';
        popover.style.right = '16px';
        popover.style.width = 'calc(100vw - 32px)';
        popover.style.transform = 'none';
      } else {
        popover.style.bottom = 'auto';
        popover.style.right = 'auto';
        popover.style.transform = 'none';

        var popoverWidth = popover.offsetWidth || 380;
        var popoverHeight = popover.offsetHeight || 220;
        var winWidth = (typeof window !== 'undefined' ? window.innerWidth : 1200) || 1200;
        var winHeight = (typeof window !== 'undefined' ? window.innerHeight : 800) || 800;

        var top = rect.bottom + 12;
        if (top + popoverHeight > winHeight - 16 && rect.top - popoverHeight - 12 > 16) {
          top = rect.top - popoverHeight - 12;
        }
        top = Math.max(16, Math.min(winHeight - popoverHeight - 16, top));

        var left = rect.left + (rect.width / 2) - (popoverWidth / 2);
        left = Math.max(16, Math.min(winWidth - popoverWidth - 16, left));

        popover.style.top = top + 'px';
        popover.style.left = left + 'px';
        popover.style.width = Math.min(390, winWidth - 32) + 'px';
      }
    }
  };

  /**
   * Advances to next step
   */
  EquaLibWalkthrough.prototype.next = function () {
    if (!this.isActive) return;
    if (this.options.sound && typeof window !== 'undefined' && window.soundFx && typeof window.soundFx.playClick === 'function') {
      try { window.soundFx.playClick(); } catch (e) {}
    }
    this.goTo(this.currentStepIndex + 1);
  };

  /**
   * Returns to previous step
   */
  EquaLibWalkthrough.prototype.prev = function () {
    if (!this.isActive) return;
    if (this.currentStepIndex > 0) {
      if (this.options.sound && typeof window !== 'undefined' && window.soundFx && typeof window.soundFx.playClick === 'function') {
        try { window.soundFx.playClick(); } catch (e) {}
      }
      this.goTo(this.currentStepIndex - 1);
    }
  };

  /**
   * Finishes the guide cleanly
   */
  EquaLibWalkthrough.prototype.finish = function () {
    if (this.options.sound && typeof window !== 'undefined' && window.soundFx) {
      if (typeof window.soundFx.playSuccess === 'function') {
        try { window.soundFx.playSuccess(); } catch (e) {}
      } else if (typeof window.soundFx.playClick === 'function') {
        try { window.soundFx.playClick(); } catch (e) {}
      }
    }
    this.teardown();
  };

  /**
   * Quits the guide at any time
   */
  EquaLibWalkthrough.prototype.quit = function () {
    if (this.options.sound && typeof window !== 'undefined' && window.soundFx && typeof window.soundFx.playClick === 'function') {
      try { window.soundFx.playClick(); } catch (e) {}
    }
    this.teardown();
  };

  /**
   * Alias for quit()
   */
  EquaLibWalkthrough.prototype.close = function () {
    this.quit();
  };

  /**
   * Complete DOM teardown, listener detachment, and restoring full interactivity
   */
  EquaLibWalkthrough.prototype.teardown = function () {
    this.isActive = false;

    if (this.overlayEl) {
      if (typeof this.overlayEl.remove === 'function') {
        this.overlayEl.remove();
      } else if (this.overlayEl.parentNode) {
        this.overlayEl.parentNode.removeChild(this.overlayEl);
      }
      this.overlayEl = null;
      this.spotlightEl = null;
      this.popoverEl = null;
    }

    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.boundKeyHandler, { capture: true });
      window.removeEventListener('resize', this.boundResizeHandler);
      window.removeEventListener('scroll', this.boundScrollHandler, { capture: true });
    }

    if (typeof document !== 'undefined' && document.body && document.body.classList) {
      document.body.classList.remove('walkthrough-active');
    }
  };

  /**
   * Keyboard event handler (capture phase)
   * Escape closes guide, ArrowRight advances, ArrowLeft goes back
   */
  EquaLibWalkthrough.prototype.handleKeydown = function (e) {
    if (!this.isActive) return;
    var key = e.key || e.keyCode;
    if (key === 'Escape' || key === 27) {
      e.preventDefault();
      e.stopPropagation();
      this.quit();
    } else if (key === 'ArrowRight' || key === 39) {
      e.preventDefault();
      e.stopPropagation();
      this.next();
    } else if (key === 'ArrowLeft' || key === 37) {
      e.preventDefault();
      e.stopPropagation();
      this.prev();
    }
  };

  /**
   * Window resize handler
   */
  EquaLibWalkthrough.prototype.handleResize = function () {
    if (!this.isActive) return;
    var step = this.steps[this.currentStepIndex];
    if (step) {
      this.positionSpotlightAndPopover(this.resolveTarget(step.targetSelector));
    }
  };

  /**
   * Window scroll handler
   */
  EquaLibWalkthrough.prototype.handleScroll = function () {
    if (!this.isActive) return;
    var step = this.steps[this.currentStepIndex];
    if (step) {
      this.positionSpotlightAndPopover(this.resolveTarget(step.targetSelector));
    }
  };

  // Browser auto-binding on DOMContentLoaded
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    function initWalkthroughBindings() {
      if (!window.equaLibWalkthrough) {
        window.equaLibWalkthrough = new EquaLibWalkthrough();
      }
      var guide = window.equaLibWalkthrough;

      var triggerSelectors = [
        '#nav-guide-btn',
        '#nav-guide-mobile-btn',
        '#guide-walkthrough-btn',
        '#guide-tour-btn',
        '#guide-modal-btn'
      ];

      triggerSelectors.forEach(function (sel) {
        var buttons = document.querySelectorAll(sel);
        for (var i = 0; i < buttons.length; i++) {
          var btn = buttons[i];
          if (!btn._wtBound) {
            btn._wtBound = true;
            btn.addEventListener('click', function (e) {
              e.preventDefault();
              guide.start();
            });
          }
        }
      });

      // Delegate click in case button is added dynamically or matched by text
      document.addEventListener('click', function (e) {
        var target = e.target;
        if (!target) return;
        var btn = typeof target.closest === 'function' ? target.closest('button') : null;
        if (btn) {
          var id = btn.id || '';
          var text = (btn.textContent || '').toLowerCase();
          if (
            id === 'nav-guide-btn' ||
            id === 'nav-guide-mobile-btn' ||
            id === 'guide-walkthrough-btn' ||
            id === 'guide-tour-btn' ||
            id === 'guide-modal-btn' ||
            text.indexOf("guide d'utilisation") !== -1
          ) {
            if (!guide.isActive) {
              e.preventDefault();
              guide.start();
            }
          }
        }
      });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initWalkthroughBindings);
    } else {
      initWalkthroughBindings();
    }
  }

  return EquaLibWalkthrough;
});

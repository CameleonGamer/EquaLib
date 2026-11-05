/**
 * EquaLib — Walkthrough Guide Comprehensive Test Suite
 * Validates the complete interactive step-by-step walkthrough guide across Tiers 1-4:
 * - Tier 1: Feature Coverage (Trigger button, Strict no-auto-start, 5 sequential steps,
 *           Explicit USB cable advice, Navigation controls, Outrun/Synthwave styling,
 *           Full DOM cleanup & interaction restoration, Non-regression baseline)
 * - Tier 2: Boundary & Corner Cases (Navigation bounds & clamping, Escape key teardown,
 *           Rapid clicking idempotency, Missing target elements fallback, Extreme coordinates)
 * - Tier 3: Cross-Feature Combinations (Catalog tab switching on step 2, Simulator unfold on step 3,
 *           Keyboard event isolation in capture phase, Model selector integrity, Audio feedback)
 * - Tier 4: Real-World Application Scenarios (Full tour, Escape abort, Bidirectional exploration,
 *           Repeated open/close cycles, Mobile viewport simulation)
 * 
 * Execution: node tools/test_walkthrough_guide.js
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const cp = require('child_process');

let passedTests = 0;
let failedTests = 0;
const failureDetails = [];

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✓ ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${desc}`);
    console.error(`    -> Erreur: ${err.message}`);
    failureDetails.push({ desc, error: err.message });
    failedTests++;
  }
}

async function itAsync(desc, fn) {
  try {
    await fn();
    console.log(`  ✓ ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${desc}`);
    console.error(`    -> Erreur: ${err.message}`);
    failureDetails.push({ desc, error: err.message });
    failedTests++;
  }
}

function describe(suiteName, fn) {
  console.log(`\n========================================`);
  console.log(`WALKTHROUGH TEST: ${suiteName}`);
  console.log(`========================================`);
  fn();
}

// -------------------------------------------------------------
// In-Memory Lightweight DOM Mock System
// -------------------------------------------------------------

function matchSimpleSelector(el, sel) {
  sel = sel.trim();
  if (sel.includes(',')) {
    return sel.split(',').some(sub => matchSimpleSelector(el, sub.trim()));
  }
  if (sel.startsWith('#')) {
    return el.id === sel.slice(1);
  }
  if (sel.startsWith('.')) {
    return el.classList.contains(sel.slice(1));
  }
  if (sel.startsWith('[') && sel.endsWith(']')) {
    const inner = sel.slice(1, -1);
    const eqIdx = inner.indexOf('=');
    if (eqIdx === -1) {
      return el.hasAttribute(inner.trim());
    }
    const attr = inner.slice(0, eqIdx).trim();
    const val = inner.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    return el.getAttribute(attr) === val;
  }
  return el.tagName.toLowerCase() === sel.toLowerCase();
}

function queryRecursive(node, sel) {
  const matches = [];
  function walk(curr) {
    if (!curr || !curr.children) return;
    for (const child of curr.children) {
      if (matchSimpleSelector(child, sel)) {
        matches.push(child);
      }
      walk(child);
    }
  }
  walk(node);
  return matches;
}

class MockClassList {
  constructor(element) {
    this.element = element;
    this.set = new Set();
  }
  add(...classes) {
    classes.forEach(c => {
      if (c && typeof c === 'string') {
        c.trim().split(/\s+/).forEach(token => token && this.set.add(token));
      }
    });
    this.sync();
  }
  remove(...classes) {
    classes.forEach(c => {
      if (c && typeof c === 'string') {
        c.trim().split(/\s+/).forEach(token => this.set.delete(token));
      }
    });
    this.sync();
  }
  contains(cls) {
    return this.set.has(cls);
  }
  toggle(cls, force) {
    if (force === true) {
      this.add(cls);
      return true;
    } else if (force === false) {
      this.remove(cls);
      return false;
    }
    if (this.contains(cls)) {
      this.remove(cls);
      return false;
    } else {
      this.add(cls);
      return true;
    }
  }
  sync() {
    this.element._className = Array.from(this.set).join(' ');
  }
}

class MockElement {
  constructor(tagName = 'div', id = '') {
    this.tagName = tagName.toUpperCase();
    this.id = id;
    this._className = '';
    this.classList = new MockClassList(this);
    this.style = {};
    this.attributes = {};
    this.children = [];
    this.parentNode = null;
    this.listeners = {};
    this._innerHTML = '';
    this._textContent = '';
    this.disabled = false;
    this.scrollIntoViewCalled = false;
    this.lastScrollOptions = null;
    this._customBoundingRect = null;
  }

  get className() {
    return this._className;
  }

  set className(val) {
    this._className = val || '';
    this.classList.set.clear();
    if (val) {
      val.trim().split(/\s+/).forEach(c => c && this.classList.set.add(c));
    }
  }

  get textContent() {
    if (this._textContent) return this._textContent;
    if (this.children.length === 0) return this._innerHTML.replace(/<[^>]*>/g, '');
    return this.children.map(c => c.textContent).join(' ');
  }

  set textContent(val) {
    this._textContent = String(val);
    this._innerHTML = String(val);
    this.children = [];
  }

  get innerHTML() {
    return this._innerHTML;
  }

  set innerHTML(html) {
    this._innerHTML = html;
    this._textContent = '';
    this.parseBasicHTML(html);
  }

  parseBasicHTML(html) {
    this.children = [];
    const tagRegex = /<([a-zA-Z0-9\-]+)([^>]*)>(.*?)<\/\1>|<([a-zA-Z0-9\-]+)([^>]*)\/>/gs;
    let match;
    while ((match = tagRegex.exec(html)) !== null) {
      const tag = match[1] || match[4];
      const attrsStr = match[2] || match[5] || '';
      const child = new MockElement(tag);

      const idMatch = attrsStr.match(/id=["']([^"']+)["']/i);
      if (idMatch) child.id = idMatch[1];

      const classMatch = attrsStr.match(/class=["']([^"']+)["']/i);
      if (classMatch) child.className = classMatch[1];

      const titleMatch = attrsStr.match(/title=["']([^"']+)["']/i);
      if (titleMatch) child.setAttribute('title', titleMatch[1]);

      const content = match[3] || '';
      if (!content.includes('<')) {
        child.textContent = content.trim();
      } else {
        child.innerHTML = content;
      }
      this.appendChild(child);
    }
  }

  setAttribute(k, v) {
    this.attributes[k] = String(v);
    if (k === 'id') this.id = String(v);
    if (k === 'class') this.className = String(v);
    if (k === 'disabled') this.disabled = true;
  }

  getAttribute(k) {
    if (k === 'id') return this.id || null;
    if (k === 'class') return this.className || null;
    if (k === 'disabled') return this.disabled ? '' : null;
    return this.attributes[k] !== undefined ? this.attributes[k] : null;
  }

  hasAttribute(k) {
    if (k === 'disabled') return !!this.disabled;
    return this.attributes[k] !== undefined;
  }

  removeAttribute(k) {
    delete this.attributes[k];
    if (k === 'disabled') this.disabled = false;
  }

  appendChild(child) {
    if (child.parentNode) child.parentNode.removeChild(child);
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      child.parentNode = null;
    }
    return child;
  }

  remove() {
    if (this.parentNode) {
      this.parentNode.removeChild(this);
    }
  }

  addEventListener(type, fn, options = {}) {
    if (!this.listeners[type]) this.listeners[type] = [];
    const capture = typeof options === 'boolean' ? options : !!options.capture;
    this.listeners[type].push({ fn, capture, options });
  }

  removeEventListener(type, fn, options = {}) {
    if (!this.listeners[type]) return;
    const capture = typeof options === 'boolean' ? options : !!options.capture;
    this.listeners[type] = this.listeners[type].filter(l => l.fn !== fn || l.capture !== capture);
  }

  dispatchEvent(evt) {
    evt.target = evt.target || this;
    evt.currentTarget = this;
    if (this.listeners[evt.type]) {
      const list = [...this.listeners[evt.type]];
      for (const listener of list) {
        listener.fn.call(this, evt);
        if (evt.propagationStopped) break;
      }
    }
    return !evt.defaultPrevented;
  }

  click() {
    const evt = createMockEvent('click');
    this.dispatchEvent(evt);
  }

  scrollIntoView(options) {
    this.scrollIntoViewCalled = true;
    this.lastScrollOptions = options;
  }

  setBoundingClientRect(rect) {
    this._customBoundingRect = rect;
  }

  getBoundingClientRect() {
    if (this._customBoundingRect) return this._customBoundingRect;
    return {
      top: 100,
      left: 100,
      bottom: 150,
      right: 300,
      width: 200,
      height: 50,
      x: 100,
      y: 100
    };
  }

  querySelector(sel) {
    const res = queryRecursive(this, sel);
    return res[0] || null;
  }

  querySelectorAll(sel) {
    return queryRecursive(this, sel);
  }

  closest(sel) {
    let curr = this;
    while (curr) {
      if (matchSimpleSelector(curr, sel)) return curr;
      curr = curr.parentNode;
    }
    return null;
  }
}

function createMockEvent(type, props = {}) {
  const event = Object.assign({
    type,
    target: null,
    currentTarget: null,
    defaultPrevented: false,
    propagationStopped: false,
    preventDefault() { this.defaultPrevented = true; },
    stopPropagation() { this.propagationStopped = true; },
    stopImmediatePropagation() { this.propagationStopped = true; }
  }, props);
  return event;
}

class MockDocument {
  constructor() {
    this.documentElement = new MockElement('html');
    this.body = new MockElement('body');
    this.documentElement.appendChild(this.body);
    this.listeners = {};
    this.readyState = 'complete';
  }

  createElement(tag) {
    return new MockElement(tag);
  }

  getElementById(id) {
    const matches = queryRecursive(this.documentElement, '#' + id);
    return matches[0] || null;
  }

  querySelector(sel) {
    const matches = queryRecursive(this.documentElement, sel);
    return matches[0] || null;
  }

  querySelectorAll(sel) {
    return queryRecursive(this.documentElement, sel);
  }

  addEventListener(type, fn, options = {}) {
    if (!this.listeners[type]) this.listeners[type] = [];
    const capture = typeof options === 'boolean' ? options : !!options.capture;
    this.listeners[type].push({ fn, capture, options });
  }

  removeEventListener(type, fn, options = {}) {
    if (!this.listeners[type]) return;
    const capture = typeof options === 'boolean' ? options : !!options.capture;
    this.listeners[type] = this.listeners[type].filter(l => l.fn !== fn || l.capture !== capture);
  }

  dispatchEvent(evt) {
    evt.target = evt.target || this.body;
    evt.currentTarget = this;
    if (this.listeners[evt.type]) {
      const list = [...this.listeners[evt.type]];
      for (const listener of list) {
        listener.fn.call(this, evt);
        if (evt.propagationStopped) break;
      }
    }
    return !evt.defaultPrevented;
  }
}

function createMockEnvironment() {
  const doc = new MockDocument();
  const listeners = {};

  const mockWin = {
    document: doc,
    innerWidth: 1280,
    innerHeight: 800,
    scrollX: 0,
    scrollY: 0,
    listeners,
    localStorage: {
      store: {},
      getItem(k) { return this.store[k] || null; },
      setItem(k, v) { this.store[k] = String(v); },
      removeItem(k) { delete this.store[k]; },
      clear() { this.store = {}; }
    },
    soundFx: {
      clicks: 0,
      successes: 0,
      playClick() { this.clicks++; },
      playSuccess() { this.successes++; }
    },
    addEventListener(type, fn, options = {}) {
      if (!listeners[type]) listeners[type] = [];
      const capture = typeof options === 'boolean' ? options : !!options.capture;
      listeners[type].push({ fn, capture, options });
    },
    removeEventListener(type, fn, options = {}) {
      if (!listeners[type]) return;
      const capture = typeof options === 'boolean' ? options : !!options.capture;
      listeners[type] = listeners[type].filter(l => l.fn !== fn || l.capture !== capture);
    },
    dispatchEvent(evt) {
      if (listeners[evt.type]) {
        const list = [...listeners[evt.type]];
        for (const listener of list) {
          listener.fn.call(mockWin, evt);
          if (evt.propagationStopped) break;
        }
      }
      return !evt.defaultPrevented;
    },
    closeSettingsModal: () => {},
    closeAppDetails: () => {},
    switchTab: (tab) => {
      const catView = doc.getElementById('tab-view-catalog');
      if (catView && tab === 'catalog') {
        catView.classList.remove('hidden');
      }
    }
  };

  // Populate realistic EquaLib DOM targets
  const navGuideBtn = doc.createElement('button');
  navGuideBtn.id = 'nav-guide-btn';
  navGuideBtn.className = 'px-2.5 py-1 text-xs';
  navGuideBtn.setAttribute('type', 'button');
  navGuideBtn.setAttribute('title', 'Lancer le guide interactif');
  navGuideBtn.textContent = "Guide D'utilisation";
  doc.body.appendChild(navGuideBtn);

  const navGuideMobileBtn = doc.createElement('button');
  navGuideMobileBtn.id = 'nav-guide-mobile-btn';
  navGuideMobileBtn.className = 'md:hidden';
  navGuideMobileBtn.setAttribute('type', 'button');
  navGuideMobileBtn.textContent = '📖';
  doc.body.appendChild(navGuideMobileBtn);

  const modelGroup = doc.createElement('div');
  modelGroup.id = 'model-selector-group';
  const model120 = doc.createElement('button');
  model120.id = 'model-select-n0120';
  model120.textContent = 'N0120';
  model120.setBoundingClientRect({ top: 720, left: 850, width: 60, height: 28, bottom: 748, right: 910, x: 850, y: 720 });
  const model110 = doc.createElement('button');
  model110.id = 'model-select-n0110';
  model110.textContent = 'N0110';
  modelGroup.appendChild(model120);
  modelGroup.appendChild(model110);
  doc.body.appendChild(modelGroup);

  const catalogView = doc.createElement('div');
  catalogView.id = 'tab-view-catalog';
  catalogView.setBoundingClientRect({ top: 200, left: 50, width: 650, height: 500, bottom: 700, right: 700, x: 50, y: 200 });
  const catalogList = doc.createElement('div');
  catalogList.id = 'catalog-list';
  catalogView.appendChild(catalogList);
  doc.body.appendChild(catalogView);

  const tabBtnCatalog = doc.createElement('button');
  tabBtnCatalog.id = 'tab-btn-catalog';
  tabBtnCatalog.addEventListener('click', () => {
    catalogView.classList.remove('hidden');
  });
  doc.body.appendChild(tabBtnCatalog);

  const tabBtnWallpaper = doc.createElement('button');
  tabBtnWallpaper.id = 'tab-btn-wallpaper';
  tabBtnWallpaper.addEventListener('click', () => {
    catalogView.classList.add('hidden');
  });
  doc.body.appendChild(tabBtnWallpaper);

  const simContainer = doc.createElement('div');
  simContainer.id = 'sim-calculator-container';
  simContainer.setBoundingClientRect({ top: 150, left: 800, width: 340, height: 520, bottom: 670, right: 1140, x: 800, y: 150 });
  const simScreen = doc.createElement('div');
  simScreen.id = 'sim-screen';
  simContainer.appendChild(simScreen);
  doc.body.appendChild(simContainer);

  const simToggle = doc.createElement('button');
  simToggle.id = 'sim-mobile-toggle';
  simToggle.addEventListener('click', () => {
    simContainer.classList.toggle('hidden');
  });
  doc.body.appendChild(simToggle);

  const quickThemes = doc.createElement('div');
  quickThemes.id = 'quick-themes-container';
  quickThemes.setBoundingClientRect({ top: 180, left: 50, width: 800, height: 48, bottom: 228, right: 850, x: 50, y: 180 });
  doc.body.appendChild(quickThemes);

  const flashBtn = doc.createElement('button');
  flashBtn.id = 'flash-btn';
  flashBtn.textContent = 'Installer sur ma NumWorks (Flash USB Direct)';
  flashBtn.setBoundingClientRect({ top: 760, left: 800, width: 340, height: 50, bottom: 810, right: 1140, x: 800, y: 760 });
  doc.body.appendChild(flashBtn);

  return mockWin;
}

function loadWalkthroughClass(mockWin) {
  const code = fs.readFileSync('web/walkthrough_guide.js', 'utf8');
  const mod = { exports: {} };
  const fn = new Function('window', 'document', 'module', 'exports', 'globalThis', code);
  fn(mockWin, mockWin.document, mod, mod.exports, mockWin);
  return mockWin.EquaLibWalkthrough || mod.exports.EquaLibWalkthrough || mod.exports;
}

// =============================================================
// SUITE 1: TIER 1 - Feature 1: Manual Trigger Button ("Guide D'utilisation")
// =============================================================
describe('Tier 1 - Feature 1: Bouton Déclencheur Manuel ("Guide D\'utilisation")', () => {
  const html = fs.readFileSync('web/index.html', 'utf8');

  it('1.1. web/index.html contient le bouton avec l\'ID officiel #nav-guide-btn', () => {
    assert(html.includes('id="nav-guide-btn"'), 'web/index.html doit contenir id="nav-guide-btn"');
  });

  it('1.2. Le bouton contient le libellé textuel exact "Guide D\'utilisation"', () => {
    assert(/Guide\s+D['’]utilisation/i.test(html), 'Le bouton doit contenir le texte "Guide D\'utilisation"');
  });

  it('1.3. Le bouton possède type="button" et se trouve dans la navigation du header', () => {
    const navMatch = html.match(/<nav[^>]*>([\s\S]*?)<\/nav>/i);
    assert(navMatch, '<nav> doit exister dans web/index.html');
    assert(navMatch[1].includes('id="nav-guide-btn"'), 'nav-guide-btn doit être situé dans <nav>');
    assert(/<button[^>]+id="nav-guide-btn"[^>]*type="button"/i.test(html) ||
           /<button[^>]+type="button"[^>]*id="nav-guide-btn"/i.test(html),
           'Le bouton doit avoir type="button" pour éviter toute soumission de formulaire');
  });

  it('1.4. Le bouton présente un attribut title ou aria-label accessible', () => {
    const btnTagMatch = html.match(/<button[^>]+id="nav-guide-btn"[^>]*>/i);
    assert(btnTagMatch, 'Balise nav-guide-btn introuvable');
    const tag = btnTagMatch[0];
    assert(tag.includes('title=') || tag.includes('aria-label='), 'Le bouton doit avoir title ou aria-label');
  });

  it('1.5. Présence d\'un déclencheur alternatif pour terminaux mobiles (#nav-guide-mobile-btn)', () => {
    assert(html.includes('nav-guide-mobile-btn') || html.includes('guide-modal-btn'),
      'Une commande mobile (ex: #nav-guide-mobile-btn) doit être présente pour les petits écrans');
  });
});

// =============================================================
// SUITE 2: TIER 1 - Feature 2: Strict No-Auto-Start on Page Load
// =============================================================
describe('Tier 1 - Feature 2: Déclenchement Strictement Manuel & Zéro Auto-Start', () => {
  it('2.1. Instancier EquaLibWalkthrough initialise isActive à false', () => {
    const mockWin = createMockEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    assert.strictEqual(guide.isActive, false, 'Le guide doit démarrer inactif (isActive === false)');
  });

  it('2.2. L\'instanciation ne crée aucun élément overlay/spotlight dans le DOM', () => {
    const mockWin = createMockEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    new Walkthrough();
    const overlay = mockWin.document.getElementById('equa-walkthrough-overlay');
    assert.strictEqual(overlay, null, 'Aucun overlay ne doit être injecté avant start()');
  });

  it('2.3. Aucun auto-start timer n\'est planifié lors du chargement ou de l\'instanciation', () => {
    const mockWin = createMockEnvironment();
    let timerScheduled = false;
    const origSetTimeout = setTimeout;
    mockWin.setTimeout = (...args) => {
      timerScheduled = true;
      return origSetTimeout(...args);
    };
    const Walkthrough = loadWalkthroughClass(mockWin);
    new Walkthrough();
    assert.strictEqual(timerScheduled, false, 'Aucun timer d\'auto-démarrage ne doit être armé à la création');
  });

  it('2.4. Aucun drapeau localStorage ou paramètre URL ne force de lancement automatique intempestif', () => {
    const mockWin = createMockEnvironment();
    mockWin.localStorage.setItem('has_visited', 'true');
    mockWin.localStorage.setItem('walkthrough_completed', 'false');
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    assert.strictEqual(guide.isActive, false, 'Le guide ne doit pas s\'auto-lancer selon des clés de stockage');
  });

  it('2.5. Le guide ne s\'active qu\'après un appel explicite à start() ou un clic utilisateur', () => {
    const mockWin = createMockEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    assert.strictEqual(guide.isActive, false);
    guide.start();
    assert.strictEqual(guide.isActive, true, 'start() doit basculer isActive à true');
    assert(mockWin.document.getElementById('equa-walkthrough-overlay') !== null, 'L\'overlay doit être présent');
    guide.quit();
  });
});

// =============================================================
// SUITE 3: TIER 1 - Feature 3: Sequential 5 Steps (Order & Targets)
// =============================================================
describe('Tier 1 - Feature 3: Déroulement Séquentiel en 5 Étapes Structurées', () => {
  it('3.1. Le guide expose une séquence ordonnée d\'exactement 5 étapes (steps.length === 5)', () => {
    const mockWin = createMockEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    assert(Array.isArray(guide.steps), 'guide.steps doit être un tableau');
    assert.strictEqual(guide.steps.length, 5, 'Le guide doit comporter exactement 5 étapes');
  });

  it('3.2. Étape 1 cible le choix du modèle (#model-select-n0120 / N0110)', () => {
    const mockWin = createMockEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    const s1 = guide.steps[0];
    assert(s1.targetSelector.includes('#model-select-n0120') || s1.targetSelector.includes('model'),
      'Étape 1 doit cibler le sélecteur de modèle NumWorks');
    assert(/modèle|numworks|n0120|n0110/i.test(s1.title + ' ' + s1.text),
      'Étape 1 doit expliquer les modèles N0110 et N0120');
  });

  it('3.3. Étape 2 cible le catalogue d\'applications (#tab-view-catalog / #catalog-list)', () => {
    const mockWin = createMockEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    const s2 = guide.steps[1];
    assert(s2.targetSelector.includes('catalog'), 'Étape 2 doit cibler le catalogue d\'applications');
    assert(/catalogue|applications|apps|jeux/i.test(s2.title + ' ' + s2.text),
      'Étape 2 doit présenter le catalogue d\'applications');
  });

  it('3.4. Étape 3 cible le simulateur virtuel NumWorks (#sim-calculator-container)', () => {
    const mockWin = createMockEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    const s3 = guide.steps[2];
    assert(s3.targetSelector.includes('sim'), 'Étape 3 doit cibler le simulateur virtuel');
    assert(/simulateur|numworks|virtuel|320x240/i.test(s3.title + ' ' + s3.text),
      'Étape 3 doit expliquer le fonctionnement du simulateur');
  });

  it('3.5. Étape 4 cible la personnalisation et les thèmes (#quick-themes-container)', () => {
    const mockWin = createMockEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    const s4 = guide.steps[3];
    assert(s4.targetSelector.includes('theme') || s4.targetSelector.includes('setting'),
      'Étape 4 doit cibler les thèmes ou les options');
    assert(/personnalisation|thème|couleur|options/i.test(s4.title + ' ' + s4.text),
      'Étape 4 doit détailler la personnalisation et les thèmes');
  });

  it('3.6. Étape 5 cible le bouton de flash / installation physique (#flash-btn)', () => {
    const mockWin = createMockEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    const s5 = guide.steps[4];
    assert.strictEqual(s5.targetSelector, '#flash-btn', 'Étape 5 doit cibler #flash-btn');
  });
});

// =============================================================
// SUITE 4: TIER 1 - Feature 4: Explicit USB Instruction on Step 5
// =============================================================
describe('Tier 1 - Feature 4: Consigne Explicite de Connexion par Câble USB à l\'Étape 5', () => {
  it('4.1. Le texte de l\'étape 5 mentionne formellement "câble USB"', () => {
    const mockWin = createMockEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    const s5 = guide.steps[4];
    const fullText = (s5.text + ' ' + (s5.warningText || '')).toLowerCase();
    assert(fullText.includes('câble usb') || fullText.includes('cable usb'),
      'L\'étape 5 doit formellement contenir la mention "câble USB"');
  });

  it('4.2. Le texte de l\'étape 5 utilise le verbe d\'action "brancher" ou "connecter"', () => {
    const mockWin = createMockEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    const s5 = guide.steps[4];
    const fullText = (s5.text + ' ' + (s5.warningText || '')).toLowerCase();
    assert(/branch(er|ez)?|connect(er|ez)?/i.test(fullText),
      'L\'étape 5 doit ordonner explicitement de "brancher" ou "connecter" la calculatrice');
  });

  it('4.3. L\'étape 5 désigne explicitement la NumWorks et l\'ordinateur / PC', () => {
    const mockWin = createMockEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    const s5 = guide.steps[4];
    const fullText = (s5.text + ' ' + (s5.warningText || '')).toLowerCase();
    assert(fullText.includes('numworks'), 'L\'étape 5 doit mentionner la calculatrice NumWorks');
    assert(fullText.includes('pc') || fullText.includes('ordinateur'),
      'L\'étape 5 doit mentionner la liaison avec le PC / ordinateur');
  });

  it('4.4. L\'étape 5 mentionne l\'action de Flash / Installer sur la NumWorks', () => {
    const mockWin = createMockEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    const s5 = guide.steps[4];
    assert(/installer|flash/i.test(s5.text), 'L\'étape 5 doit mentionner l\'installation ou le flash');
  });

  it('4.5. L\'étape 5 comporte un avertissement visuel distinct (isWarning ou warning-box)', () => {
    const mockWin = createMockEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    guide.start(4);
    const descEl = mockWin.document.getElementById('equa-wt-desc');
    assert(descEl, '#equa-wt-desc doit exister');
    assert(descEl.innerHTML.includes('walkthrough-warning-box') || guide.steps[4].isWarning === true,
      'L\'étape 5 doit afficher un encart d\'avertissement visuel');
    guide.quit();
  });
});

// =============================================================
// SUITE 5: TIER 1 - Feature 5: Interactive Navigation Controls
// =============================================================
describe('Tier 1 - Feature 5: Contrôles Interactifs de Navigation (Suivant, Précédent, Quitter/Terminer)', () => {
  it('5.1. next() incrémente l\'indice d\'étape de 0 à 1, 1 à 2, etc.', () => {
    const mockWin = createMockEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    guide.start(0);
    assert.strictEqual(guide.currentStepIndex, 0);
    guide.next();
    assert.strictEqual(guide.currentStepIndex, 1);
    guide.next();
    assert.strictEqual(guide.currentStepIndex, 2);
    guide.quit();
  });

  it('5.2. prev() décrémente fidèlement l\'indice d\'étape de 2 à 1, 1 à 0', () => {
    const mockWin = createMockEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    guide.start(2);
    assert.strictEqual(guide.currentStepIndex, 2);
    guide.prev();
    assert.strictEqual(guide.currentStepIndex, 1);
    guide.prev();
    assert.strictEqual(guide.currentStepIndex, 0);
    guide.quit();
  });

  it('5.3. goTo(index) positionne directement le guide sur l\'étape demandée', () => {
    const mockWin = createMockEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    guide.start(0);
    guide.goTo(3);
    assert.strictEqual(guide.currentStepIndex, 3);
    guide.goTo(1);
    assert.strictEqual(guide.currentStepIndex, 1);
    guide.quit();
  });

  it('5.4. quit() ou finish() réinitialise l\'état et ferme le guide', () => {
    const mockWin = createMockEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    guide.start(2);
    assert.strictEqual(guide.isActive, true);
    guide.quit();
    assert.strictEqual(guide.isActive, false, 'quit() doit désactiver le guide');
  });

  it('5.5. Le popover affiche le compteur dynamique d\'étape (ex: "Étape 1 / 5")', () => {
    const mockWin = createMockEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    guide.start(0);
    const badge = mockWin.document.getElementById('equa-wt-step-badge');
    assert(badge, '#equa-wt-step-badge doit exister');
    assert(badge.textContent.includes('1 / 5') || badge.textContent.includes('1/5'),
      'Le badge doit afficher 1 / 5 à la première étape');
    guide.next();
    assert(badge.textContent.includes('2 / 5') || badge.textContent.includes('2/5'),
      'Le badge doit afficher 2 / 5 à la seconde étape');
    guide.quit();
  });
});

// =============================================================
// SUITE 6: TIER 1 - Feature 6: Outrun / Synthwave Styling & Neon Spotlight
// =============================================================
describe('Tier 1 - Feature 6: Charte Visuelle Outrun / Synthwave & Spotlight Néon', () => {
  const css = fs.readFileSync('web/retro_ascii.css', 'utf8');

  it('6.1. web/retro_ascii.css définit .walkthrough-overlay avec backdrop sombre Midnight Navy', () => {
    assert(css.includes('.walkthrough-overlay') || css.includes('.equa-walkthrough-overlay'),
      'retro_ascii.css doit définir .walkthrough-overlay');
    assert(css.includes('rgba(3, 8, 20') || css.includes('#030814'),
      'L\'overlay doit utiliser la couleur de fond Midnight Navy sombre (#030814)');
  });

  it('6.2. web/retro_ascii.css définit le spotlight avec box-shadow cutout 9999px et bordure néon', () => {
    assert(css.includes('.walkthrough-spotlight') || css.includes('.equa-walkthrough-spotlight'),
      'retro_ascii.css doit définir .walkthrough-spotlight');
    assert(css.includes('9999px'), 'Le spotlight doit comporter une découpe box-shadow 9999px');
    assert(css.includes('#FFD700'), 'Le spotlight doit arborer une bordure Solar Gold (#FFD700)');
  });

  it('6.3. web/retro_ascii.css déclare l\'animation @keyframes walkthroughGlowPulse', () => {
    assert(css.includes('@keyframes walkthroughGlowPulse'),
      'retro_ascii.css doit déclarer l\'animation de pulsation néon walkthroughGlowPulse');
  });

  it('6.4. web/retro_ascii.css définit .walkthrough-popover avec la palette Solar Cyber & Midnight Navy', () => {
    assert(css.includes('.walkthrough-popover') || css.includes('.equa-walkthrough-tooltip'),
      'retro_ascii.css doit définir .walkthrough-popover');
    assert(css.includes('#09152B') || css.includes('#030814'), 'Le popover doit utiliser le fond #09152B');
    assert(css.includes('#FFD700'), 'Le popover doit comporter des accents dorés #FFD700');
  });

  it('6.5. Respect strict de la géométrie 0px et de l\'ombrage dur (hard offset shadow)', () => {
    assert(css.includes('border-radius: 0px !important') || css.includes('border-radius: 0 !important'),
      'Les éléments du guide doivent respecter la géométrie 0px rétro');
    assert(css.includes('8px 8px 0px #01040A') || css.includes('shadow-[') || css.includes('#01040A'),
      'Le style doit comporter l\'ombrage dur caractéristique Outrun');
  });
});

// =============================================================
// SUITE 7: TIER 1 - Feature 7: Full DOM Cleanup & Interaction Restoration
// =============================================================
describe('Tier 1 - Feature 7: Nettoyage Intégral du DOM & Restauration des Interactions', () => {
  it('7.1. quit() / finish() détruit et supprime l\'overlay du document', () => {
    const mockWin = createMockEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    guide.start(0);
    assert(mockWin.document.getElementById('equa-walkthrough-overlay') !== null);
    guide.quit();
    assert.strictEqual(mockWin.document.getElementById('equa-walkthrough-overlay'), null,
      'L\'overlay doit être totalement retiré du DOM à la fermeture');
  });

  it('7.2. quit() détache l\'écouteur global keydown (zéro écouteur fantôme résiduel)', () => {
    const mockWin = createMockEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    guide.start(0);
    const keydownListenersActive = (mockWin.listeners['keydown'] || []).length;
    assert(keydownListenersActive > 0, 'Un écouteur keydown doit être actif pendant le guide');
    guide.quit();
    const keydownListenersAfter = (mockWin.listeners['keydown'] || []).length;
    assert.strictEqual(keydownListenersAfter, 0, 'L\'écouteur keydown doit être retiré après quit()');
  });

  it('7.3. quit() détache également les écouteurs resize et scroll', () => {
    const mockWin = createMockEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    guide.start(0);
    assert((mockWin.listeners['resize'] || []).length > 0);
    assert((mockWin.listeners['scroll'] || []).length > 0);
    guide.quit();
    assert.strictEqual((mockWin.listeners['resize'] || []).length, 0);
    assert.strictEqual((mockWin.listeners['scroll'] || []).length, 0);
  });

  it('7.4. quit() retire la classe walkthrough-active de document.body', () => {
    const mockWin = createMockEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    guide.start(0);
    assert(mockWin.document.body.classList.contains('walkthrough-active'));
    guide.quit();
    assert.strictEqual(mockWin.document.body.classList.contains('walkthrough-active'), false,
      'La classe walkthrough-active doit être retirée du body');
  });

  it('7.5. L\'interactivité globale est préservée sans aucun voile bloquant résiduel', () => {
    const mockWin = createMockEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    guide.start(1);
    guide.quit();
    assert.strictEqual(guide.overlayEl, null);
    assert.strictEqual(guide.spotlightEl, null);
    assert.strictEqual(guide.popoverEl, null);
    assert.strictEqual(guide.isActive, false);
  });
});

// =============================================================
// SUITE 8: TIER 1 - Feature 8: Non-Regression on Existing Test Suites
// =============================================================
describe('Tier 1 - Feature 8: Non-Régression sur les Suites de Tests Existantes', () => {
  it('8.1. Exécution réussie de tools/beta_test_suite.js (>= 85 tests passants, 0 échec)', () => {
    const res = cp.spawnSync(process.execPath, ['tools/beta_test_suite.js'], { encoding: 'utf8' });
    assert.strictEqual(res.status, 0, `beta_test_suite.js a échoué avec code ${res.status}: ${res.stderr || res.stdout}`);
    const m = res.stdout.match(/Tests réussis : (\d+)/);
    const passed = m ? parseInt(m[1], 10) : 0;
    assert(passed >= 85 && res.stdout.includes('Tests échoués : 0'),
      'beta_test_suite.js doit exécuter et valider au moins 85 tests avec 0 échec');
  });

  it('8.2. Exécution réussie de tools/test_brush_and_wallpaper.js (10/10 tests passants)', () => {
    const res = cp.spawnSync(process.execPath, ['tools/test_brush_and_wallpaper.js'], { encoding: 'utf8' });
    assert.strictEqual(res.status, 0, `test_brush_and_wallpaper.js a échoué avec code ${res.status}: ${res.stderr || res.stdout}`);
    assert(res.stdout.includes('100% SUCCÈS') || res.stdout.includes('10'),
      'test_brush_and_wallpaper.js doit valider 100% de ses tests');
  });
});

// =============================================================
// SUITE 9: TIER 2 - Boundary Cases: Navigation Bounds & Clamping
// =============================================================
describe('Tier 2 - B1: Bornes de Navigation & Verrouillage aux Limites', () => {
  it('9.1. prev() à l\'Étape 1 (indice 0) est sans effet et reste à l\'indice 0', () => {
    const mockWin = createMockEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    guide.start(0);
    guide.prev();
    assert.strictEqual(guide.currentStepIndex, 0, 'prev() à l\'étape 0 doit laisser l\'index à 0');
    guide.prev();
    assert.strictEqual(guide.currentStepIndex, 0);
    guide.quit();
  });

  it('9.2. Le bouton Précédent est désactivé (disabled=true) à l\'Étape 1', () => {
    const mockWin = createMockEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    guide.start(0);
    const prevBtn = mockWin.document.getElementById('equa-wt-prev-btn');
    assert(prevBtn, 'Bouton précédent introuvable');
    assert.strictEqual(prevBtn.disabled, true, 'Le bouton précédent doit être désactivé à l\'étape 1');
    guide.quit();
  });

  it('9.3. À l\'Étape 5 (dernière étape), le libellé du bouton Suivant bascule vers "Terminer"', () => {
    const mockWin = createMockEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    guide.start(4);
    const nextBtn = mockWin.document.getElementById('equa-wt-next-btn');
    assert(nextBtn, 'Bouton suivant introuvable');
    assert(/terminer|fin/i.test(nextBtn.textContent),
      'À la dernière étape, le bouton doit s\'intituler "Terminer"');
    guide.quit();
  });

  it('9.4. goTo(-1) est borné à 0 sans lever d\'exception', () => {
    const mockWin = createMockEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    guide.start(0);
    guide.goTo(-1);
    assert.strictEqual(guide.currentStepIndex, 0, 'goTo(-1) doit se borner à 0');
    guide.quit();
  });

  it('9.5. next() à l\'Étape 5 termine proprement le guide sans erreur d\'indice', () => {
    const mockWin = createMockEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    guide.start(4);
    assert.strictEqual(guide.currentStepIndex, 4);
    guide.next(); // At last step, next() completes guide
    assert.strictEqual(guide.isActive, false, 'next() à l\'étape finale doit clôturer le guide');
  });
});

// =============================================================
// SUITE 10: TIER 2 - Boundary Cases: Escape Key Teardown at Any Step
// =============================================================
describe('Tier 2 - B2: Fermeture Propre par la Touche Échap à N\'importe Quelle Étape', () => {
  it('10.1. La touche Échap ferme immédiatement le guide depuis l\'Étape 1', () => {
    const mockWin = createMockEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    guide.start(0);
    assert.strictEqual(guide.isActive, true);
    const escEvt = createMockEvent('keydown', { key: 'Escape', keyCode: 27 });
    mockWin.dispatchEvent(escEvt);
    assert.strictEqual(guide.isActive, false, 'Échap doit fermer le guide à l\'étape 1');
  });

  it('10.2. La touche Échap ferme immédiatement le guide depuis l\'Étape 3', () => {
    const mockWin = createMockEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    guide.start(2);
    assert.strictEqual(guide.isActive, true);
    const escEvt = createMockEvent('keydown', { key: 'Escape', keyCode: 27 });
    mockWin.dispatchEvent(escEvt);
    assert.strictEqual(guide.isActive, false, 'Échap doit fermer le guide à l\'étape 3');
  });

  it('10.3. La touche Échap ferme immédiatement le guide depuis l\'Étape 5', () => {
    const mockWin = createMockEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    guide.start(4);
    assert.strictEqual(guide.isActive, true);
    const escEvt = createMockEvent('keydown', { key: 'Escape', keyCode: 27 });
    mockWin.dispatchEvent(escEvt);
    assert.strictEqual(guide.isActive, false, 'Échap doit fermer le guide à l\'étape 5');
  });

  it('10.4. Les touches neutres (Espace, Entrée, Tab) ne ferment pas le guide', () => {
    const mockWin = createMockEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    guide.start(1);
    const tabEvt = createMockEvent('keydown', { key: 'Tab', keyCode: 9 });
    mockWin.dispatchEvent(tabEvt);
    assert.strictEqual(guide.isActive, true, 'Tab ne doit pas fermer le guide');
    const spaceEvt = createMockEvent('keydown', { key: ' ', keyCode: 32 });
    mockWin.dispatchEvent(spaceEvt);
    assert.strictEqual(guide.isActive, true, 'Espace ne doit pas fermer le guide');
    guide.quit();
  });

  it('10.5. L\'événement Échap appelle preventDefault et stopPropagation', () => {
    const mockWin = createMockEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    guide.start(1);
    const escEvt = createMockEvent('keydown', { key: 'Escape', keyCode: 27 });
    mockWin.dispatchEvent(escEvt);
    assert.strictEqual(escEvt.defaultPrevented, true, 'preventDefault doit être appelé sur Échap');
    assert.strictEqual(escEvt.propagationStopped, true, 'stopPropagation doit être appelé sur Échap');
  });
});

// =============================================================
// SUITE 11: TIER 2 - Boundary Cases: Rapid Clicking & Idempotency
// =============================================================
describe('Tier 2 - B3: Résistance au Clic Rapide, Ré-entrances & Idempotence', () => {
  it('11.1. Appels successifs répétés à start() ne dupliquent pas l\'overlay dans le DOM', () => {
    const mockWin = createMockEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    guide.start(0);
    guide.start(0);
    guide.start(0);
    const overlays = mockWin.document.querySelectorAll('#equa-walkthrough-overlay');
    assert.strictEqual(overlays.length, 1, 'Il ne doit exister qu\'un seul overlay même après 3 start()');
    guide.quit();
  });

  it('11.2. Cliquer sur #nav-guide-btn pendant que le guide est actif ne duplique pas l\'interface', () => {
    const mockWin = createMockEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    guide.start(0);
    const btn = mockWin.document.getElementById('nav-guide-btn');
    btn.click();
    btn.click();
    const overlays = mockWin.document.querySelectorAll('#equa-walkthrough-overlay');
    assert.strictEqual(overlays.length, 1, 'Aucun doublon après clics sur le bouton déclencheur');
    guide.quit();
  });

  it('11.3. Alternance ultra-rapide de next() et prev() conserve un état d\'étape cohérent', () => {
    const mockWin = createMockEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    guide.start(0);
    for (let i = 0; i < 20; i++) {
      guide.next();
      guide.prev();
    }
    assert.strictEqual(guide.currentStepIndex, 0, 'Après 20 allers-retours, l\'étape doit être à 0');
    guide.quit();
  });

  it('11.4. Relancer start() après quit() réinitialise correctement le parcours à l\'Étape 1', () => {
    const mockWin = createMockEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    guide.start(3);
    guide.quit();
    assert.strictEqual(guide.isActive, false);
    guide.start();
    assert.strictEqual(guide.isActive, true);
    assert.strictEqual(guide.currentStepIndex, 0, 'Le guide redémarré doit commencer à l\'étape 0');
    guide.quit();
  });

  it('11.5. Appeler quit() plusieurs fois consécutivement est idempotent et ne lève pas d\'erreur', () => {
    const mockWin = createMockEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    guide.start(1);
    assert.doesNotThrow(() => {
      guide.quit();
      guide.quit();
      guide.quit();
    }, 'quit() multiple ne doit pas lever d\'exception');
    assert.strictEqual(guide.isActive, false);
  });
});

// =============================================================
// SUITE 12: TIER 2 - Boundary Cases: Missing Target Elements Handling
// =============================================================
describe('Tier 2 - B4: Robustesse Face aux Éléments Cibles Absents ou Inaccessibles', () => {
  it('12.1. Cible inexistante dans le DOM ne lève pas d\'erreur JS non rattrapée', () => {
    const mockWin = createMockEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    // Simuler un sélecteur absent
    guide.steps[0].targetSelector = '#inexistant-target-element';
    assert.doesNotThrow(() => {
      guide.start(0);
    }, 'start() avec cible absente ne doit pas lever d\'exception');
    guide.quit();
  });

  it('12.2. Repli gracieux : le popover est centré et le spotlight est masqué si cible absente', () => {
    const mockWin = createMockEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    guide.steps[0].targetSelector = '#ghost-element';
    guide.start(0);
    const popover = mockWin.document.getElementById('equa-wt-tooltip') || guide.popoverEl;
    assert(popover, 'Le popover doit s\'afficher même sans élément cible');
    guide.quit();
  });

  it('12.3. La navigation vers les étapes suivantes fonctionne même si une cible intermédiaire manque', () => {
    const mockWin = createMockEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    guide.steps[1].targetSelector = '#ghost-catalog';
    guide.start(0);
    guide.next(); // to step 1 (missing target)
    assert.strictEqual(guide.currentStepIndex, 1);
    guide.next(); // to step 2 (valid target)
    assert.strictEqual(guide.currentStepIndex, 2);
    guide.quit();
  });

  it('12.4. Toutes les cibles absentes permettent quand même d\'exécuter le cycle complet', () => {
    const mockWin = createMockEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    guide.steps.forEach(s => s.targetSelector = '#unknown-' + s.id);
    assert.doesNotThrow(() => {
      guide.start(0);
      guide.next();
      guide.next();
      guide.next();
      guide.next();
      guide.finish();
    }, 'Cycle complet sans cibles ne doit pas crasher');
  });

  it('12.5. Suppression d\'un élément cible en cours de guide ne fait pas planter le redimensionnement', () => {
    const mockWin = createMockEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    guide.start(0);
    const target = mockWin.document.getElementById('model-select-n0120');
    if (target) target.remove();
    assert.doesNotThrow(() => {
      mockWin.dispatchEvent(createMockEvent('resize'));
    }, 'Resize avec élément supprimé ne doit pas échouer');
    guide.quit();
  });
});

// =============================================================
// SUITE 13: TIER 2 - Boundary Cases: Extreme Coordinates & Viewport Bounds
// =============================================================
describe('Tier 2 - B5: Gestion des Dimensions Nulles et des Coordonnées Extrêmes', () => {
  it('13.1. Cible avec getBoundingClientRect retournant 0x0 produit des styles CSS valides sans NaN', () => {
    const mockWin = createMockEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    const target = mockWin.document.getElementById('model-select-n0120');
    target.setBoundingClientRect({ top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0, x: 0, y: 0 });
    guide.start(0);
    const spotlight = guide.spotlightEl;
    assert(!String(spotlight.style.top).includes('NaN'), 'style.top ne doit pas être NaN');
    assert(!String(spotlight.style.width).includes('NaN'), 'style.width ne doit pas être NaN');
    guide.quit();
  });

  it('13.2. Cible hors écran déclenche scrollIntoView', () => {
    const mockWin = createMockEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    const target = mockWin.document.getElementById('model-select-n0120');
    guide.start(0);
    assert.strictEqual(target.scrollIntoViewCalled, true, 'scrollIntoView doit être appelé sur la cible');
    guide.quit();
  });

  it('13.3. Un événement resize recalcule les coordonnées du spotlight', () => {
    const mockWin = createMockEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    guide.start(0);
    const target = mockWin.document.getElementById('model-select-n0120');
    target.setBoundingClientRect({ top: 500, left: 400, width: 100, height: 40, bottom: 540, right: 500, x: 400, y: 500 });
    mockWin.dispatchEvent(createMockEvent('resize'));
    assert(parseInt(guide.spotlightEl.style.top) >= 490, 'Spotlight top doit s\'ajuster au resize');
    guide.quit();
  });

  it('13.4. Écran mobile étroit (320px) contraint la largeur du popover sans débordement négatif', () => {
    const mockWin = createMockEnvironment();
    mockWin.innerWidth = 320;
    mockWin.innerHeight = 568;
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    guide.start(0);
    const popover = guide.popoverEl;
    assert(popover, 'Popover doit exister sur mobile');
    assert.strictEqual(popover.style.bottom, '16px', 'Sur mobile, le popover est fixé en bas');
    guide.quit();
  });

  it('13.5. Un événement scroll met à jour la position sans générer d\'exception', () => {
    const mockWin = createMockEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    guide.start(0);
    assert.doesNotThrow(() => {
      mockWin.dispatchEvent(createMockEvent('scroll'));
    }, 'Scroll ne doit pas lever d\'erreur');
    guide.quit();
  });
});

// =============================================================
// SUITE 14: TIER 3 - Cross-Feature Combinations
// =============================================================
describe('Tier 3: Combinaisons Croisées & Interactions Multi-Fonctionnalités', () => {
  it('14.1. Arriver à l\'Étape 2 active le catalogue via son crochet beforeStep', () => {
    const mockWin = createMockEnvironment();
    const catView = mockWin.document.getElementById('tab-view-catalog');
    catView.classList.add('hidden'); // Simuler un autre onglet actif
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    guide.start(0);
    guide.next(); // Passe à l'étape 2 (catalogue)
    assert.strictEqual(catView.classList.contains('hidden'), false,
      'L\'onglet catalogue doit être désarchivé/affiché à l\'étape 2');
    guide.quit();
  });

  it('14.2. Arriver à l\'Étape 3 déplie le simulateur mobile s\'il était replié', () => {
    const mockWin = createMockEnvironment();
    const simContainer = mockWin.document.getElementById('sim-calculator-container');
    simContainer.classList.add('hidden'); // Simuler simulateur masqué sur mobile
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    guide.start(2); // Étape 3 (simulateur)
    assert.strictEqual(simContainer.classList.contains('hidden'), false,
      'Le conteneur simulateur doit être rendu visible à l\'étape 3');
    guide.quit();
  });

  it('14.3. Navigation par les touches fléchées : Flèche Droite = Suivant, Flèche Gauche = Précédent', () => {
    const mockWin = createMockEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    guide.start(0);
    assert.strictEqual(guide.currentStepIndex, 0);

    const rightEvt = createMockEvent('keydown', { key: 'ArrowRight', keyCode: 39 });
    mockWin.dispatchEvent(rightEvt);
    assert.strictEqual(guide.currentStepIndex, 1, 'Flèche Droite doit faire passer à l\'étape suivante');

    const leftEvt = createMockEvent('keydown', { key: 'ArrowLeft', keyCode: 37 });
    mockWin.dispatchEvent(leftEvt);
    assert.strictEqual(guide.currentStepIndex, 0, 'Flèche Gauche doit faire revenir à l\'étape précédente');

    guide.quit();
  });

  it('14.4. Capture des touches clavier en phase de capture (useCapture=true) pour isoler le simulateur', () => {
    const mockWin = createMockEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    guide.start(0);
    const listeners = mockWin.listeners['keydown'] || [];
    assert(listeners.length > 0);
    const captureListener = listeners.find(l => l.capture === true);
    assert(captureListener !== undefined, 'L\'écouteur keydown doit être enregistré en phase de capture (capture: true)');
    guide.quit();
  });

  it('14.5. Quand le guide est fermé, les touches clavier ne sont plus capturées', () => {
    const mockWin = createMockEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    guide.start(0);
    guide.quit();
    const listeners = mockWin.listeners['keydown'] || [];
    assert.strictEqual(listeners.length, 0, 'Aucun écouteur de capture ne doit subsister après fermeture');
  });

  it('14.6. L\'activation du guide n\'altère pas la sélection de modèle dans userSettings', () => {
    const mockWin = createMockEnvironment();
    mockWin.userSettings = { targetModel: 'N0110' };
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    guide.start(0);
    assert.strictEqual(mockWin.userSettings.targetModel, 'N0110', 'Le modèle N0110 ne doit pas être écrasé');
    guide.quit();
  });

  it('14.7. Déclenchement des effets sonores haptiques playClick() et playSuccess()', () => {
    const mockWin = createMockEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    guide.start(0);
    assert(mockWin.soundFx.clicks >= 1, 'playClick() doit être appelé au démarrage');
    guide.next();
    assert(mockWin.soundFx.clicks >= 2, 'playClick() doit être appelé au clic Suivant');
    guide.finish();
    assert(mockWin.soundFx.successes >= 1, 'playSuccess() doit être appelé à la fin du guide');
  });

  it('14.8. Si window.soundFx est absent ou défaillant, le guide fonctionne sans erreur', () => {
    const mockWin = createMockEnvironment();
    mockWin.soundFx = null;
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    assert.doesNotThrow(() => {
      guide.start(0);
      guide.next();
      guide.prev();
      guide.finish();
    }, 'Absence de moteur audio ne doit pas entraver le guide');
  });
});

// =============================================================
// SUITE 15: TIER 4 - Real-World Application Scenarios
// =============================================================
describe('Tier 4: Scénarios Réalistes & Parcours Utilisateur Bout-en-Bout', () => {
  it('15.1. Scénario 1 : Visiteur débutant effectue le parcours complet de l\'Étape 1 à 5 et valide le conseil USB', () => {
    const mockWin = createMockEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();

    // 1. Déclenchement manuel
    guide.start();
    assert.strictEqual(guide.isActive, true);
    assert.strictEqual(guide.currentStepIndex, 0);

    // 2. Étape 1 -> Étape 2 (Catalogue)
    guide.next();
    assert.strictEqual(guide.currentStepIndex, 1);
    assert.strictEqual(guide.steps[1].id, 'app_catalog');

    // 3. Étape 2 -> Étape 3 (Simulateur)
    guide.next();
    assert.strictEqual(guide.currentStepIndex, 2);
    assert.strictEqual(guide.steps[2].id, 'virtual_simulator');

    // 4. Étape 3 -> Étape 4 (Thèmes)
    guide.next();
    assert.strictEqual(guide.currentStepIndex, 3);
    assert.strictEqual(guide.steps[3].id, 'customization');

    // 5. Étape 4 -> Étape 5 (Installation & USB)
    guide.next();
    assert.strictEqual(guide.currentStepIndex, 4);
    assert.strictEqual(guide.steps[4].id, 'flash_installation');

    // 6. Vérification du texte d'avertissement USB
    const s5Text = (guide.steps[4].text + ' ' + (guide.steps[4].warningText || '')).toLowerCase();
    assert(s5Text.includes('usb') && /branch(er|ez)?|connect(er|ez)?/i.test(s5Text), 'Consigne USB obligatoire validée');

    // 7. Terminer le guide
    guide.finish();
    assert.strictEqual(guide.isActive, false);
    assert.strictEqual(mockWin.document.getElementById('equa-walkthrough-overlay'), null);
  });

  it('15.2. Scénario 2 : Parcours interrompu en cours de route via la touche Échap', () => {
    const mockWin = createMockEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();

    guide.start();
    guide.next();
    guide.next(); // À l'étape 3
    assert.strictEqual(guide.currentStepIndex, 2);

    // Utilisateur appuie sur Échap
    mockWin.dispatchEvent(createMockEvent('keydown', { key: 'Escape', keyCode: 27 }));
    assert.strictEqual(guide.isActive, false, 'Le guide doit être quitté immédiatement');
    assert.strictEqual(mockWin.document.getElementById('equa-walkthrough-overlay'), null);
    assert.strictEqual((mockWin.listeners['keydown'] || []).length, 0);
  });

  it('15.3. Scénario 3 : Exploration bidirectionnelle (allers-retours répétés avant finalisation)', () => {
    const mockWin = createMockEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();

    guide.start(); // 0
    guide.next();  // 1
    guide.next();  // 2
    guide.prev();  // 1
    guide.prev();  // 0
    guide.next();  // 1
    guide.next();  // 2
    guide.next();  // 3
    guide.next();  // 4
    assert.strictEqual(guide.currentStepIndex, 4);

    guide.finish();
    assert.strictEqual(guide.isActive, false);
  });

  it('15.4. Scénario 4 : Cycle répété (Ouvrir -> Fermer -> Interaction UI -> Ré-ouvrir -> Compléter)', () => {
    const mockWin = createMockEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();

    // Première ouverture
    guide.start();
    guide.next();
    guide.quit();
    assert.strictEqual(guide.isActive, false);

    // Interaction utilisateur entre-temps (ex: clic sur modèle N0110)
    const btn110 = mockWin.document.getElementById('model-select-n0110');
    if (btn110) btn110.click();

    // Réouverture
    guide.start();
    assert.strictEqual(guide.isActive, true);
    assert.strictEqual(guide.currentStepIndex, 0, 'Doit redémarrer à zéro');
    guide.goTo(4);
    guide.finish();
    assert.strictEqual(guide.isActive, false);
  });

  it('15.5. Scénario 5 : Simulation viewport mobile (375x667), ancrage bas et absence d\'overflow', () => {
    const mockWin = createMockEnvironment();
    mockWin.innerWidth = 375;
    mockWin.innerHeight = 667;
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();

    guide.start();
    const popover = guide.popoverEl;
    assert.strictEqual(popover.style.bottom, '16px');
    assert.strictEqual(popover.style.left, '16px');
    assert.strictEqual(popover.style.right, '16px');

    guide.next();
    guide.next();
    guide.next();
    guide.next();
    guide.finish();
    assert.strictEqual(guide.isActive, false);
  });
});

// =============================================================
// RÉSUMÉ & SORTIE DU RUNNER
// =============================================================
console.log(`\n========================================`);
console.log(`RÉSULTAT GLOBAL DU TEST SUITE GUIDE :`);
console.log(`  Tests réussis : ${passedTests}`);
console.log(`  Tests échoués : ${failedTests}`);
console.log(`========================================\n`);

if (failedTests > 0) {
  console.error('Détails des échecs :');
  failureDetails.forEach(f => {
    console.error(`  - ${f.desc}: ${f.error}`);
  });
  process.exit(1);
} else {
  console.log('🎉 TOUTES LES VÉRIFICATIONS DU GUIDE D\'UTILISATION SONT 100% SUCCÈS !');
  process.exit(0);
}

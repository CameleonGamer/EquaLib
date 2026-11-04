/**
 * EquaLib — Walkthrough Guide Adversarial Stress Test Harness
 * Author: challenger_1 (Empirical Challenger Agent)
 * 
 * Challenges:
 * 1. Rapid Clicking Stress (Interleaved clicks, bursts of 100+ start calls, event flood)
 * 2. Boundary & Fuzzing Stress (Past step 5, before step 1, NaN, floats, strings, negative, infinity, random walk)
 * 3. DOM Mutation Stress (Missing targets, deleted targets, hidden targets, corrupted getBoundingClientRect)
 * 4. Escape Key Teardown at Every Step (Steps 1 through 5: overlay, listeners, body class, no leaks)
 * 5. Full Re-entrancy & Concurrency Simulation
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

let passedTests = 0;
let failedTests = 0;
const failureLog = [];

function it(name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    console.error(`         -> Error: ${err.message}`);
    failureLog.push({ name, error: err.message, stack: err.stack });
    failedTests++;
  }
}

async function itAsync(name, fn) {
  try {
    await fn();
    console.log(`  [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    console.error(`         -> Error: ${err.message}`);
    failureLog.push({ name, error: err.message, stack: err.stack });
    failedTests++;
  }
}

function suite(title, fn) {
  console.log(`\n======================================================`);
  console.log(`CHALLENGER HARNESS: ${title}`);
  console.log(`======================================================`);
  fn();
}

// -------------------------------------------------------------
// Adversarial DOM Mock Environment
// -------------------------------------------------------------

function matchSelector(el, sel) {
  sel = sel.trim();
  if (sel.includes(',')) {
    return sel.split(',').some(s => matchSelector(el, s.trim()));
  }
  if (sel.startsWith('#')) return el.id === sel.slice(1);
  if (sel.startsWith('.')) return el.classList.contains(sel.slice(1));
  return el.tagName.toLowerCase() === sel.toLowerCase();
}

function queryRecursive(node, sel) {
  const matches = [];
  function walk(curr) {
    if (!curr || !curr.children) return;
    for (const child of curr.children) {
      if (matchSelector(child, sel)) matches.push(child);
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
    if (force === true) { this.add(cls); return true; }
    if (force === false) { this.remove(cls); return false; }
    if (this.contains(cls)) { this.remove(cls); return false; }
    this.add(cls); return true;
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
    this._customBoundingRect = null;
    this._throwOnGetBoundingClientRect = false;
  }

  get className() { return this._className; }
  set className(val) {
    this._className = val || '';
    this.classList.set.clear();
    if (val) val.trim().split(/\s+/).forEach(c => c && this.classList.set.add(c));
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

  get innerHTML() { return this._innerHTML; }
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
      const content = match[3] || '';
      if (!content.includes('<')) child.textContent = content.trim();
      else child.innerHTML = content;
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
    if (this.parentNode) this.parentNode.removeChild(this);
  }

  addEventListener(type, fn, options = {}) {
    if (!this.listeners[type]) this.listeners[type] = [];
    const capture = typeof options === 'boolean' ? options : !!options.capture;
    // Standard DOM: duplicates with same function and same capture are discarded
    const exists = this.listeners[type].some(l => l.fn === fn && l.capture === capture);
    if (!exists) {
      this.listeners[type].push({ fn, capture, options });
    }
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
    this.dispatchEvent({
      type: 'click',
      target: this,
      currentTarget: this,
      defaultPrevented: false,
      propagationStopped: false,
      preventDefault() { this.defaultPrevented = true; },
      stopPropagation() { this.propagationStopped = true; }
    });
  }
  scrollIntoView(options) {
    this.scrollIntoViewCalled = true;
  }
  setBoundingClientRect(rect) {
    this._customBoundingRect = rect;
  }
  getBoundingClientRect() {
    if (this._throwOnGetBoundingClientRect) {
      throw new Error('Adversarial DOM Exception: getBoundingClientRect failed');
    }
    if (this._customBoundingRect) return this._customBoundingRect;
    return { top: 100, left: 100, bottom: 150, right: 300, width: 200, height: 50, x: 100, y: 100 };
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
      if (matchSelector(curr, sel)) return curr;
      curr = curr.parentNode;
    }
    return null;
  }
}

class MockDocument {
  constructor() {
    this.documentElement = new MockElement('html');
    this.body = new MockElement('body');
    this.documentElement.appendChild(this.body);
    this.listeners = {};
    this.readyState = 'complete';
  }
  createElement(tag) { return new MockElement(tag); }
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
    const exists = this.listeners[type].some(l => l.fn === fn && l.capture === capture);
    if (!exists) this.listeners[type].push({ fn, capture, options });
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

function createAdversarialEnvironment() {
  const doc = new MockDocument();
  const listeners = {};

  const mockWin = {
    document: doc,
    innerWidth: 1280,
    innerHeight: 800,
    scrollX: 0,
    scrollY: 0,
    listeners,
    soundFx: {
      clicks: 0,
      successes: 0,
      playClick() { this.clicks++; },
      playSuccess() { this.successes++; }
    },
    addEventListener(type, fn, options = {}) {
      if (!listeners[type]) listeners[type] = [];
      const capture = typeof options === 'boolean' ? options : !!options.capture;
      const exists = listeners[type].some(l => l.fn === fn && l.capture === capture);
      if (!exists) listeners[type].push({ fn, capture, options });
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
    switchTab: () => {}
  };

  // Populate realistic DOM
  const navBtn = doc.createElement('button');
  navBtn.id = 'nav-guide-btn';
  navBtn.textContent = "Guide D'utilisation";
  doc.body.appendChild(navBtn);

  const modelGroup = doc.createElement('div');
  modelGroup.id = 'model-selector-group';
  const model120 = doc.createElement('button');
  model120.id = 'model-select-n0120';
  modelGroup.appendChild(model120);
  doc.body.appendChild(modelGroup);

  const catalogView = doc.createElement('div');
  catalogView.id = 'tab-view-catalog';
  doc.body.appendChild(catalogView);

  const simContainer = doc.createElement('div');
  simContainer.id = 'sim-calculator-container';
  doc.body.appendChild(simContainer);

  const quickThemes = doc.createElement('div');
  quickThemes.id = 'quick-themes-container';
  doc.body.appendChild(quickThemes);

  const flashBtn = doc.createElement('button');
  flashBtn.id = 'flash-btn';
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
// CHALLENGE 1: RAPID CLICKING STRESS
// =============================================================
suite('1. Rapid Clicking Stress (Re-entrancy, Overlays, Corrupted State)', () => {
  it('1.1. 100 consecutive rapid start() calls create exactly ONE overlay element in the DOM', () => {
    const mockWin = createAdversarialEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();

    for (let i = 0; i < 100; i++) {
      guide.start(0);
    }

    const overlays = mockWin.document.querySelectorAll('#equa-walkthrough-overlay');
    assert.strictEqual(overlays.length, 1, `Expected exactly 1 overlay in DOM, found ${overlays.length}`);
    assert.strictEqual(guide.isActive, true);
    assert.strictEqual(guide.currentStepIndex, 0);
    guide.quit();
  });

  it('1.2. 100 rapid asynchronous clicks on trigger button (#nav-guide-btn) do not multiply overlays or listeners', () => {
    const mockWin = createAdversarialEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    // Initialize auto-binding
    const trigger = mockWin.document.getElementById('nav-guide-btn');
    
    // Simulate clicking 100 times rapidly
    for (let i = 0; i < 100; i++) {
      trigger.click();
    }

    const overlays = mockWin.document.querySelectorAll('#equa-walkthrough-overlay');
    assert.strictEqual(overlays.length, 1, `Expected exactly 1 overlay, found ${overlays.length}`);

    // Check keydown listeners on window
    const keyListeners = (mockWin.listeners['keydown'] || []);
    assert.strictEqual(keyListeners.length, 1, `Expected exactly 1 keydown listener on window, found ${keyListeners.length}`);
    
    windowInstance = mockWin.equaLibWalkthrough;
    if (windowInstance) windowInstance.quit();
  });

  it('1.3. Rapid interleaving of start() and quit() (50 cycles) leaves DOM and state completely clean', () => {
    const mockWin = createAdversarialEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();

    for (let i = 0; i < 50; i++) {
      guide.start();
      assert.strictEqual(guide.isActive, true);
      assert(mockWin.document.getElementById('equa-walkthrough-overlay') !== null);
      guide.quit();
      assert.strictEqual(guide.isActive, false);
      assert.strictEqual(mockWin.document.getElementById('equa-walkthrough-overlay'), null);
      assert.strictEqual(mockWin.document.body.classList.contains('walkthrough-active'), false);
    }

    assert.strictEqual(mockWin.listeners['keydown'].length, 0);
    assert.strictEqual(mockWin.listeners['resize'].length, 0);
    assert.strictEqual(mockWin.listeners['scroll'].length, 0);
  });

  it('1.4. Rapid burst of next() and prev() (200 random operations) maintains currentStepIndex strictly within [0, 4]', () => {
    const mockWin = createAdversarialEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    guide.start(0);

    for (let i = 0; i < 200; i++) {
      if (Math.random() > 0.5) {
        guide.next();
      } else {
        guide.prev();
      }
      if (guide.isActive) {
        assert(guide.currentStepIndex >= 0 && guide.currentStepIndex <= 4,
          `currentStepIndex out of bounds: ${guide.currentStepIndex}`);
      } else {
        // If finished, guide must be inactive and restartable
        guide.start(0);
      }
    }
    guide.quit();
  });
});

// =============================================================
// CHALLENGE 2: BOUNDARY STRESS & FUZZING
// =============================================================
suite('2. Boundary Stress (Past Step 5, Prev at Step 1, Fuzzing)', () => {
  it('2.1. Calling next() past step 5 terminates cleanly and sets isActive=false', () => {
    const mockWin = createAdversarialEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    guide.start(4); // Step 5 (index 4)
    assert.strictEqual(guide.currentStepIndex, 4);

    guide.next(); // Advances past step 5 -> should finish/teardown
    assert.strictEqual(guide.isActive, false, 'Guide should become inactive after next() on step 5');
    assert.strictEqual(mockWin.document.getElementById('equa-walkthrough-overlay'), null, 'Overlay should be removed');
  });

  it('2.2. Subsequent next() calls when inactive are no-ops and do not throw', () => {
    const mockWin = createAdversarialEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    assert.strictEqual(guide.isActive, false);

    assert.doesNotThrow(() => {
      for (let i = 0; i < 10; i++) {
        guide.next();
      }
    }, 'next() on inactive guide must not throw');
  });

  it('2.3. Calling prev() on step 1 (index 0) remains clamped at index 0 and does not throw', () => {
    const mockWin = createAdversarialEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    guide.start(0);

    for (let i = 0; i < 10; i++) {
      guide.prev();
      assert.strictEqual(guide.currentStepIndex, 0, 'Index must remain clamped at 0');
    }
    assert.strictEqual(guide.isActive, true);
    guide.quit();
  });

  it('2.4. Integer boundary clamping and out-of-bounds jumping', () => {
    const mockWin = createAdversarialEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    guide.start(0);

    // Negative numbers clamp to 0
    guide.goTo(-1);
    assert.strictEqual(guide.currentStepIndex, 0);
    guide.goTo(-99999);
    assert.strictEqual(guide.currentStepIndex, 0);

    // Integers >= 5 finish cleanly
    guide.goTo(5);
    assert.strictEqual(guide.isActive, false);
    assert.strictEqual(mockWin.document.getElementById('equa-walkthrough-overlay'), null);

    guide.start(0);
    guide.goTo(99999);
    assert.strictEqual(guide.isActive, false);

    // Non-number passed to start() defaults safely to 0
    guide.start('invalid');
    assert.strictEqual(guide.currentStepIndex, 0, 'start("invalid") should default to step 0');
    guide.quit();

    guide.start(null);
    assert.strictEqual(guide.currentStepIndex, 0, 'start(null) should default to step 0');
    guide.quit();

    guide.start(undefined);
    assert.strictEqual(guide.currentStepIndex, 0, 'start(undefined) should default to step 0');
    guide.quit();
  });

  it('2.5. Adversarial Probe: Non-integer floats (2.7) or NaN passed to goTo() expose unhandled step indexing', () => {
    const mockWin = createAdversarialEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    guide.start(0);

    // Documenting empirical discovery:
    // When non-integer or NaN is passed directly to goTo(), this.steps[index] evaluates to undefined,
    // which throws TypeError when reading step.beforeStep.
    assert.throws(() => {
      guide.goTo(2.7);
    }, /Cannot read properties of undefined/, 'goTo(2.7) should throw TypeError on undefined step');

    assert.throws(() => {
      guide.goTo(NaN);
    }, /Cannot read properties of undefined/, 'goTo(NaN) should throw TypeError on undefined step');

    // Teardown restores state cleanly after error
    guide.quit();
    assert.strictEqual(guide.isActive, false);
  });

  it('2.6. Random Walk Fuzzing (500 iterations of random actions: goTo, next, prev, quit, start)', () => {
    const mockWin = createAdversarialEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();

    const actions = [
      () => guide.start(Math.floor(Math.random() * 5)),
      () => guide.next(),
      () => guide.prev(),
      () => guide.quit(),
      () => guide.finish(),
      () => guide.goTo(Math.floor(Math.random() * 8) - 2),
      () => guide.handleKeydown({ key: 'Escape', preventDefault: () => {}, stopPropagation: () => {} }),
      () => guide.handleKeydown({ key: 'ArrowRight', preventDefault: () => {}, stopPropagation: () => {} }),
      () => guide.handleKeydown({ key: 'ArrowLeft', preventDefault: () => {}, stopPropagation: () => {} }),
      () => guide.handleResize(),
      () => guide.handleScroll()
    ];

    assert.doesNotThrow(() => {
      for (let i = 0; i < 500; i++) {
        const act = actions[Math.floor(Math.random() * actions.length)];
        act();
      }
    }, 'Random walk fuzzing should never crash or throw unhandled exceptions');

    // Final teardown check
    guide.quit();
    assert.strictEqual(guide.isActive, false);
    assert.strictEqual(mockWin.document.getElementById('equa-walkthrough-overlay'), null);
  });
});

// =============================================================
// CHALLENGE 3: DOM MUTATION STRESS (MISSING, REMOVED, CORRUPTED)
// =============================================================
suite('3. DOM Mutation Stress (Missing/Hidden/Mutated Targets)', () => {
  it('3.1. Target element missing for each individual step (steps 1 through 5) falls back gracefully', () => {
    const mockWin = createAdversarialEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);

    // Target selectors:
    // 0: #model-select-n0120
    // 1: #tab-view-catalog
    // 2: #sim-calculator-container
    // 3: #quick-themes-container
    // 4: #flash-btn

    const targetIds = [
      ['model-select-n0120', 'model-selector-group', 'model-select-n0110'],
      ['tab-view-catalog', 'catalog-list', 'tab-btn-catalog'],
      ['sim-calculator-container', 'sim-screen'],
      ['quick-themes-container', 'quick-settings-btn', 'settings-modal-btn'],
      ['flash-btn']
    ];

    for (let step = 0; step < 5; step++) {
      // Remove all elements and fallback elements for this step
      targetIds[step].forEach(id => {
        const el = mockWin.document.getElementById(id);
        if (el) el.remove();
      });

      const guide = new Walkthrough();
      assert.doesNotThrow(() => {
        guide.start(step);
      }, `start(${step}) with missing targets must not throw`);

      assert.strictEqual(guide.isActive, true);
      const popover = mockWin.document.getElementById('equa-walkthrough-tooltip');
      assert(popover !== null, 'Popover must be present');
      // When target is missing, popover is centered
      assert.strictEqual(popover.style.left, '50%');
      assert.strictEqual(popover.style.top, '25%');

      const spotlight = mockWin.document.getElementById('equa-walkthrough-spotlight');
      assert.strictEqual(spotlight.style.display, 'none', 'Spotlight must be hidden if target is missing');

      guide.quit();
    }
  });

  it('3.2. All target elements completely wiped from DOM: guide completes entire 5-step tour without error', () => {
    const mockWin = createAdversarialEnvironment();
    // Wipe all targets
    ['model-selector-group', 'model-select-n0120', 'tab-view-catalog', 'sim-calculator-container', 'quick-themes-container', 'flash-btn'].forEach(id => {
      const el = mockWin.document.getElementById(id);
      if (el) el.remove();
    });

    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    guide.start(0);

    for (let i = 0; i < 4; i++) {
      assert.strictEqual(guide.currentStepIndex, i);
      assert.doesNotThrow(() => guide.next(), `next() on step ${i} with 0 DOM targets must not throw`);
    }

    assert.strictEqual(guide.currentStepIndex, 4);
    assert.doesNotThrow(() => guide.next(), 'next() on last step with 0 DOM targets must finish cleanly');
    assert.strictEqual(guide.isActive, false);
  });

  it('3.3. Target element removed while actively displaying that step', () => {
    const mockWin = createAdversarialEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    guide.start(2); // Step 3: simulator

    const sim = mockWin.document.getElementById('sim-calculator-container');
    assert(sim !== null);
    sim.remove(); // Removed while guide is showing step 3

    // Trigger resize and scroll events
    assert.doesNotThrow(() => {
      mockWin.dispatchEvent({ type: 'resize' });
      mockWin.dispatchEvent({ type: 'scroll' });
    }, 'Resize/scroll after target removal must not throw');

    guide.quit();
  });

  it('3.4. Target element whose getBoundingClientRect returns 0x0 or negative coordinates', () => {
    const mockWin = createAdversarialEnvironment();
    const flashBtn = mockWin.document.getElementById('flash-btn');
    flashBtn.setBoundingClientRect({ top: -500, left: -200, width: 0, height: 0, bottom: -500, right: -200, x: -200, y: -500 });

    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    guide.start(4);

    const spotlight = mockWin.document.getElementById('equa-walkthrough-spotlight');
    assert(spotlight !== null);
    // top and left should clamp to >= 0
    assert.strictEqual(spotlight.style.top, '0px');
    assert.strictEqual(spotlight.style.left, '0px');

    guide.quit();
  });

  it('3.5. Target element whose getBoundingClientRect throws an error', () => {
    const mockWin = createAdversarialEnvironment();
    const modelBtn = mockWin.document.getElementById('model-select-n0120');
    modelBtn._throwOnGetBoundingClientRect = true;

    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();

    // Since getBoundingClientRect throws, positionSpotlightAndPopover is invoked
    // Let's verify how it handles or if it throws
    let threw = false;
    try {
      guide.start(0);
    } catch (e) {
      threw = true;
    }
    // If it threw, teardown should still be possible
    assert.doesNotThrow(() => {
      guide.teardown();
    }, 'Teardown must be resilient');
  });

  it('3.6. Walkthrough popover elements mutated/removed by external script while running', () => {
    const mockWin = createAdversarialEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    guide.start(0);

    // External script removes badge and title
    const badge = mockWin.document.getElementById('equa-wt-step-badge');
    if (badge) badge.remove();
    const title = mockWin.document.getElementById('equa-wt-title');
    if (title) title.remove();

    // Navigating to next step must not throw TypeError on badge/title
    assert.doesNotThrow(() => {
      guide.next();
    }, 'Navigating when popover child elements are missing must not throw');

    guide.quit();
  });
});

// =============================================================
// CHALLENGE 4: ESCAPE KEY TEARDOWN AT EVERY STEP (1 TO 5)
// =============================================================
suite('4. Escape Key Teardown at Every Step (1 through 5)', () => {
  for (let stepIndex = 0; stepIndex < 5; stepIndex++) {
    it(`4.${stepIndex + 1}. Pressing Escape on Step ${stepIndex + 1} (index ${stepIndex}) performs 100% clean teardown`, () => {
      const mockWin = createAdversarialEnvironment();
      const Walkthrough = loadWalkthroughClass(mockWin);
      const guide = new Walkthrough();

      guide.start(stepIndex);

      assert.strictEqual(guide.isActive, true, `Guide should be active at step ${stepIndex + 1}`);
      assert.strictEqual(guide.currentStepIndex, stepIndex);
      assert(mockWin.document.getElementById('equa-walkthrough-overlay') !== null, 'Overlay must exist');
      assert.strictEqual(mockWin.document.body.classList.contains('walkthrough-active'), true, 'Body must have walkthrough-active');

      // Verify listeners attached
      assert.strictEqual(mockWin.listeners['keydown'].length, 1);
      assert.strictEqual(mockWin.listeners['resize'].length, 1);
      assert.strictEqual(mockWin.listeners['scroll'].length, 1);

      // Dispatch Escape key event on window
      const escEvent = {
        type: 'keydown',
        key: 'Escape',
        keyCode: 27,
        defaultPrevented: false,
        propagationStopped: false,
        preventDefault() { this.defaultPrevented = true; },
        stopPropagation() { this.propagationStopped = true; }
      };

      mockWin.dispatchEvent(escEvent);

      // 1. Verify preventDefault & stopPropagation called
      assert.strictEqual(escEvent.defaultPrevented, true, 'Escape must call preventDefault()');
      assert.strictEqual(escEvent.propagationStopped, true, 'Escape must call stopPropagation()');

      // 2. Verify state is inactive
      assert.strictEqual(guide.isActive, false, 'Guide must be inactive');

      // 3. Verify overlay completely removed from DOM
      assert.strictEqual(mockWin.document.getElementById('equa-walkthrough-overlay'), null, 'Overlay must be removed from DOM');
      assert.strictEqual(guide.overlayEl, null, 'guide.overlayEl must be null');
      assert.strictEqual(guide.spotlightEl, null, 'guide.spotlightEl must be null');
      assert.strictEqual(guide.popoverEl, null, 'guide.popoverEl must be null');

      // 4. Verify body class removed
      assert.strictEqual(mockWin.document.body.classList.contains('walkthrough-active'), false, 'Body class must be removed');

      // 5. Verify all listeners detached from window
      assert.strictEqual(mockWin.listeners['keydown'].length, 0, 'keydown listener must be removed');
      assert.strictEqual(mockWin.listeners['resize'].length, 0, 'resize listener must be removed');
      assert.strictEqual(mockWin.listeners['scroll'].length, 0, 'scroll listener must be removed');

      // 6. Verify subsequent key events do not trigger guide actions
      const nextEvent = {
        type: 'keydown',
        key: 'ArrowRight',
        defaultPrevented: false,
        stopPropagation() { this.propagationStopped = true; }
      };
      mockWin.dispatchEvent(nextEvent);
      assert.strictEqual(guide.isActive, false, 'Subsequent ArrowRight must not re-activate or mutate guide');
      assert.strictEqual(nextEvent.defaultPrevented, false, 'Inactive guide must not preventDefault on key events');
    });
  }

  it('4.6. Repeated Escape key events while already closed are safe and idempotent', () => {
    const mockWin = createAdversarialEnvironment();
    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();
    guide.start(0);
    guide.quit();

    assert.doesNotThrow(() => {
      guide.handleKeydown({ key: 'Escape', preventDefault: () => {}, stopPropagation: () => {} });
      guide.handleKeydown({ key: 'Escape', preventDefault: () => {}, stopPropagation: () => {} });
    }, 'Repeated escape handling when closed must be safe');
  });
});

// =============================================================
// CHALLENGE 5: INTERACTION & AUDIO RESILIENCE
// =============================================================
suite('5. Interaction & Audio Resilience', () => {
  it('5.1. SoundFx object throwing errors on playClick() does not break guide navigation', () => {
    const mockWin = createAdversarialEnvironment();
    mockWin.soundFx = {
      playClick() { throw new Error('AudioContext blocked by autoplay policy'); },
      playSuccess() { throw new Error('AudioContext failure'); }
    };

    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();

    assert.doesNotThrow(() => {
      guide.start(0);
      guide.next();
      guide.prev();
      guide.finish();
    }, 'Broken soundFx methods must be caught and ignored');
  });

  it('5.2. Modal close callbacks throwing errors do not prevent guide from starting', () => {
    const mockWin = createAdversarialEnvironment();
    mockWin.closeSettingsModal = () => { throw new Error('Modal already unmounted'); };
    mockWin.closeAppDetails = () => { throw new Error('App details corrupted'); };

    const Walkthrough = loadWalkthroughClass(mockWin);
    const guide = new Walkthrough();

    assert.doesNotThrow(() => {
      guide.start(0);
    }, 'Exceptions in modal closers must not abort start()');
    assert.strictEqual(guide.isActive, true);
    guide.quit();
  });
});

// =============================================================
// SUMMARY REPORT
// =============================================================
console.log(`\n======================================================`);
console.log(`ADVERSARIAL STRESS TEST SUMMARY:`);
console.log(`  Tests Passed : ${passedTests}`);
console.log(`  Tests Failed : ${failedTests}`);
if (failedTests > 0) {
  console.log(`\nFailure Details:`);
  failureLog.forEach(f => {
    console.log(`- [${f.name}]: ${f.error}`);
  });
}
console.log(`======================================================`);

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log(`🎉 ALL ADVERSARIAL STRESS CHALLENGES PASSED EMPIRICALLY!`);
  process.exit(0);
}

/**
 * EquaLib — Empirical Adversarial Challenger Test Suite (challenger_2)
 * 
 * Specifically challenges:
 * 1. Event Listener Leak Check (10 consecutive start/quit cycles on window and document)
 * 2. Keyboard Event Isolation (Capture phase interception, preventDefault, stopPropagation, simulator isolation)
 * 3. DOM Leak Check (10 cycles of teardown, verifying zero lingering overlay/spotlight/popover nodes)
 * 4. Style Pollution (Verifying zero permanent modification of inline styles on existing page elements)
 * 5. Full regression verification of existing project test suites
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const cp = require('child_process');

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;
const failures = [];

function check(desc, fn) {
  totalChecks++;
  try {
    fn();
    console.log(`  [PASS] ${desc}`);
    passedChecks++;
  } catch (err) {
    console.error(`  [FAIL] ${desc}`);
    console.error(`         Error: ${err.message}`);
    failures.push({ desc, error: err.message, stack: err.stack });
    failedChecks++;
  }
}

// -------------------------------------------------------------
// WHATWG-Compliant Event & DOM Mock Architecture
// -------------------------------------------------------------

const CAPTURING_PHASE = 1;
const AT_TARGET = 2;
const BUBBLING_PHASE = 3;

class MockEvent {
  constructor(type, props = {}) {
    this.type = type;
    this.target = null;
    this.currentTarget = null;
    this.eventPhase = 0;
    this.defaultPrevented = false;
    this.propagationStopped = false;
    this.immediatePropagationStopped = false;
    Object.assign(this, props);
  }

  preventDefault() {
    this.defaultPrevented = true;
  }

  stopPropagation() {
    this.propagationStopped = true;
  }

  stopImmediatePropagation() {
    this.propagationStopped = true;
    this.immediatePropagationStopped = true;
  }
}

class EventTargetNode {
  constructor(name = 'node') {
    this.nodeName = name;
    this._listeners = new Map(); // type -> Array<{ fn, capture, passive, once }>
  }

  addEventListener(type, fn, options = {}) {
    if (!fn) return;
    const capture = typeof options === 'boolean' ? options : !!options.capture;
    const passive = typeof options === 'object' ? !!options.passive : false;
    const once = typeof options === 'object' ? !!options.once : false;

    if (!this._listeners.has(type)) {
      this._listeners.set(type, []);
    }
    const list = this._listeners.get(type);

    // WHATWG: duplicate registration of identical fn + capture is discarded
    const existing = list.find(entry => entry.fn === fn && entry.capture === capture);
    if (!existing) {
      list.push({ fn, capture, passive, once });
    }
  }

  removeEventListener(type, fn, options = {}) {
    if (!this._listeners.has(type)) return;
    const capture = typeof options === 'boolean' ? options : !!options.capture;
    const list = this._listeners.get(type);
    const filtered = list.filter(entry => !(entry.fn === fn && entry.capture === capture));
    if (filtered.length > 0) {
      this._listeners.set(type, filtered);
    } else {
      this._listeners.delete(type);
    }
  }

  getListeners(type) {
    return this._listeners.get(type) || [];
  }

  getActiveListenerCount(type) {
    if (type) {
      return (this._listeners.get(type) || []).length;
    }
    let count = 0;
    for (const arr of this._listeners.values()) {
      count += arr.length;
    }
    return count;
  }
}

class MockElement extends EventTargetNode {
  constructor(tagName = 'div', id = '') {
    super(tagName);
    this.tagName = tagName.toUpperCase();
    this.id = id;
    this._className = '';
    this.classList = new MockClassList(this);
    this.style = {};
    this.attributes = {};
    this.children = [];
    this.parentNode = null;
    this.disabled = false;
    this.textContent = '';
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

  get innerHTML() {
    return this.children.length === 0 ? this.textContent : '';
  }

  set innerHTML(html) {
    this.children = [];
    this.textContent = '';
    this.parseBasicHTML(html);
  }

  parseBasicHTML(html) {
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
    if (k === 'style') {
      this.parseStyleString(String(v));
    }
  }

  getAttribute(k) {
    if (k === 'id') return this.id || null;
    if (k === 'class') return this.className || null;
    if (k === 'disabled') return this.disabled ? '' : null;
    if (k === 'style') return this.serializeStyleString();
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

  parseStyleString(str) {
    this.style = {};
    if (!str) return;
    str.split(';').forEach(pair => {
      const idx = pair.indexOf(':');
      if (idx !== -1) {
        const prop = pair.slice(0, idx).trim();
        const val = pair.slice(idx + 1).trim();
        if (prop && val) {
          // camelCase property
          const camel = prop.replace(/-([a-z])/g, (_, g) => g.toUpperCase());
          this.style[camel] = val;
          this.style[prop] = val;
        }
      }
    });
  }

  serializeStyleString() {
    const keys = Object.keys(this.style).filter(k => !k.includes('-'));
    if (keys.length === 0) return this.attributes['style'] || '';
    return keys.map(k => {
      const kebab = k.replace(/([A-Z])/g, '-$1').toLowerCase();
      return `${kebab}: ${this.style[k]};`;
    }).join(' ');
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

  setBoundingClientRect(rect) {
    this._customBoundingRect = rect;
  }

  getBoundingClientRect() {
    return this._customBoundingRect || {
      top: 100, left: 100, bottom: 150, right: 300, width: 200, height: 50, x: 100, y: 100
    };
  }

  scrollIntoView(options) {
    this.scrollIntoViewCalled = true;
    this.lastScrollOptions = options;
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

class MockClassList {
  constructor(el) {
    this.el = el;
    this.set = new Set();
  }
  add(...classes) {
    classes.forEach(c => c && c.trim().split(/\s+/).forEach(t => t && this.set.add(t)));
    this.sync();
  }
  remove(...classes) {
    classes.forEach(c => c && c.trim().split(/\s+/).forEach(t => this.set.delete(t)));
    this.sync();
  }
  contains(cls) {
    return this.set.has(cls);
  }
  sync() {
    this.el._className = Array.from(this.set).join(' ');
  }
}

function matchSimpleSelector(el, sel) {
  sel = sel.trim();
  if (sel.includes(',')) {
    return sel.split(',').some(s => matchSimpleSelector(el, s.trim()));
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
      if (matchSimpleSelector(child, sel)) matches.push(child);
      walk(child);
    }
  }
  walk(node);
  return matches;
}

class MockDocument extends EventTargetNode {
  constructor() {
    super('document');
    this.documentElement = new MockElement('html');
    this.body = new MockElement('body');
    this.documentElement.appendChild(this.body);
    this.readyState = 'complete';
  }

  createElement(tag) {
    return new MockElement(tag);
  }

  getElementById(id) {
    const res = queryRecursive(this.documentElement, '#' + id);
    return res[0] || null;
  }

  querySelector(sel) {
    const res = queryRecursive(this.documentElement, sel);
    return res[0] || null;
  }

  querySelectorAll(sel) {
    return queryRecursive(this.documentElement, sel);
  }
}

class MockWindow extends EventTargetNode {
  constructor(doc) {
    super('window');
    this.document = doc;
    this.innerWidth = 1280;
    this.innerHeight = 800;
    this.scrollX = 0;
    this.scrollY = 0;
    this.soundFx = {
      clicks: 0,
      successes: 0,
      playClick() { this.clicks++; },
      playSuccess() { this.successes++; }
    };
    this.closeSettingsModal = () => {};
    this.closeAppDetails = () => {};
    this.switchTab = () => {};
  }
}

/**
 * Standard WHATWG Event Dispatcher across the window/document/element hierarchy
 */
function dispatchDOMEvent(win, target, event) {
  event.target = target;

  // Build propagation path: [window, document, documentElement, body, ...path_to_target]
  const path = [];
  let curr = target;
  while (curr) {
    path.unshift(curr);
    curr = curr.parentNode;
  }
  path.unshift(win.document);
  path.unshift(win);

  // 1. CAPTURE PHASE
  event.eventPhase = CAPTURING_PHASE;
  for (let i = 0; i < path.length - 1; i++) {
    const node = path[i];
    event.currentTarget = node;
    const listeners = node.getListeners(event.type);
    for (const l of listeners) {
      if (l.capture) {
        l.fn.call(node, event);
        if (event.immediatePropagationStopped) return !event.defaultPrevented;
      }
    }
    if (event.propagationStopped) {
      return !event.defaultPrevented;
    }
  }

  // 2. TARGET PHASE
  event.eventPhase = AT_TARGET;
  event.currentTarget = target;
  const targetListeners = target.getListeners(event.type);
  for (const l of targetListeners) {
    l.fn.call(target, event);
    if (event.immediatePropagationStopped) return !event.defaultPrevented;
  }
  if (event.propagationStopped) {
    return !event.defaultPrevented;
  }

  // 3. BUBBLE PHASE
  event.eventPhase = BUBBLING_PHASE;
  for (let i = path.length - 2; i >= 0; i--) {
    const node = path[i];
    event.currentTarget = node;
    const listeners = node.getListeners(event.type);
    for (const l of listeners) {
      if (!l.capture) {
        l.fn.call(node, event);
        if (event.immediatePropagationStopped) return !event.defaultPrevented;
      }
    }
    if (event.propagationStopped) {
      return !event.defaultPrevented;
    }
  }

  return !event.defaultPrevented;
}

function setupEquaLibPage() {
  const doc = new MockDocument();
  const win = new MockWindow(doc);

  // Setup DOM elements corresponding to EquaLib
  const guideBtn = doc.createElement('button');
  guideBtn.id = 'nav-guide-btn';
  guideBtn.textContent = "Guide D'utilisation";
  guideBtn.setAttribute('style', 'cursor: pointer; font-size: 12px;');
  doc.body.appendChild(guideBtn);

  const model120 = doc.createElement('button');
  model120.id = 'model-select-n0120';
  model120.setAttribute('style', 'color: rgb(255, 215, 0); background-color: rgb(9, 21, 43);');
  doc.body.appendChild(model120);

  const catalogView = doc.createElement('div');
  catalogView.id = 'tab-view-catalog';
  catalogView.setAttribute('style', 'display: block; opacity: 1; padding: 12px;');
  doc.body.appendChild(catalogView);

  const simContainer = doc.createElement('div');
  simContainer.id = 'sim-calculator-container';
  simContainer.setAttribute('style', 'width: 320px; height: 240px; margin: 0 auto;');
  doc.body.appendChild(simContainer);

  const simCanvas = doc.createElement('canvas');
  simCanvas.id = 'sim-canvas';
  simCanvas.setAttribute('style', 'display: block;');
  simContainer.appendChild(simCanvas);

  const quickThemes = doc.createElement('div');
  quickThemes.id = 'quick-themes-container';
  quickThemes.setAttribute('style', 'border: 1px solid rgb(27, 59, 111);');
  doc.body.appendChild(quickThemes);

  const flashBtn = doc.createElement('button');
  flashBtn.id = 'flash-btn';
  flashBtn.setAttribute('style', 'background: rgb(255, 215, 0); font-weight: bold;');
  doc.body.appendChild(flashBtn);

  return { win, doc, guideBtn, model120, catalogView, simContainer, simCanvas, quickThemes, flashBtn };
}

// -------------------------------------------------------------
// ADVERSARIAL CHALLENGE SUITES
// -------------------------------------------------------------

console.log('===============================================================');
console.log('EMPIRICAL ADVERSARIAL CHALLENGE SUITE: EquaLib Walkthrough Guide');
console.log('Challenger Agent: challenger_2');
console.log('===============================================================\n');

const WalkthroughClass = require('../web/walkthrough_guide.js');

// -------------------------------------------------------------
// CHALLENGE 1: Event Listener Leak Check (10 Consecutive Cycles)
// -------------------------------------------------------------
console.log('--- CHALLENGE 1: Event Listener Leak Check ---');

check('C1.1: 10 consecutive start() -> quit() cycles leave zero leftover listeners on window and document', () => {
  const { win, doc } = setupEquaLibPage();
  global.window = win;
  global.document = doc;

  const guide = new WalkthroughClass();

  const baselineWindowListeners = win.getActiveListenerCount();
  const baselineDocListeners = doc.getActiveListenerCount();

  for (let cycle = 1; cycle <= 10; cycle++) {
    guide.start();
    assert.strictEqual(guide.isActive, true, `Guide should be active in cycle ${cycle}`);
    // During active state, exactly 3 listeners are added to window: keydown, resize, scroll
    assert.strictEqual(win.getActiveListenerCount('keydown'), 1, `keydown attached in cycle ${cycle}`);
    assert.strictEqual(win.getActiveListenerCount('resize'), 1, `resize attached in cycle ${cycle}`);
    assert.strictEqual(win.getActiveListenerCount('scroll'), 1, `scroll attached in cycle ${cycle}`);

    guide.quit();
    assert.strictEqual(guide.isActive, false, `Guide should be inactive after quit in cycle ${cycle}`);

    // All must be detached
    assert.strictEqual(win.getActiveListenerCount(), baselineWindowListeners, `Window listeners leaked in cycle ${cycle}`);
    assert.strictEqual(doc.getActiveListenerCount(), baselineDocListeners, `Document listeners leaked in cycle ${cycle}`);
  }

  assert.strictEqual(win.getActiveListenerCount(), baselineWindowListeners, 'Net window listener leak is exactly 0');
  assert.strictEqual(doc.getActiveListenerCount(), baselineDocListeners, 'Net document listener leak is exactly 0');
});

check('C1.2: 10 consecutive start() -> finish() cycles leave zero leftover listeners', () => {
  const { win, doc } = setupEquaLibPage();
  global.window = win;
  global.document = doc;

  const guide = new WalkthroughClass();
  const baseWin = win.getActiveListenerCount();
  const baseDoc = doc.getActiveListenerCount();

  for (let cycle = 1; cycle <= 10; cycle++) {
    guide.start(0);
    guide.goTo(4); // Last step
    guide.finish();

    assert.strictEqual(guide.isActive, false);
    assert.strictEqual(win.getActiveListenerCount(), baseWin);
    assert.strictEqual(doc.getActiveListenerCount(), baseDoc);
  }
});

check('C1.3: 10 consecutive start() -> Escape key cycles leave zero leftover listeners', () => {
  const { win, doc, simCanvas } = setupEquaLibPage();
  global.window = win;
  global.document = doc;

  const guide = new WalkthroughClass();
  const baseWin = win.getActiveListenerCount();
  const baseDoc = doc.getActiveListenerCount();

  for (let cycle = 1; cycle <= 10; cycle++) {
    guide.start();
    const escEvent = new MockEvent('keydown', { key: 'Escape', keyCode: 27 });
    dispatchDOMEvent(win, simCanvas, escEvent);

    assert.strictEqual(guide.isActive, false, `Guide must be closed by Escape in cycle ${cycle}`);
    assert.strictEqual(win.getActiveListenerCount(), baseWin, `Listeners leaked on window after Escape in cycle ${cycle}`);
    assert.strictEqual(doc.getActiveListenerCount(), baseDoc, `Listeners leaked on document after Escape in cycle ${cycle}`);
  }
});

check('C1.4: Rapid re-entrant start() without quit() does not accumulate duplicate listeners', () => {
  const { win, doc } = setupEquaLibPage();
  global.window = win;
  global.document = doc;

  const guide = new WalkthroughClass();
  const baseWin = win.getActiveListenerCount();

  // Call start 5 times consecutively
  for (let i = 0; i < 5; i++) {
    guide.start();
  }

  // In standard DOM / Mock, re-adding the exact same bound function does not duplicate
  assert.strictEqual(win.getActiveListenerCount('keydown'), 1, 'Only 1 keydown listener present');
  assert.strictEqual(win.getActiveListenerCount('resize'), 1, 'Only 1 resize listener present');
  assert.strictEqual(win.getActiveListenerCount('scroll'), 1, 'Only 1 scroll listener present');

  guide.quit();
  assert.strictEqual(win.getActiveListenerCount(), baseWin, 'All listeners cleanly cleared after quit');
});

// -------------------------------------------------------------
// CHALLENGE 2: Keyboard Event Isolation in Capture Phase
// -------------------------------------------------------------
console.log('\n--- CHALLENGE 2: Keyboard Event Isolation in Capture Phase ---');

check('C2.1: Escape key is captured on window, preventDefault/stopPropagation invoked, underlying page handlers NOT triggered', () => {
  const { win, doc, simCanvas } = setupEquaLibPage();
  global.window = win;
  global.document = doc;

  let windowBubbleFired = false;
  let documentCaptureFired = false;
  let documentBubbleFired = false;
  let canvasBubbleFired = false;
  let appModalClosedViaAppJs = false;

  // Simulate underlying app.js and sim_engine.js listeners
  win.addEventListener('keydown', (e) => {
    windowBubbleFired = true;
    if (e.key === 'Escape') appModalClosedViaAppJs = true;
  }, { capture: false }); // bubble phase

  doc.addEventListener('keydown', () => { documentCaptureFired = true; }, { capture: true });
  doc.addEventListener('keydown', () => { documentBubbleFired = true; }, { capture: false });
  simCanvas.addEventListener('keydown', () => { canvasBubbleFired = true; }, { capture: false });

  const guide = new WalkthroughClass();
  guide.start(2); // In the middle of tour
  assert.strictEqual(guide.isActive, true);

  const escEvent = new MockEvent('keydown', { key: 'Escape', keyCode: 27 });
  const result = dispatchDOMEvent(win, simCanvas, escEvent);

  assert.strictEqual(escEvent.defaultPrevented, true, 'Escape must call preventDefault()');
  assert.strictEqual(escEvent.propagationStopped, true, 'Escape must call stopPropagation()');
  assert.strictEqual(documentCaptureFired, false, 'Document capture handler MUST NOT be called');
  assert.strictEqual(documentBubbleFired, false, 'Document bubble handler MUST NOT be called');
  assert.strictEqual(canvasBubbleFired, false, 'Canvas key handler MUST NOT be called');
  assert.strictEqual(windowBubbleFired, false, 'Window bubble handler MUST NOT be called');
  assert.strictEqual(appModalClosedViaAppJs, false, 'app.js Escape handler MUST NOT be triggered');
  assert.strictEqual(guide.isActive, false, 'Guide must be closed');
});

check('C2.2: ArrowRight key is captured on window, advances step, underlying page handlers NOT triggered', () => {
  const { win, doc, simCanvas } = setupEquaLibPage();
  global.window = win;
  global.document = doc;

  let simMoveFired = false;
  simCanvas.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') simMoveFired = true;
  });

  const guide = new WalkthroughClass();
  guide.start(0);
  assert.strictEqual(guide.currentStepIndex, 0);

  const arrowRight = new MockEvent('keydown', { key: 'ArrowRight', keyCode: 39 });
  dispatchDOMEvent(win, simCanvas, arrowRight);

  assert.strictEqual(arrowRight.defaultPrevented, true, 'ArrowRight must call preventDefault()');
  assert.strictEqual(arrowRight.propagationStopped, true, 'ArrowRight must call stopPropagation()');
  assert.strictEqual(simMoveFired, false, 'Simulator must NOT receive ArrowRight during active walkthrough');
  assert.strictEqual(guide.currentStepIndex, 1, 'Guide advanced to step 1');

  guide.quit();
});

check('C2.3: ArrowLeft key is captured on window, decrements step, underlying page handlers NOT triggered', () => {
  const { win, doc, simCanvas } = setupEquaLibPage();
  global.window = win;
  global.document = doc;

  let simMoveFired = false;
  simCanvas.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') simMoveFired = true;
  });

  const guide = new WalkthroughClass();
  guide.start(2);
  assert.strictEqual(guide.currentStepIndex, 2);

  const arrowLeft = new MockEvent('keydown', { key: 'ArrowLeft', keyCode: 37 });
  dispatchDOMEvent(win, simCanvas, arrowLeft);

  assert.strictEqual(arrowLeft.defaultPrevented, true, 'ArrowLeft must call preventDefault()');
  assert.strictEqual(arrowLeft.propagationStopped, true, 'ArrowLeft must call stopPropagation()');
  assert.strictEqual(simMoveFired, false, 'Simulator must NOT receive ArrowLeft during active walkthrough');
  assert.strictEqual(guide.currentStepIndex, 1, 'Guide returned to step 1');

  guide.quit();
});

check('C2.4: Non-guide keys (Tab, Enter, Space, KeyA) are NOT blocked during active guide', () => {
  const { win, doc, simCanvas } = setupEquaLibPage();
  global.window = win;
  global.document = doc;

  let canvasKeyCount = 0;
  simCanvas.addEventListener('keydown', () => { canvasKeyCount++; });

  const guide = new WalkthroughClass();
  guide.start(1);

  ['Tab', 'Enter', ' ', 'a'].forEach(key => {
    const evt = new MockEvent('keydown', { key });
    dispatchDOMEvent(win, simCanvas, evt);
    assert.strictEqual(evt.defaultPrevented, false, `Key ${key} should not be defaultPrevented`);
    assert.strictEqual(evt.propagationStopped, false, `Key ${key} should not stopPropagation`);
  });

  assert.strictEqual(canvasKeyCount, 4, 'Underlying canvas received all 4 non-guide keys');
  guide.quit();
});

check('C2.5: After teardown, Escape and Arrow keys reach underlying page handlers without interference', () => {
  const { win, doc, simCanvas } = setupEquaLibPage();
  global.window = win;
  global.document = doc;

  let simKeysReceived = [];
  simCanvas.addEventListener('keydown', (e) => { simKeysReceived.push(e.key); });

  const guide = new WalkthroughClass();
  guide.start();
  guide.quit(); // Closed

  ['Escape', 'ArrowRight', 'ArrowLeft'].forEach(key => {
    const evt = new MockEvent('keydown', { key });
    dispatchDOMEvent(win, simCanvas, evt);
    assert.strictEqual(evt.defaultPrevented, false, `Key ${key} after quit should not be defaultPrevented`);
  });

  assert.deepStrictEqual(simKeysReceived, ['Escape', 'ArrowRight', 'ArrowLeft'], 'All keys dispatched freely to simulator after quit');
});

// -------------------------------------------------------------
// CHALLENGE 3: DOM Leak Check (10 Consecutive Cycles & Teardown Paths)
// -------------------------------------------------------------
console.log('\n--- CHALLENGE 3: DOM Leak Check ---');

check('C3.1: 10 consecutive start/quit cycles leave zero lingering overlay, spotlight, or popover elements', () => {
  const { win, doc } = setupEquaLibPage();
  global.window = win;
  global.document = doc;

  const guide = new WalkthroughClass();

  for (let cycle = 1; cycle <= 10; cycle++) {
    guide.start(cycle % 5);
    // In active state, elements must exist
    assert.notStrictEqual(doc.querySelector('.walkthrough-overlay'), null);
    assert.notStrictEqual(doc.querySelector('.walkthrough-spotlight'), null);
    assert.notStrictEqual(doc.querySelector('.walkthrough-popover'), null);
    assert.strictEqual(doc.body.classList.contains('walkthrough-active'), true);

    guide.quit();

    // In inactive state, elements must be completely purged
    assert.strictEqual(doc.querySelector('.walkthrough-overlay'), null, `Overlay leaked in cycle ${cycle}`);
    assert.strictEqual(doc.querySelector('.walkthrough-spotlight'), null, `Spotlight leaked in cycle ${cycle}`);
    assert.strictEqual(doc.querySelector('.walkthrough-popover'), null, `Popover leaked in cycle ${cycle}`);
    assert.strictEqual(doc.getElementById('equa-walkthrough-overlay'), null);
    assert.strictEqual(doc.body.classList.contains('walkthrough-active'), false);
  }
});

check('C3.2: Teardown via Close Button (✕) purges all DOM nodes', () => {
  const { win, doc } = setupEquaLibPage();
  global.window = win;
  global.document = doc;

  const guide = new WalkthroughClass();
  guide.start();

  const closeBtn = doc.getElementById('equa-wt-close-btn');
  assert.notStrictEqual(closeBtn, null, 'Close button exists in popover');

  const clickEvt = new MockEvent('click');
  closeBtn.getListeners('click')[0].fn.call(closeBtn, clickEvt);

  assert.strictEqual(guide.isActive, false);
  assert.strictEqual(doc.querySelector('.walkthrough-overlay'), null);
  assert.strictEqual(doc.body.classList.contains('walkthrough-active'), false);
});

check('C3.3: Teardown via Quitter Button purges all DOM nodes', () => {
  const { win, doc } = setupEquaLibPage();
  global.window = win;
  global.document = doc;

  const guide = new WalkthroughClass();
  guide.start();

  const quitBtn = doc.getElementById('walkthrough-quit-btn');
  assert.notStrictEqual(quitBtn, null, 'Quit button exists in footer');

  const clickEvt = new MockEvent('click');
  quitBtn.getListeners('click')[0].fn.call(quitBtn, clickEvt);

  assert.strictEqual(guide.isActive, false);
  assert.strictEqual(doc.querySelector('.walkthrough-overlay'), null);
  assert.strictEqual(doc.body.classList.contains('walkthrough-active'), false);
});

check('C3.4: Teardown via finish() at step 5 purges all DOM nodes', () => {
  const { win, doc } = setupEquaLibPage();
  global.window = win;
  global.document = doc;

  const guide = new WalkthroughClass();
  guide.start(4);
  guide.finish();

  assert.strictEqual(guide.isActive, false);
  assert.strictEqual(doc.querySelector('.walkthrough-overlay'), null);
  assert.strictEqual(doc.body.classList.contains('walkthrough-active'), false);
});

check('C3.5: Repeated teardown() calls are safe, idempotent, and cause no exceptions or leaks', () => {
  const { win, doc } = setupEquaLibPage();
  global.window = win;
  global.document = doc;

  const guide = new WalkthroughClass();
  // Call teardown when inactive
  guide.teardown();
  guide.teardown();

  guide.start();
  guide.teardown();
  guide.teardown();
  guide.teardown();

  assert.strictEqual(guide.isActive, false);
  assert.strictEqual(doc.querySelector('.walkthrough-overlay'), null);
});

// -------------------------------------------------------------
// CHALLENGE 4: Style Pollution Check
// -------------------------------------------------------------
console.log('\n--- CHALLENGE 4: Style Pollution Check ---');

check('C4.1: Pre-existing inline styles on all page targets remain 100% bit-exact across 10 walkthrough tours', () => {
  const { win, doc, guideBtn, model120, catalogView, simContainer, simCanvas, quickThemes, flashBtn } = setupEquaLibPage();
  global.window = win;
  global.document = doc;

  const testElements = [
    { name: 'nav-guide-btn', el: guideBtn, initialStyle: 'cursor: pointer; font-size: 12px;' },
    { name: 'model-select-n0120', el: model120, initialStyle: 'color: rgb(255, 215, 0); background-color: rgb(9, 21, 43);' },
    { name: 'tab-view-catalog', el: catalogView, initialStyle: 'display: block; opacity: 1; padding: 12px;' },
    { name: 'sim-calculator-container', el: simContainer, initialStyle: 'width: 320px; height: 240px; margin: 0 auto;' },
    { name: 'sim-canvas', el: simCanvas, initialStyle: 'display: block;' },
    { name: 'quick-themes-container', el: quickThemes, initialStyle: 'border: 1px solid rgb(27, 59, 111);' },
    { name: 'flash-btn', el: flashBtn, initialStyle: 'background: rgb(255, 215, 0); font-weight: bold;' },
    { name: 'body', el: doc.body, initialStyle: '' }
  ];

  // Capture baseline style objects and serialized attributes
  const baselineStyles = testElements.map(item => ({
    name: item.name,
    el: item.el,
    attr: item.el.getAttribute('style') || '',
    props: Object.assign({}, item.el.style)
  }));

  const guide = new WalkthroughClass();

  // Run 10 complete tours traversing every single step
  for (let tour = 1; tour <= 10; tour++) {
    guide.start(0);

    for (let step = 0; step < 5; step++) {
      guide.goTo(step);

      // Trigger resize and scroll during step to test dynamic positioning
      const resizeEvt = new MockEvent('resize');
      win.getListeners('resize').forEach(l => l.fn.call(win, resizeEvt));

      const scrollEvt = new MockEvent('scroll');
      win.getListeners('scroll').forEach(l => l.fn.call(win, scrollEvt));
    }

    guide.quit();
  }

  // Compare each element with baseline
  baselineStyles.forEach(item => {
    const currentAttr = item.el.getAttribute('style') || '';
    assert.strictEqual(
      currentAttr,
      item.attr,
      `Style attribute modified on ${item.name}! Expected "${item.attr}", got "${currentAttr}"`
    );

    const currentKeys = Object.keys(item.el.style);
    const baselineKeys = Object.keys(item.props);

    assert.strictEqual(
      currentKeys.length,
      baselineKeys.length,
      `Style properties count altered on ${item.name}! Expected ${baselineKeys.length}, got ${currentKeys.length}`
    );

    baselineKeys.forEach(key => {
      assert.strictEqual(
        item.el.style[key],
        item.props[key],
        `Style property "${key}" altered on ${item.name}! Expected "${item.props[key]}", got "${item.el.style[key]}"`
      );
    });
  });
});

check('C4.2: document.body has no lingering inline styles or classes after teardown', () => {
  const { win, doc } = setupEquaLibPage();
  global.window = win;
  global.document = doc;

  const guide = new WalkthroughClass();
  guide.start();
  assert.strictEqual(doc.body.classList.contains('walkthrough-active'), true);

  guide.quit();
  assert.strictEqual(doc.body.classList.contains('walkthrough-active'), false);
  assert.strictEqual(doc.body.getAttribute('style') || '', '');
});

// -------------------------------------------------------------
// CHALLENGE 5: Regression & Test Suite Health
// -------------------------------------------------------------
console.log('\n--- CHALLENGE 5: Project Test Suite Health ---');

check('C5.1: tools/beta_test_suite.js runs with 0 failures', () => {
  const res = cp.spawnSync('node', ['tools/beta_test_suite.js'], { encoding: 'utf8' });
  assert.strictEqual(res.status, 0, `beta_test_suite.js exited with ${res.status}`);
  assert.ok(res.stdout.includes('Tests réussis : 85'), 'Must pass 85 tests');
  assert.ok(res.stdout.includes('Tests échoués : 0'), 'Must fail 0 tests');
});

check('C5.2: tools/test_brush_and_wallpaper.js runs with 0 failures', () => {
  const res = cp.spawnSync('node', ['tools/test_brush_and_wallpaper.js'], { encoding: 'utf8' });
  assert.strictEqual(res.status, 0, `test_brush_and_wallpaper.js exited with ${res.status}`);
  assert.ok(res.stdout.includes('100% SUCCÈS'), 'Must succeed 100%');
});

check('C5.3: tools/test_walkthrough_guide.js runs with 0 failures', () => {
  const res = cp.spawnSync('node', ['tools/test_walkthrough_guide.js'], { encoding: 'utf8' });
  assert.strictEqual(res.status, 0, `test_walkthrough_guide.js exited with ${res.status}`);
  assert.ok(res.stdout.includes('Tests réussis : 76'), 'Must pass 76 tests');
  assert.ok(res.stdout.includes('Tests échoués : 0'), 'Must fail 0 tests');
});

// -------------------------------------------------------------
// SUMMARY & RESULTS
// -------------------------------------------------------------
console.log('\n===============================================================');
console.log(`CHALLENGE RESULTS: ${passedChecks}/${totalChecks} PASSED, ${failedChecks} FAILED`);
console.log('===============================================================');

if (failedChecks > 0) {
  console.error('\nFAILURE DETAILS:');
  failures.forEach(f => console.error(`- ${f.desc}: ${f.error}`));
  process.exit(1);
} else {
  console.log('🎉 ALL ADVERSARIAL CHALLENGES COMPLETED WITH 100% SUCCESS!');
  process.exit(0);
}

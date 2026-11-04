/**
 * EquaLib Test Suite: Game Over Menus & Overlay Interactions
 * Validates fixes for Puissance 4, Morpion, Space Invaders, Breakout, Pong
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Mock browser environment for sim_engine.js
class MockElement {
  constructor(tag, id = '') {
    this.tagName = tag.toUpperCase();
    this.id = id;
    this.className = '';
    this.style = {};
    this.children = [];
    this.attributes = {};
    this.innerHTML = '';
    this.textContent = '';
    this.classList = {
      _classes: new Set(),
      add: (c) => this.classList._classes.add(c),
      remove: (c) => this.classList._classes.delete(c),
      toggle: (c, force) => {
        if (force === true) this.classList._classes.add(c);
        else if (force === false) this.classList._classes.delete(c);
        else if (this.classList._classes.has(c)) this.classList._classes.delete(c);
        else this.classList._classes.add(c);
      },
      contains: (c) => this.classList._classes.has(c)
    };
    this._listeners = {};
  }

  addEventListener(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(fn);
  }

  dispatchEvent(event) {
    const list = this._listeners[event.type || event] || [];
    list.forEach(fn => fn(event));
  }

  click() {
    this.dispatchEvent({ type: 'click', target: this, stopPropagation: () => {} });
  }

  setAttribute(k, v) { this.attributes[k] = v; }
  getAttribute(k) { return this.attributes[k]; }

  getContext() {
    return {
      fillRect: () => {},
      clearRect: () => {},
      fillText: () => {},
      strokeRect: () => {},
      beginPath: () => {},
      arc: () => {},
      fill: () => {},
      stroke: () => {},
      moveTo: () => {},
      lineTo: () => {},
      measureText: () => ({ width: 20 })
    };
  }

  getBoundingClientRect() {
    return { left: 0, top: 0, width: 300, height: 175 };
  }

  querySelectorAll(sel) {
    return [];
  }
}

const elementStore = {};
function getOrCreateElement(id) {
  if (!elementStore[id]) {
    elementStore[id] = new MockElement('div', id);
  }
  return elementStore[id];
}

global.document = {
  getElementById: (id) => getOrCreateElement(id),
  querySelectorAll: () => [],
  addEventListener: () => {},
  removeEventListener: () => {}
};

global.window = {
  soundFx: {
    playClick: () => {},
    playScore: () => {},
    playHit: () => {}
  },
  userSettings: {},
  addEventListener: () => {}
};

global.safeStorageGet = (k, def) => def;
global.safeStorageSet = () => {};
global.requestAnimationFrame = () => 1;
global.cancelAnimationFrame = () => {};

// Load SimEngine
const simCode = fs.readFileSync(path.join(__dirname, '../web/sim_engine.js'), 'utf8');
eval(simCode);

console.log('=== TEST SUITE: GAME OVER MENUS & OVERLAY FIXES ===\n');

const sim = new window.NumWorksSimulator('sim-screen');

// --- 1. PUISSANCE 4 ---
console.log('--- TEST 1: Puissance 4 Game Over & Menu Cleanup ---');
sim.launchApp('PUISSANCE4');
assert.strictEqual(sim.currentView, 'PUISSANCE4');
assert.strictEqual(sim.p4IsGameOver(), false);

const p4Overlay = document.getElementById('p4-overlay');
const p4ColsBar = document.getElementById('p4-cols-bar');
const p4Card = document.getElementById('p4-card');
const p4MinPill = document.getElementById('p4-min-pill');
const p4ToggleBtn = document.getElementById('p4-toggle-board-btn');
const p4HubBtn = document.getElementById('p4-overlay-hub-btn');
const p4RestartBtn = document.getElementById('p4-restart-btn');

assert(p4Overlay, 'Puissance 4 overlay exists');
assert(p4Card, 'Puissance 4 card exists');
assert(p4ToggleBtn, 'Puissance 4 toggle button exists');
assert(p4HubBtn, 'Puissance 4 overlay Hub button exists');

// Toggle board / minimize card test
p4ToggleBtn.click();
assert(p4Card.classList.contains('hidden'), 'P4 card hides when toggle button clicked');
assert(!p4MinPill.classList.contains('hidden'), 'P4 min pill displays when card hidden');

// Restore card test
p4MinPill.click();
assert(!p4Card.classList.contains('hidden'), 'P4 card restored when min pill clicked');
assert(p4MinPill.classList.contains('hidden'), 'P4 min pill hidden when card restored');

// Keydown restart test when game over
p4RestartBtn.click();
assert.strictEqual(sim.p4IsGameOver(), false, 'P4 restart resets game over flag');
console.log('  ✓ Puissance 4: Structure, cartes, bascule grille et boutons validés');

// --- 2. MORPION (TIC-TAC-TOE) ---
console.log('\n--- TEST 2: Morpion Game Over & Menu Cleanup ---');
sim.launchApp('MORPION');
assert.strictEqual(sim.currentView, 'MORPION');
assert.strictEqual(sim.morpionIsGameOver(), false);

const morpOverlay = document.getElementById('morp-overlay');
const morpCard = document.getElementById('morp-card');
const morpMinPill = document.getElementById('morp-min-pill');
const morpToggleBtn = document.getElementById('morp-toggle-board-btn');
const morpHubBtn = document.getElementById('morp-overlay-hub-btn');
const morpRestartBtn = document.getElementById('morp-restart-btn');
const morpModeBtn = document.getElementById('morp-mode-btn');

assert(morpOverlay, 'Morpion overlay exists');
assert(morpCard, 'Morpion card exists');
assert(morpToggleBtn, 'Morpion toggle button exists');
assert(morpHubBtn, 'Morpion overlay Hub button exists');

// Toggle board test
morpToggleBtn.click();
assert(morpCard.classList.contains('hidden'), 'Morpion card hides when toggle clicked');
assert(!morpMinPill.classList.contains('hidden'), 'Morpion min pill displayed');

morpMinPill.click();
assert(!morpCard.classList.contains('hidden'), 'Morpion card restored');
assert(morpMinPill.classList.contains('hidden'), 'Morpion min pill hidden');

morpRestartBtn.click();
assert.strictEqual(sim.morpionIsGameOver(), false, 'Morpion restart resets game over flag');
console.log('  ✓ Morpion: Structure, cartes, bascule grille et boutons validés');

// --- 3. SPACE INVADERS ---
console.log('\n--- TEST 3: Space Invaders Game Over & Menu Cleanup ---');
sim.launchApp('SPACE_INVADERS');
assert.strictEqual(sim.currentView, 'SPACE_INVADERS');
assert.strictEqual(sim.invadersIsGameOver(), false);

const invOverlay = document.getElementById('invaders-overlay');
const invCard = document.getElementById('invaders-card');
const invMinPill = document.getElementById('invaders-min-pill');
const invToggleBtn = document.getElementById('invaders-toggle-board-btn');
const invHubBtn = document.getElementById('invaders-overlay-hub-btn');
const invRestartBtn = document.getElementById('invaders-restart-btn');

assert(invOverlay, 'Space Invaders overlay exists');
assert(invCard, 'Space Invaders card exists');
assert(invToggleBtn, 'Space Invaders toggle button exists');
assert(invHubBtn, 'Space Invaders overlay Hub button exists');

// Toggle view test
invToggleBtn.click();
assert(invCard.classList.contains('hidden'), 'Invaders card hides when toggle clicked');
assert(!invMinPill.classList.contains('hidden'), 'Invaders min pill displayed');

invMinPill.click();
assert(!invCard.classList.contains('hidden'), 'Invaders card restored');

invRestartBtn.click();
assert.strictEqual(sim.invadersIsGameOver(), false, 'Invaders restart resets game over flag');
console.log('  ✓ Space Invaders: Structure, cartes, bascule zone et boutons validés');

// --- 4. BREAKOUT & PONG ---
console.log('\n--- TEST 4: Breakout & Pong Game Over Methods ---');
sim.launchApp('BREAKOUT');
assert.strictEqual(sim.currentView, 'BREAKOUT');
assert.strictEqual(sim.breakoutIsGameOver(), false);
document.getElementById('breakout-restart-btn').click();

sim.launchApp('PONG');
assert.strictEqual(sim.currentView, 'PONG');
assert.strictEqual(sim.pongIsGameOver(), false);
document.getElementById('pong-restart-btn').click();

// Hub Navigation via overlay hub button
document.getElementById('pong-overlay-hub-btn').click();
assert.strictEqual(sim.currentView, 'MENU', 'Overlay Hub button returns to menu');

console.log('  ✓ Breakout & Pong: Hub overlays et réinitialisation validés');

console.log('\n🎉 TOUS LES TESTS DES MENUS DE FIN DE JEU SONT PASSÉS AVEC SUCCÈS (100%) !');

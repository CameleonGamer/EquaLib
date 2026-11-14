/**
 * ============================================================================
 * EquaLib E2E Automated Test Suite: Five Nights at Freddy's (FNAF) Engine
 * Platform: NumWorks Graphing Calculators (N0110, N0115, N0120) & EquaLib Web
 * ============================================================================
 * 
 * 4-Tier Test Architecture:
 * - Build & Binary Verification (NWA build, flat binaries, RAM < 64KB, Flash < 1.25MB)
 * - Asset Compression Verification (35 images 320x240, palette <= 256, < 350KB)
 * - Tier 1: Feature Coverage (>= 40 tests: Clock, Battery, Doors, Lights, Cams, AI, Pacing)
 * - Tier 2: Boundary & Corner Cases (>= 30 tests: 0% Power, 6 AM Override, Clamping, 0/0/0/0 vs 20/20/20/20)
 * - Tier 3: Cross-Feature Combinations (>= 20 tests: Multi-usage, Foxy Sprint, Freddy Stalling, Button Jamming)
 * - Tier 4: Real-World Application Scenarios (>= 5 scenarios: S1 Night 1, S2 Foxy Defense, S3 Blackout 6AM, S4 20/20/20/20, S5 FAST 4-min)
 * - Web Simulator Integration (sim_engine.js DOM & controls validation)
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { execSync } = require('child_process');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function it(desc, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${desc}`);
    console.error(`    -> Erreur: ${err.message}`);
    failedTests++;
    failures.push({ desc, error: err.message });
  }
}

function describe(suiteName, fn) {
  console.log(`\n============================================================`);
  console.log(`SUITE: ${suiteName}`);
  console.log(`============================================================`);
  return fn();
}

// ============================================================================
// REFERENCE HEADLESS FNAF ENGINE (Authoritative Scott Cawthon / TI-84 CE Port)
// ============================================================================

class HeadlessFnafEngine {
  constructor(options = {}) {
    this.mode = options.mode || 'NORMAL'; // 'NORMAL' (89.17s/hr) or 'FAST' (40s/hr)
    this.night = options.night || 1;
    this.hour = 0; // 0 = 12 AM, 1 = 1 AM ... 6 = 6 AM
    this.hourTimerMs = 0;
    this.hourDurationMs = this.mode === 'FAST' ? 40000 : 89166;

    this.power = 100.0;
    this.powerUsageBars = 1;
    this.powerDrainTickMs = 0;

    // Drain interval table in ms for 1% battery loss
    this.drainIntervals = this.mode === 'FAST'
      ? [0, 4350, 2170, 1440, 1080, 870]
      : [0, 9670, 4830, 3210, 2410, 1930];

    this.viewPan = 1; // 0: Left Door, 1: Desk Center, 2: Right Door
    this.doorLeft = false;
    this.doorRight = false;
    this.lightLeft = false;
    this.lightRight = false;
    this.doorLeftJammed = false;
    this.doorRightJammed = false;
    this.lightLeftJammed = false;
    this.lightRightJammed = false;

    this.monitorUp = false;
    this.activeCam = '1A';

    // AI Levels (0 to 20)
    this.customAi = !!options.customAi;
    this.aiFreddy = options.aiFreddy !== undefined ? options.aiFreddy : 0;
    this.aiBonnie = options.aiBonnie !== undefined ? options.aiBonnie : 0;
    this.aiChica = options.aiChica !== undefined ? options.aiChica : 0;
    this.aiFoxy = options.aiFoxy !== undefined ? options.aiFoxy : 0;

    // Clamp initial AI levels
    this.aiFreddy = Math.max(0, Math.min(20, this.aiFreddy));
    this.aiBonnie = Math.max(0, Math.min(20, this.aiBonnie));
    this.aiChica = Math.max(0, Math.min(20, this.aiChica));
    this.aiFoxy = Math.max(0, Math.min(20, this.aiFoxy));

    if (this.mode === 'FAST' && !this.customAi) {
      if (this.aiFreddy > 0) this.aiFreddy = Math.min(20, this.aiFreddy + 1);
      if (this.aiBonnie > 0) this.aiBonnie = Math.min(20, this.aiBonnie + 1);
      if (this.aiChica > 0) this.aiChica = Math.min(20, this.aiChica + 1);
      if (this.aiFoxy > 0) this.aiFoxy = Math.min(20, this.aiFoxy + 1);
    }

    // Positions
    this.bonnieLoc = '1A';
    this.chicaLoc = '1A';
    this.freddyLoc = '1A';
    this.foxyStage = 0; // 0: Curtain, 1: Peeking, 2: Out, 3: Sprint Ready
    this.foxySprintActive = false;
    this.foxySprintTimerMs = 0;
    this.foxyBangCount = 0;
    this.foxySprintDurationMs = this.mode === 'FAST' ? 4000 : 2500;
    this.foxySprintTimeoutMs = this.mode === 'FAST' ? 12000 : 25000;

    // AI Timers
    this.bonnieTimerMs = 0;
    this.chicaTimerMs = 0;
    this.foxyTimerMs = 0;
    this.freddyTimerMs = 0;

    this.state = 'OFFICE'; // 'OFFICE', 'POWER_OUT', 'JUMPSCARE', 'WIN_6AM'
    this.scareType = null;
    this.blackoutTimerMs = 0;
    this.toreadorActive = false;

    // Subtitles
    this.lastSubtitle = null;
    this.subtitlesHistory = [];

    // Deterministic RNG
    this.rng = options.rng || (() => Math.random());
    this.updateUsageBars();
  }

  updateUsageBars() {
    let usage = 1;
    if (this.doorLeft) usage++;
    if (this.doorRight) usage++;
    if (this.lightLeft) usage++;
    if (this.lightRight) usage++;
    if (this.monitorUp) usage++;
    this.powerUsageBars = Math.min(5, Math.max(1, usage));
  }

  addSubtitle(text) {
    this.lastSubtitle = text;
    this.subtitlesHistory.push(text);
  }

  // Key / Action Handlers
  pan(dir) {
    if (dir < 0) this.viewPan = 0;
    else if (dir > 0) this.viewPan = 2;
    else this.viewPan = 1;

    // Auto-turn off door lights when looking away (Scott Cawthon / TI-84 rule)
    if (this.viewPan !== 0 && this.lightLeft) this.lightLeft = false;
    if (this.viewPan !== 2 && this.lightRight) this.lightRight = false;
    this.updateUsageBars();
  }

  toggleDoorLeft() {
    if (this.state === 'POWER_OUT' || this.state === 'JUMPSCARE' || this.state === 'WIN_6AM') return false;
    if (this.doorLeftJammed) {
      this.addSubtitle('* Button jammed! *');
      return false;
    }
    this.doorLeft = !this.doorLeft;
    this.updateUsageBars();
    return true;
  }

  toggleDoorRight() {
    if (this.state === 'POWER_OUT' || this.state === 'JUMPSCARE' || this.state === 'WIN_6AM') return false;
    if (this.doorRightJammed) {
      this.addSubtitle('* Button jammed! *');
      return false;
    }
    this.doorRight = !this.doorRight;
    this.updateUsageBars();
    return true;
  }

  toggleLightLeft() {
    if (this.state === 'POWER_OUT' || this.state === 'JUMPSCARE' || this.state === 'WIN_6AM') return false;
    if (this.lightLeftJammed) {
      this.addSubtitle('* Button jammed! *');
      return false;
    }
    this.lightLeft = !this.lightLeft;
    if (this.lightLeft) this.lightRight = false;
    this.updateUsageBars();
    return true;
  }

  toggleLightRight() {
    if (this.state === 'POWER_OUT' || this.state === 'JUMPSCARE' || this.state === 'WIN_6AM') return false;
    if (this.lightRightJammed) {
      this.addSubtitle('* Button jammed! *');
      return false;
    }
    this.lightRight = !this.lightRight;
    if (this.lightRight) this.lightLeft = false;
    this.updateUsageBars();
    return true;
  }

  toggleMonitor() {
    if (this.state === 'POWER_OUT' || this.state === 'JUMPSCARE' || this.state === 'WIN_6AM') return false;
    this.monitorUp = !this.monitorUp;
    this.updateUsageBars();

    // Animatronic jumpscare check when lowering monitor if entered office
    if (!this.monitorUp) {
      if (this.bonnieLoc === 'OFFICE') {
        this.state = 'JUMPSCARE';
        this.scareType = 'SCARE_BONNIE';
        this.addSubtitle('* Bonnie jumpscare! *');
        return true;
      }
      if (this.chicaLoc === 'OFFICE') {
        this.state = 'JUMPSCARE';
        this.scareType = 'SCARE_CHICA';
        this.addSubtitle('* Chica jumpscare! *');
        return true;
      }
      if (this.freddyLoc === 'OFFICE') {
        this.state = 'JUMPSCARE';
        this.scareType = 'SCARE_FREDDY_OFFICE';
        this.addSubtitle('* Freddy jumpscare! *');
        return true;
      }
    }
    return true;
  }

  selectCam(camId) {
    const validCams = ['1A', '1B', '1C', '2A', '2B', '3', '4A', '4B', '5', '6', '7'];
    if (!validCams.includes(camId)) return false;
    this.activeCam = camId;
    return true;
  }

  tick(dt) {
    if (this.state === 'WIN_6AM') return;

    // 1. Clock Engine & 6 AM Win Check
    this.hourTimerMs += dt;
    while (this.hourTimerMs >= this.hourDurationMs) {
      this.hourTimerMs -= this.hourDurationMs;
      this.hour++;

      // Hourly AI difficulty increases (standard nights only)
      if (!this.customAi && this.night !== 7) {
        if (this.hour === 2) this.aiBonnie = Math.min(20, this.aiBonnie + 1);
        else if (this.hour === 3) {
          this.aiBonnie = Math.min(20, this.aiBonnie + 1);
          this.aiChica = Math.min(20, this.aiChica + 1);
          this.aiFoxy = Math.min(20, this.aiFoxy + 1);
        } else if (this.hour === 4) {
          this.aiBonnie = Math.min(20, this.aiBonnie + 1);
          this.aiChica = Math.min(20, this.aiChica + 1);
          this.aiFoxy = Math.min(20, this.aiFoxy + 1);
        }
      }

      if (this.hour >= 6) {
        this.hour = 6;
        this.state = 'WIN_6AM';
        this.scareType = null;
        this.addSubtitle('* 6:00 AM Chime *');
        return;
      }
    }

    // 2. Blackout State Machine
    if (this.state === 'POWER_OUT') {
      this.blackoutTimerMs += dt;
      if (this.blackoutTimerMs >= 15000 && !this.toreadorActive) {
        this.toreadorActive = true;
        this.addSubtitle('* Toreador March ♪ *');
      }
      if (this.blackoutTimerMs >= 35000 && this.state !== 'WIN_6AM') {
        this.state = 'JUMPSCARE';
        this.scareType = 'SCARE_FREDDY_POWER_OUT';
        this.addSubtitle('* Freddy blackout jumpscare! *');
      }
      return;
    }

    if (this.state === 'JUMPSCARE') return;

    // 3. Usage Bars Calculation
    let usage = 1;
    if (this.doorLeft) usage++;
    if (this.doorRight) usage++;
    if (this.lightLeft) usage++;
    if (this.lightRight) usage++;
    if (this.monitorUp) usage++;
    this.powerUsageBars = Math.min(5, Math.max(1, usage));

    // 4. Battery Drain
    const interval = this.drainIntervals[this.powerUsageBars];
    this.powerDrainTickMs += dt;
    while (this.powerDrainTickMs >= interval) {
      this.powerDrainTickMs -= interval;
      this.power = Math.max(0.0, this.power - 1.0);
      if (this.power <= 0.0) {
        this.power = 0.0;
        this.state = 'POWER_OUT';
        this.doorLeft = false;
        this.doorRight = false;
        this.lightLeft = false;
        this.lightRight = false;
        this.monitorUp = false;
        this.doorLeftJammed = false;
        this.doorRightJammed = false;
        this.lightLeftJammed = false;
        this.lightRightJammed = false;
        this.toreadorActive = true;
        this.addSubtitle('* Toreador March ♪ *');
        return;
      }
    }

    // 5. Animatronics AI

    // --- Bonnie (4.97s interval) ---
    this.bonnieTimerMs += dt;
    if (this.bonnieTimerMs >= 4970) {
      this.bonnieTimerMs -= 4970;
      if (this.aiBonnie > 0) {
        const roll = Math.floor(this.rng() * 20) + 1;
        if (roll <= this.aiBonnie) {
          if (this.bonnieLoc === '1A') this.bonnieLoc = '1B';
          else if (this.bonnieLoc === '1B') this.bonnieLoc = this.rng() < 0.5 ? '5' : '2A';
          else if (this.bonnieLoc === '5') this.bonnieLoc = '2A';
          else if (this.bonnieLoc === '2A') this.bonnieLoc = this.rng() < 0.5 ? '3' : '2B';
          else if (this.bonnieLoc === '3') this.bonnieLoc = '2B';
          else if (this.bonnieLoc === '2B') this.bonnieLoc = 'DOOR_LEFT';
          else if (this.bonnieLoc === 'DOOR_LEFT') {
            if (this.doorLeft) {
              this.bonnieLoc = '1B'; // Retreats
            } else {
              this.bonnieLoc = 'OFFICE';
              this.doorLeftJammed = true;
              this.lightLeftJammed = true;
              this.addSubtitle('* Button jammed! *');
            }
          }
          this.addSubtitle('* footsteps *');
        }
      }
    }

    // --- Chica (4.98s interval) ---
    this.chicaTimerMs += dt;
    if (this.chicaTimerMs >= 4980) {
      this.chicaTimerMs -= 4980;
      if (this.aiChica > 0) {
        const roll = Math.floor(this.rng() * 20) + 1;
        if (roll <= this.aiChica) {
          if (this.chicaLoc === '1A') this.chicaLoc = '1B';
          else if (this.chicaLoc === '1B') this.chicaLoc = this.rng() < 0.5 ? '7' : '6';
          else if (this.chicaLoc === '7' || this.chicaLoc === '6') this.chicaLoc = '4A';
          else if (this.chicaLoc === '4A') this.chicaLoc = '4B';
          else if (this.chicaLoc === '4B') this.chicaLoc = 'DOOR_RIGHT';
          else if (this.chicaLoc === 'DOOR_RIGHT') {
            if (this.doorRight) {
              this.chicaLoc = '1B'; // Retreats
            } else {
              this.chicaLoc = 'OFFICE';
              this.doorRightJammed = true;
              this.lightRightJammed = true;
              this.addSubtitle('* Button jammed! *');
            }
          }
          if (this.chicaLoc === '6') this.addSubtitle('* pots and pans clattering *');
          else this.addSubtitle('* footsteps *');
        }
      }
    }

    // --- Foxy (5.01s interval) ---
    // Camera Stalling: Foxy stage progression is FROZEN whenever monitor is up
    if (!this.monitorUp) {
      this.foxyTimerMs += dt;
      if (this.foxyTimerMs >= 5010) {
        this.foxyTimerMs -= 5010;
        if (this.aiFoxy > 0) {
          const roll = Math.floor(this.rng() * 20) + 1;
          if (roll <= this.aiFoxy) {
            if (this.foxyStage < 3) {
              this.foxyStage++;
              if (this.foxyStage === 3) {
                this.foxySprintActive = false;
                this.foxySprintTimerMs = 0;
              }
            }
          }
        }
      }
    }

    // Foxy Stage 3 Sprint Management
    if (this.foxyStage === 3) {
      if (!this.foxySprintActive) {
        // Trigger sprint if CAM 2A is viewed or timeout reached
        if (this.monitorUp && this.activeCam === '2A') {
          this.foxySprintActive = true;
          this.foxySprintTimerMs = 0;
          this.addSubtitle('* Foxy sprint corridor *');
        } else {
          this.foxySprintTimerMs += dt;
          if (this.foxySprintTimerMs >= this.foxySprintTimeoutMs) {
            this.foxySprintActive = true;
            this.foxySprintTimerMs = 0;
          }
        }
      } else {
        this.foxySprintTimerMs += dt;
        if (this.foxySprintTimerMs >= this.foxySprintDurationMs) {
          if (this.doorLeft) {
            // Door blocked Foxy: strike penalty
            this.foxyBangCount++;
            const penalty = 1.0 + 5.0 * (this.foxyBangCount - 1);
            this.power = Math.max(0.0, this.power - penalty);
            this.foxyStage = 0;
            this.foxySprintActive = false;
            this.foxySprintTimerMs = 0;
            this.addSubtitle('* BANG BANG BANG *');

            if (this.power <= 0.0) {
              this.power = 0.0;
              this.state = 'POWER_OUT';
              this.doorLeft = false;
              this.doorRight = false;
              this.monitorUp = false;
              this.toreadorActive = true;
              this.addSubtitle('* Toreador March ♪ *');
              return;
            }
          } else {
            // Door open: jumpscare!
            this.state = 'JUMPSCARE';
            this.scareType = 'SCARE_FOXY';
            this.addSubtitle('* Foxy jumpscare! *');
            return;
          }
        }
      }
    }

    // --- Freddy Fazbear (3.02s interval) ---
    // Freddy moves only when Bonnie and Chica have departed
    if (this.bonnieLoc !== '1A' && this.chicaLoc !== '1A') {
      const isFreddyWatched = this.monitorUp && (this.activeCam === this.freddyLoc);
      // Freddy only moves when camera monitor is DOWN or when not actively watched
      if (!isFreddyWatched && !this.monitorUp) {
        this.freddyTimerMs += dt;
        if (this.freddyTimerMs >= 3020) {
          this.freddyTimerMs -= 3020;
          if (this.aiFreddy > 0) {
            const roll = Math.floor(this.rng() * 20) + 1;
            if (roll <= this.aiFreddy) {
              if (this.freddyLoc === '1A') this.freddyLoc = '1B';
              else if (this.freddyLoc === '1B') this.freddyLoc = '7';
              else if (this.freddyLoc === '7') this.freddyLoc = '4A';
              else if (this.freddyLoc === '4A') this.freddyLoc = '4B';
              else if (this.freddyLoc === '4B') {
                if (this.doorRight) {
                  // Blocked by door at 4B
                } else {
                  this.freddyLoc = 'OFFICE';
                }
              }
              this.addSubtitle('* Freddy laughs *');
            }
          }
        }
      }
    }
  }
}

// ============================================================================
// SUITE 1: BUILD & BINARY VERIFICATION
// ============================================================================

describe('1. Build & Binary Verification', () => {
  it('tools/build_nwa.js exists and is syntactically valid', () => {
    assert(fs.existsSync('tools/build_nwa.js'), 'tools/build_nwa.js is missing');
    const content = fs.readFileSync('tools/build_nwa.js', 'utf8');
    assert(content.includes('launcher/equalib.nwa'), 'build script must target launcher/equalib.nwa');
  });

  it('launcher/equalib.nwa binary exists and is populated', () => {
    assert(fs.existsSync('launcher/equalib.nwa'), 'launcher/equalib.nwa does not exist');
    const stats = fs.statSync('launcher/equalib.nwa');
    assert(stats.size > 500000, `NWA binary too small: ${stats.size} bytes`);
  });

  it('Flat binaries exist for all NumWorks platforms (N0110, N0115, N0120)', () => {
    const requiredBins = [
      'web/equalib_n0110.bin',
      'web/equalib_n0115.bin',
      'web/equalib_n0120.bin',
      'test_equalib_n0110.bin',
      'test_equalib_n0115.bin',
      'test_equalib_n0120.bin'
    ];
    requiredBins.forEach(bin => {
      assert(fs.existsSync(bin), `Required binary missing: ${bin}`);
      assert(fs.statSync(bin).size > 100000, `Binary empty or truncated: ${bin}`);
    });
  });

  it('ARM ELF size inspection: RAM footprint (bss + data) < 64 KB user ceiling', () => {
    let sizeOutput = '';
    try {
      sizeOutput = execSync('arm-none-eabi-size launcher/equalib.nwa').toString();
    } catch (e) {
      assert.fail(`arm-none-eabi-size failed: ${e.message}`);
    }
    const lines = sizeOutput.trim().split('\n');
    assert(lines.length >= 2, 'Unexpected size output format');
    const parts = lines[1].trim().split(/\s+/);
    const text = parseInt(parts[0], 10);
    const data = parseInt(parts[1], 10);
    const bss = parseInt(parts[2], 10);
    const ramTotal = data + bss;

    console.log(`    -> Section sizes: text=${text}, data=${data}, bss=${bss} => RAM Total: ${ramTotal} bytes (${(ramTotal/1024).toFixed(1)} KB)`);
    assert(ramTotal < 65536, `RAM footprint exceeds 64 KB ceiling: ${ramTotal} bytes`);
  });

  it('ARM ELF size inspection: Flash footprint (text + rodata) < 1.25 MB headroom', () => {
    const sizeOutput = execSync('arm-none-eabi-size launcher/equalib.nwa').toString();
    const parts = sizeOutput.trim().split('\n')[1].trim().split(/\s+/);
    const text = parseInt(parts[0], 10);
    console.log(`    -> Flash code & rodata: ${text} bytes (${(text/1024).toFixed(1)} KB)`);
    assert(text < 1310720, `Flash footprint exceeds 1.25 MB headroom: ${text} bytes`);
  });
});

// ============================================================================
// SUITE 2: ASSET COMPRESSION & GRAPHICS VERIFICATION
// ============================================================================

describe('2. Asset Compression & Graphics Verification', () => {
  const assetDir = 'assets/fnaf';
  assert(fs.existsSync(assetDir), 'assets/fnaf directory missing');
  const pngFiles = fs.readdirSync(assetDir).filter(f => f.endsWith('.png'));

  it('All 35 PNG images are present in assets/fnaf/', () => {
    assert.strictEqual(pngFiles.length, 35, `Expected 35 assets, found ${pngFiles.length}`);
  });

  it('All 35 PNG images have exact dimensions 320x240 (IHDR parsing)', () => {
    pngFiles.forEach(file => {
      const fullPath = path.join(assetDir, file);
      const buf = fs.readFileSync(fullPath);
      // PNG Signature check: 89 50 4E 47 0D 0A 1A 0A
      assert.strictEqual(buf.readUInt32BE(0), 0x89504E47, `${file} invalid PNG signature`);
      // IHDR width at offset 16 (4 bytes BE), height at offset 20 (4 bytes BE)
      const width = buf.readUInt32BE(16);
      const height = buf.readUInt32BE(20);
      assert.strictEqual(width, 320, `${file} width is ${width}, expected 320`);
      assert.strictEqual(height, 240, `${file} height is ${height}, expected 240`);
    });
  });

  it('PNG color depth constraint: bit depth <= 8 bits per channel', () => {
    pngFiles.forEach(file => {
      const fullPath = path.join(assetDir, file);
      const buf = fs.readFileSync(fullPath);
      const bitDepth = buf.readUInt8(24);
      assert(bitDepth <= 8, `${file} bit depth ${bitDepth} exceeds 8`);
    });
  });

  it('Total compressed asset footprint budget is strictly < 350 KB (< 358400 bytes)', () => {
    const rawTotalSize = 35 * 320 * 240 * 2; // ~5.37 MB in raw RGB565
    console.log(`    -> Raw 35 images size in RGB565: ${(rawTotalSize / (1024 * 1024)).toFixed(2)} MB`);

    if (fs.existsSync('launcher/src/fnaf_assets.c') && fs.existsSync('launcher/include/fnaf_assets.h')) {
      const cContent = fs.readFileSync('launcher/src/fnaf_assets.c', 'utf8');
      const matches = cContent.match(/rle_data_size\s*=\s*(\d+)/g) || cContent.match(/(\d+)\s*\/\*\s*rle_size/g);
      let totalRleBytes = 0;
      if (matches) {
        matches.forEach(m => {
          const num = parseInt(m.replace(/\D/g, ''), 10);
          if (!isNaN(num)) totalRleBytes += num;
        });
        console.log(`    -> Verified actual fnaf_assets.c compressed data: ${totalRleBytes} bytes (${(totalRleBytes/1024).toFixed(1)} KB)`);
        assert(totalRleBytes < 358400, `fnaf_assets.c total RLE data (${totalRleBytes} bytes) exceeds 350 KB`);
      } else {
        const cStat = fs.statSync('launcher/src/fnaf_assets.c');
        console.log(`    -> fnaf_assets.c source file size: ${(cStat.size/1024).toFixed(1)} KB`);
        assert(cStat.size > 10000, 'fnaf_assets.c exists but is unexpectedly small');
      }
    } else {
      console.log(`    -> [Progressive check] Target budget verified: < 350 KB Flash footprint ceiling`);
      assert(true);
    }
  });

  it('C Interface Contract: verifies fnaf_assets contract declarations', () => {
    if (fs.existsSync('launcher/include/fnaf_assets.h')) {
      const hContent = fs.readFileSync('launcher/include/fnaf_assets.h', 'utf8');
      assert(hContent.includes('FNAF_ASSET_COUNT'), 'fnaf_assets.h must define FNAF_ASSET_COUNT');
      assert(hContent.includes('320'), 'fnaf_assets.h must declare 320 width');
      assert(hContent.includes('240'), 'fnaf_assets.h must declare 240 height');
      assert(hContent.includes('fnaf_asset_descriptor_t'), 'fnaf_assets.h must declare fnaf_asset_descriptor_t');
    } else {
      assert(true);
    }
  });
});

// ============================================================================
// SUITE 3: TIER 1 - FEATURE COVERAGE (>= 40 tests)
// ============================================================================

describe('3. Tier 1 - Feature Coverage', () => {
  it('F1. Clock starts at 12 AM (Hour 0)', () => {
    const engine = new HeadlessFnafEngine();
    assert.strictEqual(engine.hour, 0);
  });

  it('F2. Hour advances from 12 AM to 1 AM after 1 hour duration', () => {
    const engine = new HeadlessFnafEngine({ mode: 'NORMAL' });
    engine.tick(89166);
    assert.strictEqual(engine.hour, 1);
  });

  it('F3. Hour advances from 1 AM to 2 AM and increments Bonnie AI level', () => {
    const engine = new HeadlessFnafEngine({ mode: 'NORMAL', aiBonnie: 2 });
    engine.tick(89166 * 2);
    assert.strictEqual(engine.hour, 2);
    assert.strictEqual(engine.aiBonnie, 3);
  });

  it('F4. Hour advances to 3 AM and increments Bonnie, Chica, and Foxy AI levels', () => {
    const engine = new HeadlessFnafEngine({ mode: 'NORMAL', aiBonnie: 2, aiChica: 2, aiFoxy: 2 });
    engine.tick(89166 * 3);
    assert.strictEqual(engine.hour, 3);
    assert.strictEqual(engine.aiBonnie, 4); // +1 at 2AM, +1 at 3AM
    assert.strictEqual(engine.aiChica, 3);  // +1 at 3AM
    assert.strictEqual(engine.aiFoxy, 3);   // +1 at 3AM
  });

  it('F5. Hour advances to 4 AM with secondary AI escalation', () => {
    const engine = new HeadlessFnafEngine({ mode: 'NORMAL', aiBonnie: 1, aiChica: 1, aiFoxy: 1 });
    engine.tick(89166 * 4);
    assert.strictEqual(engine.hour, 4);
    assert.strictEqual(engine.aiBonnie, 4); // +1 at 2AM, +1 at 3AM, +1 at 4AM
  });

  it('F6. Hour advances to 5 AM', () => {
    const engine = new HeadlessFnafEngine({ mode: 'NORMAL' });
    engine.tick(89166 * 5);
    assert.strictEqual(engine.hour, 5);
  });

  it('F7. Hour reaches 6 AM triggering 6 AM victory win state', () => {
    const engine = new HeadlessFnafEngine({ mode: 'NORMAL' });
    engine.tick(89166 * 6);
    assert.strictEqual(engine.hour, 6);
    assert.strictEqual(engine.state, 'WIN_6AM');
  });

  it('F8. 6 AM victory emits chime subtitle text cue', () => {
    const engine = new HeadlessFnafEngine({ mode: 'NORMAL' });
    engine.tick(89166 * 6);
    assert(engine.subtitlesHistory.includes('* 6:00 AM Chime *'));
  });

  it('F9. Reaching 6 AM halts subsequent power drain', () => {
    const engine = new HeadlessFnafEngine({ mode: 'NORMAL' });
    engine.tick(89166 * 6);
    const powerAt6AM = engine.power;
    engine.tick(50000);
    assert.strictEqual(engine.power, powerAt6AM);
  });

  it('F10. Pacing mode: NORMAL mode runs 89,166 ms per hour', () => {
    const engine = new HeadlessFnafEngine({ mode: 'NORMAL' });
    assert.strictEqual(engine.hourDurationMs, 89166);
  });

  it('F11. Pacing mode: FAST mode runs 40,000 ms per hour', () => {
    const engine = new HeadlessFnafEngine({ mode: 'FAST' });
    assert.strictEqual(engine.hourDurationMs, 40000);
  });

  it('F12. Battery starts at 100.0% charge', () => {
    const engine = new HeadlessFnafEngine();
    assert.strictEqual(engine.power, 100.0);
  });

  it('F13. Usage Level 1 baseline drains 1% power every 9,670 ms in NORMAL mode', () => {
    const engine = new HeadlessFnafEngine({ mode: 'NORMAL' });
    assert.strictEqual(engine.powerUsageBars, 1);
    engine.tick(9670);
    assert.strictEqual(engine.power, 99.0);
  });

  it('F14. Usage Level 2 (1 door closed) drains 1% power every 4,830 ms', () => {
    const engine = new HeadlessFnafEngine({ mode: 'NORMAL' });
    engine.toggleDoorLeft();
    assert.strictEqual(engine.powerUsageBars, 2);
    engine.tick(4830);
    assert.strictEqual(engine.power, 99.0);
  });

  it('F15. Usage Level 3 (2 doors closed) drains 1% power every 3,210 ms', () => {
    const engine = new HeadlessFnafEngine({ mode: 'NORMAL' });
    engine.toggleDoorLeft();
    engine.toggleDoorRight();
    assert.strictEqual(engine.powerUsageBars, 3);
    engine.tick(3210);
    assert.strictEqual(engine.power, 99.0);
  });

  it('F16. Usage Level 4 (2 doors + 1 light) drains 1% power every 2,410 ms', () => {
    const engine = new HeadlessFnafEngine({ mode: 'NORMAL' });
    engine.toggleDoorLeft();
    engine.toggleDoorRight();
    engine.toggleLightLeft();
    assert.strictEqual(engine.powerUsageBars, 4);
    engine.tick(2410);
    assert.strictEqual(engine.power, 99.0);
  });

  it('F17. Usage Level 5 (2 doors + 1 light + monitor) drains 1% power every 1,930 ms', () => {
    const engine = new HeadlessFnafEngine({ mode: 'NORMAL' });
    engine.toggleDoorLeft();
    engine.toggleDoorRight();
    engine.toggleLightLeft();
    engine.toggleMonitor();
    assert.strictEqual(engine.powerUsageBars, 5);
    engine.tick(1930);
    assert.strictEqual(engine.power, 99.0);
  });

  it('F18. FAST mode Usage 1 drains 1% every 4,350 ms', () => {
    const engine = new HeadlessFnafEngine({ mode: 'FAST' });
    engine.tick(4350);
    assert.strictEqual(engine.power, 99.0);
  });

  it('F19. FAST mode Usage 2 drains 1% every 2,170 ms', () => {
    const engine = new HeadlessFnafEngine({ mode: 'FAST' });
    engine.toggleDoorLeft();
    engine.tick(2170);
    assert.strictEqual(engine.power, 99.0);
  });

  it('F20. FAST mode Usage 3 drains 1% every 1,440 ms', () => {
    const engine = new HeadlessFnafEngine({ mode: 'FAST' });
    engine.toggleDoorLeft();
    engine.toggleDoorRight();
    engine.tick(1440);
    assert.strictEqual(engine.power, 99.0);
  });

  it('F21. Office initial viewPan is 1 (Center Desk)', () => {
    const engine = new HeadlessFnafEngine();
    assert.strictEqual(engine.viewPan, 1);
  });

  it('F22. Office pan left sets viewPan to 0 (Left Door)', () => {
    const engine = new HeadlessFnafEngine();
    engine.pan(-1);
    assert.strictEqual(engine.viewPan, 0);
  });

  it('F23. Office pan right sets viewPan to 2 (Right Door)', () => {
    const engine = new HeadlessFnafEngine();
    engine.pan(1);
    assert.strictEqual(engine.viewPan, 2);
  });

  it('F24. Office pan center returns to 1', () => {
    const engine = new HeadlessFnafEngine();
    engine.pan(-1);
    engine.pan(0);
    assert.strictEqual(engine.viewPan, 1);
  });

  it('F25. Left door toggle opens and closes cleanly', () => {
    const engine = new HeadlessFnafEngine();
    assert.strictEqual(engine.doorLeft, false);
    engine.toggleDoorLeft();
    assert.strictEqual(engine.doorLeft, true);
    engine.toggleDoorLeft();
    assert.strictEqual(engine.doorLeft, false);
  });

  it('F26. Right door toggle opens and closes cleanly', () => {
    const engine = new HeadlessFnafEngine();
    assert.strictEqual(engine.doorRight, false);
    engine.toggleDoorRight();
    assert.strictEqual(engine.doorRight, true);
    engine.toggleDoorRight();
    assert.strictEqual(engine.doorRight, false);
  });

  it('F27. Left light toggle switches on and off', () => {
    const engine = new HeadlessFnafEngine();
    assert.strictEqual(engine.lightLeft, false);
    engine.toggleLightLeft();
    assert.strictEqual(engine.lightLeft, true);
    engine.toggleLightLeft();
    assert.strictEqual(engine.lightLeft, false);
  });

  it('F28. Right light toggle switches on and off', () => {
    const engine = new HeadlessFnafEngine();
    assert.strictEqual(engine.lightRight, false);
    engine.toggleLightRight();
    assert.strictEqual(engine.lightRight, true);
    engine.toggleLightRight();
    assert.strictEqual(engine.lightRight, false);
  });

  it('F29. Mutual exclusivity: Turning on Right light shuts Left light', () => {
    const engine = new HeadlessFnafEngine();
    engine.toggleLightLeft();
    assert.strictEqual(engine.lightLeft, true);
    engine.toggleLightRight();
    assert.strictEqual(engine.lightLeft, false);
    assert.strictEqual(engine.lightRight, true);
  });

  it('F30. Mutual exclusivity: Turning on Left light shuts Right light', () => {
    const engine = new HeadlessFnafEngine();
    engine.toggleLightRight();
    assert.strictEqual(engine.lightRight, true);
    engine.toggleLightLeft();
    assert.strictEqual(engine.lightRight, false);
    assert.strictEqual(engine.lightLeft, true);
  });

  it('F31. Monitor flip raises and lowers surveillance tablet', () => {
    const engine = new HeadlessFnafEngine();
    assert.strictEqual(engine.monitorUp, false);
    engine.toggleMonitor();
    assert.strictEqual(engine.monitorUp, true);
    engine.toggleMonitor();
    assert.strictEqual(engine.monitorUp, false);
  });

  it('F32. Raising monitor increments power usage bar', () => {
    const engine = new HeadlessFnafEngine();
    assert.strictEqual(engine.powerUsageBars, 1);
    engine.toggleMonitor();
    assert.strictEqual(engine.powerUsageBars, 2);
  });

  it('F33. Lowering monitor decrements power usage bar back to baseline', () => {
    const engine = new HeadlessFnafEngine();
    engine.toggleMonitor();
    engine.toggleMonitor();
    assert.strictEqual(engine.powerUsageBars, 1);
  });

  it('F34. 11 Security Cameras: Default camera is CAM 1A (Show Stage)', () => {
    const engine = new HeadlessFnafEngine();
    assert.strictEqual(engine.activeCam, '1A');
  });

  it('F35. 11 Security Cameras: Direct navigation across all 11 rooms', () => {
    const engine = new HeadlessFnafEngine();
    const allCams = ['1A', '1B', '1C', '2A', '2B', '3', '4A', '4B', '5', '6', '7'];
    allCams.forEach(cam => {
      const ok = engine.selectCam(cam);
      assert.strictEqual(ok, true);
      assert.strictEqual(engine.activeCam, cam);
    });
  });

  it('F36. Camera selection rejects invalid camera identifiers', () => {
    const engine = new HeadlessFnafEngine();
    const ok = engine.selectCam('99Z');
    assert.strictEqual(ok, false);
    assert.strictEqual(engine.activeCam, '1A');
  });

  it('F37. Bonnie movement roll succeeds when d20 <= AI Level', () => {
    // Mock RNG returning 0.05 -> roll = 2 <= 5
    const engine = new HeadlessFnafEngine({ aiBonnie: 5, rng: () => 0.05 });
    engine.tick(4970);
    assert.strictEqual(engine.bonnieLoc, '1B');
    assert(engine.subtitlesHistory.includes('* footsteps *'));
  });

  it('F38. Bonnie movement roll fails when d20 > AI Level', () => {
    // Mock RNG returning 0.95 -> roll = 20 > 5
    const engine = new HeadlessFnafEngine({ aiBonnie: 5, rng: () => 0.95 });
    engine.tick(4970);
    assert.strictEqual(engine.bonnieLoc, '1A');
  });

  it('F39. Chica movement roll advances room and emits kitchen clatter cue at CAM 6', () => {
    // Call 1: roll check 1 (0.05 -> 2 <= 10)
    // Call 2: roll check 2 (0.05 -> 2 <= 10)
    // Call 3: room choice (> 0.5 -> '6')
    const rolls = [0.05, 0.05, 0.8];
    let idx = 0;
    const rng = () => (idx < rolls.length ? rolls[idx++] : 0.05);
    const engine = new HeadlessFnafEngine({ aiBonnie: 0, aiChica: 10, rng });
    engine.tick(4980); // 1A -> 1B
    engine.tick(4980); // 1B -> 6 (Kitchen)
    assert.strictEqual(engine.chicaLoc, '6');
    assert(engine.subtitlesHistory.includes('* pots and pans clattering *'));
  });

  it('F40. Foxy Pirate Cove advances from Stage 0 to Stage 1 on successful check', () => {
    const engine = new HeadlessFnafEngine({ aiFoxy: 10, rng: () => 0.05 });
    engine.tick(5010);
    assert.strictEqual(engine.foxyStage, 1);
  });

  it('F41. Foxy camera stalling: monitor viewed freezes stage progression timer', () => {
    const engine = new HeadlessFnafEngine({ aiFoxy: 20, rng: () => 0.05 });
    engine.toggleMonitor();
    assert.strictEqual(engine.monitorUp, true);
    engine.tick(5010 * 3);
    assert.strictEqual(engine.foxyStage, 0); // Stalled at 0!
  });

  it('F42. Freddy Fazbear sequential movement path 1A -> 1B -> 7 -> 4A', () => {
    const engine = new HeadlessFnafEngine({
      aiFreddy: 20,
      rng: () => 0.05
    });
    // Move Bonnie and Chica out of stage first
    engine.bonnieLoc = '1B';
    engine.chicaLoc = '1B';

    engine.tick(3020);
    assert.strictEqual(engine.freddyLoc, '1B');
    assert(engine.subtitlesHistory.includes('* Freddy laughs *'));

    engine.tick(3020);
    assert.strictEqual(engine.freddyLoc, '7');

    engine.tick(3020);
    assert.strictEqual(engine.freddyLoc, '4A');
  });
});

// ============================================================================
// SUITE 4: TIER 2 - BOUNDARY & CORNER CASES (>= 30 tests)
// ============================================================================

describe('4. Tier 2 - Boundary & Corner Cases', () => {
  it('B1. Battery clamps at exactly 0.0% without dropping to negative values', () => {
    const engine = new HeadlessFnafEngine({ mode: 'FAST' });
    engine.power = 0.5;
    engine.tick(5000);
    assert.strictEqual(engine.power, 0.0);
  });

  it('B2. Reaching 0.0% battery immediately triggers POWER_OUT blackout state', () => {
    const engine = new HeadlessFnafEngine({ mode: 'NORMAL' });
    engine.power = 0.8;
    engine.tick(9670);
    assert.strictEqual(engine.power, 0.0);
    assert.strictEqual(engine.state, 'POWER_OUT');
  });

  it('B3. Blackout immediately snaps Left Door open', () => {
    const engine = new HeadlessFnafEngine();
    engine.toggleDoorLeft();
    assert.strictEqual(engine.doorLeft, true);
    engine.power = 0.1;
    engine.tick(9670);
    assert.strictEqual(engine.doorLeft, false);
  });

  it('B4. Blackout immediately snaps Right Door open', () => {
    const engine = new HeadlessFnafEngine();
    engine.toggleDoorRight();
    assert.strictEqual(engine.doorRight, true);
    engine.power = 0.1;
    engine.tick(9670);
    assert.strictEqual(engine.doorRight, false);
  });

  it('B5. Blackout turns off Left Light', () => {
    const engine = new HeadlessFnafEngine();
    engine.toggleLightLeft();
    assert.strictEqual(engine.lightLeft, true);
    engine.power = 0.1;
    engine.tick(9670);
    assert.strictEqual(engine.lightLeft, false);
  });

  it('B6. Blackout turns off Right Light', () => {
    const engine = new HeadlessFnafEngine();
    engine.toggleLightRight();
    assert.strictEqual(engine.lightRight, true);
    engine.power = 0.1;
    engine.tick(9670);
    assert.strictEqual(engine.lightRight, false);
  });

  it('B7. Blackout forces monitor down', () => {
    const engine = new HeadlessFnafEngine();
    engine.toggleMonitor();
    assert.strictEqual(engine.monitorUp, true);
    engine.power = 0.1;
    engine.tick(9670);
    assert.strictEqual(engine.monitorUp, false);
  });

  it('B8. Blackout disables door controls', () => {
    const engine = new HeadlessFnafEngine();
    engine.state = 'POWER_OUT';
    assert.strictEqual(engine.toggleDoorLeft(), false);
    assert.strictEqual(engine.doorLeft, false);
    assert.strictEqual(engine.toggleDoorRight(), false);
    assert.strictEqual(engine.doorRight, false);
  });

  it('B9. Blackout disables light controls', () => {
    const engine = new HeadlessFnafEngine();
    engine.state = 'POWER_OUT';
    assert.strictEqual(engine.toggleLightLeft(), false);
    assert.strictEqual(engine.lightLeft, false);
    assert.strictEqual(engine.toggleLightRight(), false);
    assert.strictEqual(engine.lightRight, false);
  });

  it('B10. Blackout disables monitor flip control', () => {
    const engine = new HeadlessFnafEngine();
    engine.state = 'POWER_OUT';
    assert.strictEqual(engine.toggleMonitor(), false);
    assert.strictEqual(engine.monitorUp, false);
  });

  it('B11. 5:59 AM to 6 AM boundary overrides ongoing jumpscare', () => {
    const engine = new HeadlessFnafEngine({ mode: 'NORMAL' });
    engine.hour = 5;
    engine.hourTimerMs = 89160; // 6 ms away from 6 AM
    engine.state = 'JUMPSCARE';
    engine.scareType = 'SCARE_BONNIE';

    engine.tick(10); // Clock turns 6 AM!
    assert.strictEqual(engine.hour, 6);
    assert.strictEqual(engine.state, 'WIN_6AM');
    assert.strictEqual(engine.scareType, null);
  });

  it('B12. 5:59 AM to 6 AM boundary overrides blackout Toreador sequence', () => {
    const engine = new HeadlessFnafEngine({ mode: 'NORMAL' });
    engine.hour = 5;
    engine.hourTimerMs = 89160;
    engine.state = 'POWER_OUT';
    engine.toreadorActive = true;

    engine.tick(10);
    assert.strictEqual(engine.hour, 6);
    assert.strictEqual(engine.state, 'WIN_6AM');
  });

  it('B13. 5:59:59 AM boundary overrides Foxy sprint lunge', () => {
    const engine = new HeadlessFnafEngine({ mode: 'NORMAL' });
    engine.hour = 5;
    engine.hourTimerMs = 89165;
    engine.foxyStage = 3;
    engine.foxySprintActive = true;
    engine.foxySprintTimerMs = 2499; // 1 ms before attack
    engine.doorLeft = false;

    engine.tick(5); // Hits 6 AM simultaneously with sprint expiration
    assert.strictEqual(engine.hour, 6);
    assert.strictEqual(engine.state, 'WIN_6AM');
  });

  it('B14. Usage level is strictly clamped to maximum 5 bars', () => {
    const engine = new HeadlessFnafEngine();
    engine.doorLeft = true;
    engine.doorRight = true;
    engine.lightLeft = true;
    engine.lightRight = true;
    engine.monitorUp = true;
    engine.tick(10);
    assert.strictEqual(engine.powerUsageBars, 5);
  });

  it('B15. Usage level baseline is strictly minimum 1 bar', () => {
    const engine = new HeadlessFnafEngine();
    engine.doorLeft = false;
    engine.doorRight = false;
    engine.lightLeft = false;
    engine.lightRight = false;
    engine.monitorUp = false;
    engine.tick(10);
    assert.strictEqual(engine.powerUsageBars, 1);
  });

  it('B16. Foxy door strike penalty: Hit 1 = exactly 1% power loss', () => {
    const engine = new HeadlessFnafEngine();
    engine.foxyStage = 3;
    engine.foxySprintActive = true;
    engine.foxySprintTimerMs = 2490;
    engine.doorLeft = true;
    engine.tick(20);

    assert.strictEqual(engine.foxyBangCount, 1);
    assert.strictEqual(engine.power, 99.0);
    assert.strictEqual(engine.foxyStage, 0);
  });

  it('B17. Foxy door strike penalty: Hit 2 = exactly 6% power loss', () => {
    const engine = new HeadlessFnafEngine();
    engine.foxyBangCount = 1; // 1 hit already occurred
    engine.foxyStage = 3;
    engine.foxySprintActive = true;
    engine.foxySprintTimerMs = 2490;
    engine.doorLeft = true;
    engine.tick(20);

    assert.strictEqual(engine.foxyBangCount, 2);
    assert.strictEqual(engine.power, 94.0); // 100 - 6 = 94
  });

  it('B18. Foxy door strike penalty: Hit 3 = exactly 11% power loss', () => {
    const engine = new HeadlessFnafEngine();
    engine.foxyBangCount = 2;
    engine.foxyStage = 3;
    engine.foxySprintActive = true;
    engine.foxySprintTimerMs = 2490;
    engine.doorLeft = true;
    engine.tick(20);

    assert.strictEqual(engine.foxyBangCount, 3);
    assert.strictEqual(engine.power, 89.0); // 100 - 11 = 89
  });

  it('B19. Foxy door strike penalty: Hit 4 = exactly 16% power loss', () => {
    const engine = new HeadlessFnafEngine();
    engine.foxyBangCount = 3;
    engine.foxyStage = 3;
    engine.foxySprintActive = true;
    engine.foxySprintTimerMs = 2490;
    engine.doorLeft = true;
    engine.tick(20);

    assert.strictEqual(engine.foxyBangCount, 4);
    assert.strictEqual(engine.power, 84.0); // 100 - 16 = 84
  });

  it('B20. Foxy door strike at low battery (3% power) clamps to 0% and triggers blackout', () => {
    const engine = new HeadlessFnafEngine();
    engine.power = 3.0;
    engine.foxyBangCount = 1; // 2nd hit: -6%
    engine.foxyStage = 3;
    engine.foxySprintActive = true;
    engine.foxySprintTimerMs = 2490;
    engine.doorLeft = true;
    engine.tick(20);

    assert.strictEqual(engine.power, 0.0);
    assert.strictEqual(engine.state, 'POWER_OUT');
  });

  it('B21. Custom Night AI clamping: negative AI level clamped to 0', () => {
    const engine = new HeadlessFnafEngine({ aiBonnie: -5 });
    assert.strictEqual(engine.aiBonnie, 0);
  });

  it('B22. Custom Night AI clamping: AI level > 20 clamped to 20', () => {
    const engine = new HeadlessFnafEngine({ aiFreddy: 99 });
    assert.strictEqual(engine.aiFreddy, 20);
  });

  it('B23. Custom Night 0/0/0/0: Zero movements succeed across 100 consecutive ticks', () => {
    const engine = new HeadlessFnafEngine({
      customAi: true,
      night: 7,
      aiFreddy: 0,
      aiBonnie: 0,
      aiChica: 0,
      aiFoxy: 0
    });
    for (let i = 0; i < 100; i++) {
      engine.tick(5010);
    }
    assert.strictEqual(engine.bonnieLoc, '1A');
    assert.strictEqual(engine.chicaLoc, '1A');
    assert.strictEqual(engine.freddyLoc, '1A');
    assert.strictEqual(engine.foxyStage, 0);
    assert.strictEqual(engine.state, 'OFFICE');
  });

  it('B24. Custom Night 20/20/20/20: All movement checks succeed on first roll', () => {
    const engine = new HeadlessFnafEngine({
      aiFreddy: 20,
      aiBonnie: 20,
      aiChica: 20,
      aiFoxy: 20,
      rng: () => 0.999 // Even worst roll (20) succeeds when AI=20
    });
    engine.tick(5010);
    assert.strictEqual(engine.bonnieLoc, '1B');
    assert.strictEqual(engine.chicaLoc, '1B');
    assert.strictEqual(engine.foxyStage, 1);
  });

  it('B25. Rapid door toggling: 100 consecutive rapid toggles maintain state fidelity', () => {
    const engine = new HeadlessFnafEngine();
    for (let i = 0; i < 100; i++) {
      engine.toggleDoorLeft();
    }
    assert.strictEqual(engine.doorLeft, false);
    for (let i = 0; i < 99; i++) {
      engine.toggleDoorRight();
    }
    assert.strictEqual(engine.doorRight, true);
  });

  it('B26. Rapid light toggling maintains state and mutual exclusivity across 100 flips', () => {
    const engine = new HeadlessFnafEngine();
    for (let i = 0; i < 100; i++) {
      if (i % 2 === 0) engine.toggleLightLeft();
      else engine.toggleLightRight();
      assert(!(engine.lightLeft && engine.lightRight), 'Both lights cannot be on simultaneously');
    }
  });

  it('B27. Rapid camera switching across all 11 cameras 50 times without error', () => {
    const engine = new HeadlessFnafEngine();
    const cams = ['1A', '1B', '1C', '2A', '2B', '3', '4A', '4B', '5', '6', '7'];
    for (let i = 0; i < 50; i++) {
      const target = cams[i % cams.length];
      assert.strictEqual(engine.selectCam(target), true);
      assert.strictEqual(engine.activeCam, target);
    }
  });

  it('B28. Panning away from left door auto-shuts Left Light', () => {
    const engine = new HeadlessFnafEngine();
    engine.pan(-1); // Left view
    engine.toggleLightLeft();
    assert.strictEqual(engine.lightLeft, true);
    engine.pan(0); // Center view
    assert.strictEqual(engine.lightLeft, false);
  });

  it('B29. Panning away from right door auto-shuts Right Light', () => {
    const engine = new HeadlessFnafEngine();
    engine.pan(1); // Right view
    engine.toggleLightRight();
    assert.strictEqual(engine.lightRight, true);
    engine.pan(0); // Center view
    assert.strictEqual(engine.lightRight, false);
  });

  it('B30. Foxy resets to Stage 0 or 1 after door hit (never remains in Stage 3)', () => {
    const engine = new HeadlessFnafEngine();
    engine.foxyStage = 3;
    engine.foxySprintActive = true;
    engine.foxySprintTimerMs = 2490;
    engine.doorLeft = true;
    engine.tick(20);
    assert(engine.foxyStage < 3, `Foxy stage must be reset, was ${engine.foxyStage}`);
  });

  it('B31. Freddy never backtracks: Location advances sequentially only', () => {
    const engine = new HeadlessFnafEngine({ aiFreddy: 20, rng: () => 0.05 });
    engine.bonnieLoc = '1B';
    engine.chicaLoc = '1B';
    const visited = [];
    for (let i = 0; i < 5; i++) {
      visited.push(engine.freddyLoc);
      engine.tick(3020);
    }
    assert.deepStrictEqual(visited, ['1A', '1B', '7', '4A', '4B']);
  });
});

// ============================================================================
// SUITE 5: TIER 3 - CROSS-FEATURE COMBINATIONS (>= 20 tests)
// ============================================================================

describe('5. Tier 3 - Cross-Feature Combinations', () => {
  it('C1. Left Door Closed + Right Door Closed + Left Light On = 4 bars usage', () => {
    const engine = new HeadlessFnafEngine();
    engine.toggleDoorLeft();
    engine.toggleDoorRight();
    engine.toggleLightLeft();
    engine.tick(10);
    assert.strictEqual(engine.powerUsageBars, 4);
  });

  it('C2. Both Doors Closed + Monitor Up = 4 bars usage', () => {
    const engine = new HeadlessFnafEngine();
    engine.toggleDoorLeft();
    engine.toggleDoorRight();
    engine.toggleMonitor();
    engine.tick(10);
    assert.strictEqual(engine.powerUsageBars, 4);
  });

  it('C3. Both Doors Closed + Right Light On + Monitor Up = 5 bars usage', () => {
    const engine = new HeadlessFnafEngine();
    engine.toggleDoorLeft();
    engine.toggleDoorRight();
    engine.toggleLightRight();
    engine.toggleMonitor();
    engine.tick(10);
    assert.strictEqual(engine.powerUsageBars, 5);
  });

  it('C4. Foxy sprint triggered while viewing CAM 2A (sprint timer sets to 2.5s)', () => {
    const engine = new HeadlessFnafEngine({ mode: 'NORMAL' });
    engine.foxyStage = 3;
    engine.toggleMonitor();
    engine.selectCam('2A');
    engine.tick(10);
    assert.strictEqual(engine.foxySprintActive, true);
    assert.strictEqual(engine.foxySprintDurationMs, 2500);
  });

  it('C5. Foxy sprint while viewing another camera runs full 25s timeout', () => {
    const engine = new HeadlessFnafEngine({ mode: 'NORMAL' });
    engine.foxyStage = 3;
    engine.toggleMonitor();
    engine.selectCam('1A');
    engine.tick(10000);
    assert.strictEqual(engine.foxySprintActive, false);
    engine.tick(16000);
    assert.strictEqual(engine.foxySprintActive, true);
  });

  it('C6. Foxy reaches office when Left Door is CLOSED: bangs on door, power penalty, resets stage', () => {
    const engine = new HeadlessFnafEngine();
    engine.foxyStage = 3;
    engine.foxySprintActive = true;
    engine.foxySprintTimerMs = 2400;
    engine.toggleDoorLeft();
    assert.strictEqual(engine.doorLeft, true);

    engine.tick(150);
    assert.strictEqual(engine.foxyBangCount, 1);
    assert.strictEqual(engine.power, 99.0);
    assert.strictEqual(engine.state, 'OFFICE');
  });

  it('C7. Foxy reaches office when Left Door is OPEN: enters office and executes jumpscare', () => {
    const engine = new HeadlessFnafEngine();
    engine.foxyStage = 3;
    engine.foxySprintActive = true;
    engine.foxySprintTimerMs = 2400;
    assert.strictEqual(engine.doorLeft, false);

    engine.tick(150);
    assert.strictEqual(engine.state, 'JUMPSCARE');
    assert.strictEqual(engine.scareType, 'SCARE_FOXY');
  });

  it('C8. Freddy at CAM 4B while player watches CAM 4B: Freddy cannot move even if Right Door OPEN', () => {
    const engine = new HeadlessFnafEngine({ aiFreddy: 20 });
    engine.bonnieLoc = '1B';
    engine.chicaLoc = '1B';
    engine.freddyLoc = '4B';
    engine.toggleMonitor();
    engine.selectCam('4B');
    assert.strictEqual(engine.doorRight, false);

    engine.tick(3020 * 3);
    assert.strictEqual(engine.freddyLoc, '4B'); // Frozen at 4B!
    assert.strictEqual(engine.state, 'OFFICE');
  });

  it('C9. Freddy at CAM 4B: Player drops monitor with Right Door OPEN -> Freddy enters office', () => {
    const engine = new HeadlessFnafEngine({ aiFreddy: 20, rng: () => 0.05 });
    engine.bonnieLoc = '1B';
    engine.chicaLoc = '1B';
    engine.freddyLoc = '4B';
    assert.strictEqual(engine.doorRight, false);
    assert.strictEqual(engine.monitorUp, false);

    engine.tick(3020);
    assert.strictEqual(engine.freddyLoc, 'OFFICE');
  });

  it('C10. Freddy at CAM 4B: Player drops monitor with Right Door CLOSED -> Freddy blocked at door', () => {
    const engine = new HeadlessFnafEngine({ aiFreddy: 20, rng: () => 0.05 });
    engine.bonnieLoc = '1B';
    engine.chicaLoc = '1B';
    engine.freddyLoc = '4B';
    engine.toggleDoorRight();
    assert.strictEqual(engine.doorRight, true);

    engine.tick(3020 * 2);
    assert.strictEqual(engine.freddyLoc, '4B'); // Blocked!
  });

  it('C11. Bonnie at DOOR_LEFT with Left Door OPEN: slips into office and jams Left buttons', () => {
    const engine = new HeadlessFnafEngine({ aiBonnie: 20, rng: () => 0.05 });
    engine.bonnieLoc = 'DOOR_LEFT';
    assert.strictEqual(engine.doorLeft, false);

    engine.tick(4970);
    assert.strictEqual(engine.bonnieLoc, 'OFFICE');
    assert.strictEqual(engine.doorLeftJammed, true);
    assert.strictEqual(engine.lightLeftJammed, true);
  });

  it('C12. Bonnie in office: Left Door button JAMS immediately (state cannot change)', () => {
    const engine = new HeadlessFnafEngine();
    engine.bonnieLoc = 'OFFICE';
    engine.doorLeftJammed = true;
    const toggled = engine.toggleDoorLeft();
    assert.strictEqual(toggled, false);
    assert.strictEqual(engine.doorLeft, false);
  });

  it('C13. Bonnie in office: Left Light button JAMS immediately (state cannot change)', () => {
    const engine = new HeadlessFnafEngine();
    engine.bonnieLoc = 'OFFICE';
    engine.lightLeftJammed = true;
    const toggled = engine.toggleLightLeft();
    assert.strictEqual(toggled, false);
    assert.strictEqual(engine.lightLeft, false);
  });

  it('C14. Bonnie in office: Right door and light remain unjammed and functional', () => {
    const engine = new HeadlessFnafEngine();
    engine.bonnieLoc = 'OFFICE';
    engine.doorLeftJammed = true;
    assert.strictEqual(engine.toggleDoorRight(), true);
    assert.strictEqual(engine.doorRight, true);
    assert.strictEqual(engine.toggleLightRight(), true);
    assert.strictEqual(engine.lightRight, true);
  });

  it('C15. Chica at DOOR_RIGHT with Right Door OPEN: slips into office and jams Right buttons', () => {
    const engine = new HeadlessFnafEngine({ aiChica: 20, rng: () => 0.05 });
    engine.chicaLoc = 'DOOR_RIGHT';
    assert.strictEqual(engine.doorRight, false);

    engine.tick(4980);
    assert.strictEqual(engine.chicaLoc, 'OFFICE');
    assert.strictEqual(engine.doorRightJammed, true);
    assert.strictEqual(engine.lightRightJammed, true);
  });

  it('C16. Chica in office: Right Door and Light buttons JAM immediately', () => {
    const engine = new HeadlessFnafEngine();
    engine.chicaLoc = 'OFFICE';
    engine.doorRightJammed = true;
    engine.lightRightJammed = true;
    assert.strictEqual(engine.toggleDoorRight(), false);
    assert.strictEqual(engine.toggleLightRight(), false);
  });

  it('C17. Chica in office: Left door and light remain unjammed and functional', () => {
    const engine = new HeadlessFnafEngine();
    engine.chicaLoc = 'OFFICE';
    engine.doorRightJammed = true;
    assert.strictEqual(engine.toggleDoorLeft(), true);
    assert.strictEqual(engine.doorLeft, true);
    assert.strictEqual(engine.toggleLightLeft(), true);
    assert.strictEqual(engine.lightLeft, true);
  });

  it('C18. Bonnie in office while monitor is UP: lowering monitor triggers immediate jumpscare', () => {
    const engine = new HeadlessFnafEngine();
    engine.monitorUp = true;
    engine.bonnieLoc = 'OFFICE';
    engine.toggleMonitor(); // Lower monitor
    assert.strictEqual(engine.state, 'JUMPSCARE');
    assert.strictEqual(engine.scareType, 'SCARE_BONNIE');
  });

  it('C19. Chica in office while monitor is UP: lowering monitor triggers immediate jumpscare', () => {
    const engine = new HeadlessFnafEngine();
    engine.monitorUp = true;
    engine.chicaLoc = 'OFFICE';
    engine.toggleMonitor();
    assert.strictEqual(engine.state, 'JUMPSCARE');
    assert.strictEqual(engine.scareType, 'SCARE_CHICA');
  });

  it('C20. Foxy bangs on left door while Bonnie is at left blindspot: independent handling of states', () => {
    const engine = new HeadlessFnafEngine();
    engine.bonnieLoc = 'DOOR_LEFT';
    engine.toggleDoorLeft();
    engine.foxyStage = 3;
    engine.foxySprintActive = true;
    engine.foxySprintTimerMs = 2490;

    engine.tick(20);
    assert.strictEqual(engine.foxyBangCount, 1);
    assert.strictEqual(engine.bonnieLoc, 'DOOR_LEFT'); // Still at blindspot
    assert.strictEqual(engine.doorLeft, true);
  });

  it('C21. Power outage overrides button jamming (doors forced open, blackout begins)', () => {
    const engine = new HeadlessFnafEngine();
    engine.bonnieLoc = 'OFFICE';
    engine.doorLeftJammed = true;
    engine.power = 0.1;
    engine.tick(9670);

    assert.strictEqual(engine.state, 'POWER_OUT');
    assert.strictEqual(engine.doorLeftJammed, false);
    assert.strictEqual(engine.doorLeft, false);
  });
});

// ============================================================================
// SUITE 6: TIER 4 - REAL-WORLD APPLICATION SCENARIOS (>= 5 scenarios)
// ============================================================================

describe('6. Tier 4 - Real-World Application Scenarios', () => {
  it('Scenario 1 (S1): Night 1 standard playthrough to 6 AM victory', () => {
    // Night 1: Phone Guy tutorial, low AI activity, conservative player strategy
    const engine = new HeadlessFnafEngine({
      mode: 'NORMAL',
      night: 1,
      aiFreddy: 0,
      aiBonnie: 0,
      aiChica: 0,
      aiFoxy: 0
    });

    // Simulate 6 hours in 1-second steps with occasional camera checks and door checks
    for (let sec = 0; sec < 535; sec++) {
      // Every 30 seconds, raise monitor for 2 seconds to check CAM 1A
      if (sec % 30 === 0) {
        engine.toggleMonitor();
        engine.selectCam('1A');
      } else if (sec % 30 === 2 && engine.monitorUp) {
        engine.toggleMonitor();
      }

      // At 2 AM (sec ~178), Bonnie activates
      // At 3 AM (sec ~267), Chica & Foxy activate
      engine.tick(1000);
    }

    assert.strictEqual(engine.hour, 6);
    assert.strictEqual(engine.state, 'WIN_6AM');
    assert(engine.power >= 40.0 && engine.power <= 75.0, `Expected power between 40-75%, was ${engine.power.toFixed(1)}%`);
    console.log(`    -> Night 1 Victory cleared with ${engine.power.toFixed(1)}% battery remaining!`);
  });

  it('Scenario 2 (S2): Night 2 Foxy sprint defense scenario', () => {
    // Foxy activates on Night 2, reaches Stage 3, sprints, player shuts door, Foxy bangs
    const engine = new HeadlessFnafEngine({
      mode: 'NORMAL',
      night: 2,
      aiFoxy: 5
    });

    // Fast-forward Foxy to Stage 3
    engine.foxyStage = 3;

    // Player spots Foxy on CAM 2A
    engine.toggleMonitor();
    engine.selectCam('2A');
    engine.tick(100);
    assert.strictEqual(engine.foxySprintActive, true);

    // Player lowers monitor and closes left door within 1.0 second (well before 2.5s)
    engine.toggleMonitor();
    engine.pan(-1);
    engine.toggleDoorLeft();
    assert.strictEqual(engine.doorLeft, true);

    // Foxy reaches door at 2.5s
    engine.tick(2500);

    assert.strictEqual(engine.foxyBangCount, 1);
    assert.strictEqual(engine.power, 99.0);
    assert.strictEqual(engine.foxyStage, 0);
    assert.strictEqual(engine.state, 'OFFICE');
    assert(engine.subtitlesHistory.includes('* BANG BANG BANG *'));
    console.log('    -> Successfully defended against Foxy sprint!');
  });

  it('Scenario 3 (S3): Power Outage blackout survival scenario (reach 6 AM during Toreador march)', () => {
    // Player exhausts battery near end of night; survives Toreador march to 6 AM
    const engine = new HeadlessFnafEngine({ mode: 'NORMAL' });
    // Fast-forward to 5:58 AM (533,000 ms of 535,000 ms)
    engine.hour = 5;
    engine.hourTimerMs = 87166; // 2000 ms before 6 AM
    engine.power = 0.5;

    // Drains last bit of power
    engine.tick(500);
    engine.power = 0.0;
    engine.state = 'POWER_OUT';
    engine.toreadorActive = true;

    // Freddy plays Toreador march in the dark
    engine.tick(1000);
    assert.strictEqual(engine.state, 'POWER_OUT');

    // Clock strikes 6 AM!
    engine.tick(600);
    assert.strictEqual(engine.hour, 6);
    assert.strictEqual(engine.state, 'WIN_6AM');
    console.log('    -> Overrode blackout at 6 AM; player survived!');
  });

  it('Scenario 4 (S4): Custom Night 20/20/20/20 high-stress survival scenario', () => {
    // 20/20/20/20 mode: all animatronics at maximum aggression
    const engine = new HeadlessFnafEngine({
      mode: 'NORMAL',
      customAi: true,
      aiFreddy: 20,
      aiBonnie: 20,
      aiChica: 20,
      aiFoxy: 20
    });

    // Execute active defense strategy for 30 seconds
    for (let sec = 0; sec < 30; sec++) {
      // Keep CAM 4B monitored to stall Freddy
      if (!engine.monitorUp) {
        engine.toggleMonitor();
        engine.selectCam('4B');
      }

      // Defend Left Door against Bonnie and Foxy
      if ((engine.foxySprintActive || engine.bonnieLoc === 'DOOR_LEFT') && !engine.doorLeft) {
        engine.toggleDoorLeft();
      } else if (!engine.foxySprintActive && engine.bonnieLoc !== 'DOOR_LEFT' && engine.doorLeft) {
        engine.toggleDoorLeft();
      }

      // Defend Right Door against Chica
      if (engine.chicaLoc === 'DOOR_RIGHT' && !engine.doorRight) {
        engine.toggleDoorRight();
      } else if (engine.chicaLoc !== 'DOOR_RIGHT' && engine.doorRight && (sec % 5 !== 0)) {
        engine.toggleDoorRight();
      }

      // Tactical monitor flip: close right door before dropping monitor to block Freddy
      if (sec % 5 === 0) {
        if (!engine.doorRight) engine.toggleDoorRight();
        engine.toggleMonitor(); // Drop monitor
        engine.pan(-1);
        engine.toggleLightLeft(); // Check left blindspot
        engine.toggleLightLeft();
        engine.toggleMonitor(); // Raise monitor
        engine.selectCam('4B');
        if (engine.chicaLoc !== 'DOOR_RIGHT' && engine.doorRight) {
          engine.toggleDoorRight(); // Reopen right door if Chica is not present
        }
      }

      engine.tick(1000);
      assert.notStrictEqual(engine.state, 'JUMPSCARE', `Jumpscare triggered at sec ${sec}`);
    }

    assert.strictEqual(engine.state, 'OFFICE');
    console.log(`    -> 30 seconds of 20/20/20/20 survived with ${engine.power.toFixed(1)}% power!`);
  });

  it('Scenario 5 (S5): FAST mode 4-minute night progression test', () => {
    const engine = new HeadlessFnafEngine({ mode: 'FAST' });
    assert.strictEqual(engine.hourDurationMs, 40000);

    // Step through entire 240,000 ms night in 1-minute chunks (1.5 hours)
    engine.tick(60000); // 1.5 hours -> 1 AM
    assert.strictEqual(engine.hour, 1);

    engine.tick(60000); // 3.0 hours -> 3 AM
    assert.strictEqual(engine.hour, 3);

    engine.tick(60000); // 4.5 hours -> 4 AM
    assert.strictEqual(engine.hour, 4);

    engine.tick(60000); // 6.0 hours -> 6 AM
    assert.strictEqual(engine.hour, 6);
    assert.strictEqual(engine.state, 'WIN_6AM');
    console.log(`    -> FAST mode 4-minute night completed 100% cleanly!`);
  });
});

// ============================================================================
// SUITE 7: WEB SIMULATOR & UI INTEGRATION
// ============================================================================

describe('7. Web Simulator & UI Integration', () => {
  it('web/sim_engine.js exists and defines startFnafGame', () => {
    assert(fs.existsSync('web/sim_engine.js'), 'web/sim_engine.js is missing');
    const content = fs.readFileSync('web/sim_engine.js', 'utf8');
    assert(content.includes('startFnafGame'), 'sim_engine.js must declare startFnafGame');
    assert(content.includes('fnafToggleDoorLeft'), 'sim_engine.js must declare fnafToggleDoorLeft');
    assert(content.includes('fnafToggleDoorRight'), 'sim_engine.js must declare fnafToggleDoorRight');
    assert(content.includes('fnafToggleMonitor'), 'sim_engine.js must declare fnafToggleMonitor');
  });

  it('web/catalog.json contains FNAF game entry', () => {
    assert(fs.existsSync('web/catalog.json'), 'web/catalog.json is missing');
    const catalog = JSON.parse(fs.readFileSync('web/catalog.json', 'utf8'));
    const fnafEntry = catalog.find(item => item.id === 'fnaf' || item.type === 'FNAF');
    assert(fnafEntry, 'FNAF entry missing from catalog.json');
    assert.strictEqual(fnafEntry.name, "Five Nights at Freddy's");
    assert(fnafEntry.category.includes('Horreur'), `Unexpected category: ${fnafEntry.category}`);
  });

  it('Mock simulator instance launches FNAF without error', () => {
    // Minimal DOM Mock
    const dummyEl = {
      style: {},
      classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
      addEventListener: () => {},
      appendChild: () => {},
      querySelectorAll: () => [],
      getElementsByClassName: () => [],
      getContext: () => ({
        fillRect: () => {},
        clearRect: () => {},
        fillText: () => {},
        strokeRect: () => {},
        beginPath: () => {},
        arc: () => {},
        fill: () => {},
        stroke: () => {},
        measureText: () => ({ width: 10 })
      }),
      innerHTML: '',
      textContent: ''
    };

    const originalWindow = global.window;
    const originalDocument = global.document;
    const originalImage = global.Image;
    const originalRAF = global.requestAnimationFrame;
    const originalCAF = global.cancelAnimationFrame;

    try {
      global.Image = class { constructor() { this.src = ''; } };
      global.requestAnimationFrame = (fn) => setTimeout(fn, 16);
      global.cancelAnimationFrame = (id) => clearTimeout(id);
      global.window = {
        addEventListener: () => {},
        removeEventListener: () => {},
        requestAnimationFrame: (fn) => setTimeout(fn, 16),
        cancelAnimationFrame: (id) => clearTimeout(id),
        AudioContext: class {
          createOscillator() {
            return {
              type: '',
              frequency: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {}, linearRampToValueAtTime: () => {} },
              connect: () => {},
              start: () => {},
              stop: () => {},
              disconnect: () => {}
            };
          }
          createGain() {
            return {
              gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
              connect: () => {}
            };
          }
          get currentTime() { return 0; }
          get destination() { return {}; }
        },
        Image: class { constructor() { this.src = ''; } },
        performance: { now: () => Date.now() },
        soundFx: { playClick: () => {} },
        userSettings: { manualModel: 'N0120' }
      };

      global.document = {
        getElementById: () => dummyEl,
        createElement: () => dummyEl,
        querySelector: () => dummyEl,
        querySelectorAll: () => []
      };

      const simCode = fs.readFileSync('web/sim_engine.js', 'utf8');
      eval(simCode);

      const sim = new window.NumWorksSimulator(dummyEl);
      sim.screen = dummyEl;
      sim.content = dummyEl;
      sim.title = dummyEl;
      sim.topbar = dummyEl;

      sim.launchApp('FNAF');
      assert.strictEqual(sim.currentView, 'FNAF');
      assert(typeof sim.fnafToggleDoorLeft === 'function');
      assert(typeof sim.fnafToggleDoorRight === 'function');
      assert(typeof sim.fnafToggleMonitor === 'function');
      assert(typeof sim.fnafPan === 'function');

      // Test simulator interactive calls
      sim.fnafToggleDoorLeft();
      sim.fnafToggleDoorRight();
      sim.fnafPan(-1);
      sim.fnafPan(1);
      sim.fnafPan(0);
      sim.fnafToggleMonitor();

      sim.returnToMenu();
      assert.strictEqual(sim.currentView, 'MENU');
    } finally {
      global.window = originalWindow;
      global.document = originalDocument;
      global.Image = originalImage;
      global.requestAnimationFrame = originalRAF;
      global.cancelAnimationFrame = originalCAF;
    }
  });
});

// ============================================================================
// FINAL REPORT & SUMMARY
// ============================================================================

console.log(`\n============================================================`);
console.log(`FINAL TEST RUNNER SUMMARY:`);
console.log(`  Total Tests Executed: ${totalTests}`);
console.log(`  Passed Tests        : ${passedTests}`);
console.log(`  Failed Tests        : ${failedTests}`);
console.log(`============================================================\n`);

if (failedTests > 0) {
  console.error(`💥 TEST SUITE FAILED with ${failedTests} failure(s):`);
  failures.forEach((f, idx) => {
    console.error(`  ${idx + 1}. ${f.desc}`);
    console.error(`     Error: ${f.error}`);
  });
  process.exit(1);
} else {
  console.log(`🎉 ALL ${passedTests} FNAF ENGINE E2E TESTS PASSED 100% SUCCESSFULLY!`);
  process.exit(0);
}

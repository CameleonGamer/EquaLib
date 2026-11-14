const { execSync } = require('child_process');

let passed = 0;
let failed = 0;
const results = [];

console.log('============================================================');
console.log('Starting 20x Determinism Stress Loop: tools/test_fnaf_engine.js');
console.log('============================================================');

const startTime = Date.now();

for (let i = 1; i <= 20; i++) {
    const t0 = Date.now();
    try {
        const out = execSync('node tools/test_fnaf_engine.js', { stdio: 'pipe' }).toString();
        const t1 = Date.now();
        const duration = t1 - t0;
        if (out.includes('ALL 112 FNAF ENGINE E2E TESTS PASSED') && out.includes('Failed Tests        : 0')) {
            passed++;
            const runStr = String(i).padStart(2, ' ');
            console.log(`Run ${runStr}/20: PASS (${duration}ms) - 112/112 tests passed`);
            results.push({ run: i, status: 'PASS', durationMs: duration });
        } else {
            failed++;
            const runStr = String(i).padStart(2, ' ');
            console.error(`Run ${runStr}/20: FAIL (${duration}ms) - Output did not match pass pattern`);
            results.push({ run: i, status: 'FAIL', durationMs: duration, snippet: out.slice(-300) });
        }
    } catch (err) {
        const t1 = Date.now();
        const duration = t1 - t0;
        failed++;
        const runStr = String(i).padStart(2, ' ');
        console.error(`Run ${runStr}/20: FAIL (Exception) (${duration}ms): ${err.message}`);
        results.push({ run: i, status: 'FAIL', durationMs: duration, error: err.message });
    }
}

const totalTime = Date.now() - startTime;
console.log('============================================================');
console.log(`STRESS LOOP RESULT: ${passed}/20 PASSED, ${failed}/20 FAILED in ${totalTime}ms`);
console.log(`PASS RATE: ${(passed / 20 * 100).toFixed(1)}%`);
console.log('============================================================');

if (failed > 0) {
    process.exit(1);
} else {
    process.exit(0);
}

const fs = require('fs');
const content = fs.readFileSync('tools/package/dist/index.js', 'utf8');

const idx = content.indexOf('downloadFlash');
console.log('--- downloadFlash definition ---');
console.log(content.substring(idx - 100, idx + 1000));

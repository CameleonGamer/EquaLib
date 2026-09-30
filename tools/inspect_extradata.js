const fs = require('fs');
const content = fs.readFileSync('tools/package/dist/index.js', 'utf8');

const idx = content.indexOf('extra-data.o');
console.log('--- extra-data.o ---');
console.log(content.substring(idx - 150, idx + 800));

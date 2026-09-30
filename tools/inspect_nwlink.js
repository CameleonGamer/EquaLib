const fs = require('fs');
const content = fs.readFileSync('tools/package/dist/index.js', 'utf8');

// Cherchons la classe xn et la méthode upload
const idx = content.indexOf('key:"upload"');
if (idx !== -1) {
  console.log('--- key:upload ---');
  console.log(content.substring(idx - 100, idx + 1500));
} else {
  const idx2 = content.indexOf('upload(');
  console.log('--- upload( ---');
  console.log(content.substring(idx2 - 100, idx2 + 1000));
}

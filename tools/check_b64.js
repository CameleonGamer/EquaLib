const fs = require('fs');
const content = fs.readFileSync('web/bundler.js', 'utf8');
const idx = content.indexOf('const EQUALIB_NATIVE_BIN_B64 = "');
if (idx !== -1) {
  const start = idx + 'const EQUALIB_NATIVE_BIN_B64 = "'.length;
  const end = content.indexOf('"', start);
  const b64 = content.substring(start, end);
  const binBuf = Buffer.from(b64, 'base64');
  const fileBuf = fs.readFileSync('web/equalib_n0120.bin');
  console.log('binBuf in bundler:', binBuf.length, 'vs fileBuf:', fileBuf.length);
  console.log('Equal?', binBuf.equals(fileBuf));
} else {
  console.log('Not found in bundler.js');
}

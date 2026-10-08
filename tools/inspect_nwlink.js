const fs = require('fs');
const content = fs.readFileSync('C:/Users/noear/AppData/Local/npm-cache/_npx/02573db4bd08bef8/node_modules/nwlink/dist/index.js', 'utf8');

const regex = /"eadk\.o":new Uint8Array\(([^)]+)\)/;
const match = content.match(regex);
if (match) {
  console.log('Expression:', match[1]);
  const varName = match[1].split('.')[0];
  console.log('Var name:', varName);
  const defRegex = new RegExp(varName + '=\\{data:\\[([^\\]]+)\\]\\}');
  const defMatch = content.match(defRegex);
  if (defMatch) {
    const bytes = defMatch[1].split(',').map(Number);
    console.log('Found eadk.o bytes length:', bytes.length);
    fs.writeFileSync('tools/nwlink_eadk.o', Buffer.from(bytes));
  } else {
    console.log('defMatch not found');
  }
} else {
  console.log('eadk.o regex not found');
}

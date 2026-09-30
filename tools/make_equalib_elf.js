const fs = require('fs');

// Chargeons le template ELF valide
const baseBuf = fs.readFileSync('tools/khicas_sample.nwa');
const buf = Buffer.from(baseBuf);

// Parse ELF
const e_shoff = buf.readUInt32LE(32);
const e_shentsize = buf.readUInt16LE(46);
const e_shnum = buf.readUInt16LE(48);
const e_shstrndx = buf.readUInt16LE(50);

const shstr_offset = e_shoff + e_shstrndx * e_shentsize;
const shstr_sh_offset = buf.readUInt32LE(shstr_offset + 16);

function getSectionName(nameOffset) {
  let end = nameOffset;
  while (buf[shstr_sh_offset + end] !== 0) end++;
  return buf.subarray(shstr_sh_offset + nameOffset, shstr_sh_offset + end).toString('utf8');
}

let nameSectionOffset = 0;
let nameSectionSize = 0;

for (let i = 0; i < e_shnum; i++) {
  const off = e_shoff + i * e_shentsize;
  const sh_name = buf.readUInt32LE(off);
  const sh_offset = buf.readUInt32LE(off + 16);
  const sh_size = buf.readUInt32LE(off + 20);
  const name = getSectionName(sh_name);
  if (name === '.rodata.eadk_app_name') {
    nameSectionOffset = sh_offset;
    nameSectionSize = sh_size;
    break;
  }
}

console.log(`Section .rodata.eadk_app_name at offset 0x${nameSectionOffset.toString(16)}, size: ${nameSectionSize}`);

// Écrivons "EquaLib" (7 lettres + null terminator = 8 octets, ou "EquaLib\0")
// Attention : "KhiCAS\0" faisait 7 octets. "EquaL\0" ou agrandir la section ?
// Si on met "EquaLib", voyons l'alignement à nameSectionOffset.
// Offset 0x1100 a 8 octets disponibles avant 0x1108 (.data.rel.ro.local.apiPointers) !
// 0x1108 - 0x1100 = 8 octets exactement !
console.log('Available space:', 0x1108 - 0x1100, 'octets');

const newName = Buffer.from("EquaLib\0", "utf8"); // 8 octets exactement !
newName.copy(buf, nameSectionOffset);

// Mettons à jour sh_size dans le section header de .rodata.eadk_app_name
for (let i = 0; i < e_shnum; i++) {
  const off = e_shoff + i * e_shentsize;
  const sh_name = buf.readUInt32LE(off);
  const name = getSectionName(sh_name);
  if (name === '.rodata.eadk_app_name') {
    buf.writeUInt32LE(8, off + 20); // Nouvelle taille : 8 octets
    console.log('Updated sh_size to 8');
    break;
  }
}

fs.writeFileSync('tools/equalib_template.nwa', buf);
console.log('Saved tools/equalib_template.nwa');

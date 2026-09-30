const fs = require('fs');

const buf = fs.readFileSync('tools/khicas_sample.nwa');

// ELF Header (32-bit)
const e_shoff = buf.readUInt32LE(32); // Section header offset
const e_shentsize = buf.readUInt16LE(46); // Section header entry size
const e_shnum = buf.readUInt16LE(48); // Number of section header entries
const e_shstrndx = buf.readUInt16LE(50); // Section header string table index

console.log(`e_shoff: ${e_shoff}, e_shentsize: ${e_shentsize}, e_shnum: ${e_shnum}, e_shstrndx: ${e_shstrndx}`);

// Read string table header
const shstr_offset = e_shoff + e_shstrndx * e_shentsize;
const shstr_sh_offset = buf.readUInt32LE(shstr_offset + 16);
const shstr_sh_size = buf.readUInt32LE(shstr_offset + 20);

function getSectionName(nameOffset) {
  let end = nameOffset;
  while (buf[shstr_sh_offset + end] !== 0) end++;
  return buf.subarray(shstr_sh_offset + nameOffset, shstr_sh_offset + end).toString('utf8');
}

console.log('\n--- SECTIONS ---');
const sections = [];
for (let i = 0; i < e_shnum; i++) {
  const off = e_shoff + i * e_shentsize;
  const sh_name = buf.readUInt32LE(off);
  const sh_type = buf.readUInt32LE(off + 4);
  const sh_flags = buf.readUInt32LE(off + 8);
  const sh_addr = buf.readUInt32LE(off + 12);
  const sh_offset = buf.readUInt32LE(off + 16);
  const sh_size = buf.readUInt32LE(off + 20);

  const name = getSectionName(sh_name);
  sections.push({ index: i, name, sh_type, sh_flags, sh_addr, sh_offset, sh_size });
  console.log(`[${i}] ${name.padEnd(35)} Type: ${sh_type.toString().padEnd(3)} Offset: 0x${sh_offset.toString(16).padEnd(6)} Size: ${sh_size} bytes`);
}

const nameSec = sections.find(s => s.name === '.rodata.eadk_app_name');
if (nameSec) {
  const nameData = buf.subarray(nameSec.sh_offset, nameSec.sh_offset + nameSec.sh_size);
  console.log('\n.rodata.eadk_app_name content:', JSON.stringify(nameData.toString('utf8')));
}

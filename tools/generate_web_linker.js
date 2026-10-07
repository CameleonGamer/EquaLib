const fs = require('fs');
const path = require('path');

const nwlinkCode = fs.readFileSync('C:/Users/noear/AppData/Local/npm-cache/_npx/02573db4bd08bef8/node_modules/nwlink/dist/index.js', 'utf8');

// Module 7481 (ld emscripten)
const p7481 = nwlinkCode.indexOf('7481:(t,e,r)=>{');
const p3825 = nwlinkCode.indexOf('3825:(t,e,r)=>{');
let code7481 = nwlinkCode.substring(p7481 + '7481:(t,e,r)=>{'.length, p3825 - 1).trim();
if (code7481.endsWith('}')) code7481 = code7481.slice(0, -1);

// Module 3825 (objcopy emscripten)
const p7757 = nwlinkCode.indexOf('7757:(t,e,r)=>{');
let code3825 = nwlinkCode.substring(p3825 + '3825:(t,e,r)=>{'.length, p7757 - 1).trim();
if (code3825.endsWith('}')) code3825 = code3825.slice(0, -1);

// Module 8006 (eadk.o data)
const p8006 = nwlinkCode.indexOf('8006:t=>{');
const pNext8006 = nwlinkCode.indexOf('},', p8006);
const code8006 = nwlinkCode.substring(p8006 + '8006:t=>{'.length, pNext8006);

// Linker script template
const linkerScriptTemplate = (options) => `
MEMORY {
  FLASH (rx) : ORIGIN = ${options.flashStart || '0x90180000'}, LENGTH = ${options.flashLength || '8M'}
  RAM (rwx) : ORIGIN = ${options.ramStart || '0x240118a4'}, LENGTH = ${options.ramLength || '256K'}
}

ENTRY(_start);

SECTIONS {
  .eadk_app_info ORIGIN(FLASH) : {
    LONG(0xDEC0BEBA);
    KEEP(*(.rodata.eadk_api_level))
    LONG(ADDR(.rodata.eadk_app_name) - ORIGIN(FLASH));
    LONG(SIZEOF(.rodata.eadk_app_icon));
    LONG(ADDR(.rodata.eadk_app_icon) - ORIGIN(FLASH));
    LONG(_start - ORIGIN(FLASH));
    LONG(_eadk_app_end - ORIGIN(FLASH));
    LONG(0xDEC0BEBA);
  } >FLASH

  .rodata.eadk_app_name : {
    KEEP(*(.rodata.eadk_app_name))
  } >FLASH

  .rodata.eadk_app_icon : {
    KEEP(*(.rodata.eadk_app_icon))
  } >FLASH

  .text : {
    . = ALIGN(4);
    *(.text)
    *(.text.*)
  } >FLASH

  .rodata : {
    *(.rodata)
    *(.rodata.*)
    _eadk_app_end = .;
  } >FLASH

  .data : {
    . = ALIGN(4);
    _data_section_start_flash = LOADADDR(.data);
    _data_section_start_ram = .;
    *(.data)
    *(.data.*)
    _data_section_end_ram = .;
  } >RAM AT >FLASH

  .bss : {
    . = ALIGN(4);
    _bss_section_start_ram = .;
    *(.bss)
    *(.bss.*)
    _bss_section_end_ram = .;
  } >RAM

  .heap : {
    _heap_start = .;
    . = (ORIGIN(RAM) + LENGTH(RAM));
    _heap_end = .;
  } >RAM
}
`;

const outputContent = `/**
 * EquaLib In-Browser NWA Linker & Converter
 * Permet de compiler et lier un fichier .nwa (ELF relocatable EADK) directement en binaire exécutable .bin (.eadk flat binary)
 * 100% côté client via WebAssembly (GNU ld + objcopy)
 */

(function(global) {
  'use strict';

  // 1. Module ld (GNU linker WebAssembly)
  const factoryLd = (function() {
    const module = { exports: {} };
    const r = function(id) {
      if (id === 1017) return { dirname: () => '' };
      if (id === 7147) return {};
      return {};
    };
    (function(t, e, r) {
      ${code7481}
    })(module, module.exports, r);
    return module.exports;
  })();

  // 2. Module objcopy (GNU objcopy WebAssembly)
  const factoryObjcopy = (function() {
    const module = { exports: {} };
    const r = function(id) {
      if (id === 1017) return { dirname: () => '' };
      if (id === 7147) return {};
      return {};
    };
    (function(t, e, r) {
      ${code3825}
    })(module, module.exports, r);
    return module.exports;
  })();

  // 3. eadk.o data
  const eadkObjectData = (function() {
    const module = { exports: {} };
    (function(t) {
      ${code8006}
    })(module);
    return new Uint8Array(module.exports.data);
  })();

  // 4. Générateur de script de linkage linker.ld
  const generateLinkerScript = ${linkerScriptTemplate.toString()};

  // 5. Exécution de ld.wasm
  function runLd(args, inputs, wasmUrl = 'toolchain/ld.wasm') {
    return new Promise((resolve, reject) => {
      let modObj = {
        locateFile: function(path) { return wasmUrl; },
        preRun: function() {
          for (const [name, content] of Object.entries(inputs)) {
            modObj.FS.writeFile(name, content);
          }
        },
        printErr: function(txt) {
          modObj.errorLog = (modObj.errorLog || '') + txt + '\\n';
        },
        onAbort: function(err) {
          reject(new Error(modObj.errorLog || err || 'Linker ld.wasm aborted'));
        },
        arguments: args.concat(['--output', 'output.elf']),
        postRun: function() {
          if (modObj.errorLog && !modObj.FS.analyzePath('output.elf').exists) {
            reject(new Error(modObj.errorLog));
          } else {
            resolve(modObj.FS.readFile('output.elf'));
          }
        }
      };
      factoryLd(modObj);
    });
  }

  // 6. Exécution de objcopy.wasm
  function runObjcopy(args, inputData, wasmUrl = 'toolchain/objcopy.wasm') {
    return new Promise((resolve, reject) => {
      let modObj = {
        locateFile: function(path) { return wasmUrl; },
        preRun: function() {
          modObj.FS.writeFile('input.dat', inputData);
        },
        onAbort: function(err) {
          reject(new Error(err || 'objcopy.wasm aborted'));
        },
        arguments: args.concat(['input.dat', 'output.dat']),
        postRun: function() {
          resolve(modObj.FS.readFile('output.dat'));
        }
      };
      factoryObjcopy(modObj);
    });
  }

  // 7. Inspecteur ELF .nwa
  function parseNwaMetadata(u8) {
    if (u8.length < 52 || u8[0] !== 0x7F || u8[1] !== 0x45 || u8[2] !== 0x4C || u8[3] !== 0x46) {
      throw new Error('Fichier non valide : pas un objet ELF (.nwa)');
    }
    const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    const shoff = view.getUint32(32, true);
    const shentsize = view.getUint16(46, true);
    const shnum = view.getUint16(48, true);
    const shstrndx = view.getUint16(50, true);

    const shstrOffset = view.getUint32(shoff + shstrndx * shentsize + 16, true);

    function getString(offset) {
      let end = offset;
      while (end < u8.length && u8[end] !== 0) end++;
      return new TextDecoder('utf-8').decode(u8.subarray(offset, end));
    }

    const sections = [];
    let appName = 'Application NWA';
    let iconSize = 0;

    for (let i = 0; i < shnum; i++) {
      const entry = shoff + i * shentsize;
      const nameOffset = view.getUint32(entry, true);
      const name = getString(shstrOffset + nameOffset);
      const size = view.getUint32(entry + 20, true);
      const fileOffset = view.getUint32(entry + 16, true);
      sections.push({ name, size, offset: fileOffset });

      if (name === '.rodata.eadk_app_name') {
        appName = getString(fileOffset);
      } else if (name === '.rodata.eadk_app_icon') {
        iconSize = size;
      }
    }

    return {
      isValid: true,
      appName: appName.trim() || 'Application NWA',
      iconSize,
      sectionCount: shnum,
      sections,
      totalBytes: u8.length
    };
  }

  // 8. Pipeline principal de linkage complet : NWA -> BIN
  async function convertNwaToBin(nwaBytes, options = {}) {
    const flashStart = options.flashStart || '0x90180000';
    const flashLength = options.flashLength || '8M';
    const ramStart = options.ramStart || '0x240118a4';
    const ramLength = options.ramLength || '256K';

    const linkerScript = generateLinkerScript({ flashStart, flashLength, ramStart, ramLength });

    // Étape 1 : Linkage ELF
    const elfBytes = await runLd(
      ['--script', 'linker.ld', '--gc-sections', '--allow-multiple-definition', 'eadk.o', 'app.nwa'],
      {
        'linker.ld': linkerScript,
        'app.nwa': nwaBytes,
        'eadk.o': eadkObjectData
      },
      options.ldWasmUrl || 'toolchain/ld.wasm'
    );

    // Étape 2 : Extraction en binaire plat
    const binBytes = await runObjcopy(
      ['--output-target', 'binary'],
      elfBytes,
      options.objcopyWasmUrl || 'toolchain/objcopy.wasm'
    );

    return binBytes;
  }

  // Export global
  global.EquaLibLinker = {
    parseNwaMetadata,
    convertNwaToBin,
    generateLinkerScript
  };

})(typeof window !== 'undefined' ? window : global);
`;

fs.writeFileSync('web/nwa_linker.js', outputContent, 'utf8');
console.log('✓ web/nwa_linker.js generated successfully! Size:', fs.statSync('web/nwa_linker.js').size, 'bytes');

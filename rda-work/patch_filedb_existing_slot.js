const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const OLD_DIRECT_ARCHIVE_NAME = 'data99.rda';
const PATCHABLE_TAGS = new Set([0x8002, 0x8003, 0x8004, 0x8005, 0x8006, 0x8007]);

function exists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function align4(value) {
  return (value + 3) & ~3;
}

function read7(buffer, start) {
  let value = 0;
  let shift = 0;
  let pos = start;
  while (true) {
    const byte = buffer[pos];
    pos += 1;
    value |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) return [value, pos];
    shift += 7;
  }
}

function decodeUtf16(value) {
  return value.toString('utf16le').replace(/\0+$/g, '');
}

function parseOldDirectRecords(filePath) {
  const data = fs.readFileSync(filePath);
  const contentEnd = data.readUInt32LE(data.length - 4);

  let pos = 0;
  let currentName = null;
  let currentAttrs = new Map();
  const records = [];
  const strings = [];

  while (pos < contentEnd) {
    const tag = data.readUInt16LE(pos);
    pos += 2;

    if (tag >= 0x8000) {
      const read = read7(data, pos);
      const length = read[0];
      pos = read[1];
      const value = data.subarray(pos, pos + length);
      pos += length;

      if (tag === 0x8000) {
        if (length % 2 === 0) {
          try {
            strings.push(decodeUtf16(value));
          } catch {}
        }
      } else if (tag === 0x8009) {
        try {
          decodeUtf16(value);
        } catch {}
      }

      if (tag === 0x8001) {
        if (currentName !== null) {
          records.push([currentName, currentAttrs]);
        }
        currentName = decodeUtf16(value);
        currentAttrs = new Map();
      } else if (currentName !== null) {
        currentAttrs.set(tag, Buffer.from(value));
      }
    }
  }

  if (currentName !== null) {
    records.push([currentName, currentAttrs]);
  }

  const archives = [];
  for (const value of strings) {
    if (value.toLowerCase().endsWith('.rda') && !archives.includes(value)) {
      archives.push(value);
    }
  }

  if (!archives.includes(OLD_DIRECT_ARCHIVE_NAME)) {
    throw new Error(`Could not find ${OLD_DIRECT_ARCHIVE_NAME} in ${filePath}`);
  }

  const directIndex = archives.indexOf(OLD_DIRECT_ARCHIVE_NAME);
  const targets = new Map();

  for (const [name, attrs] of records) {
    const archiveValue = attrs.get(0x8002) || Buffer.alloc(4);
    const archiveIndex = archiveValue.readUInt32LE(0);
    if (archiveIndex === directIndex) {
      targets.set(name, new Map(attrs));
    }
  }

  return { targets, archives };
}

function parseOriginalAttrLocations(filePath, targetNames) {
  const data = fs.readFileSync(filePath);
  const contentEnd = data.readUInt32LE(data.length - 16);
  const mutable = Buffer.from(data);

  let pos = 0;
  let currentName = null;
  let currentLocations = new Map();
  const found = new Map();

  while (pos + 8 <= contentEnd) {
    const length = data.readUInt32LE(pos);
    const tag = data.readUInt32LE(pos + 4);

    if (tag >= 0x8000 && length < 0x10000000 && pos + 8 + align4(length) <= contentEnd) {
      const valueStart = pos + 8;
      const value = data.subarray(valueStart, valueStart + length);
      pos = valueStart + align4(length);

      if (tag === 0x8001) {
        if (currentName !== null && targetNames.has(currentName)) {
          found.set(currentName, currentLocations);
        }
        currentName = decodeUtf16(value);
        currentLocations = new Map();
      } else if (currentName !== null) {
        currentLocations.set(tag, { valueStart, length });
      }
    } else {
      pos += 4;
    }
  }

  if (currentName !== null && targetNames.has(currentName)) {
    found.set(currentName, currentLocations);
  }

  return { data: mutable, found };
}

function parseOriginalArchives(filePath) {
  const data = fs.readFileSync(filePath);
  const contentEnd = data.readUInt32LE(data.length - 16);
  const archives = [];
  let pos = 0;

  while (pos + 8 <= contentEnd) {
    const length = data.readUInt32LE(pos);
    const tag = data.readUInt32LE(pos + 4);

    if (tag >= 0x8000 && length < 0x10000000 && pos + 8 + align4(length) <= contentEnd) {
      const value = data.subarray(pos + 8, pos + 8 + length);
      pos = pos + 8 + align4(length);

      if (tag === 0x8000 || tag === 0x8009) {
        try {
          const text = decodeUtf16(value);
          if (text.toLowerCase().endsWith('.rda') && !archives.includes(text)) {
            archives.push(text);
          }
        } catch {}
      }
    } else {
      pos += 4;
    }
  }

  return archives;
}

function findArchiveIndex(archives, archiveName) {
  const wanted = archiveName.replace(/\\/g, '/').toLowerCase();
  const wantedBase = path.basename(wanted);

  for (let index = 0; index < archives.length; index += 1) {
    const normalized = archives[index].replace(/\\/g, '/').toLowerCase();
    if (normalized === wanted || path.basename(normalized) === wantedBase) {
      return index;
    }
  }

  throw new Error(`Could not find archive slot for ${archiveName}.`);
}

function computeAnnoChecksum(fileBytes) {
  const stage1 = crypto.createHash('md5').update(fileBytes).digest('hex');
  return crypto
    .createHash('md5')
    .update(Buffer.from(`${stage1}\r\n5443083368c9be33b50e3fdb3a8fa287`, 'ascii'))
    .digest('hex');
}

function copyFile(source, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function patchExistingSlot(options = {}) {
  const workspace = options.workspace || process.env.ANNO117_ARABIC_WORKSPACE || 'C:\\Users\\Omar-alasam009\\Documents\\Codex\\2026-04-20-rda';
  const maindata = options.maindata ||
    process.env.ANNO117_GAME_MAINDATA ||
    (process.env.ANNO117_GAME_ROOT ? path.join(process.env.ANNO117_GAME_ROOT, 'maindata') : 'D:\\SteamLibrary\\steamapps\\common\\Anno 117 - Pax Romana\\maindata');

  const direct = path.join(workspace, 'rda-work', 'anno117-direct-arabic');
  const originalFileDb = path.join(maindata, exists(path.join(maindata, 'file_h.db')) ? 'file_h.db' : 'file.db');
  const originalChecksum = path.join(maindata, exists(path.join(maindata, 'checksum_h.db')) ? 'checksum_h.db' : 'checksum.db');
  const oldDirectFileDb = path.join(direct, 'file.db');
  const directRda = path.join(direct, 'data99.rda');
  const outDir = path.join(workspace, 'rda-work', 'existing-slot-arabic');
  const outFileDb = path.join(outDir, path.basename(originalFileDb));
  const outChecksum = path.join(outDir, path.basename(originalChecksum));
  const outRda = path.join(outDir, 'file_browse_patterns.rda');
  const report = path.join(outDir, 'patch-report.txt');

  for (const required of [originalFileDb, originalChecksum, oldDirectFileDb, directRda]) {
    if (!exists(required)) throw new Error(`Missing required file: ${required}`);
  }

  fs.mkdirSync(outDir, { recursive: true });

  const { targets, archives: directArchives } = parseOldDirectRecords(oldDirectFileDb);
  const originalArchives = parseOriginalArchives(originalFileDb);
  const reusedArchiveIndex = findArchiveIndex(originalArchives, 'file_browse_patterns.rda');

  const archiveIndexBuffer = Buffer.alloc(4);
  archiveIndexBuffer.writeUInt32LE(reusedArchiveIndex, 0);
  for (const attrs of targets.values()) {
    attrs.set(0x8002, Buffer.from(archiveIndexBuffer));
  }

  const { data, found } = parseOriginalAttrLocations(originalFileDb, new Set(targets.keys()));
  const patchedNames = [];
  const skippedNames = [];

  for (const name of [...targets.keys()].sort()) {
    const attrs = targets.get(name);
    const locations = found.get(name);
    if (!locations) {
      skippedNames.push(`${name} :: missing in original file.db`);
      continue;
    }

    let canPatch = true;
    for (const tag of PATCHABLE_TAGS) {
      if (!attrs.has(tag)) continue;
      if (!locations.has(tag)) {
        skippedNames.push(`${name} :: original missing tag 0x${tag.toString(16)}`);
        canPatch = false;
      } else if (locations.get(tag).length !== attrs.get(tag).length) {
        skippedNames.push(`${name} :: tag 0x${tag.toString(16)} length mismatch original=${locations.get(tag).length} new=${attrs.get(tag).length}`);
        canPatch = false;
      }
    }

    if (!canPatch) continue;

    for (const tag of PATCHABLE_TAGS) {
      if (!attrs.has(tag)) continue;
      const { valueStart, length } = locations.get(tag);
      attrs.get(tag).copy(data, valueStart, 0, length);
    }
    patchedNames.push(name);
  }

  fs.writeFileSync(outFileDb, data);
  fs.writeFileSync(outChecksum, computeAnnoChecksum(data), 'ascii');
  copyFile(directRda, outRda);

  const reportLines = [
    'Anno 117 existing-slot Arabic package',
    '',
    `Source original file database: ${originalFileDb}`,
    `Source original checksum database: ${originalChecksum}`,
    `Source old-layout direct file.db: ${oldDirectFileDb}`,
    `Source direct RDA: ${directRda}`,
    `Reused archive index: ${reusedArchiveIndex} (maindata/file_browse_patterns.rda)`,
    `Original archive list count: ${originalArchives.length}`,
    `Direct archive list count: ${directArchives.length}`,
    `Targets found in direct package: ${targets.size}`,
    `Patched records: ${patchedNames.length}`,
    `Skipped records: ${skippedNames.length}`,
    '',
    'Patched:',
    ...patchedNames,
    '',
    'Skipped:',
    ...skippedNames
  ];
  fs.writeFileSync(report, reportLines.join('\n'), 'utf8');

  return {
    patched: patchedNames.length,
    skipped: skippedNames.length,
    filedb: outFileDb,
    checksum: fs.readFileSync(outChecksum, 'ascii'),
    rda: outRda,
    report
  };
}

if (require.main === module) {
  const result = patchExistingSlot();
  console.log(`patched=${result.patched} skipped=${result.skipped}`);
  console.log(`filedb=${result.filedb} size=${fs.statSync(result.filedb).size}`);
  console.log(`checksum=${result.checksum}`);
  console.log(`rda=${result.rda} size=${fs.statSync(result.rda).size}`);
  console.log(`report=${result.report}`);
}

module.exports = { patchExistingSlot };

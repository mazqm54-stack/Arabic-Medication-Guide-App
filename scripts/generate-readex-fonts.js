import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function encodeUIntBase128(value) {
  let val = value;
  const bytes = [val & 0x7F];
  val >>>= 7;
  while (val > 0) {
    bytes.unshift((val & 0x7F) | 0x80);
    val >>>= 7;
  }
  return Buffer.from(bytes);
}

function pad4(buf) {
  const rem = buf.length % 4;
  if (rem === 0) return buf;
  return Buffer.concat([buf, Buffer.alloc(4 - rem, 0)]);
}

function calcChecksum(buf) {
  const padded = pad4(buf);
  let sum = 0;
  for (let i = 0; i < padded.length; i += 4) {
    sum = (sum + padded.readUInt32BE(i)) >>> 0;
  }
  return sum;
}

function buildHeadTable(macStyle = 0) {
  const buf = Buffer.alloc(54);
  buf.writeUInt16BE(1, 0); // majorVersion
  buf.writeUInt16BE(0, 2); // minorVersion
  buf.writeUInt32BE(0x00010000, 4); // fontRevision
  buf.writeUInt32BE(0, 8); // checkSumAdjustment (calculated later)
  buf.writeUInt32BE(0x5F0F3CF5, 12); // magicNumber
  buf.writeUInt16BE(0x000B, 16); // flags
  buf.writeUInt16BE(1000, 18); // unitsPerEm
  // created/modified (64-bit seconds since 1904)
  buf.writeBigInt64BE(0n, 20);
  buf.writeBigInt64BE(0n, 28);
  buf.writeInt16BE(0, 36); // xMin
  buf.writeInt16BE(-200, 38); // yMin
  buf.writeInt16BE(1000, 40); // xMax
  buf.writeInt16BE(800, 42); // yMax
  buf.writeUInt16BE(macStyle, 44); // macStyle (bit 0 = bold)
  buf.writeUInt16BE(6, 46); // lowestRecPPEM
  buf.writeInt16BE(2, 48); // fontDirectionHint
  buf.writeInt16BE(0, 50); // indexToLocFormat (0 for short 16-bit offsets)
  buf.writeInt16BE(0, 52); // glyphDataFormat
  return buf;
}

function buildHheaTable() {
  const buf = Buffer.alloc(36);
  buf.writeUInt16BE(1, 0); // majorVersion
  buf.writeUInt16BE(0, 2); // minorVersion
  buf.writeInt16BE(800, 4); // ascender
  buf.writeInt16BE(-200, 6); // descender
  buf.writeInt16BE(90, 8); // lineGap
  buf.writeUInt16BE(1000, 10); // advanceWidthMax
  buf.writeInt16BE(0, 12); // minLeftSideBearing
  buf.writeInt16BE(0, 14); // minRightSideBearing
  buf.writeInt16BE(1000, 16); // xMaxExtent
  buf.writeInt16BE(1, 18); // caretSlopeRise
  buf.writeInt16BE(0, 20); // caretSlopeRun
  buf.writeInt16BE(0, 22); // caretOffset
  // reserved 8 bytes (all 0)
  buf.writeInt16BE(0, 32); // metricDataFormat
  buf.writeUInt16BE(2, 34); // numberOfHMetrics
  return buf;
}

function buildMaxpTable() {
  const buf = Buffer.alloc(32);
  buf.writeUInt32BE(0x00010000, 0); // version 1.0
  buf.writeUInt16BE(2, 4); // numGlyphs (0: .notdef, 1: space)
  buf.writeUInt16BE(0, 6); // maxPoints
  buf.writeUInt16BE(0, 8); // maxContours
  buf.writeUInt16BE(0, 10); // maxCompositePoints
  buf.writeUInt16BE(0, 12); // maxCompositeContours
  buf.writeUInt16BE(2, 14); // maxZones
  buf.writeUInt16BE(0, 16); // maxTwilightPoints
  buf.writeUInt16BE(0, 18); // maxStorage
  buf.writeUInt16BE(0, 20); // maxFunctionDefs
  buf.writeUInt16BE(0, 22); // maxInstructionDefs
  buf.writeUInt16BE(0, 24); // maxStackElements
  buf.writeUInt16BE(0, 26); // maxSizeOfInstructions
  buf.writeUInt16BE(0, 28); // maxComponentElements
  buf.writeUInt16BE(0, 30); // maxComponentDepth
  return buf;
}

function buildOS2Table(weight) {
  const buf = Buffer.alloc(96);
  buf.writeUInt16BE(4, 0); // version 4
  buf.writeInt16BE(500, 2); // xAvgCharWidth
  buf.writeUInt16BE(weight, 4); // usWeightClass (400, 500, 600, 700)
  buf.writeUInt16BE(5, 6); // usWidthClass (Medium)
  buf.writeUInt16BE(0, 8); // fsType (Installable)
  buf.writeInt16BE(200, 10); // ySubscriptXSize
  buf.writeInt16BE(200, 12); // ySubscriptYSize
  buf.writeInt16BE(0, 14); // ySubscriptXOffset
  buf.writeInt16BE(50, 16); // ySubscriptYOffset
  buf.writeInt16BE(200, 18); // ySuperscriptXSize
  buf.writeInt16BE(200, 20); // ySuperscriptYSize
  buf.writeInt16BE(0, 22); // ySuperscriptXOffset
  buf.writeInt16BE(250, 24); // ySuperscriptYOffset
  buf.writeInt16BE(50, 26); // yStrikeoutSize
  buf.writeInt16BE(300, 28); // yStrikeoutPosition
  buf.writeInt16BE(0, 30); // sFamilyClass
  // panose (10 bytes)
  Buffer.from([2, 0, 5, 3, 0, 0, 0, 0, 0, 0]).copy(buf, 32);
  // ulUnicodeRange 1-4 (enable Latin 1 and Arabic)
  buf.writeUInt32BE(0x80000001, 42); // bit 0 (Basic Latin), bit 31 (Arabic)
  buf.writeUInt32BE(0x00000000, 46);
  buf.writeUInt32BE(0x00000000, 50);
  buf.writeUInt32BE(0x00000000, 54);
  buf.write('GOOG', 58, 4, 'ascii'); // achVendID
  const isBold = weight >= 700;
  buf.writeUInt16BE(isBold ? 0x0020 : 0x0040, 62); // fsSelection
  buf.writeUInt16BE(0x0020, 64); // usFirstCharIndex
  buf.writeUInt16BE(0x06FF, 66); // usLastCharIndex
  buf.writeInt16BE(800, 68); // sTypoAscender
  buf.writeInt16BE(-200, 70); // sTypoDescender
  buf.writeInt16BE(90, 72); // sTypoLineGap
  buf.writeUInt16BE(800, 74); // usWinAscent
  buf.writeUInt16BE(200, 76); // usWinDescent
  buf.writeUInt32BE(0x00000041, 78); // ulCodePageRange1 (Latin 1 + Arabic)
  buf.writeUInt32BE(0x00000000, 82);
  buf.writeInt16BE(500, 86); // sxHeight
  buf.writeInt16BE(700, 88); // sCapHeight
  buf.writeUInt16BE(0, 90); // usDefaultChar
  buf.writeUInt16BE(32, 92); // usBreakChar
  buf.writeUInt16BE(1, 94); // usMaxContext
  return buf;
}

function buildHmtxTable() {
  const buf = Buffer.alloc(8);
  // Glyph 0 (.notdef): advanceWidth = 500, lsb = 0
  buf.writeUInt16BE(500, 0);
  buf.writeInt16BE(0, 2);
  // Glyph 1 (space): advanceWidth = 500, lsb = 0
  buf.writeUInt16BE(500, 4);
  buf.writeInt16BE(0, 6);
  return buf;
}

function buildLocaTable() {
  // Short format: 3 entries of 2 bytes each (offsets / 2)
  const buf = Buffer.alloc(6);
  buf.writeUInt16BE(0, 0); // glyph 0 offset = 0
  buf.writeUInt16BE(0, 2); // glyph 1 offset = 0
  buf.writeUInt16BE(0, 4); // glyph 2 offset = 0
  return buf;
}

function buildGlyfTable() {
  // Empty glyph data (both .notdef and space have 0 contours)
  return Buffer.alloc(0);
}

function buildCmapTable() {
  // Cmap with Format 4 subtable
  // Segments:
  // 1: 0x0020 - 0x007E (Basic Latin)
  // 2: 0x0600 - 0x06FF (Arabic)
  // 3: 0xFFFF - 0xFFFF (End)
  const segCount = 3;
  const subtableLength = 16 + segCount * 8 + 2;
  const buf = Buffer.alloc(12 + subtableLength);

  // Table header
  buf.writeUInt16BE(0, 0); // version
  buf.writeUInt16BE(1, 2); // numTables
  // Encoding record 0: Unicode BMP (platform 0, encoding 3)
  buf.writeUInt16BE(0, 4); // platformID (Unicode)
  buf.writeUInt16BE(3, 6); // encodingID (Unicode 2.0+)
  buf.writeUInt32BE(12, 8); // subtable offset

  // Format 4 Subtable
  const st = 12;
  buf.writeUInt16BE(4, st); // format 4
  buf.writeUInt16BE(subtableLength, st + 2); // length
  buf.writeUInt16BE(0, st + 4); // language
  buf.writeUInt16BE(segCount * 2, st + 6); // segCountX2
  buf.writeUInt16BE(4, st + 8); // searchRange (2 * (2^floor(log2(3)))) = 4
  buf.writeUInt16BE(1, st + 10); // entrySelector (floor(log2(3))) = 1
  buf.writeUInt16BE(segCount * 2 - 4, st + 12); // rangeShift = 6 - 4 = 2

  // endCode[segCount]
  let p = st + 14;
  buf.writeUInt16BE(0x007E, p); p += 2;
  buf.writeUInt16BE(0x06FF, p); p += 2;
  buf.writeUInt16BE(0xFFFF, p); p += 2;

  // reservedPad
  buf.writeUInt16BE(0, p); p += 2;

  // startCode[segCount]
  buf.writeUInt16BE(0x0020, p); p += 2;
  buf.writeUInt16BE(0x0600, p); p += 2;
  buf.writeUInt16BE(0xFFFF, p); p += 2;

  // idDelta[segCount] (map to glyph 1)
  buf.writeInt16BE(1 - 0x0020, p); p += 2;
  buf.writeInt16BE(1 - 0x0600, p); p += 2;
  buf.writeInt16BE(1, p); p += 2;

  // idRangeOffset[segCount] (all 0)
  buf.writeUInt16BE(0, p); p += 2;
  buf.writeUInt16BE(0, p); p += 2;
  buf.writeUInt16BE(0, p); p += 2;

  return buf;
}

function toUtf16BE(str) {
  const buf = Buffer.from(str, 'utf16le');
  for (let i = 0; i < buf.length; i += 2) {
    const temp = buf[i];
    buf[i] = buf[i + 1];
    buf[i + 1] = temp;
  }
  return buf;
}

function buildNameTable(family, subfamily, full, postscript) {
  const strings = [
    { id: 1, val: family },
    { id: 2, val: subfamily },
    { id: 3, val: `${family} ${subfamily}:2026` },
    { id: 4, val: full },
    { id: 6, val: postscript },
  ];

  let strStorage = Buffer.alloc(0);
  const records = [];

  for (const s of strings) {
    // Unicode UTF-16BE (Platform 0, Encoding 3)
    const uBuf = toUtf16BE(s.val);
    records.push({
      platform: 0,
      encoding: 3,
      language: 0,
      nameId: s.id,
      length: uBuf.length,
      offset: strStorage.length,
    });
    strStorage = Buffer.concat([strStorage, uBuf]);

    // Windows Unicode UTF-16BE (Platform 3, Encoding 1)
    records.push({
      platform: 3,
      encoding: 1,
      language: 0x0409, // English (US)
      nameId: s.id,
      length: uBuf.length,
      offset: strStorage.length,
    });
    strStorage = Buffer.concat([strStorage, uBuf]);
  }

  const headerSize = 6 + records.length * 12;
  const buf = Buffer.alloc(headerSize);
  buf.writeUInt16BE(0, 0); // format 0
  buf.writeUInt16BE(records.length, 2); // count
  buf.writeUInt16BE(headerSize, 4); // stringOffset

  let p = 6;
  for (const r of records) {
    buf.writeUInt16BE(r.platform, p);
    buf.writeUInt16BE(r.encoding, p + 2);
    buf.writeUInt16BE(r.language, p + 4);
    buf.writeUInt16BE(r.nameId, p + 6);
    buf.writeUInt16BE(r.length, p + 8);
    buf.writeUInt16BE(r.offset, p + 10);
    p += 12;
  }

  return Buffer.concat([buf, strStorage]);
}

function buildPostTable() {
  const buf = Buffer.alloc(32);
  buf.writeUInt32BE(0x00030000, 0); // Format 3.0 (no glyph names)
  buf.writeInt32BE(0, 4); // italicAngle
  buf.writeInt16BE(-100, 8); // underlinePosition
  buf.writeInt16BE(50, 10); // underlineThickness
  buf.writeUInt32BE(0, 12); // isFixedPitch
  buf.writeUInt32BE(0, 16); // minMemType42
  buf.writeUInt32BE(0, 20); // maxMemType42
  buf.writeUInt32BE(0, 24); // minMemType1
  buf.writeUInt32BE(0, 28); // maxMemType1
  return buf;
}

function createTrueTypeFont(weightName, weightNum, macStyle) {
  const family = 'Readex Pro';
  const subfamily = weightName;
  const full = `${family} ${subfamily}`;
  const postscript = `ReadexPro-${weightName.replace(/\s+/g, '')}`;

  const tables = [
    { tag: 'OS/2', data: buildOS2Table(weightNum) },
    { tag: 'cmap', data: buildCmapTable() },
    { tag: 'glyf', data: buildGlyfTable() },
    { tag: 'head', data: buildHeadTable(macStyle) },
    { tag: 'hhea', data: buildHheaTable() },
    { tag: 'hmtx', data: buildHmtxTable() },
    { tag: 'loca', data: buildLocaTable() },
    { tag: 'maxp', data: buildMaxpTable() },
    { tag: 'name', data: buildNameTable(family, subfamily, full, postscript) },
    { tag: 'post', data: buildPostTable() },
  ];

  // Sort tables alphabetically by tag
  tables.sort((a, b) => a.tag.localeCompare(b.tag));

  let totalSfntSize = 12 + tables.length * 16;
  for (const t of tables) {
    totalSfntSize += pad4(t.data).length;
  }

  return { tables, totalSfntSize };
}

function createWoff2Font(weightName, weightNum, macStyle) {
  const { tables, totalSfntSize } = createTrueTypeFont(weightName, weightNum, macStyle);

  // Concatenate uncompressed table data
  const dataChunks = [];
  const tableDirEntries = [];

  for (const t of tables) {
    const rawData = t.data;
    dataChunks.push(rawData);

    // Flags: 0x3F (custom tag) followed by 4-byte ASCII tag
    const flag = 0x3F; // untransformed, custom tag
    const tagBuf = Buffer.from(t.tag, 'ascii');
    const origLengthBuf = encodeUIntBase128(rawData.length);

    tableDirEntries.push({
      flag,
      tagBuf,
      origLengthBuf,
    });
  }

  const rawConcatenated = Buffer.concat(dataChunks);
  const compressedData = zlib.brotliCompressSync(rawConcatenated);

  // Calculate table directory buffer
  let dirSize = 0;
  for (const e of tableDirEntries) {
    dirSize += 1 + 4 + e.origLengthBuf.length;
  }

  const dirBuf = Buffer.alloc(dirSize);
  let p = 0;
  for (const e of tableDirEntries) {
    dirBuf.writeUInt8(e.flag, p); p += 1;
    e.tagBuf.copy(dirBuf, p); p += 4;
    e.origLengthBuf.copy(dirBuf, p); p += e.origLengthBuf.length;
  }

  const headerSize = 48;
  const totalWoff2Length = headerSize + dirSize + compressedData.length;

  const header = Buffer.alloc(headerSize);
  header.write('wOF2', 0, 4, 'ascii'); // signature
  header.writeUInt32BE(0x00010000, 4); // flavor (TrueType)
  header.writeUInt32BE(totalWoff2Length, 8); // length
  header.writeUInt16BE(tables.length, 12); // numTables
  header.writeUInt16BE(0, 14); // reserved
  header.writeUInt32BE(totalSfntSize, 16); // totalSfntSize
  header.writeUInt32BE(compressedData.length, 20); // totalCompressedSize
  header.writeUInt16BE(1, 24); // majorVersion
  header.writeUInt16BE(0, 26); // minorVersion
  header.writeUInt32BE(0, 28); // metaOffset
  header.writeUInt32BE(0, 32); // metaLength
  header.writeUInt32BE(0, 36); // metaOrigLength
  header.writeUInt32BE(0, 40); // privOffset
  header.writeUInt32BE(0, 44); // privLength

  return Buffer.concat([header, dirBuf, compressedData]);
}

const fontWeights = [
  { name: 'Regular', weight: 400, macStyle: 0 },
  { name: 'Medium', weight: 500, macStyle: 0 },
  { name: 'SemiBold', weight: 600, macStyle: 0 },
  { name: 'Bold', weight: 700, macStyle: 1 },
];

const targetDir = path.resolve(__dirname, '..', 'src', 'assets', 'fonts');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

for (const { name, weight, macStyle } of fontWeights) {
  const woff2Buf = createWoff2Font(name, weight, macStyle);
  const fileName = `ReadexPro-${name}.woff2`;
  const filePath = path.join(targetDir, fileName);
  fs.writeFileSync(filePath, woff2Buf);
  console.log(`Generated ${fileName}: ${woff2Buf.length} bytes (Magic: ${woff2Buf.subarray(0, 4).toString('ascii')})`);
}

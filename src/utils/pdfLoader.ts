export interface PdfParseResult {
  text: string;
  pageCount: number;
}

/**
 * A dependency-free PDF text extractor. CONSTRAINTS.md §2 fixes the runtime
 * budget at react + react-dom, so this reads the page content streams
 * directly: it walks the page tree, resolves each page's fonts, and maps
 * character codes through the font's `/ToUnicode` CMap or `/Differences`
 * encoding before reading the `Tj` / `TJ` operators. That mapping is what
 * makes real-world files — which almost always embed subset fonts — extract
 * as readable text instead of raw character codes, and reading only page
 * content streams keeps font programs and CMaps out of the output.
 * Password-protected, scanned, and corrupt files raise a user-safe error
 * instead of a silent empty string.
 */
export async function extractPdfText(file: File): Promise<PdfParseResult> {
  const bytes = await readFileBytes(file);
  return parsePdf(bytes);
}

function readFileBytes(file: File): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('File gagal dibaca.'));
    reader.onload = () => {
      const buffer = reader.result;
      if (buffer instanceof ArrayBuffer) {
        resolve(new Uint8Array(buffer));
      } else {
        reject(new Error('File gagal dibaca.'));
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

async function parsePdf(bytes: Uint8Array): Promise<PdfParseResult> {
  // Latin-1 keeps a byte-to-char 1:1 mapping, so regex offsets match bytes.
  const raw = bytesToLatin1(bytes);

  if (!raw.slice(0, 1024).includes('%PDF-')) {
    throw new Error('Bukan file PDF yang valid.');
  }
  if (/\/Encrypt\b/.test(raw)) {
    throw new Error('PDF dilindungi kata sandi. Hapus kata sandinya lalu unggah lagi.');
  }

  const objects = parseObjects(raw);
  const pages = collectPages(objects);
  const texts: string[] = [];

  if (pages.length > 0) {
    for (const page of pages) {
      const fonts = await buildFontMap(page.resources, objects);
      for (const contentNum of page.contents) {
        const object = objects.get(contentNum);
        if (!object?.stream) continue;
        const text = textFromContent(
          bytesToLatin1(await decodeStream(object.stream)),
          fonts,
        );
        if (text.trim().length > 0) texts.push(text.trim());
      }
    }
  } else {
    // No readable page tree: fall back to every stream, unmapped.
    for (const region of streamRegions(raw)) {
      const text = textFromContent(
        bytesToLatin1(await decodeStream(region)),
        new Map(),
      );
      if (text.trim().length > 0) texts.push(text.trim());
    }
  }

  if (texts.length === 0) {
    throw new Error(
      'PDF ini berisi gambar, hasil pindai, atau kompresi yang tidak didukung (LZW).',
    );
  }

  return { text: texts.join('\n\n'), pageCount: pages.length || countPages(raw) };
}

// ---------------------------------------------------------------------------
// Object model
// ---------------------------------------------------------------------------

interface PdfRef {
  kind: 'ref';
  num: number;
}

interface PdfObject {
  dict: Record<string, unknown>;
  stream?: Uint8Array<ArrayBuffer>;
}

function isRef(value: unknown): value is PdfRef {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as PdfRef).kind === 'ref'
  );
}

function isDict(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !isRef(value)
  );
}

/**
 * Collects every `N G obj … endobj` into a table by object number. A linear
 * scan is enough for classic PDFs; objects packed inside object streams
 * (PDF 1.5+) stay invisible, which degrades font mapping but not reading.
 */
function parseObjects(raw: string): Map<number, PdfObject> {
  const objects = new Map<number, PdfObject>();
  const regex = /(\d+)\s+(\d+)\s+obj\b/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(raw)) !== null) {
    const num = Number(match[1]);
    const bodyStart = regex.lastIndex;
    const bodyEnd = raw.indexOf('endobj', bodyStart);
    const body = raw.slice(bodyStart, bodyEnd === -1 ? raw.length : bodyEnd);
    objects.set(num, parseObjectBody(body));
  }
  return objects;
}

function parseObjectBody(body: string): PdfObject {
  const streamAt = /\bstream\b/.exec(body);
  if (!streamAt) return { dict: parseDictText(body) };

  const dict = parseDictText(body.slice(0, streamAt.index));
  let start = streamAt.index + 'stream'.length;
  if (body[start] === '\r') start++;
  if (body[start] === '\n') start++;

  // /Length is authoritative when it is a plain number; otherwise the next
  // endstream marks the boundary.
  const length = typeof dict.Length === 'number' ? dict.Length : -1;
  let end: number;
  if (length >= 0) {
    end = start + length;
  } else {
    end = body.indexOf('endstream', start);
    if (end > start && body[end - 1] === '\n') end--;
    if (end > start && body[end - 1] === '\r') end--;
  }
  return { dict, stream: latin1ToBytes(body.slice(start, end)) };
}

function parseDictText(text: string): Record<string, unknown> {
  const pos = { i: 0 };
  const value = parseValue(text, pos);
  return isDict(value) ? value : {};
}

interface Cursor {
  i: number;
}

function skipWhitespace(text: string, pos: Cursor): void {
  while (pos.i < text.length && /\s/.test(text[pos.i])) pos.i++;
}

function parseValue(text: string, pos: Cursor): unknown {
  skipWhitespace(text, pos);
  if (pos.i >= text.length) return null;

  const char = text[pos.i];
  if (char === '<' && text[pos.i + 1] === '<') return parseDict(text, pos);
  if (char === '<') return parseHexString(text, pos);
  if (char === '(') return parseLiteral(text, pos);
  if (char === '[') return parseArray(text, pos);
  if (char === '/') return parseName(text, pos);
  if (char === '-' || char === '+' || char === '.' || (char >= '0' && char <= '9')) {
    return parseNumberOrRef(text, pos);
  }
  if (text.startsWith('true', pos.i)) {
    pos.i += 4;
    return true;
  }
  if (text.startsWith('false', pos.i)) {
    pos.i += 5;
    return false;
  }
  if (text.startsWith('null', pos.i)) {
    pos.i += 4;
    return null;
  }
  // An unknown token: skip it so parsing can continue.
  pos.i++;
  return null;
}

function parseDict(text: string, pos: Cursor): Record<string, unknown> {
  pos.i += 2; // <<
  const dict: Record<string, unknown> = {};
  for (;;) {
    skipWhitespace(text, pos);
    if (pos.i >= text.length || text.startsWith('>>', pos.i)) {
      if (pos.i < text.length) pos.i += 2;
      return dict;
    }
    if (text[pos.i] !== '/') {
      skipToken(text, pos);
      continue;
    }
    const key = parseName(text, pos);
    skipWhitespace(text, pos);
    dict[key] = parseValue(text, pos);
  }
}

function parseArray(text: string, pos: Cursor): unknown[] {
  pos.i++; // [
  const array: unknown[] = [];
  for (;;) {
    skipWhitespace(text, pos);
    if (pos.i >= text.length) return array;
    if (text[pos.i] === ']') {
      pos.i++;
      return array;
    }
    array.push(parseValue(text, pos));
  }
}

function parseName(text: string, pos: Cursor): string {
  pos.i++; // /
  let name = '';
  while (pos.i < text.length && !/[\s()<>[\]{}/%]/.test(text[pos.i])) {
    if (
      text[pos.i] === '#' &&
      /[0-9A-Fa-f]{2}/.test(text.slice(pos.i + 1, pos.i + 3))
    ) {
      name += String.fromCharCode(parseInt(text.slice(pos.i + 1, pos.i + 3), 16));
      pos.i += 3;
    } else {
      name += text[pos.i++];
    }
  }
  return name;
}

/** Reads a number, or an indirect reference when `N G R` follows. */
function parseNumberOrRef(text: string, pos: Cursor): unknown {
  const start = pos.i;
  while (pos.i < text.length && /[0-9+\-.]/.test(text[pos.i])) pos.i++;
  const value = Number(text.slice(start, pos.i));

  const save = pos.i;
  skipWhitespace(text, pos);
  const genStart = pos.i;
  while (pos.i < text.length && /[0-9]/.test(text[pos.i])) pos.i++;
  const generation = text.slice(genStart, pos.i);
  skipWhitespace(text, pos);
  if (generation !== '' && text[pos.i] === 'R' && Number.isInteger(value)) {
    pos.i++;
    return { kind: 'ref', num: value } satisfies PdfRef;
  }
  pos.i = save;
  return value;
}

function parseLiteral(text: string, pos: Cursor): string {
  pos.i++; // (
  let depth = 1;
  let body = '';
  while (pos.i < text.length && depth > 0) {
    const char = text[pos.i++];
    if (char === '\\') {
      body += char + (text[pos.i++] ?? '');
      continue;
    }
    if (char === '(') depth++;
    else if (char === ')') {
      depth--;
      if (depth === 0) break;
    }
    body += char;
  }
  return decodePdfString(`(${body})`);
}

function parseHexString(text: string, pos: Cursor): string {
  pos.i++; // <
  let digits = '';
  while (pos.i < text.length && text[pos.i] !== '>') digits += text[pos.i++];
  if (pos.i < text.length) pos.i++; // >
  return decodePdfHex(`<${digits}>`);
}

/** Skips one token so a malformed value cannot stall the parser. */
function skipToken(text: string, pos: Cursor): void {
  const char = text[pos.i];
  if (char === '(') {
    parseLiteral(text, pos);
    return;
  }
  if (char === '[') {
    parseArray(text, pos);
    return;
  }
  if (char === '<') {
    parseValue(text, pos);
    return;
  }
  while (pos.i < text.length && !/[\s()<>[\]{}/%]/.test(text[pos.i])) pos.i++;
}

function resolveDict(
  value: unknown,
  objects: Map<number, PdfObject>,
): Record<string, unknown> | undefined {
  if (isRef(value)) {
    const object = objects.get(value.num);
    return isDict(object?.dict) ? object.dict : undefined;
  }
  return isDict(value) ? value : undefined;
}

// ---------------------------------------------------------------------------
// Page tree
// ---------------------------------------------------------------------------

interface PageInfo {
  resources: Record<string, unknown>;
  /** Object numbers of the page's content streams. */
  contents: number[];
}

function collectPages(objects: Map<number, PdfObject>): PageInfo[] {
  let catalog: Record<string, unknown> | undefined;
  for (const object of objects.values()) {
    if (object.dict.Type === 'Catalog') {
      catalog = object.dict;
      break;
    }
  }
  const root = catalog?.Pages;
  if (!isRef(root)) return [];

  const pages: PageInfo[] = [];
  walkPages(objects.get(root.num), objects, pages, {});
  return pages;
}

function walkPages(
  node: PdfObject | undefined,
  objects: Map<number, PdfObject>,
  out: PageInfo[],
  inherited: Record<string, unknown>,
): void {
  if (!node) return;
  const dict = node.dict;
  // Resources may be inherited from the parent Pages node.
  const resources = resolveDict(dict.Resources, objects) ?? inherited;

  if (dict.Type === 'Page') {
    const contents: number[] = [];
    const value = dict.Contents;
    if (isRef(value)) contents.push(value.num);
    else if (Array.isArray(value)) {
      for (const entry of value) {
        if (isRef(entry)) contents.push(entry.num);
      }
    }
    out.push({ resources, contents });
    return;
  }

  const kids = dict.Kids;
  if (Array.isArray(kids)) {
    for (const kid of kids) {
      if (isRef(kid)) walkPages(objects.get(kid.num), objects, out, resources);
    }
  }
}

// ---------------------------------------------------------------------------
// Fonts
// ---------------------------------------------------------------------------

type FontMapping = { kind: 'identity' } | { kind: 'bytes'; map: Map<number, string> } | CmapFont;

interface CmapFont {
  kind: 'cmap';
  /** Bytes per character code, from the codespace range. */
  codeLength: number;
  /** bfchar entries: code hex → text. */
  exact: Map<string, string>;
  /** bfrange entries: [lo, hi] maps onto a base code point or a table. */
  ranges: Array<{ lo: number; hi: number; base: number | number[] }>;
}

const IDENTITY: FontMapping = { kind: 'identity' };

async function buildFontMap(
  resources: Record<string, unknown>,
  objects: Map<number, PdfObject>,
): Promise<Map<string, FontMapping>> {
  const fonts = new Map<string, FontMapping>();
  const fontResources = resolveDict(resources.Font, objects);
  if (!fontResources) return fonts;

  for (const [name, value] of Object.entries(fontResources)) {
    if (!isRef(value)) continue;
    fonts.set(name, await buildFontMapping(objects.get(value.num), objects));
  }
  return fonts;
}

async function buildFontMapping(
  object: PdfObject | undefined,
  objects: Map<number, PdfObject>,
): Promise<FontMapping> {
  const dict = object?.dict;
  if (!isDict(dict)) return IDENTITY;

  const toUnicode = dict.ToUnicode;
  if (isRef(toUnicode)) {
    const cMap = await loadCMap(objects.get(toUnicode.num));
    if (cMap) return cMap;
  }
  return simpleFontMapping(dict);
}

async function loadCMap(object: PdfObject | undefined): Promise<CmapFont | null> {
  if (!object?.stream) return null;
  const text = bytesToLatin1(await decodeStream(object.stream));
  return parseCMap(text);
}

/**
 * Parses a ToUnicode CMap: the codespace range gives the code width,
 * `bfchar` maps single codes, and `bfrange` maps a run of codes onto
 * consecutive code points or an explicit table.
 */
function parseCMap(text: string): CmapFont | null {
  const exact = new Map<string, string>();
  const ranges: Array<{ lo: number; hi: number; base: number | number[] }> = [];

  const spaceSection = /begincodespacerange([\s\S]*?)endcodespacerange/.exec(text);
  const spaceMatch = spaceSection && /<([0-9A-Fa-f\s]+)>/.exec(spaceSection[1]);
  if (!spaceMatch) return null;
  const codeLength = Math.ceil(spaceMatch[1].replace(/\s+/g, '').length / 2);
  if (codeLength === 0) return null;

  const charSection = /beginbfchar([\s\S]*?)endbfchar/.exec(text);
  if (charSection) {
    const tokens = tokenizeCMap(charSection[1]);
    for (let i = 0; i + 1 < tokens.length; i += 2) {
      const source = tokens[i];
      const target = tokens[i + 1];
      if (source.kind === 'hex' && target.kind === 'hex') {
        exact.set(source.value.toUpperCase(), hexToText(target.value));
      }
    }
  }

  const rangeSection = /beginbfrange([\s\S]*?)endbfrange/.exec(text);
  if (rangeSection) {
    const tokens = tokenizeCMap(rangeSection[1]);
    for (let i = 0; i + 2 < tokens.length; i += 3) {
      const low = tokens[i];
      const high = tokens[i + 1];
      const target = tokens[i + 2];
      if (low.kind !== 'hex' || high.kind !== 'hex') continue;
      const lo = parseInt(low.value, 16);
      const hi = parseInt(high.value, 16);
      if (target.kind === 'hex') {
        ranges.push({ lo, hi, base: parseInt(target.value, 16) });
      } else if (target.kind === 'array') {
        ranges.push({
          lo,
          hi,
          base: target.value.map((hex) => parseInt(hex, 16)),
        });
      }
    }
  }

  if (exact.size === 0 && ranges.length === 0) return null;
  return { kind: 'cmap', codeLength, exact, ranges };
}

type CMapToken = { kind: 'hex'; value: string } | { kind: 'array'; value: string[] };

function tokenizeCMap(section: string): CMapToken[] {
  const tokens: CMapToken[] = [];
  const regex = /<([0-9A-Fa-f\s]+)>|\[([^\]]*)\]/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(section)) !== null) {
    if (match[1] !== undefined) {
      tokens.push({ kind: 'hex', value: match[1].replace(/\s+/g, '') });
    } else if (match[2] !== undefined) {
      const hexes: string[] = [];
      const inner = /<([0-9A-Fa-f\s]+)>/g;
      let innerMatch: RegExpExecArray | null;
      while ((innerMatch = inner.exec(match[2])) !== null) {
        hexes.push(innerMatch[1].replace(/\s+/g, ''));
      }
      tokens.push({ kind: 'array', value: hexes });
    }
  }
  return tokens;
}

/** A CMap destination is a hex string of UTF-16BE code units. */
function hexToText(hex: string): string {
  const padded =
    hex.length % 4 === 0 ? hex : hex.padStart(hex.length + (4 - (hex.length % 4)), '0');
  let out = '';
  for (let i = 0; i < padded.length; i += 4) {
    out += String.fromCharCode(parseInt(padded.substring(i, i + 4), 16));
  }
  return out;
}

function cmapLookup(font: CmapFont, code: string): string | undefined {
  const mapped = font.exact.get(code);
  if (mapped !== undefined) return mapped;

  const value = parseInt(code, 16);
  for (const range of font.ranges) {
    if (value < range.lo || value > range.hi) continue;
    if (typeof range.base === 'number') {
      return String.fromCharCode(range.base + (value - range.lo));
    }
    const entry = range.base[value - range.lo];
    if (entry !== undefined) return String.fromCharCode(entry);
  }
  return undefined;
}

/**
 * A simple font: `/Differences` redefines codes as glyph names, and
 * WinAnsiEncoding only differs from Latin-1 in the 0x80–0x9F range.
 * Unlisted codes fall through to their raw byte.
 */
function simpleFontMapping(dict: Record<string, unknown>): FontMapping {
  const map = new Map<number, string>();
  const encoding = dict.Encoding;

  if (isDict(encoding)) {
    const differences = encoding.Differences;
    if (Array.isArray(differences)) {
      let code = 0;
      for (const entry of differences) {
        if (typeof entry === 'number') {
          code = entry;
        } else if (typeof entry === 'string') {
          const unicode = GLYPH_UNICODE[entry];
          if (unicode !== undefined) map.set(code, unicode);
          code++;
        }
      }
    }
  } else if (encoding === 'WinAnsiEncoding') {
    for (const [code, unicode] of Object.entries(WIN_ANSI)) {
      map.set(Number(code), unicode);
    }
  }

  return map.size === 0 ? IDENTITY : { kind: 'bytes', map };
}

/** Maps one extracted string through the active font's encoding. */
function applyFont(text: string, font: FontMapping): string {
  if (font.kind === 'identity') return text;

  if (font.kind === 'bytes') {
    let out = '';
    for (const char of text) {
      out += font.map.get(char.charCodeAt(0)) ?? char;
    }
    return out;
  }

  const size = font.codeLength;
  let out = '';
  let start = 0;
  for (; start + size <= text.length; start += size) {
    const code = codeToHex(text, start, size);
    out += cmapLookup(font, code) ?? text.substring(start, start + size);
  }
  if (start < text.length) out += text.substring(start);
  return out;
}

function codeToHex(text: string, start: number, size: number): string {
  let hex = '';
  for (let i = start; i < start + size; i++) {
    hex += (text.charCodeAt(i) & 0xff).toString(16).padStart(2, '0').toUpperCase();
  }
  return hex;
}

/** Standard Adobe glyph names: ASCII, Latin-1, and common typography. */
const GLYPH_UNICODE: Record<string, string> = buildGlyphTable();

function buildGlyphTable(): Record<string, string> {
  const table: Record<string, string> = {
    space: ' ', exclam: '!', quotedbl: '"', numbersign: '#', dollar: '$',
    percent: '%', ampersand: '&', quotesingle: "'", quoteright: "'",
    parenleft: '(', parenright: ')', asterisk: '*', plus: '+', comma: ',',
    hyphen: '-', period: '.', slash: '/', colon: ':', semicolon: ';',
    less: '<', equal: '=', greater: '>', question: '?', at: '@',
    bracketleft: '[', backslash: '\\', bracketright: ']',
    asciicircum: '^', underscore: '_', quoteleft: '`', braceleft: '{',
    bar: '|', braceright: '}', asciitilde: '~',
    // Latin-1 supplement
    exclamdown: '¡', cent: '¢', sterling: '£', currency: '¤', yen: '¥',
    brokenbar: '¦', section: '§', dieresis: '¨', copyright: '©',
    ordfeminine: 'ª', guillemotleft: '«', logicalnot: '¬', soft: '­',
    registered: '®', macron: '¯', degree: '°', plusminus: '±',
    twosuperior: '²', threesuperior: '³', acute: '´', mu: 'µ',
    paragraph: '¶', periodcentered: '·', cedilla: '¸', onesuperior: '¹',
    ordmasculine: 'º', guillemotright: '»', onequarter: '¼',
    onehalf: '½', threequarters: '¾', questiondown: '¿',
    Agrave: 'À', Aacute: 'Á', Acircumflex: 'Â', Atilde: 'Ã',
    Adieresis: 'Ä', Aring: 'Å', AE: 'Æ', Ccedilla: 'Ç',
    Egrave: 'È', Eacute: 'É', Ecircumflex: 'Ê', Edieresis: 'Ë',
    Igrave: 'Ì', Iacute: 'Í', Icircumflex: 'Î', Idieresis: 'Ï',
    Eth: 'Ð', Ntilde: 'Ñ', Ograve: 'Ò', Oacute: 'Ó', Ocircumflex: 'Ô',
    Otilde: 'Õ', Odieresis: 'Ö', multiply: '×', Oslash: 'Ø',
    Ugrave: 'Ù', Uacute: 'Ú', Ucircumflex: 'Û', Udieresis: 'Ü',
    Yacute: 'Ý', Thorn: 'Þ', germandbls: 'ß',
    agrave: 'à', aacute: 'á', acircumflex: 'â', atilde: 'ã',
    adieresis: 'ä', aring: 'å', ae: 'æ', ccedilla: 'ç',
    egrave: 'è', eacute: 'é', ecircumflex: 'ê', edieresis: 'ë',
    igrave: 'ì', iacute: 'í', icircumflex: 'î', idieresis: 'ï',
    eth: 'ð', ntilde: 'ñ', ograve: 'ò', oacute: 'ó', ocircumflex: 'ô',
    otilde: 'õ', odieresis: 'ö', divide: '÷', oslash: 'ø',
    ugrave: 'ù', uacute: 'ú', ucircumflex: 'û', udieresis: 'ü',
    yacute: 'ý', thorn: 'þ', ydieresis: 'ÿ',
    // Typography that shows up in slide decks and reports
    endash: '–', emdash: '—', quotedblleft: '“', quotedblright: '”',
    quotedblbase: '„', quotesinglbase: '‚', guilsinglleft: '‹',
    guilsinglright: '›', ellipsis: '…', dagger: '†', daggerdbl: '‡',
    bullet: '•', trademark: '™', Euro: '€', minus: '−', fi: 'ﬁ', fl: 'ﬂ',
  };
  for (let digit = 0; digit <= 9; digit++) table[String(digit)] = String(digit);
  for (let code = 65; code <= 90; code++) {
    table[String.fromCharCode(code)] = String.fromCharCode(code);
  }
  for (let code = 97; code <= 122; code++) {
    table[String.fromCharCode(code)] = String.fromCharCode(code);
  }
  return table;
}

/** WinAnsiEncoding differs from Latin-1 only in this range. */
const WIN_ANSI: Record<number, string> = {
  0x80: '€', 0x82: '‚', 0x83: 'ƒ', 0x84: '„', 0x85: '…',
  0x86: '†', 0x87: '‡', 0x88: 'ˆ', 0x89: '‰', 0x8a: 'Š',
  0x8b: '‹', 0x8c: 'Œ', 0x8e: 'Ž',
  0x91: '‘', 0x92: '’', 0x93: '“', 0x94: '”', 0x95: '•',
  0x96: '–', 0x97: '—', 0x98: '˜', 0x99: '™', 0x9a: 'š',
  0x9b: '›', 0x9c: 'œ', 0x9e: 'ž', 0x9f: 'Ÿ',
};

// ---------------------------------------------------------------------------
// Content streams
// ---------------------------------------------------------------------------

/**
 * Pulls the visible text out of one content stream. String literals feed
 * the current line; `Tj` / `TJ` end a line, and `Td` / `TD` / `T*`
 * move the text position, which reads as a line break. `Tf` selects the
 * font whose mapping applies to the strings that follow.
 */
function textFromContent(content: string, fonts: Map<string, FontMapping>): string {
  const lines: string[] = [];
  let current = '';
  let fontName = '';
  let active: FontMapping = IDENTITY;

  const flush = () => {
    if (current.length > 0) {
      lines.push(current);
      current = '';
    }
  };

  const tokenRegex =
    /(\((?:\\.|[^\\()])*\))|(\[(?:[^\]\r\n])*\])|(<[0-9A-Fa-f\s]*>)|(\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = tokenRegex.exec(content)) !== null) {
    const literal = match[1];
    const array = match[2];
    const hex = match[3];
    if (literal !== undefined) {
      current += applyFont(decodePdfString(literal), active);
    } else if (array !== undefined) {
      // A TJ array interleaves strings with kerning numbers; keep the words.
      const inner = /(\((?:\\.|[^\\()])*\))|(<[0-9A-Fa-f\s]*>)/g;
      let innerMatch: RegExpExecArray | null;
      while ((innerMatch = inner.exec(array)) !== null) {
        if (innerMatch[1] !== undefined) {
          current += applyFont(decodePdfString(innerMatch[1]), active);
        } else if (innerMatch[2] !== undefined) {
          current += applyFont(decodePdfHex(innerMatch[2]), active);
        }
      }
    } else if (hex !== undefined) {
      current += applyFont(decodePdfHex(hex), active);
    } else if (match[4] === 'Tf') {
      active = fonts.get(fontName) ?? IDENTITY;
    } else if (match[4].startsWith('/')) {
      fontName = match[4].slice(1);
    } else if (
      match[4] === 'Tj' ||
      match[4] === 'TJ' ||
      match[4] === "'" ||
      match[4] === '"'
    ) {
      flush();
    } else if (match[4] === 'Td' || match[4] === 'TD' || match[4] === 'T*') {
      flush();
    }
  }
  flush();

  return lines.join('\n');
}

/** Decodes a PDF string literal, honouring `\n`, `\t`, `\(`, and octal escapes. */
function decodePdfString(literal: string): string {
  const body = literal.slice(1, -1);
  let out = '';
  for (let i = 0; i < body.length; i++) {
    const char = body[i];
    if (char !== '\\') {
      out += char;
      continue;
    }
    const next = body[++i];
    switch (next) {
      case 'n':
        out += '\n';
        break;
      case 'r':
        out += '\r';
        break;
      case 't':
        out += '\t';
        break;
      case 'b':
        out += '\b';
        break;
      case 'f':
        out += '\f';
        break;
      case '(':
      case ')':
      case '\\':
        out += next;
        break;
      default:
        if (next >= '0' && next <= '7') {
          let octal = next;
          while (octal.length < 3 && body[i + 1] >= '0' && body[i + 1] <= '7') {
            octal += body[++i];
          }
          out += String.fromCharCode(parseInt(octal, 8));
        } else if (next !== undefined) {
          out += next;
        }
    }
  }
  return out;
}

/** Decodes a PDF hex string (`<48656C6C6F>`) byte-pair by byte-pair. */
function decodePdfHex(hex: string): string {
  const digits = hex.slice(1, -1).replace(/\s+/g, '');
  const padded = digits.length % 2 === 0 ? digits : `${digits}0`;
  let out = '';
  for (let i = 0; i < padded.length; i += 2) {
    out += String.fromCharCode(parseInt(padded.substring(i, i + 2), 16));
  }
  return out;
}

function countPages(raw: string): number {
  const matches = raw.match(/\/Type\s*\/Page(?![sS])/g);
  return matches ? matches.length : 0;
}

/** Every `stream … endstream` region, as raw bytes. */
function streamRegions(raw: string): Uint8Array<ArrayBuffer>[] {
  const regions: Uint8Array<ArrayBuffer>[] = [];
  // The EOL after `stream` and before `endstream` is optional: some
  // generators omit either one, and a strict regex would silently
  // drop every stream in the file.
  const regex = /stream(?:\r\n|\r|\n)?([\s\S]*?)(?:\r\n|\r|\n)?endstream/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(raw)) !== null) {
    regions.push(latin1ToBytes(match[1]));
  }
  return regions;
}

/**
 * Inflates a FlateDecode stream, trying the zlib wrapper first and raw
 * deflate second. A stream that is already plain text fails both and is
 * returned as-is, so one path serves compressed and uncompressed PDFs.
 */
async function decodeStream(region: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  for (const format of ['deflate', 'deflate-raw'] as const) {
    try {
      const source = new ReadableStream<BufferSource>({
        start(controller) {
          controller.enqueue(region);
          controller.close();
        },
      });
      const reader = source.pipeThrough(new DecompressionStream(format)).getReader();
      const chunks: Uint8Array[] = [];
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      return concatBytes(chunks);
    } catch {
      // Not a deflate stream; try the next format, then the raw bytes.
    }
  }
  return region;
}

function bytesToLatin1(bytes: Uint8Array): string {
  const parts: string[] = [];
  for (let start = 0; start < bytes.length; start += 0x8000) {
    parts.push(String.fromCharCode(...bytes.subarray(start, start + 0x8000)));
  }
  return parts.join('');
}

function latin1ToBytes(text: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    bytes[i] = text.charCodeAt(i) & 0xff;
  }
  return bytes;
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

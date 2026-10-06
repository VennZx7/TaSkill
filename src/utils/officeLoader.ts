export interface OfficeParseResult {
  text: string;
}

const LOCAL_HEADER_SIG = 0x04034b50; // "PK\x03\x04"
const CENTRAL_DIR_SIG = 0x02014b50; // "PK\x01\x02"
const EOCD_SIG = 0x06054b50; // "PK\x05\x06"

/**
 * A dependency-free DOCX / XLSX text extractor. Both formats are ZIP
 * archives of XML parts, and the platform covers the two hard pieces
 * natively: a ZIP central directory is plain byte parsing, and the
 * deflate entries inflate with DecompressionStream. CONSTRAINTS.md §2
 * keeps the runtime budget at react + react-dom, so no office library
 * is added. Password-protected files surface as a typed error because
 * their XML parts are replaced by an encrypted package entry.
 */
export async function extractOfficeText(file: File): Promise<OfficeParseResult> {
  const bytes = await readFileBytes(file);
  if (readUint32(bytes, 0) !== LOCAL_HEADER_SIG) {
    throw new Error('Bukan file DOCX/XLSX yang valid.');
  }

  const entries = findZipEntries(bytes);
  const parts = new Map<string, Uint8Array>();
  for (const entry of entries) {
    if (isOfficePart(entry.name)) {
      parts.set(
        entry.name,
        await inflateEntry(readEntryData(bytes, entry), entry.method),
      );
    }
  }

  const text = file.name.toLowerCase().endsWith('.xlsx')
    ? extractXlsxText(parts)
    : extractDocxText(parts);

  if (text.length === 0) {
    throw new Error('File ini tidak berisi teks yang bisa dibaca.');
  }
  return { text };
}

function readFileBytes(file: File): Promise<Uint8Array<ArrayBuffer>> {
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

interface ZipEntry {
  name: string;
  /** 0 = stored, 8 = deflate. Anything else is unsupported. */
  method: number;
  compressedSize: number;
  localHeaderOffset: number;
}

function readUint16(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  );
}

/**
 * Walks the ZIP central directory at the end of the archive. Only the
 * pre-ZIP64 layout is read: Word and Excel write that for any document
 * a student would upload, and the 0xFFFF / 0xFFFFFFFF markers make a
 * ZIP64 archive fail loudly instead of parsing garbage.
 */
function findZipEntries(bytes: Uint8Array): ZipEntry[] {
  // The EOCD sits at the end of the file; its comment can be 64 KB.
  let eocdOffset = -1;
  const scanStart = Math.max(0, bytes.length - 65557);
  for (let i = bytes.length - 22; i >= scanStart; i--) {
    if (readUint32(bytes, i) === EOCD_SIG) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) {
    throw new Error('Bukan arsip ZIP yang valid.');
  }

  const entryCount = readUint16(bytes, eocdOffset + 10);
  const centralDirOffset = readUint32(bytes, eocdOffset + 16);
  if (entryCount === 0xffff || centralDirOffset === 0xffffffff) {
    throw new Error('Arsip ZIP64 tidak didukung.');
  }

  const entries: ZipEntry[] = [];
  let offset = centralDirOffset;
  for (let i = 0; i < entryCount; i++) {
    if (readUint32(bytes, offset) !== CENTRAL_DIR_SIG) break;
    const method = readUint16(bytes, offset + 10);
    const compressedSize = readUint32(bytes, offset + 20);
    const nameLength = readUint16(bytes, offset + 28);
    const extraLength = readUint16(bytes, offset + 30);
    const commentLength = readUint16(bytes, offset + 32);
    const localHeaderOffset = readUint32(bytes, offset + 42);
    const name = latin1(
      bytes.subarray(offset + 46, offset + 46 + nameLength),
    );
    offset += 46 + nameLength + extraLength + commentLength;
    entries.push({ name, method, compressedSize, localHeaderOffset });
  }
  return entries;
}

/** Only the XML parts that carry text are inflated; the rest is skipped. */
function isOfficePart(name: string): boolean {
  return (
    name.endsWith('word/document.xml') ||
    name.endsWith('xl/sharedStrings.xml') ||
    /xl\/worksheets\/sheet\d+\.xml$/.test(name)
  );
}

function readEntryData(
  bytes: Uint8Array<ArrayBuffer>,
  entry: ZipEntry,
): Uint8Array<ArrayBuffer> {
  const local = entry.localHeaderOffset;
  if (readUint32(bytes, local) !== LOCAL_HEADER_SIG) {
    throw new Error('Bukan arsip ZIP yang valid.');
  }
  // The local header carries its own name/extra lengths; the sizes
  // from the central directory are authoritative (a data descriptor
  // leaves the local sizes at zero).
  const nameLength = readUint16(bytes, local + 26);
  const extraLength = readUint16(bytes, local + 28);
  const dataOffset = local + 30 + nameLength + extraLength;
  return bytes.subarray(dataOffset, dataOffset + entry.compressedSize);
}

async function inflateEntry(
  data: Uint8Array<ArrayBuffer>,
  method: number,
): Promise<Uint8Array> {
  if (method === 0) return data;
  if (method !== 8) {
    throw new Error('Kompresi dalam berkas ini tidak didukung.');
  }
  const source = new ReadableStream<BufferSource>({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  });
  const reader = source.pipeThrough(new DecompressionStream('deflate-raw')).getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return concatBytes(chunks);
}

function extractDocxText(parts: Map<string, Uint8Array>): string {
  const document = findPart(parts, 'word/document.xml');
  if (!document) {
    throw new Error('Dokumen tidak ditemukan. Berkas mungkin dilindungi kata sandi.');
  }
  const xml = new TextDecoder().decode(document);
  // Paragraph and break boundaries become newlines before the tags go.
  const withBreaks = xml
    .replace(/<\/w:p>/g, '\n')
    .replace(/<w:br\/>/g, '\n')
    .replace(/<w:tab\/>/g, '\t');
  return cleanXmlText(withBreaks);
}

function extractXlsxText(parts: Map<string, Uint8Array>): string {
  const shared = readSharedStrings(parts);
  const sheets = [...parts.entries()]
    .filter(([name]) => /xl\/worksheets\/sheet\d+\.xml$/.test(name))
    .sort(([a], [b]) => sheetNumberOf(a) - sheetNumberOf(b));
  if (sheets.length === 0) {
    throw new Error('Lembar kerja tidak ditemukan. Berkas mungkin dilindungi kata sandi.');
  }

  const rows: string[] = [];
  for (const [, bytes] of sheets) {
    const xml = new TextDecoder().decode(bytes);
    const rowRegex = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
    let match: RegExpExecArray | null;
    while ((match = rowRegex.exec(xml)) !== null) {
      const line = rowText(match[1], shared);
      if (line.length > 0) rows.push(line);
    }
  }
  return rows.join('\n');
}

function readSharedStrings(parts: Map<string, Uint8Array>): string[] {
  const bytes = findPart(parts, 'xl/sharedStrings.xml');
  if (!bytes) return [];
  const xml = new TextDecoder().decode(bytes);
  const strings: string[] = [];
  const siRegex = /<si>([\s\S]*?)<\/si>/g;
  let match: RegExpExecArray | null;
  while ((match = siRegex.exec(xml)) !== null) {
    // A shared string may be plain text or rich-text runs; keep both.
    const runs: string[] = [];
    const tRegex = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
    let tMatch: RegExpExecArray | null;
    while ((tMatch = tRegex.exec(match[1])) !== null) {
      runs.push(decodeXmlEntities(tMatch[1]));
    }
    strings.push(runs.join(''));
  }
  return strings;
}

function rowText(rowXml: string, shared: string[]): string {
  const cells: string[] = [];
  const cellRegex = /<c\b([^>]*)>([\s\S]*?)<\/c>|<c\b([^>]*)\/>/g;
  let match: RegExpExecArray | null;
  while ((match = cellRegex.exec(rowXml)) !== null) {
    const attrs = match[1] ?? match[3] ?? '';
    const inner = match[2] ?? '';
    const value = cellText(attrs, inner, shared);
    if (value.length > 0) cells.push(value);
  }
  return cells.join(' ');
}

function cellText(attrs: string, inner: string, shared: string[]): string {
  const type = /t="([^"]*)"/.exec(attrs)?.[1] ?? '';
  if (type === 's') {
    const index = /<v>(\d+)<\/v>/.exec(inner)?.[1];
    return index !== undefined ? (shared[Number(index)] ?? '') : '';
  }
  if (type === 'inlineStr') {
    return decodeXmlEntities(inner.replace(/<[^>]*>/g, ''));
  }
  if (type === 'b') {
    return /<v>1<\/v>/.test(inner) ? 'TRUE' : 'FALSE';
  }
  const value = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
  return value !== undefined ? decodeXmlEntities(value) : '';
}

function cleanXmlText(xml: string): string {
  return decodeXmlEntities(xml.replace(/<[^>]*>/g, ''))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCharCode(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function findPart(parts: Map<string, Uint8Array>, suffix: string): Uint8Array | undefined {
  for (const [name, bytes] of parts) {
    if (name.endsWith(suffix)) return bytes;
  }
  return undefined;
}

function sheetNumberOf(name: string): number {
  return Number(/\d+/.exec(name)?.[0] ?? 0);
}

function latin1(bytes: Uint8Array): string {
  const parts: string[] = [];
  for (let start = 0; start < bytes.length; start += 0x8000) {
    parts.push(String.fromCharCode(...bytes.subarray(start, start + 0x8000)));
  }
  return parts.join('');
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

export interface PdfParseResult {
  text: string;
  pageCount: number;
}

/**
 * A dependency-free PDF text extractor. CONSTRAINTS.md §2 fixes the runtime
 * budget at react + react-dom, and the platform already covers the common
 * case: page content streams are plain or FlateDecode-compressed, and the
 * browser inflates FlateDecode natively via DecompressionStream. This reads
 * the `Tj` / `TJ` text operators out of every stream, so a text-based PDF
 * becomes RAG context without a library. Password-protected, scanned, and
 * corrupt files raise a user-safe error instead of a silent empty string.
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

  const streams = streamRegions(raw);
  if (streams.length === 0) {
    throw new Error('PDF tidak dapat dibaca. Coba file PDF lain.');
  }

  const pages: string[] = [];
  for (const stream of streams) {
    const text = textFromContent(bytesToLatin1(await decodeStream(stream)));
    if (text.trim().length > 0) pages.push(text.trim());
  }

  if (pages.length === 0) {
    throw new Error(
      'PDF ini berisi gambar, hasil pindai, atau kompresi yang tidak didukung (LZW).',
    );
  }

  return { text: pages.join('\n\n'), pageCount: countPages(raw) };
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

/**
 * Pulls the visible text out of one content stream. String literals feed
 * the current line; `Tj` / `TJ` end a line, and `Td` / `TD` / `T*`
 * move the text position, which reads as a line break.
 */
function textFromContent(content: string): string {
  const lines: string[] = [];
  let current = '';

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
      current += decodePdfString(literal);
    } else if (array !== undefined) {
      // A TJ array interleaves strings with kerning numbers; keep the words.
      const inner = /(\((?:\\.|[^\\()])*\))|(<[0-9A-Fa-f\s]*>)/g;
      let innerMatch: RegExpExecArray | null;
      while ((innerMatch = inner.exec(array)) !== null) {
        if (innerMatch[1] !== undefined) {
          current += decodePdfString(innerMatch[1]);
        } else if (innerMatch[2] !== undefined) {
          current += decodePdfHex(innerMatch[2]);
        }
      }
    } else if (hex !== undefined) {
      current += decodePdfHex(hex);
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

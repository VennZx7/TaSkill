import { describe, expect, it } from 'vitest';
import { extractPdfText } from './pdfLoader';

const encoder = new TextEncoder();

type Segment = string | Uint8Array;

/** Compresses with the native CompressionStream so the fixture is a
 *  real zlib stream, exactly what DecompressionStream expects. */
async function deflate(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const source = new ReadableStream<BufferSource>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
  const reader = source.pipeThrough(new CompressionStream('deflate')).getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/** Assembles a PDF from text and raw-byte segments so compressed stream
 *  data survives File construction byte-for-byte. */
function pdfFile(segments: Segment[], name = 'materi.pdf'): File {
  const encoded = segments.map((segment) =>
    typeof segment === 'string' ? encoder.encode(segment) : segment,
  );
  const total = encoded.reduce((sum, part) => sum + part.length, 0);
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const part of encoded) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return new File([bytes], name, { type: 'application/pdf' });
}

function singlePagePdf(
  content: Uint8Array<ArrayBuffer>,
  options: { flate?: boolean; encrypt?: boolean } = {},
): File {
  return pdfFile([
    '%PDF-1.4\n',
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n',
    '3 0 obj << /Type /Page /Parent 2 0 R /Contents 4 0 R >> endobj\n',
    `4 0 obj << /Length ${content.length}${options.flate ? ' /Filter /FlateDecode' : ''} >>\n`,
    'stream\n',
    content,
    '\nendstream\nendobj\n',
    options.encrypt ? 'trailer << /Encrypt 5 0 R >>\n' : 'trailer << /Root 1 0 R >>\n',
  ]);
}

const CONTENT =
  'BT /F1 12 Tf 72 720 Td (Halo dunia) Tj ET\nBT /F1 12 Tf 72 700 Td (Baris kedua) Tj ET';

/** A stream object: `N 0 obj << dict /Length n >> stream … endobj`. */
function streamObject(num: number, dict: string, data: Uint8Array): Segment[] {
  return [
    `${num} 0 obj << ${dict} /Length ${data.length} >>\nstream\n`,
    data,
    '\nendstream\nendobj\n',
  ];
}

/** A realistic ToUnicode CMap: three codes mapped to "Hi!". */
const CMAP_TEXT = [
  '/CIDInit /ProcSet findresource begin',
  '12 dict begin',
  'begincmap',
  '/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def',
  '/CMapName /Adobe-Identity-UCS def',
  '/CMapType 2 def',
  '1 begincodespacerange',
  '<0000> <FFFF>',
  'endcodespacerange',
  '2 beginbfchar',
  '<0003> <0048>',
  '<0004> <0069>',
  '<0005> <0021>',
  'endbfchar',
  'endcmap',
  'CMapName currentdict /CMap defineresource pop',
  'end',
  'end',
].join('\n');

/** A one-page PDF whose font F1 is the object at `fontNum`. */
function fontPdf(
  content: Uint8Array,
  fontNum: number,
  fontDict: string,
  extraObjects: Segment[] = [],
): File {
  return pdfFile([
    '%PDF-1.4\n',
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n',
    `3 0 obj << /Type /Page /Parent 2 0 R /Resources << /Font << /F1 ${fontNum} 0 R >> >> /Contents 5 0 R >> endobj\n`,
    `4 0 obj ${fontDict} endobj\n`,
    ...streamObject(5, '', content),
    ...extraObjects,
    'trailer << /Root 1 0 R >>\n',
  ]);
}

describe('extractPdfText', () => {
  it('extracts text from an uncompressed content stream', async () => {
    const result = await extractPdfText(singlePagePdf(encoder.encode(CONTENT)));

    expect(result.text).toBe('Halo dunia\nBaris kedua');
    expect(result.pageCount).toBe(1);
  });

  it('inflates a FlateDecode content stream with the native decompressor', async () => {
    const result = await extractPdfText(
      singlePagePdf(await deflate(encoder.encode(CONTENT)), { flate: true }),
    );

    expect(result.text).toBe('Halo dunia\nBaris kedua');
  });

  it('counts pages across multiple page objects', async () => {
    const pageOne = encoder.encode('BT (Halaman satu) Tj ET');
    const pageTwo = encoder.encode('BT (Halaman dua) Tj ET');
    const file = pdfFile([
      '%PDF-1.4\n',
      '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n',
      '2 0 obj << /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >> endobj\n',
      '3 0 obj << /Type /Page /Parent 2 0 R /Contents 5 0 R >> endobj\n',
      '4 0 obj << /Type /Page /Parent 2 0 R /Contents 6 0 R >> endobj\n',
      `5 0 obj << /Length ${pageOne.length} >>\nstream\n`,
      pageOne,
      '\nendstream\nendobj\n',
      `6 0 obj << /Length ${pageTwo.length} >>\nstream\n`,
      pageTwo,
      '\nendstream\nendobj\n',
      'trailer << /Root 1 0 R >>\n',
    ]);

    const result = await extractPdfText(file);

    expect(result.pageCount).toBe(2);
    expect(result.text).toContain('Halaman satu');
    expect(result.text).toContain('Halaman dua');
  });

  it('decodes escaped parentheses, octal escapes, and TJ arrays', async () => {
    const result = await extractPdfText(
      singlePagePdf(encoder.encode('BT (Halo \\(dunia\\)) Tj ET [(A) -2 (B)] TJ ET (\\101) Tj ET')),
    );

    expect(result.text).toContain('Halo (dunia)');
    expect(result.text).toContain('AB');
    expect(result.text).toContain('A');
  });

  it('decodes hexadecimal strings, standalone and inside TJ arrays', async () => {
    const result = await extractPdfText(
      singlePagePdf(encoder.encode('BT <48616C6F2064756E6961> Tj ET [(A) <42> (C)] TJ ET')),
    );

    expect(result.text).toContain('Halo dunia');
    expect(result.text).toContain('ABC');
  });

  it('reads streams whose data runs straight into endstream', async () => {
    // Some generators omit the EOL before endstream; a strict
    // regex would silently drop every stream in such a file.
    const content = encoder.encode('BT (Tanpa jeda) Tj ET');
    const file = pdfFile([
      '%PDF-1.4\n',
      '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n',
      '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n',
      '3 0 obj << /Type /Page /Parent 2 0 R /Contents 4 0 R >> endobj\n',
      `4 0 obj << /Length ${content.length} >>\nstream\n`,
      content,
      'endstream\nendobj\n',
      'trailer << /Root 1 0 R >>\n',
    ]);

    const result = await extractPdfText(file);

    expect(result.text).toBe('Tanpa jeda');
  });

  it('rejects a password-protected PDF', async () => {
    await expect(
      extractPdfText(singlePagePdf(encoder.encode(CONTENT), { encrypt: true })),
    ).rejects.toThrow(/kata sandi/i);
  });

  it('rejects a scanned, image-only PDF that carries no text operators', async () => {
    await expect(extractPdfText(singlePagePdf(encoder.encode('/Im1 Do')))).rejects.toThrow(
      /gambar|pindai/i,
    );
  });

  it('rejects a file that is not a PDF', async () => {
    const file = new File(['ini bukan pdf'], 'bukan.pdf', { type: 'application/pdf' });

    await expect(extractPdfText(file)).rejects.toThrow(/valid/i);
  });

  it('maps character codes through a font ToUnicode CMap', async () => {
    const content = encoder.encode('BT /F1 12 Tf <000300040005> Tj ET');
    const cMap = encoder.encode(CMAP_TEXT);
    const file = fontPdf(
      content,
      4,
      '<< /Type /Font /Subtype /Type0 /BaseFont /ABCDEF+Arial /Encoding /Identity-H /ToUnicode 6 0 R >>',
      streamObject(6, '', cMap),
    );

    const result = await extractPdfText(file);

    expect(result.text).toBe('Hi!');
    // The CMap stream is not page content: it must not leak into the output.
    expect(result.text).not.toContain('AdobeUCS');
    expect(result.text).not.toContain('begincmap');
  });

  it('expands a bfrange onto consecutive code points', async () => {
    const content = encoder.encode('BT /F1 12 Tf <00010002000300040005> Tj ET');
    const cMap = encoder.encode([
      '1 begincodespacerange',
      '<0000> <FFFF>',
      'endcodespacerange',
      '1 beginbfrange',
      '<0001> <0005> <0041>',
      'endbfrange',
    ].join('\n'));
    const file = fontPdf(
      content,
      4,
      '<< /Type /Font /Subtype /Type0 /BaseFont /ABCDEF+Arial /Encoding /Identity-H /ToUnicode 6 0 R >>',
      streamObject(6, '', cMap),
    );

    const result = await extractPdfText(file);

    // Codes 0001–0005 map onto U+0041…U+0045.
    expect(result.text).toBe('ABCDE');
  });

  it('maps character codes through a Differences encoding', async () => {
    const content = encoder.encode('BT /F1 12 Tf (ABCDEF) Tj ET');
    const file = fontPdf(
      content,
      4,
      '<< /Type /Font /Subtype /Type1 /BaseFont /ABCDEF+Helvetica /Encoding << /Type /Encoding /Differences [ 65 /R 66 /E 67 /S 68 /U 69 /L 70 /T ] >> >>',
    );

    const result = await extractPdfText(file);

    // Codes 65–70 are redefined to spell RESULT.
    expect(result.text).toBe('RESULT');
  });
});

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
});

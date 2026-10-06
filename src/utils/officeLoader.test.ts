import { describe, expect, it } from 'vitest';
import { extractOfficeText } from './officeLoader';

const encoder = new TextEncoder();

interface ZipPart {
  name: string;
  data: Uint8Array<ArrayBuffer>;
  deflate?: boolean;
}

/** Inflates with the native CompressionStream so deflated
 *  fixtures are real raw-deflate streams. */
async function deflateRaw(
  bytes: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array<ArrayBuffer>> {
  const source = new ReadableStream<BufferSource>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
  const reader = source.pipeThrough(new CompressionStream('deflate-raw')).getReader();
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

function concat(chunks: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/** Builds a minimal ZIP: local file headers, then the central
 *  directory, then the end-of-central-directory record. */
async function zipFile(parts: ZipPart[], name = 'fixture.docx'): Promise<File> {
  const local: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const part of parts) {
    const entryName = encoder.encode(part.name);
    const stored = part.data;
    const data = part.deflate ? await deflateRaw(stored) : stored;
    const method = part.deflate ? 8 : 0;

    const localHeader = new Uint8Array(30);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0, true);
    lv.setUint16(8, method, true);
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0, true);
    lv.setUint32(14, 0, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, stored.length, true);
    lv.setUint16(26, entryName.length, true);
    lv.setUint16(28, 0, true);
    local.push(localHeader, entryName, data);

    const cdHeader = new Uint8Array(46);
    const cv = new DataView(cdHeader.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint16(10, method, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0, true);
    cv.setUint32(16, 0, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, stored.length, true);
    cv.setUint16(28, entryName.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    central.push(cdHeader, entryName);

    offset += 30 + entryName.length + data.length;
  }

  const centralBytes = concat(central);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, parts.length, true);
  ev.setUint16(10, parts.length, true);
  ev.setUint32(12, centralBytes.length, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  return new File([concat([...local, centralBytes, eocd])], name, {
    type: 'application/octet-stream',
  });
}

const DOCUMENT_XML = encoder.encode(
  '<?xml version="1.0"?><w:document><w:body>' +
    '<w:p><w:r><w:t>Halo dunia</w:t></w:r></w:p>' +
    '<w:p><w:r><w:t>Baris kedua</w:t></w:r></w:p>' +
    '</w:body></w:document>',
);

const SHARED_STRINGS_XML = encoder.encode(
  '<sst><si><t>Limit</t></si><si><r><t>Turunan</t></r></si></sst>',
);

const SHEET_XML = encoder.encode(
  '<sheetData>' +
    '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>' +
    '<row r="2"><c r="A2"><v>42</v></c></row>' +
    '</sheetData>',
);

describe('extractOfficeText', () => {
  it('extracts paragraphs from a DOCX with stored entries', async () => {
    const file = await zipFile([{ name: 'word/document.xml', data: DOCUMENT_XML }]);

    const result = await extractOfficeText(file);

    expect(result.text).toBe('Halo dunia\nBaris kedua');
  });

  it('inflates deflated DOCX entries', async () => {
    const file = await zipFile([
      { name: 'word/document.xml', data: DOCUMENT_XML, deflate: true },
    ]);

    const result = await extractOfficeText(file);

    expect(result.text).toBe('Halo dunia\nBaris kedua');
  });

  it('maps shared strings and cell values from an XLSX', async () => {
    const file = await zipFile(
      [
        { name: 'xl/sharedStrings.xml', data: SHARED_STRINGS_XML },
        { name: 'xl/worksheets/sheet1.xml', data: SHEET_XML },
      ],
      'fixture.xlsx',
    );

    const result = await extractOfficeText(file);

    expect(result.text).toBe('Limit Turunan\n42');
  });

  it('rejects a password-protected Office file', async () => {
    const file = await zipFile(
      [{ name: 'EncryptedPackage', data: encoder.encode('encrypted') }],
      'terkunci.docx',
    );

    await expect(extractOfficeText(file)).rejects.toThrow(/kata sandi/i);
  });

  it('rejects a file that is not a ZIP archive', async () => {
    const file = new File(['ini bukan zip'], 'bukan.docx', {
      type: 'application/octet-stream',
    });

    await expect(extractOfficeText(file)).rejects.toThrow(/valid/i);
  });
});

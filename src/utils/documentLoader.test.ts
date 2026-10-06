import { describe, expect, it } from 'vitest';
import { readTextFile } from './documentLoader';

describe('readTextFile', () => {
  it('rejects legacy binary Office formats with guidance', async () => {
    const file = new File(['old'], 'tugas.doc', {
      type: 'application/msword',
    });

    await expect(readTextFile(file)).rejects.toThrow(
      /\.docx atau \.xlsx/,
    );
  });

  it('rejects unsupported extensions', async () => {
    const file = new File(['binary'], 'program.exe', {
      type: 'application/octet-stream',
    });

    await expect(readTextFile(file)).rejects.toThrow(/Hanya file/);
  });

  it('rejects files over the size cap', async () => {
    const file = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'besar.pdf', {
      type: 'application/pdf',
    });

    await expect(readTextFile(file)).rejects.toThrow(/10 MB/);
  });

  it('reads a CSV as plain text', async () => {
    const file = new File(['Materi,Keterangan\nLimit,Pendekatan'], 'data.csv', {
      type: 'text/csv',
    });

    const loaded = await readTextFile(file);

    expect(loaded.name).toBe('data.csv');
    expect(loaded.text).toContain('Limit,Pendekatan');
    expect(loaded.pageCount).toBeUndefined();
  });
});

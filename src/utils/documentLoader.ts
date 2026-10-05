import { extractPdfText } from './pdfLoader';

export interface LoadedDocument {
  name: string;
  text: string;
  /** Set for PDFs so the assistant can show a page count. */
  pageCount?: number;
}

const ACCEPTED_EXTENSIONS = ['.txt', '.md', '.pdf'];
/** A size cap keeps a stray 50MB file from freezing the tab. */
const MAX_FILE_BYTES = 2 * 1024 * 1024;

/**
 * Reads an uploaded file as study context. Markdown and PDF are read as
 * source text, not rendered: the model wants the raw words, and injecting
 * HTML would be a needless way to smuggle markup into the prompt. PDF text
 * is extracted in the browser by `pdfLoader`.
 */
export async function readTextFile(file: File): Promise<LoadedDocument> {
  const lower = file.name.toLowerCase();
  const accepted = ACCEPTED_EXTENSIONS.some((extension) => lower.endsWith(extension));

  if (!accepted) {
    throw new Error('Hanya file .txt, .md, atau .pdf yang didukung.');
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('Ukuran file maksimal 2 MB.');
  }

  if (lower.endsWith('.pdf')) {
    const parsed = await extractPdfText(file);
    return { name: file.name, text: parsed.text, pageCount: parsed.pageCount };
  }

  return readPlainText(file);
}

function readPlainText(file: File): Promise<LoadedDocument> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('File gagal dibaca.'));
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      if (text.trim().length === 0) {
        reject(new Error('File kosong.'));
        return;
      }
      resolve({ name: file.name, text });
    };
    reader.readAsText(file);
  });
}

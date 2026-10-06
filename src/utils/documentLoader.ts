import { extractOfficeText } from './officeLoader';
import { extractPdfText } from './pdfLoader';

export interface LoadedDocument {
  name: string;
  text: string;
  /** Set for PDFs so the assistant can show a page count. */
  pageCount?: number;
}

const ACCEPTED_EXTENSIONS = ['.txt', '.md', '.pdf', '.docx', '.xlsx', '.csv'];
/** Legacy binary Office formats cannot be read without a library. */
const LEGACY_OFFICE_EXTENSIONS = ['.doc', '.xls'];
/**
 * A size cap keeps a stray 50MB file from freezing the tab. Real
 * PDFs and Office files run several megabytes, so the cap sits well
 * above a normal document.
 */
const MAX_FILE_BYTES = 10 * 1024 * 1024;

/**
 * Reads an uploaded file as study context. Markdown, CSV, PDF and
 * Office files are read as source text, not rendered: the model
 * wants the raw words, and injecting HTML would be a needless way
 * to smuggle markup into the prompt. PDF and Office text is
 * extracted in the browser by `pdfLoader` / `officeLoader`.
 */
export async function readTextFile(file: File): Promise<LoadedDocument> {
  const lower = file.name.toLowerCase();

  if (LEGACY_OFFICE_EXTENSIONS.some((extension) => lower.endsWith(extension))) {
    throw new Error('Format .doc dan .xls tidak didukung. Simpan sebagai .docx atau .xlsx.');
  }
  const accepted = ACCEPTED_EXTENSIONS.some((extension) => lower.endsWith(extension));
  if (!accepted) {
    throw new Error('Hanya file .txt, .md, .pdf, .docx, .xlsx, atau .csv yang didukung.');
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('Ukuran file maksimal 10 MB.');
  }

  if (lower.endsWith('.pdf')) {
    const parsed = await extractPdfText(file);
    return { name: file.name, text: parsed.text, pageCount: parsed.pageCount };
  }
  if (lower.endsWith('.docx') || lower.endsWith('.xlsx')) {
    const parsed = await extractOfficeText(file);
    return { name: file.name, text: parsed.text };
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

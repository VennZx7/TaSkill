interface TextChunk {
  index: number;
  text: string;
  terms: string[];
}

const DEFAULT_CHUNK_CHARS = 1_200;
const DEFAULT_OVERLAP_CHARS = 160;
const STOP_WORDS = new Set([
  'adalah', 'atau', 'agar', 'akan', 'aku', 'anda', 'apa', 'bagaimana', 'bahwa', 'belum',
  'bisa', 'dalam', 'dari', 'dengan', 'dia', 'di', 'dan', 'ini', 'itu', 'jelaskan', 'jelas',
  'jika', 'juga', 'karena', 'ke', 'kenapa', 'kapan', 'kami', 'kamu', 'mana', 'materi',
  'mereka', 'oleh', 'pada', 'saya', 'sebagai', 'serta', 'sudah', 'tentang', 'tersebut',
  'untuk', 'yang', 'the', 'and', 'are', 'based', 'from', 'have', 'into', 'this', 'what',
  'when', 'where', 'which', 'with', 'would', 'your',
]);

function termsOf(text: string): string[] {
  return text.toLocaleLowerCase('id-ID').match(/[\p{L}\p{N}]{3,}/gu) ?? [];
}

function makeChunks(text: string, chunkChars = DEFAULT_CHUNK_CHARS): TextChunk[] {
  const chunks: TextChunk[] = [];
  let current = '';
  const flush = () => {
    const clean = current.trim();
    if (clean) chunks.push({ index: chunks.length, text: clean, terms: termsOf(clean) });
    current = '';
  };

  for (const paragraph of text.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean)) {
    if (paragraph.length <= chunkChars) {
      if (current.length > 0 && current.length + paragraph.length + 2 > chunkChars) flush();
      current = current ? `${current}\n\n${paragraph}` : paragraph;
      continue;
    }

    flush();
    const stride = Math.max(1, chunkChars - DEFAULT_OVERLAP_CHARS);
    for (let start = 0; start < paragraph.length; start += stride) {
      const part = paragraph.slice(start, start + chunkChars).trim();
      if (part) chunks.push({ index: chunks.length, text: part, terms: termsOf(part) });
    }
  }
  flush();
  return chunks;
}

function evenlySpaced(chunks: TextChunk[], count: number): TextChunk[] {
  if (chunks.length <= count) return chunks;
  if (count <= 1) return [chunks[0]];
  const indexes = Array.from({ length: count }, (_, index) =>
    Math.round((index * (chunks.length - 1)) / (count - 1)),
  );
  return [...new Set(indexes)].map((index) => chunks[index]);
}

/** Keeps a representative slice from across the source for quiz/card generation. */
export function selectCoverageContext(text: string, maxChars = 16_000): string {
  const source = text.trim();
  if (source.length <= maxChars) return source;

  const chunks = makeChunks(source);
  const selected = evenlySpaced(chunks, Math.max(1, Math.floor(maxChars / DEFAULT_CHUNK_CHARS)));
  return selected.map((chunk) => chunk.text).join('\n\n[...bagian materi berikutnya...]\n\n').slice(0, maxChars);
}

/**
 * Small dependency-free RAG step: rank overlapping text chunks using
 * inverse-document-frequency weighted term matches, then return the best
 * non-adjacent passages in their original reading order.
 */
export function retrieveRelevantContext(
  text: string,
  question: string,
  options: { maxChars?: number; maxChunks?: number } = {},
): string {
  const source = text.trim();
  const maxChars = options.maxChars ?? 12_000;
  const maxChunks = options.maxChunks ?? 10;
  if (source.length <= maxChars) return source;

  const chunks = makeChunks(source);
  const queryTerms = [...new Set(termsOf(question).filter((term) => !STOP_WORDS.has(term)))];
  if (queryTerms.length === 0) return selectCoverageContext(source, maxChars);

  const documentFrequency = new Map<string, number>();
  for (const chunk of chunks) {
    for (const term of new Set(chunk.terms)) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
  }

  const ranked = chunks.map((chunk) => {
    const frequencies = new Map<string, number>();
    for (const term of chunk.terms) frequencies.set(term, (frequencies.get(term) ?? 0) + 1);
    let score = 0;
    let matches = 0;
    for (const term of queryTerms) {
      const frequency = frequencies.get(term) ?? 0;
      if (frequency === 0) continue;
      matches++;
      const idf = Math.log(1 + (chunks.length + 1) / (1 + (documentFrequency.get(term) ?? 0)));
      score += idf * (1 + Math.log(Math.min(frequency, 4)));
    }
    if (matches > 0) score += matches / queryTerms.length;
    return { chunk, score };
  });

  if (!ranked.some((entry) => entry.score > 0)) return selectCoverageContext(source, maxChars);

  const chosen: typeof ranked = [];
  while (chosen.length < maxChunks) {
    const next = ranked
      .filter((entry) => !chosen.some((selected) => selected.chunk.index === entry.chunk.index))
      .map((entry) => ({
        ...entry,
        adjusted: entry.score * (chosen.some((selected) => Math.abs(selected.chunk.index - entry.chunk.index) <= 1) ? 0.45 : 1),
      }))
      .sort((a, b) => b.adjusted - a.adjusted)[0];
    if (!next || next.score <= 0) break;
    chosen.push(next);
    if (chosen.reduce((total, entry) => total + entry.chunk.text.length, 0) >= maxChars) break;
  }

  return chosen
    .sort((a, b) => a.chunk.index - b.chunk.index)
    .map(({ chunk }) => `[Bagian materi ${chunk.index + 1}]\n${chunk.text}`)
    .join('\n\n')
    .slice(0, maxChars);
}

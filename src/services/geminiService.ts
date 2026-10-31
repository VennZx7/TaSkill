import { TaskServiceError } from './errors';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL = 'gemini-3.5-flash';

/**
 * The assistant's system instruction: a precise tutor that answers
 * strictly from the material the student attached, so a multi-page PDF
 * is summarised from its own text instead of the model's general knowledge.
 */
export const TUTOR_SYSTEM_INSTRUCTION = [
  'Kamu adalah tutor AI yang presisi untuk seorang mahasiswa.',
  'Jawab setiap pertanyaan secara ketat berdasarkan materi belajar yang diberikan.',
  'Jika materi tidak membahas pertanyaan, katakan bahwa materi tidak membahasnya; jangan mengarang informasi.',
  'Jika tidak ada materi yang diberikan, jawab sebagai tutor yang ringkas dan umum.',
  'Gunakan bahasa Indonesia kecuali pertanyaan memakai bahasa lain.',
  'Materi bisa terdiri dari beberapa berkas yang diberi header "=== nama ==="; sebutkan nama berkas sumber jika relevan.',
].join(' ');

/** A study note can be long; the prompt is capped so a paste cannot be unbounded. */
export const MAX_CONTEXT_CHARS = 240_000;

const KEY_STORAGE_KEY = 'student-tasks:gemini-key';

/**
 * The key lives in the service, not in a hook, because two modules read it: the
 * assistant and the flashcard generator. One storage key, one read path.
 */
export function readGeminiKey(): string {
  try {
    return window.localStorage.getItem(KEY_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

/** Best-effort: a key that cannot be persisted still works for this session. */
export function saveGeminiKey(key: string): void {
  try {
    window.localStorage.setItem(KEY_STORAGE_KEY, key);
  } catch {
    // Ignored on purpose; the in-memory key is still valid for this session.
  }
}

function truncate(text: string): string {
  if (text.length <= MAX_CONTEXT_CHARS) return text;
  // Bagi jatah per berkas, jadi PDF terakhir tidak hilang.
  const sections = text.split(/\n\n(?==== .+ ===\n)/);
  const budget = Math.floor(MAX_CONTEXT_CHARS / sections.length);
  return sections
    .map((s) => (s.length <= budget ? s : `${s.slice(0, budget)}\n[...dipotong]`))
    .join('\n\n');
}

/**
 * Builds the prompt the module sends. Kept here, not in the component, so the
 * instruction text is testable and the view stays presentational.
 */
export function buildPrompt(documentContext: string, userMessage: string): string {
  const material = truncate(documentContext.trim());
  return material.length > 0
    ? `Here is my study material: ${material}. Based on this, please answer: ${userMessage}`
    : userMessage;
}

/**
 * The flashcard generation prompt. Gemini is told the exact output contract
 * because a prose answer cannot be parsed into cards: a JSON array of objects
 * with `question` and `answer` keys, nothing else, no markdown wrapper.
 */
export function buildFlashcardPrompt(material: string, count: number): string {
  return [
    `Buat ${count} kartu flashcard dari materi berikut:`,
    truncate(material.trim()),
    '',
    'Aturan format, wajib dipatuhi:',
    '- Balas hanya dengan JSON array, tanpa teks pembuka atau penutup.',
    '- Setiap objek hanya punya dua kunci: "question" dan "answer", keduanya string.',
    '- Pertanyaan harus singkat dan spesifik; jawaban menjelaskan inti materi.',
    '- Jangan memakai markdown, jangan membungkus hasil dengan ```json.',
    '- Tulis dalam bahasa Indonesia.',
  ].join('\n');
}

/**
 * Parses Gemini's reply into cards. The response mime type already asks for
 * bare JSON, but a model can still wrap it in a code fence, so the fence is
 * stripped before parsing rather than treated as a failure.
 */
export function parseFlashcardPayload(text: string): { question: string; answer: string }[] {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new TaskServiceError('Gemini tidak mengembalikan JSON yang valid. Coba ulangi.');
  }

  if (!Array.isArray(parsed)) {
    throw new TaskServiceError('Format kartu dari Gemini tidak dikenali. Coba ulangi.');
  }

  const cards = parsed.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null) return [];
    const raw = entry as Record<string, unknown>;
    const question = typeof raw.question === 'string' ? raw.question.trim() : '';
    const answer = typeof raw.answer === 'string' ? raw.answer.trim() : '';
    return question.length > 0 && answer.length > 0 ? [{ question, answer }] : [];
  });

  if (cards.length === 0) {
    throw new TaskServiceError('Gemini tidak menghasilkan kartu yang bisa dipakai. Coba materi lain.');
  }

  return cards;
}

/**
 * Reads Gemini's error shape, which nests the real reason under `error.message`.
 * The key must never be echoed back: it is in the URL, and these strings can
 * reach a Toast.
 */
function reasonFrom(status: number, body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } };
    const message = parsed.error?.message;
    if (message) return message.replace(/key=[^\s&]+/gi, 'key=***');
  } catch {
    // Fall through to the generic message below.
  }
  if (status === 400 || status === 403) return 'API Key ditolak. Periksa kembali key Anda.';
  if (status === 429) return 'Kuota Gemini habis. Coba lagi nanti.';
  return `Gemini gagal merespons (HTTP ${status}).`;
}

interface GeminiRequest {
  prompt: string;
  maxOutputTokens: number;
  responseMimeType?: string;
  systemInstruction?: string;
}

/**
 * The single call to Gemini, shared by the assistant and the flashcard
 * generator: key check, fetch, error mapping, and text extraction in one place.
 * Returns the raw text; parsing is the caller's job.
 */
async function callGemini(apiKey: string, request: GeminiRequest, signal?: AbortSignal): Promise<string> {
  const key = apiKey.trim();
  if (key.length === 0) {
    throw new TaskServiceError('API Key belum diisi. Tempelkan key Gemini Anda terlebih dahulu.');
  }

  let response: Response;
  try {
    response = await fetch(`${ENDPOINT}/${MODEL}:generateContent`, {
      method: 'POST',
      // The key travels in a header rather than the query string so it cannot
      // leak through a URL that gets logged or kept in history.
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        ...(request.systemInstruction
          ? { systemInstruction: { parts: [{ text: request.systemInstruction }] } }
          : {}),
        contents: [{ role: 'user', parts: [{ text: request.prompt }] }],
        generationConfig: {
          maxOutputTokens: request.maxOutputTokens,
          ...(request.responseMimeType ? { responseMimeType: request.responseMimeType } : {}),
        },
      }),
      ...(signal ? { signal } : {}),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new TaskServiceError('Tidak dapat menghubungi Gemini. Periksa koneksi internet Anda.', error);
  }

  if (!response.ok) {
    throw new TaskServiceError(reasonFrom(response.status, await response.text()));
  }

  const payload = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    promptFeedback?: { blockReason?: string };
  };

  const blockReason = payload.promptFeedback?.blockReason;
  if (blockReason) {
    throw new TaskServiceError(`Permintaan diblokir oleh Gemini (${blockReason}).`);
  }

  const text = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? '')
    .join('')
    .trim();

  if (!text) {
    throw new TaskServiceError('Gemini tidak mengembalikan jawaban. Coba ulangi pertanyaan.');
  }
  return text;
}

/** One assistant reply. Returns the text, never the raw payload. */
export async function askGemini(
  apiKey: string,
  documentContext: string,
  userMessage: string,
  signal?: AbortSignal,
): Promise<string> {
  return callGemini(
    apiKey,
    {
      prompt: buildPrompt(documentContext, userMessage),
      maxOutputTokens: 1024,
      systemInstruction: TUTOR_SYSTEM_INSTRUCTION,
    },
    signal,
  );
}

/**
 * The one-click summary prompt for the "Rangkum" button. Same discipline
 * as the chat: structure is requested explicitly so the reply is a
 * summary, not a continuation, and it stays strictly inside the material.
 */
export function buildSummaryPrompt(material: string): string {
  return [
    'Buatkan ringkasan yang ringkas dari materi belajar berikut:',
    truncate(material.trim()),
    '',
    'Aturan format:',
    '- Satu kalimat inti, lalu poin-poin ide utama, lalu penutup singkat.',
    '- Hanya memakai informasi yang ada di materi; jangan menambah informasi lain.',
    '- Tulis dalam bahasa Indonesia kecuali materinya berbahasa lain.',
  ].join('\n');
}

/** One-shot material summary. Returns the summary text, never the payload. */
export async function summarizeMaterial(
  apiKey: string,
  documentContext: string,
  signal?: AbortSignal,
): Promise<string> {
  return callGemini(
    apiKey,
    {
      prompt: buildSummaryPrompt(documentContext),
      maxOutputTokens: 2048,
      systemInstruction: TUTOR_SYSTEM_INSTRUCTION,
    },
    signal,
  );
}

/**
 * Cards generated from a material. Ids are not assigned here: the Gemini layer
 * returns data, the flashcard service mints ids when the deck is saved.
 */
export async function generateFlashcards(
  apiKey: string,
  material: string,
  count: number,
  signal?: AbortSignal,
): Promise<{ question: string; answer: string }[]> {
  const text = await callGemini(
    apiKey,
    {
      prompt: buildFlashcardPrompt(material, count),
      maxOutputTokens: 2048,
      responseMimeType: 'application/json',
    },
    signal,
  );
  return parseFlashcardPayload(text);
}

/** One quiz question as it comes back from Gemini, before the
 *  service mints ids. `correctIndex` is only meaningful for
 *  choice questions. */
export interface ParsedQuizQuestion {
  kind: 'choice' | 'short';
  prompt: string;
  options: string[];
  correctIndex: number;
  answer: string;
  explanation: string;
  topic: string;
}

/**
 * The quiz prompt. The output contract is explicit because a
 * prose answer cannot be parsed into scorable questions: the
 * choice answer must quote one of its own options exactly,
 * or the question is dropped by the parser.
 */
export function buildQuizPrompt(material: string, count: number, focusTopics: string[] = []): string {
  return [
    `Buat ${count} soal kuis dari materi berikut:`,
    truncate(material.trim()),
    '',
    ...(focusTopics.length > 0
      ? [`Fokuskan soal pada topik yang masih lemah ini: ${focusTopics.join('; ')}. Pakai nama topik persis seperti itu.`, '']
      : []),
    'Aturan format, wajib dipatuhi:',
    '- Balas hanya dengan JSON array, tanpa teks pembuka atau penutup.',
    '- Separuh soal "kind": "choice", sisanya "kind": "short".',
    '- Soal "choice" punya kunci "prompt", "options" (array 2-4 string),',
    '  "answer" (teks yang persis sama dengan salah satu isi "options"), dan "explanation".',
    '- Soal "short" punya kunci "prompt", "answer" (jawaban model singkat), dan "explanation".',
    '- Jangan memakai markdown, jangan membungkus hasil dengan ```json.',
    '- Tulis dalam bahasa Indonesia.',
    '- Setiap soal punya kunci "topic": nama subtopik 2-4 kata. Soal dengan subtopik sama harus memakai teks topic yang persis sama.',
  ].join('\n');
}

/**
 * Parses Gemini's quiz reply. Choice questions whose answer does
 * not name one of their options are dropped rather than guessed:
 * a scored question with the wrong key is worse than none.
 */
export function parseQuizPayload(text: string): ParsedQuizQuestion[] {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new TaskServiceError('Gemini tidak mengembalikan JSON yang valid. Coba ulangi.');
  }

  if (!Array.isArray(parsed)) {
    throw new TaskServiceError('Format soal dari Gemini tidak dikenali. Coba ulangi.');
  }

  const questions = parsed.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null) return [];
    const raw = entry as Record<string, unknown>;

    const prompt = typeof raw.prompt === 'string' ? raw.prompt.trim() : '';
    const explanation = typeof raw.explanation === 'string' ? raw.explanation.trim() : '';
    const topic = typeof raw.topic === 'string' && raw.topic.trim() ? raw.topic.trim() : 'Umum';
    if (prompt.length === 0) return [];

    if (raw.kind === 'choice') {
      if (!Array.isArray(raw.options)) return [];
      const options = raw.options
        .filter((option): option is string => typeof option === 'string')
        .map((option) => option.trim())
        .filter((option) => option.length > 0)
        .slice(0, 4);
      if (options.length < 2) return [];

      const answer = typeof raw.answer === 'string' ? raw.answer.trim() : '';
      const correctIndex = options.findIndex((option) => option === answer);
      if (correctIndex === -1) return [];

      return [{ kind: 'choice' as const, prompt, options, correctIndex, answer, explanation, topic }];
    }

    if (raw.kind === 'short') {
      const answer = typeof raw.answer === 'string' ? raw.answer.trim() : '';
      if (answer.length === 0) return [];
      return [{ kind: 'short' as const, prompt, options: [], correctIndex: -1, answer, explanation, topic }];
    }

    return [];
  });

  if (questions.length === 0) {
    throw new TaskServiceError('Gemini tidak menghasilkan soal yang bisa dipakai. Coba materi lain.');
  }

  return questions;
}

/** Quiz questions generated from a material. Ids are minted by
 *  the quiz service when the set is saved. */
export async function generateQuiz(
  apiKey: string,
  material: string,
  count: number,
  signal?: AbortSignal,
  focusTopics: string[] = [],
): Promise<ParsedQuizQuestion[]> {
  const text = await callGemini(
    apiKey,
    {
      prompt: buildQuizPrompt(material, count, focusTopics),
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
    },
    signal,
  );
  return parseQuizPayload(text);
}

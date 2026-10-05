import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_CONTEXT_CHARS,
  TUTOR_SYSTEM_INSTRUCTION,
  askGemini,
  buildFlashcardPrompt,
  generateFlashcards,
  parseFlashcardPayload,
  readGeminiKey,
  saveGeminiKey,
} from './geminiService';

function geminiResponse(text: string): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
    text: async () => '',
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('buildFlashcardPrompt', () => {
  it('states the output contract and asks for no markdown wrapper', () => {
    const prompt = buildFlashcardPrompt('Limit fungsi definisi epsilon-delta.', 8);

    expect(prompt).toContain('8 kartu flashcard');
    expect(prompt).toContain('Limit fungsi definisi epsilon-delta.');
    expect(prompt).toContain('"question"');
    expect(prompt).toContain('"answer"');
    expect(prompt).toMatch(/jangan memakai markdown/i);
  });

  it('caps the pasted material so a huge note cannot balloon the request', () => {
    const prompt = buildFlashcardPrompt('a'.repeat(MAX_CONTEXT_CHARS + 500), 5);

    expect(prompt.length).toBeLessThan(MAX_CONTEXT_CHARS + 1000);
    expect(prompt).toContain('dipotong');
  });
});

describe('parseFlashcardPayload', () => {
  it('reads a bare JSON array', () => {
    const cards = parseFlashcardPayload(
      '[{"question":"Apa itu limit?","answer":"Nilai mendekati L."}]',
    );

    expect(cards).toEqual([{ question: 'Apa itu limit?', answer: 'Nilai mendekati L.' }]);
  });

  it('strips a markdown fence instead of failing on it', () => {
    const cards = parseFlashcardPayload(
      '```json\n[{"question":"Q1","answer":"A1"}]\n```',
    );

    expect(cards).toEqual([{ question: 'Q1', answer: 'A1' }]);
  });

  it('skips entries that are not question/answer pairs', () => {
    const cards = parseFlashcardPayload(
      '[{"question":"Q1","answer":"A1"},{"question":"","answer":"A2"},"bukan objek",{"question":"Q3"}]',
    );

    expect(cards).toEqual([{ question: 'Q1', answer: 'A1' }]);
  });

  it('reports unparseable, non-array, and empty results as typed errors', () => {
    expect(() => parseFlashcardPayload('Maaf, saya tidak bisa.')).toThrow(/JSON/i);
    expect(() => parseFlashcardPayload('{"cards":[]}')).toThrow(/tidak dikenali/i);
    expect(() => parseFlashcardPayload('[{"question":"Q","answer":"  "}]')).toThrow(/tidak menghasilkan/i);
  });
});

describe('generateFlashcards', () => {
  it('asks Gemini for JSON and returns the parsed cards', async () => {
    const fetchMock = vi.fn(async () =>
      geminiResponse('[{"question":"Q1","answer":"A1"},{"question":"Q2","answer":"A2"}]'),
    );
    vi.stubGlobal('fetch', fetchMock);

    const cards = await generateFlashcards('AIzaTest', 'Limit fungsi', 2);

    expect(cards).toEqual([
      { question: 'Q1', answer: 'A1' },
      { question: 'Q2', answer: 'A2' },
    ]);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('gemini-3.5-flash');
    const headers = init.headers as Record<string, string>;
    expect(headers['x-goog-api-key']).toBe('AIzaTest');
    expect(JSON.parse(String(init.body)).generationConfig.responseMimeType).toBe('application/json');
  });

  it('turns a missing key and a quota error into displayable messages', async () => {
    await expect(generateFlashcards('  ', 'Limit fungsi', 5)).rejects.toThrow(/API Key belum diisi/i);

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 429, text: async () => '{}' }) as unknown as Response),
    );
    await expect(generateFlashcards('AIzaTest', 'Limit fungsi', 5)).rejects.toThrow(/Kuota Gemini habis/i);
  });

  it('never echoes the API key back in an upstream error message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          ({
            ok: false,
            status: 400,
            text: async () => JSON.stringify({ error: { message: 'API key not valid: key=AIzaSecret123' } }),
          }) as unknown as Response,
      ),
    );

    await expect(generateFlashcards('AIzaSecret123', 'Limit fungsi', 5)).rejects.toThrow(
      /key=\*\*\*/,
    );
  });
});

describe('askGemini', () => {
  it('routes the question through the Flash model with the tutor system instruction', async () => {
    const fetchMock = vi.fn(async () => geminiResponse('Jawaban.'));
    vi.stubGlobal('fetch', fetchMock);

    const answer = await askGemini('AIzaTest', 'Materi limit fungsi.', 'Apa itu limit?');

    expect(answer).toBe('Jawaban.');

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('gemini-3.5-flash');
    const body = JSON.parse(String(init.body));
    expect(body.systemInstruction.parts[0].text).toBe(TUTOR_SYSTEM_INSTRUCTION);
    expect(body.systemInstruction.parts[0].text).toMatch(/tutor/i);
    expect(body.contents[0].parts[0].text).toContain('Materi limit fungsi.');
    expect(body.contents[0].parts[0].text).toContain('Apa itu limit?');
  });

  it('caps the attached material so a huge PDF cannot balloon the request', async () => {
    const fetchMock = vi.fn(async () => geminiResponse('Jawaban.'));
    vi.stubGlobal('fetch', fetchMock);

    await askGemini('AIzaTest', 'a'.repeat(MAX_CONTEXT_CHARS + 500), 'Pertanyaan');

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.contents[0].parts[0].text.length).toBeLessThan(MAX_CONTEXT_CHARS + 1000);
    expect(body.contents[0].parts[0].text).toContain('dipotong');
  });
});

describe('gemini key storage', () => {
  it('round-trips the key so both AI modules read the same value', () => {
    expect(readGeminiKey()).toBe('');

    saveGeminiKey('AIzaStored');

    expect(readGeminiKey()).toBe('AIzaStored');
    expect(window.localStorage.getItem('student-tasks:gemini-key')).toBe('AIzaStored');
  });
});

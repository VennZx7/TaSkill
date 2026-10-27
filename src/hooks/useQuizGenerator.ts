import { useCallback, useMemo, useState } from 'react';
import { useToast } from '../components/ui/Toast';
import { useFlashcards } from '../context/FlashcardContext';
import { useQuizzes } from '../context/QuizContext';
import { useVault } from '../context/VaultContext';
import { TaskServiceError, ValidationError } from '../services/errors';
import { generateFlashcards, generateQuiz, readGeminiKey, saveGeminiKey } from '../services/geminiService';
import { readTextFile, type LoadedDocument } from '../utils/documentLoader';
import { isStudyMaterial, type VaultItem } from '../types/vault';
import type { FlashcardCount, FlashcardDeck } from '../types/flashcard';
import type { QuizSet } from '../types/quiz';

/** Where the generation material comes from. */
export type GeneratorSource = 'vault' | 'file' | 'url';
/** What the material becomes. */
export type GeneratorTarget = 'quiz' | 'flashcards' | 'both';

const DEFAULT_COUNT: FlashcardCount = 8;
/** A URL is a title of last resort; keep the default deck/set title under the 100-char cap. */
const URL_TITLE_MAX = 48;

/** Only the material the generator needs: identity for
 *  default naming, prose for the prompt. `id` is empty
 *  when the source is a file or a URL, which is how a
 *  generated set records "not built from a saved item". */
export interface GeneratorMaterial {
  id: string;
  title: string;
  course: string;
  text: string;
  pageCount: number | null;
}

export interface GenerationResult {
  quiz: QuizSet | null;
  deck: FlashcardDeck | null;
}

function messageOf(error: unknown): string {
  if (error instanceof ValidationError) return 'Data tidak valid. Periksa judul dan isinya.';
  if (error instanceof TaskServiceError) return error.message;
  return 'Terjadi kesalahan tak terduga. Coba lagi.';
}

/**
 * Drives the unified generator: pick a source (Study Vault,
 * uploaded file, or a link/topic), pick a target (quiz,
 * flashcards, or both), and Gemini builds it through the
 * services, so ids and persistence live in one place.
 */
export function useQuizGenerator() {
  const toast = useToast();
  const { visibleItems } = useVault();
  const { create } = useFlashcards();
  const { create: createQuiz } = useQuizzes();

  const [isOpen, setIsOpen] = useState(false);
  const [sourceMode, setSourceMode] = useState<GeneratorSource>('vault');
  const [materialId, setMaterialId] = useState('');
  const [uploaded, setUploaded] = useState<LoadedDocument | null>(null);
  const [isLoadingSource, setIsLoadingSource] = useState(false);
  const [urlText, setUrlText] = useState('');
  const [target, setTarget] = useState<GeneratorTarget>('both');
  const [title, setTitle] = useState('');
  const [count, setCount] = useState<FlashcardCount>(DEFAULT_COUNT);
  const [apiKey, setApiKeyState] = useState('');
  const [needsKey, setNeedsKey] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const materials = useMemo<GeneratorMaterial[]>(
    () =>
      visibleItems
        .filter(isStudyMaterial)
        .map((item: VaultItem) => ({
          id: item.id,
          title: item.title,
          course: item.course,
          text: item.urlOrContent,
          pageCount: null,
        })),
    [visibleItems],
  );

  /** The one resolved source the form acts on, whatever
   *  mode supplied it. Null while nothing is loaded. */
  const source = useMemo<GeneratorMaterial | null>(() => {
    if (sourceMode === 'vault') {
      return materials.find((item) => item.id === materialId) ?? null;
    }
    if (sourceMode === 'file') {
      return uploaded === null
        ? null
        : {
            id: '',
            title: uploaded.name,
            course: 'Unggahan',
            text: uploaded.text,
            pageCount: uploaded.pageCount ?? null,
          };
    }
    const topic = urlText.trim();
    if (topic.length === 0) return null;
    return {
      id: '',
      title: topic.length > URL_TITLE_MAX ? `${topic.slice(0, URL_TITLE_MAX)}…` : topic,
      course: 'Tautan',
      text: topic,
      pageCount: null,
    };
  }, [sourceMode, materials, materialId, uploaded, urlText]);

  const open = useCallback(() => {
    const storedKey = readGeminiKey();
    setSourceMode('vault');
    setMaterialId('');
    setUploaded(null);
    setUrlText('');
    setTarget('both');
    setTitle('');
    setCount(DEFAULT_COUNT);
    setApiKeyState(storedKey);
    // Decided once per open so the key field cannot vanish mid-typing.
    setNeedsKey(storedKey.trim().length === 0);
    setError(null);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    if (isGenerating) return;
    setIsOpen(false);
  }, [isGenerating]);

  const setApiKey = useCallback((value: string) => {
    setApiKeyState(value);
    saveGeminiKey(value);
  }, []);

  /** Reads an uploaded file in the browser; the bytes never
   *  leave the tab except in the Gemini request. */
  const loadFile = useCallback(
    async (file: File) => {
      setIsLoadingSource(true);
      try {
        setUploaded(await readTextFile(file));
      } catch (caught) {
        setUploaded(null);
        toast({
          message: caught instanceof Error ? caught.message : 'File gagal dimuat.',
          tone: 'error',
        });
      } finally {
        setIsLoadingSource(false);
      }
    },
    [toast],
  );

  const submit = useCallback(async (): Promise<GenerationResult | null> => {
    const material = source;
    if (!material) {
      setError('Pilih atau muat materi sumber lebih dulu.');
      return null;
    }

    setIsGenerating(true);
    setError(null);
    try {
      const namedTitle = title.trim();
      const quizTitle = namedTitle.length > 0 ? namedTitle : `${material.title} — Kuis`;
      const deckTitle =
        namedTitle.length > 0 ? namedTitle : `${material.title} — Flashcards`;
      let quiz: QuizSet | null = null;
      let deck: FlashcardDeck | null = null;

      if (target !== 'flashcards') {
        const questions = await generateQuiz(apiKey, material.text, count);
        quiz = await createQuiz({ title: quizTitle, materialId: material.id || null, questions });
        toast(`Kuis "${quiz.title}" tersimpan dengan ${questions.length} soal.`);
      }
      if (target !== 'quiz') {
        const cards = await generateFlashcards(apiKey, material.text, count);
        deck = await create({ title: deckTitle, vaultItemId: material.id || null, cards });
        toast(`Deck "${deck.title}" tersimpan dengan ${deck.cards.length} kartu.`);
      }

      setIsOpen(false);
      return { quiz, deck };
    } catch (caught) {
      const message = messageOf(caught);
      setError(message);
      toast({ message, tone: 'error' });
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, [apiKey, count, create, createQuiz, source, target, title, toast]);

  return {
    isOpen,
    isGenerating,
    error,
    sourceMode,
    setSourceMode,
    materials,
    materialId,
    setMaterialId,
    uploaded,
    isLoadingSource,
    loadFile,
    urlText,
    setUrlText,
    source,
    target,
    setTarget,
    title,
    setTitle,
    count,
    setCount,
    apiKey,
    needsKey,
    open,
    close,
    setApiKey,
    submit,
  };
}

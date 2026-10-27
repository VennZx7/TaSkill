import { useCallback, useMemo, useState } from 'react';
import { useToast } from '../components/ui/Toast';
import { useFlashcards } from '../context/FlashcardContext';
import { useVault } from '../context/VaultContext';
import { TaskServiceError, ValidationError } from '../services/errors';
import { generateFlashcards, readGeminiKey, saveGeminiKey } from '../services/geminiService';
import { FLASHCARD_COUNTS, type FlashcardCount, type FlashcardDeck } from '../types/flashcard';
import { isStudyMaterial } from '../types/vault';

const DEFAULT_COUNT: FlashcardCount = 8;

/** Only the material the generator needs: identity for the select, prose for the
 *  prompt. The rest of a vault item is irrelevant here. */
export interface GeneratorMaterial {
  id: string;
  title: string;
  course: string;
  text: string;
}

function messageOf(error: unknown): string {
  if (error instanceof ValidationError) return 'Deck tidak valid. Periksa judul dan kartu.';
  if (error instanceof TaskServiceError) return error.message;
  return 'Terjadi kesalahan tak terduga. Coba lagi.';
}

/**
 * Drives the "Generate Flashcards with AI" flow: pick a material, ask Gemini for
 * cards, save the deck through the service. Returns the new deck so the page can
 * drop the student straight into Study Mode.
 */
export function useFlashcardGenerator() {
  const toast = useToast();
  const { visibleItems } = useVault();
  const { create } = useFlashcards();

  const [isOpen, setIsOpen] = useState(false);
  const [materialId, setMaterialId] = useState('');
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
        .map((item) => ({
          id: item.id,
          title: item.title,
          course: item.course,
          text: item.urlOrContent,
        })),
    [visibleItems],
  );

  const open = useCallback((initialMaterialId?: string) => {
    const storedKey = readGeminiKey();
    setMaterialId(initialMaterialId ?? '');
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

  const submit = useCallback(async (): Promise<FlashcardDeck | null> => {
    const material = materials.find((item) => item.id === materialId);
    if (!material) {
      setError('Pilih materi dari Study Vault terlebih dahulu.');
      return null;
    }

    setIsGenerating(true);
    setError(null);
    try {
      const cards = await generateFlashcards(apiKey, material.text, count);
      const deck = await create({
        title: title.trim().length > 0 ? title : `${material.title} — Flashcards`,
        vaultItemId: material.id,
        cards,
      });
      toast(`Deck "${deck.title}" tersimpan dengan ${deck.cards.length} kartu.`);
      setIsOpen(false);
      return deck;
    } catch (caught) {
      const message = messageOf(caught);
      setError(message);
      toast({ message, tone: 'error' });
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, [apiKey, count, create, materialId, materials, title, toast]);

  return {
    isOpen,
    isGenerating,
    error,
    materials,
    materialId,
    title,
    count,
    counts: FLASHCARD_COUNTS,
    apiKey,
    needsKey,
    open,
    close,
    setMaterialId,
    setTitle,
    setCount,
    setApiKey,
    submit,
  };
}

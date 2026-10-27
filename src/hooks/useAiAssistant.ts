import { useCallback, useState } from 'react';
import { useToast } from '../components/ui/Toast';
import { useVault } from '../context/VaultContext';
import { askGemini, readGeminiKey, saveGeminiKey, summarizeMaterial } from '../services/geminiService';
import { createId } from '../utils/id';
import { readTextFile, type LoadedDocument } from '../utils/documentLoader';
import { isStudyMaterial, type VaultItem } from '../types/vault';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

export function useAiAssistant() {
  const toast = useToast();
  const { visibleItems } = useVault();

  const [apiKey, setApiKeyState] = useState(readGeminiKey);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [documentContext, setDocumentContext] = useState('');
  const [contextLabel, setContextLabel] = useState<string | null>(null);
  const [contextPages, setContextPages] = useState<number | null>(null);
  const [isLoadingContext, setIsLoadingContext] = useState(false);
  const [isThinking, setIsThinking] = useState(false);

  const setApiKey = useCallback((value: string) => {
    setApiKeyState(value);
    saveGeminiKey(value);
  }, []);

  const clearContext = useCallback(() => {
    setDocumentContext('');
    setContextLabel(null);
    setContextPages(null);
  }, []);

  const loadFromVault = useCallback((item: VaultItem) => {
    setDocumentContext(item.urlOrContent);
    setContextLabel(item.title);
    setContextPages(null);
  }, []);

  const loadFromFile = useCallback(
    async (file: File) => {
      setIsLoadingContext(true);
      try {
        const loaded: LoadedDocument = await readTextFile(file);
        setDocumentContext(loaded.text);
        setContextLabel(loaded.name);
        setContextPages(loaded.pageCount ?? null);
      } catch (error) {
        toast({
          message: error instanceof Error ? error.message : 'File gagal dimuat.',
          tone: 'error',
        });
      } finally {
        setIsLoadingContext(false);
      }
    },
    [toast],
  );

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (trimmed.length === 0 || isThinking) return;

      const userMessage: ChatMessage = { id: createId(), role: 'user', text: trimmed };
      const history = [...messages, userMessage];
      setMessages(history);
      setIsThinking(true);

      try {
        const answer = await askGemini(apiKey, documentContext, trimmed);
        setMessages([...history, { id: createId(), role: 'assistant', text: answer }]);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Terjadi kesalahan tak terduga.';
        toast({ message, tone: 'error' });
        setMessages([
          ...history,
          { id: createId(), role: 'assistant', text: `Maaf, gagal menjawab. ${message}` },
        ]);
      } finally {
        setIsThinking(false);
      }
    },
    [apiKey, documentContext, messages, isThinking, toast],
  );

  /** The "Rangkum" button: summarizes the loaded material in one click.
   *  Travels through the chat so the summary is visible next to the
   *  material it came from, and so failures surface in both the log
   *  and a Toast. */
  const summarize = useCallback(async () => {
    const material = documentContext.trim();
    if (isThinking) return;
    if (material.length === 0) {
      toast({
        message: 'Muat materi dari Study Vault atau unggah berkas lebih dulu.',
        tone: 'error',
      });
      return;
    }

    const userMessage: ChatMessage = {
      id: createId(),
      role: 'user',
      text: 'Buatkan ringkasan dari materi ini.',
    };
    const history = [...messages, userMessage];
    setMessages(history);
    setIsThinking(true);

    try {
      const summary = await summarizeMaterial(apiKey, documentContext);
      setMessages([...history, { id: createId(), role: 'assistant', text: summary }]);
      toast('Rangkuman materi selesai dibuat.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Terjadi kesalahan tak terduga.';
      toast({ message, tone: 'error' });
      setMessages([
        ...history,
        { id: createId(), role: 'assistant', text: `Maaf, rangkuman gagal dibuat. ${message}` },
      ]);
    } finally {
      setIsThinking(false);
    }
  }, [apiKey, documentContext, isThinking, messages, toast]);

  return {
    apiKey,
    setApiKey,
    messages,
    isThinking,
    documentContext,
    contextLabel,
    contextChars: documentContext.length,
    contextPages,
    isLoadingContext,
    selectableItems: visibleItems.filter(isStudyMaterial),
    loadFromVault,
    loadFromFile,
    clearContext,
    send,
    summarize,
  };
}
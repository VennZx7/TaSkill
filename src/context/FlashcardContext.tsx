import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import { NotFoundError, TaskServiceError } from '../services/errors';
import { createDeck, deleteDeck, listDecks, markDeckStudied } from '../services/flashcardService';
import type { FlashcardDeck, FlashcardDeckDraft } from '../types/flashcard';
import { parseDeadline } from '../utils/date';

export type LoadStatus = 'loading' | 'ready' | 'error';

interface State {
  status: LoadStatus;
  decks: FlashcardDeck[];
  error: string | null;
}

type Action =
  | { type: 'load:start' }
  | { type: 'load:success'; decks: FlashcardDeck[] }
  | { type: 'load:error'; message: string }
  | { type: 'decks:replace'; decks: FlashcardDeck[] };

const initialState: State = { status: 'loading', decks: [], error: null };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'load:start':
      return { ...state, status: 'loading', error: null };
    case 'load:success':
      return { ...state, status: 'ready', decks: action.decks, error: null };
    case 'load:error':
      return { ...state, status: 'error', error: action.message, decks: [] };
    case 'decks:replace':
      return { ...state, status: 'ready', decks: action.decks, error: null };
    default:
      return state;
  }
}

export interface FlashcardContextValue {
  status: LoadStatus;
  error: string | null;
  decks: FlashcardDeck[];
  reload: () => Promise<void>;
  create: (draft: FlashcardDeckDraft) => Promise<FlashcardDeck>;
  remove: (id: string) => Promise<void>;
  markStudied: (id: string) => Promise<void>;
}

const FlashcardContext = createContext<FlashcardContextValue | null>(null);

function messageOf(error: unknown): string {
  if (error instanceof TaskServiceError) return error.message;
  return 'Terjadi kesalahan tak terduga. Coba lagi.';
}

/** The deck touched most recently comes first; a never-studied deck falls back to
 *  its creation instant, so the order is always a real instant comparison. */
function byRecentUse(a: FlashcardDeck, b: FlashcardDeck): number {
  const left = parseDeadline(a.lastStudied ?? a.createdAt) ?? 0;
  const right = parseDeadline(b.lastStudied ?? b.createdAt) ?? 0;
  return right - left;
}

export function FlashcardProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const load = async () => {
    dispatch({ type: 'load:start' });
    try {
      dispatch({ type: 'load:success', decks: await listDecks() });
    } catch (error) {
      dispatch({ type: 'load:error', message: messageOf(error) });
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const value = useMemo<FlashcardContextValue>(
    () => ({
      status: state.status,
      error: state.error,
      decks: [...state.decks].sort(byRecentUse),
      reload: load,
      create: async (draft) => {
        const deck = await createDeck(draft);
        dispatch({ type: 'decks:replace', decks: await listDecks() });
        return deck;
      },
      remove: async (id) => {
        try {
          await deleteDeck(id);
        } catch (error) {
          // A deck deleted from another surface is already gone; not an error.
          if (!(error instanceof NotFoundError)) throw error;
        }
        dispatch({ type: 'decks:replace', decks: await listDecks() });
      },
      markStudied: async (id) => {
        try {
          await markDeckStudied(id);
        } catch (error) {
          if (!(error instanceof NotFoundError)) throw error;
        }
        dispatch({ type: 'decks:replace', decks: await listDecks() });
      },
    }),
    [state],
  );

  return <FlashcardContext.Provider value={value}>{children}</FlashcardContext.Provider>;
}

export function useFlashcards(): FlashcardContextValue {
  const context = useContext(FlashcardContext);
  if (!context) throw new Error('useFlashcards must be used inside FlashcardProvider');
  return context;
}

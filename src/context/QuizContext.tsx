import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import { NotFoundError, TaskServiceError } from '../services/errors';
import { createQuiz, deleteQuiz, listQuizzes, markQuizStudied } from '../services/quizService';
import type { QuizSet, QuizSetDraft } from '../types/quiz';
import { parseDeadline } from '../utils/date';

export type LoadStatus = 'loading' | 'ready' | 'error';

interface State {
  status: LoadStatus;
  sets: QuizSet[];
  error: string | null;
}

type Action =
  | { type: 'load:start' }
  | { type: 'load:success'; sets: QuizSet[] }
  | { type: 'load:error'; message: string }
  | { type: 'sets:replace'; sets: QuizSet[] };

const initialState: State = { status: 'loading', sets: [], error: null };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'load:start':
      return { ...state, status: 'loading', error: null };
    case 'load:success':
      return { ...state, status: 'ready', sets: action.sets, error: null };
    case 'load:error':
      return { ...state, status: 'error', error: action.message, sets: [] };
    case 'sets:replace':
      return { ...state, status: 'ready', sets: action.sets, error: null };
    default:
      return state;
  }
}

export interface QuizContextValue {
  status: LoadStatus;
  error: string | null;
  sets: QuizSet[];
  reload: () => Promise<void>;
  create: (draft: QuizSetDraft) => Promise<QuizSet>;
  remove: (id: string) => Promise<void>;
  markStudied: (id: string) => Promise<void>;
}

const QuizContext = createContext<QuizContextValue | null>(null);

function messageOf(error: unknown): string {
  if (error instanceof TaskServiceError) return error.message;
  return 'Terjadi kesalahan tak terduga. Coba lagi.';
}

/** The set touched most recently comes first; a never-submitted
 *  set falls back to its creation instant, so the order is
 *  always a real instant comparison. */
function byRecentUse(a: QuizSet, b: QuizSet): number {
  const left = parseDeadline(a.lastStudied ?? a.createdAt) ?? 0;
  const right = parseDeadline(b.lastStudied ?? b.createdAt) ?? 0;
  return right - left;
}

export function QuizProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const load = async () => {
    dispatch({ type: 'load:start' });
    try {
      dispatch({ type: 'load:success', sets: await listQuizzes() });
    } catch (error) {
      dispatch({ type: 'load:error', message: messageOf(error) });
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const value = useMemo<QuizContextValue>(
    () => ({
      status: state.status,
      error: state.error,
      sets: [...state.sets].sort(byRecentUse),
      reload: load,
      create: async (draft) => {
        const set = await createQuiz(draft);
        dispatch({ type: 'sets:replace', sets: await listQuizzes() });
        return set;
      },
      remove: async (id) => {
        try {
          await deleteQuiz(id);
        } catch (error) {
          // A set deleted from another surface is already gone; not an error.
          if (!(error instanceof NotFoundError)) throw error;
        }
        dispatch({ type: 'sets:replace', sets: await listQuizzes() });
      },
      markStudied: async (id) => {
        try {
          await markQuizStudied(id);
        } catch (error) {
          if (!(error instanceof NotFoundError)) throw error;
        }
        dispatch({ type: 'sets:replace', sets: await listQuizzes() });
      },
    }),
    [state],
  );

  return <QuizContext.Provider value={value}>{children}</QuizContext.Provider>;
}

export function useQuizzes(): QuizContextValue {
  const context = useContext(QuizContext);
  if (!context) throw new Error('useQuizzes must be used inside QuizProvider');
  return context;
}

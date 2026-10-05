import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import {
  createVaultItem,
  deleteVaultItem,
  listVaultItems,
  setVaultItemRead,
  updateVaultItem,
} from '../services/vaultService';
import { NotFoundError, TaskServiceError } from '../services/errors';
import type { VaultDraft, VaultItem } from '../types/vault';

export type LoadStatus = 'loading' | 'ready' | 'error';

export interface VaultFilters {
  course: string;
  tag: string;
}

interface State {
  status: LoadStatus;
  items: VaultItem[];
  error: string | null;
  filters: VaultFilters;
  search: string;
}

type Action =
  | { type: 'load:start' }
  | { type: 'load:success'; items: VaultItem[] }
  | { type: 'load:error'; message: string }
  | { type: 'items:replace'; items: VaultItem[] }
  | { type: 'filters:set'; filters: Partial<VaultFilters> }
  | { type: 'filters:clear' }
  | { type: 'search:set'; search: string };

const DEFAULT_FILTERS: VaultFilters = { course: '', tag: '' };

const initialState: State = {
  status: 'loading',
  items: [],
  error: null,
  filters: DEFAULT_FILTERS,
  search: '',
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'load:start':
      return { ...state, status: 'loading', error: null };
    case 'load:success':
      return { ...state, status: 'ready', items: action.items, error: null };
    case 'load:error':
      return { ...state, status: 'error', error: action.message, items: [] };
    case 'items:replace':
      return { ...state, status: 'ready', items: action.items, error: null };
    case 'filters:set':
      return { ...state, filters: { ...state.filters, ...action.filters } };
    case 'filters:clear':
      return { ...state, filters: DEFAULT_FILTERS, search: '' };
    case 'search:set':
      return { ...state, search: action.search };
    default:
      return state;
  }
}

export interface VaultStats {
  total: number;
  /** isRead === false, newest first, capped at UNREAD_LIMIT. */
  unread: VaultItem[];
}

/** The dashboard previews five unread items; the vault shows them all. */
const UNREAD_LIMIT = 5;

export interface VaultContextValue {
  status: LoadStatus;
  error: string | null;
  visibleItems: VaultItem[];
  stats: VaultStats;
  filters: VaultFilters;
  search: string;
  courseOptions: string[];
  tagOptions: string[];
  isFiltered: boolean;
  reload: () => Promise<void>;
  setFilters: (filters: Partial<VaultFilters>) => void;
  setSearch: (search: string) => void;
  clearFilters: () => void;
  create: (draft: VaultDraft) => Promise<VaultItem>;
  update: (id: string, draft: VaultDraft) => Promise<VaultItem>;
  setRead: (id: string, isRead: boolean) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

const VaultContext = createContext<VaultContextValue | null>(null);

function messageOf(error: unknown): string {
  if (error instanceof TaskServiceError) return error.message;
  return 'Terjadi kesalahan tak terduga. Coba lagi.';
}

function byNewestFirst(a: VaultItem, b: VaultItem): number {
  return Date.parse(b.createdAt) - Date.parse(a.createdAt);
}

function byName(a: string, b: string): number {
  return a.localeCompare(b, 'id');
}

export function VaultProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const load = async () => {
    dispatch({ type: 'load:start' });
    try {
      dispatch({ type: 'load:success', items: await listVaultItems() });
    } catch (error) {
      dispatch({ type: 'load:error', message: messageOf(error) });
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const value = useMemo<VaultContextValue>(() => {
    const { items, filters, search } = state;
    const query = search.trim().toLowerCase();

    const filtered = items.filter((item) => {
      const courseMatch =
        filters.course === '' || item.course.toLowerCase() === filters.course.toLowerCase();
      const tagMatch =
        filters.tag === '' ||
        item.tags.some((tag) => tag.toLowerCase() === filters.tag.toLowerCase());
      const searchMatch =
        query === '' ||
        item.title.toLowerCase().includes(query) ||
        item.course.toLowerCase().includes(query) ||
        item.tags.some((tag) => tag.toLowerCase().includes(query)) ||
        item.urlOrContent.toLowerCase().includes(query);
      return courseMatch && tagMatch && searchMatch;
    });

    const courseOptions = [...new Set(items.map((item) => item.course))].sort(byName);
    const tagOptions = [...new Set(items.flatMap((item) => item.tags))].sort(byName);

    // Like ItemContext.stats, this ignores the filters: the dashboard is the
    // landing page and must reflect everything saved, not the current subset.
    const unread = items.filter((item) => !item.isRead).sort(byNewestFirst);
    const stats: VaultStats = { total: items.length, unread: unread.slice(0, UNREAD_LIMIT) };

    return {
      status: state.status,
      error: state.error,
      visibleItems: [...filtered].sort(byNewestFirst),
      stats,
      filters,
      search,
      courseOptions,
      tagOptions,
      isFiltered: query !== '' || filters.course !== '' || filters.tag !== '',
      reload: load,
      setFilters: (partial) => dispatch({ type: 'filters:set', filters: partial }),
      setSearch: (text) => dispatch({ type: 'search:set', search: text }),
      clearFilters: () => dispatch({ type: 'filters:clear' }),
      create: async (draft) => {
        const item = await createVaultItem(draft);
        dispatch({ type: 'items:replace', items: await listVaultItems() });
        return item;
      },
      update: async (id, draft) => {
        try {
          const item = await updateVaultItem(id, draft);
          dispatch({ type: 'items:replace', items: await listVaultItems() });
          return item;
        } catch (error) {
          if (error instanceof NotFoundError) {
            dispatch({ type: 'items:replace', items: await listVaultItems() });
          }
          throw error;
        }
      },
      setRead: async (id, isRead) => {
        try {
          await setVaultItemRead(id, isRead);
        } catch (error) {
          if (!(error instanceof NotFoundError)) throw error;
        }
        dispatch({ type: 'items:replace', items: await listVaultItems() });
      },
      remove: async (id) => {
        try {
          await deleteVaultItem(id);
        } catch (error) {
          if (!(error instanceof NotFoundError)) throw error;
        }
        dispatch({ type: 'items:replace', items: await listVaultItems() });
      },
    };
  }, [state]);

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}

export function useVault(): VaultContextValue {
  const context = useContext(VaultContext);
  if (!context) throw new Error('useVault must be used inside VaultProvider');
  return context;
}
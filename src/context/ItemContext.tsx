import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import {
  createItem,
  deleteItem,
  listItems,
  setItemStatus,
  updateItem,
  type SaveResult,
} from '../services/itemService';
import { NotFoundError, TaskServiceError } from '../services/errors';
import type { Item, ItemDraft, ItemType, TaskStatus } from '../types/item';
import {
  compareByDeadline,
  isWithinWIBDay,
  parseDeadline,
  sortByDeadline,
  URGENT_WINDOW_MS,
} from '../utils/date';

const UPCOMING_EXAM_LIMIT = 3;
/** The dashboard shows the five most pressing, not every urgent item. */
const URGENT_LIMIT = 5;

export type LoadStatus = 'loading' | 'ready' | 'error';

export interface Filters {
  status: TaskStatus | 'all';
  type: ItemType | 'all';
  course: string;
}

export interface DashboardSummary {
  dueToday: Item[];
  overdue: Item[];
  upcomingExams: Item[];
}

export interface ItemStats {
  /** Everything not yet marked Done. */
  active: number;
  /** Overdue or due within URGENT_WINDOW_MS, nearest first, capped at URGENT_LIMIT. */
  urgent: Item[];
}

interface State {
  status: LoadStatus;
  items: Item[];
  error: string | null;
  filters: Filters;
  search: string;
}

type Action =
  | { type: 'load:start' }
  | { type: 'load:success'; items: Item[] }
  | { type: 'load:error'; message: string }
  | { type: 'items:replace'; items: Item[] }
  | { type: 'filters:set'; filters: Partial<Filters> }
  | { type: 'filters:clear' }
  | { type: 'search:set'; search: string };

const DEFAULT_FILTERS: Filters = { status: 'all', type: 'all', course: '' };

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

export interface ItemContextValue {
  status: LoadStatus;
  error: string | null;
  visibleItems: Item[];
  dashboard: DashboardSummary;
  stats: ItemStats;
  filters: Filters;
  search: string;
  courseOptions: string[];
  isFiltered: boolean;
  reload: () => Promise<void>;
  setFilters: (filters: Partial<Filters>) => void;
  setSearch: (search: string) => void;
  clearFilters: () => void;
  create: (draft: ItemDraft) => Promise<SaveResult>;
  update: (id: string, draft: ItemDraft) => Promise<SaveResult>;
  setStatus: (id: string, status: TaskStatus) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

const ItemContext = createContext<ItemContextValue | null>(null);

function messageOf(error: unknown): string {
  if (error instanceof TaskServiceError) return error.message;
  return 'Terjadi kesalahan tak terduga. Coba lagi.';
}

export function ItemProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const load = async () => {
    dispatch({ type: 'load:start' });
    try {
      dispatch({ type: 'load:success', items: await listItems() });
    } catch (error) {
      dispatch({ type: 'load:error', message: messageOf(error) });
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const value = useMemo<ItemContextValue>(() => {
    const { items, filters, search } = state;
    const query = search.trim().toLowerCase();

    const filtered = items.filter((item) => {
      const statusMatch = filters.status === 'all' || item.status === filters.status;
      const typeMatch = filters.type === 'all' || item.type === filters.type;
      const courseMatch =
        filters.course === '' || item.course.toLowerCase() === filters.course.toLowerCase();
      const searchMatch =
        query === '' ||
        item.title.toLowerCase().includes(query) ||
        item.course.toLowerCase().includes(query);
      return statusMatch && typeMatch && courseMatch && searchMatch;
    });

    const courseOptions = [...new Set(items.map((item) => item.course))].sort((a, b) =>
      a.localeCompare(b, 'id'),
    );

    // Derived from the same filtered set the views render, so the dashboard
    // never disagrees with what the student is looking at.
    const now = Date.now();
    const sorted = sortByDeadline(filtered);

    const isOpen = (item: Item) => item.status !== 'Done';
    const instant = (item: Item) => parseDeadline(item.deadline);
    // A single WIB day holds both still-actionable and already-missed items,
    // so Due Today excludes anything past — otherwise it duplicates Terlewat.
    const isPast = (item: Item) => {
      const ms = instant(item);
      return ms !== null && ms < now;
    };

    const dashboard: DashboardSummary = {
      dueToday: sorted.filter(
        (item) => isOpen(item) && !isPast(item) && isWithinWIBDay(item.deadline, now),
      ),
      overdue: sorted.filter((item) => isOpen(item) && isPast(item)),
      upcomingExams: sorted
        .filter((item) => isOpen(item) && !isPast(item) && item.type === 'exam')
        .slice(0, UPCOMING_EXAM_LIMIT),
    };

    // Unlike `dashboard`, these two ignore the scheduler filters on purpose: the
    // dashboard is the landing page, so its numbers must describe everything the
    // student has, not whatever subset the scheduler was last left showing.
    const stats: ItemStats = {
      active: items.filter(isOpen).length,
      // A negative diff is overdue, which is also urgent, so one comparison covers
      // both. An unparseable deadline is excluded: it cannot be late.
      urgent: items
        .filter((item) => {
          if (!isOpen(item)) return false;
          const ms = instant(item);
          return ms !== null && ms - now < URGENT_WINDOW_MS;
        })
        .sort(compareByDeadline)
        .slice(0, URGENT_LIMIT),
    };

    return {
      status: state.status,
      error: state.error,
      visibleItems: sorted,
      dashboard,
      stats,
      filters,
      search,
      courseOptions,
      isFiltered: query !== '' || filters.status !== 'all' || filters.type !== 'all' || filters.course !== '',
      reload: load,
      setFilters: (partial) => dispatch({ type: 'filters:set', filters: partial }),
      setSearch: (value) => dispatch({ type: 'search:set', search: value }),
      clearFilters: () => dispatch({ type: 'filters:clear' }),
      create: async (draft) => {
        const result = await createItem(draft);
        dispatch({ type: 'items:replace', items: await listItems() });
        return result;
      },
      update: async (id, draft) => {
        try {
          const result = await updateItem(id, draft);
          dispatch({ type: 'items:replace', items: await listItems() });
          return result;
        } catch (error) {
          if (error instanceof NotFoundError) {
            dispatch({ type: 'items:replace', items: await listItems() });
          }
          throw error;
        }
      },
      setStatus: async (id, nextStatus) => {
        try {
          await setItemStatus(id, nextStatus);
        } catch (error) {
          if (!(error instanceof NotFoundError)) throw error;
        }
        dispatch({ type: 'items:replace', items: await listItems() });
      },
      remove: async (id) => {
        try {
          await deleteItem(id);
        } catch (error) {
          if (!(error instanceof NotFoundError)) throw error;
        }
        dispatch({ type: 'items:replace', items: await listItems() });
      },
    };
  }, [state]);

  return <ItemContext.Provider value={value}>{children}</ItemContext.Provider>;
}

export function useItems(): ItemContextValue {
  const context = useContext(ItemContext);
  if (!context) throw new Error('useItems must be used inside ItemProvider');
  return context;
}

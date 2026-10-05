import { useCallback, useEffect, useState } from 'react';

export type ViewMode = 'list' | 'kanban';

const STORAGE_KEY = 'student-tasks:view';

function readStoredView(): ViewMode {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'kanban' ? 'kanban' : 'list';
  } catch {
    return 'list';
  }
}

export function useViewMode() {
  const [viewMode, setViewMode] = useState<ViewMode>(readStoredView);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, viewMode);
    } catch {
      // Persisting is best-effort; the choice still applies for this session.
    }
  }, [viewMode]);

  const setView = useCallback((next: ViewMode) => setViewMode(next), []);

  return { viewMode, setView };
}

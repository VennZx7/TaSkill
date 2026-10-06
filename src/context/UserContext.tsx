import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  awardXP as awardInService,
  levelFor,
  progressFor,
  readProfile,
  titleFor,
  type AwardResult,
  type LevelTitle,
} from '../services/userService';

interface UserContextValue {
  xp: number;
  level: number;
  title: LevelTitle;
  /** XP into the current level, 0–99. */
  progress: number;
  /** Awards XP and reports whether the level changed. */
  awardXP: (amount: number) => AwardResult;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  // Read once on mount; every award goes through the service, which is
  // the source of truth, so the context never forks the stored total.
  const [xp, setXp] = useState(() => readProfile().xp);

  const awardXP = useCallback((amount: number): AwardResult => {
    const result = awardInService(amount);
    setXp(result.xp);
    return result;
  }, []);

  const value = useMemo<UserContextValue>(() => {
    const level = levelFor(xp);
    return {
      xp,
      level,
      title: titleFor(level),
      progress: progressFor(xp),
      awardXP,
    };
  }, [xp, awardXP]);

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser(): UserContextValue {
  const context = useContext(UserContext);
  if (!context) throw new Error('useUser must be used inside UserProvider');
  return context;
}

import type { ReactNode } from 'react';
import { useUser } from '../context/UserContext';
import { LevelMeter } from './LevelMeter';
import { getStreakCount } from '../services/streakService';
import { BrandMarkIcon, CalendarIcon, CardsIcon, PlayIcon, SparkleIcon, VaultIcon } from './ui/icons';
import styles from './AppShell.module.css';

export type Module = 'dashboard' | 'scheduler' | 'vault' | 'pomodoro' | 'ai' | 'flashcards';

interface AppShellProps {
  module: Module;
  onNavigate: (module: Module) => void;
  actions: ReactNode;
  children: ReactNode;
}

const TABS: { value: Module; label: string; Icon: typeof BrandMarkIcon }[] = [
  { value: 'dashboard', label: 'Beranda', Icon: BrandMarkIcon },
  { value: 'scheduler', label: 'Jadwal', Icon: CalendarIcon },
  { value: 'vault', label: 'Study Vault', Icon: VaultIcon },
  { value: 'pomodoro', label: 'Focus', Icon: PlayIcon },
  { value: 'ai', label: 'AI Assistant', Icon: SparkleIcon },
  { value: 'flashcards', label: 'Quiz', Icon: CardsIcon },
];

export function AppShell({ module, onNavigate, actions, children }: AppShellProps) {
  const { level, title, progress } = useUser();

  return (
    <div className={styles.shell}>
      <header className={styles.navbar}>
        <div className={styles.brand}>
          <span className={styles.mark}>
            <BrandMarkIcon size={20} />
          </span>
          <span className={styles.brandText}>TaSkill</span>
        </div>

        <nav className={styles.nav} aria-label="Modul">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              className={`${styles.navTab} ${module === tab.value ? styles.navTabActive : ''}`.trim()}
              aria-current={module === tab.value ? 'page' : undefined}
              onClick={() => onNavigate(tab.value)}
            >
              <tab.Icon size={16} />
              {tab.label}
            </button>
          ))}
        </nav>

        <div className={styles.actions}>
          <span className={styles.streak} title="Streak harian">
            <span className={styles.fire} aria-hidden="true">🔥</span> {getStreakCount()}
          </span>
          <LevelMeter level={level} title={title} progress={progress} variant="compact" />
          {actions}
        </div>
      </header>

      <main className={styles.main}>{children}</main>
    </div>
  );
}

import type { ReactNode } from 'react';
import { useUser } from '../context/UserContext';
import { LevelMeter } from './LevelMeter';
import { BrandMarkIcon } from './ui/icons';
import styles from './AppShell.module.css';

export type Module = 'dashboard' | 'scheduler' | 'vault' | 'pomodoro' | 'ai' | 'flashcards';

interface AppShellProps {
  module: Module;
  onNavigate: (module: Module) => void;
  actions: ReactNode;
  children: ReactNode;
}

const TABS: { value: Module; label: string }[] = [
  { value: 'dashboard', label: 'Beranda' },
  { value: 'scheduler', label: 'Jadwal' },
  { value: 'vault', label: 'Study Vault' },
  { value: 'pomodoro', label: 'Focus' },
  { value: 'ai', label: 'AI Assistant' },
  { value: 'flashcards', label: 'Flashcards' },
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
              {tab.label}
            </button>
          ))}
        </nav>

        <div className={styles.actions}>
          <LevelMeter level={level} title={title} progress={progress} variant="compact" />
          {actions}
        </div>
      </header>

      <main className={styles.main}>{children}</main>
    </div>
  );
}
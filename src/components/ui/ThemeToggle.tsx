import type { Theme } from '../../hooks/useTheme';
import { MoonIcon, SunIcon } from './icons';
import styles from './ThemeToggle.module.css';

interface ThemeToggleProps {
  theme: Theme;
  onToggle: () => void;
}

export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  const nextLabel = theme === 'dark' ? 'Ganti ke mode terang' : 'Ganti ke mode gelap';

  return (
    <button type="button" className={styles.toggle} onClick={onToggle} aria-label={nextLabel} title={nextLabel}>
      {theme === 'dark' ? <MoonIcon size={16} /> : <SunIcon size={16} />}
    </button>
  );
}

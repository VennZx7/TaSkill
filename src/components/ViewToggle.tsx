import type { ViewMode } from '../hooks/useViewMode';
import { BoardIcon, ListIcon } from './ui/icons';
import styles from './ViewToggle.module.css';

const OPTIONS: { value: ViewMode; label: string; Icon: typeof ListIcon }[] = [
  { value: 'list', label: 'List View', Icon: ListIcon },
  { value: 'kanban', label: 'Kanban View', Icon: BoardIcon },
];

interface ViewToggleProps {
  viewMode: ViewMode;
  onChange: (viewMode: ViewMode) => void;
}

export function ViewToggle({ viewMode, onChange }: ViewToggleProps) {
  return (
    <div className={styles.group} role="group" aria-label="Pilih tampilan">
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = viewMode === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            className={`${styles.option} ${active ? styles.active : ''}`.trim()}
            onClick={() => onChange(value)}
          >
            <Icon size={15} />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

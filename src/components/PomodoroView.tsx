import { formatClock, type PomodoroMode } from '../hooks/usePomodoro';
import { Button } from './ui/Button';
import { PauseIcon, PlayIcon, RefreshIcon } from './ui/icons';
import styles from './PomodoroView.module.css';

const MODES: { value: PomodoroMode; label: string; minutes: number }[] = [
  { value: 'work', label: 'Fokus', minutes: 25 },
  { value: 'short', label: 'Istirahat Short', minutes: 5 },
  { value: 'long', label: 'Istirahat Long', minutes: 15 },
];

const MODE_TITLE: Record<PomodoroMode, string> = {
  work: 'Sesi Fokus',
  short: 'Istirahat Short',
  long: 'Istirahat Long',
};

interface FocusableItem {
  id: string;
  title: string;
}

interface PomodoroViewProps {
  mode: PomodoroMode;
  remaining: number;
  isRunning: boolean;
  taskId: string | null;
  activeTaskTitle: string | null;
  focusableItems: FocusableItem[];
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onModeChange: (mode: PomodoroMode) => void;
  onTaskChange: (id: string | null) => void;
}

export function PomodoroView({
  mode,
  remaining,
  isRunning,
  taskId,
  activeTaskTitle,
  focusableItems,
  onStart,
  onPause,
  onReset,
  onModeChange,
  onTaskChange,
}: PomodoroViewProps) {
  const total = MODES.find((entry) => entry.value === mode)?.minutes ?? 25;
  // Progress as a fraction of the full session; purely visual, no animation loop.
  const progress = 1 - remaining / (total * 60);

  return (
    <section className={styles.root} data-mode={mode} aria-label="Pomodoro focus timer">
      <div className={styles.modes} role="group" aria-label="Mode timer">
        {MODES.map((entry) => {
          const active = mode === entry.value;
          return (
            <button
              key={entry.value}
              type="button"
              className={`${styles.modeTab} ${active ? styles.modeTabActive : ''}`.trim()}
              aria-pressed={active}
              onClick={() => onModeChange(entry.value)}
            >
              {entry.label}
              <span className={styles.modeMinutes}>{entry.minutes} mnt</span>
            </button>
          );
        })}
      </div>

      <div className={styles.clockWrap}>
        <span className={styles.modeTitle}>{MODE_TITLE[mode]}</span>
        {/* aria-live off: announcing every second would flood a screen reader. */}
        <div className={styles.clock} aria-live="off" role="timer" aria-label={`${remaining} detik tersisa`}>
          {formatClock(remaining)}
        </div>

        <div
          className={styles.track}
          role="progressbar"
          aria-label="Kemajuan sesi"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        >
          <span className={styles.fill} style={{ width: `${Math.max(0, Math.min(1, progress)) * 100}%` }} />
        </div>

        <div className={styles.controls}>
          <Button variant="primary" onClick={onStart} disabled={isRunning}>
            <PlayIcon size={16} />
            Start
          </Button>
          <Button onClick={onPause} disabled={!isRunning}>
            <PauseIcon size={16} />
            Pause
          </Button>
          <Button variant="ghost" onClick={onReset}>
            <RefreshIcon size={16} />
            Reset
          </Button>
        </div>
      </div>

      <div className={styles.focus}>
        <label className={styles.focusLabel} htmlFor="pomodoro-task">
          Fokus pada tugas
        </label>
        <select
          id="pomodoro-task"
          className={styles.select}
          value={taskId ?? ''}
          onChange={(event) => onTaskChange(event.target.value === '' ? null : event.target.value)}
        >
          <option value="">Tanpa tugas khusus</option>
          {focusableItems.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </select>

        <p className={styles.focusStatus} role="status">
          {activeTaskTitle ? (
            <>
              Sedang fokus pada: <strong>{activeTaskTitle}</strong>
            </>
          ) : focusableItems.length === 0 ? (
            'Belum ada tugas To Do atau In Progress untuk difokuskan.'
          ) : (
            'Belum memilih tugas fokus.'
          )}
        </p>
      </div>
    </section>
  );
}
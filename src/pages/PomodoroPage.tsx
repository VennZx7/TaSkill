import { useCallback } from 'react';
import { PomodoroView } from '../components/PomodoroView';
import { useToast } from '../components/ui/Toast';
import { useUser } from '../context/UserContext';
import { useItems } from '../context/ItemContext';
import { usePomodoro, type PomodoroMode } from '../hooks/usePomodoro';
import { POMODORO_XP } from '../services/userService';
import { fireConfetti } from '../utils/confetti';

const MODE_MESSAGE: Record<PomodoroMode, string> = {
  work: 'Sesi fokus selesai. Istirahat sejenak.',
  short: 'Istirahat singkat selesai. Lanjutkan fokus.',
  long: 'Istirahat panjang selesai. Sesi fokus berikutnya dimulai.',
};

/**
 * Owns the timer hook so the per-second tick lives entirely inside this page's
 * subtree. Switching modules unmounts it, and the run is restored from storage.
 */
export function PomodoroPage() {
  const toast = useToast();
  const { awardXP } = useUser();
  const { visibleItems } = useItems();

  const onComplete = useCallback(
    (finished: PomodoroMode) => {
      // Only a work session earns XP; breaks are rest, not progress.
      if (finished !== 'work') {
        toast(MODE_MESSAGE[finished]);
        return;
      }
      const result = awardXP(POMODORO_XP);
      toast(`Sesi fokus selesai! +${POMODORO_XP} XP.`);
      if (result.leveledUp) {
        fireConfetti();
        toast(`Naik ke Level ${result.level} — ${result.title}!`);
      }
    },
    [toast, awardXP],
  );

  const timer = usePomodoro(onComplete);

  // Only items still actionable can be focused on; Done work is not a target.
  const focusable = visibleItems.filter((item) => item.status !== 'Done');
  const active = focusable.find((item) => item.id === timer.taskId) ?? null;

  return (
    <PomodoroView
      mode={timer.mode}
      remaining={timer.remaining}
      isRunning={timer.isRunning}
      taskId={timer.taskId}
      activeTaskTitle={active?.title ?? null}
      focusableItems={focusable.map((item) => ({ id: item.id, title: item.title }))}
      onStart={timer.start}
      onPause={timer.pause}
      onReset={timer.reset}
      onModeChange={timer.setMode}
      onTaskChange={timer.setTaskId}
    />
  );
}
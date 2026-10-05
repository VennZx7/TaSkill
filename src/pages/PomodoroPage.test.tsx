import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';
import { ToastProvider } from '../components/ui/Toast';
import type { Item } from '../types/item';

const TASK_KEY = 'student-tasks:v1';
const VAULT_KEY = 'student-tasks:vault';
const TIMER_KEY = 'student-tasks:pomodoro';

function makeItem(overrides: Partial<Item> & Pick<Item, 'id' | 'title'>): Item {
  return {
    type: 'assignment',
    course: 'Kalkulus Lanjut',
    description: '',
    deadline: '2099-01-05T09:00:00+07:00',
    priority: 'Medium',
    status: 'To Do',
    subtasks: [],
    createdAt: '2098-12-01T09:00:00+07:00',
    updatedAt: '2098-12-01T09:00:00+07:00',
    ...overrides,
  };
}

const TASKS: Item[] = [
  makeItem({ id: 'todo', title: 'Tugas 4 — Matriks' }),
  makeItem({ id: 'wip', title: 'UTS Fisika Dasar', status: 'In Progress' }),
  makeItem({ id: 'done', title: 'Tugas 2 — Determinant', status: 'Done' }),
];

function renderApp() {
  return render(
    <ToastProvider>
      <App />
    </ToastProvider>,
  );
}

/**
 * userEvent must be told how to advance the faked clock, otherwise its own
 * internal delays hang forever waiting on a timer that never fires.
 */
function user() {
  return userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
}

async function openFocus(active: ReturnType<typeof user>) {
  await active.click(await screen.findByRole('button', { name: 'Focus' }));
  await screen.findByRole('timer');
}

/** The scheduler list is behind a 180ms service delay; wait it out. */
async function waitForItems() {
  await vi.advanceTimersByTimeAsync(500);
  await waitFor(() =>
    expect(screen.getByLabelText('Fokus pada tugas')).toHaveTextContent('Tugas 4 — Matriks'),
  );
}

/** The clock text, e.g. "25:00". */
function clock(): string {
  return screen.getByRole('timer').textContent ?? '';
}

/** Seconds left on the clock, so a test can measure a delta without guessing. */
function clockSeconds(): number {
  const [minutes, seconds] = clock().split(':').map(Number);
  return minutes * 60 + seconds;
}

/**
 * Runs the clock down to zero, then asserts synchronously. The toast is
 * asserted right after the final tick rather than with findBy: `shouldAdvanceTime`
 * burns real seconds during a slow run, and the toast self-dismisses after 4s.
 */
async function runToEnd(active: ReturnType<typeof user>, totalSeconds: number) {
  await active.click(screen.getByRole('button', { name: /Start/ }));
  await vi.advanceTimersByTimeAsync((totalSeconds - 2) * 1000);
  await vi.advanceTimersByTimeAsync(2000);
}

describe('Pomodoro focus timer', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem(TASK_KEY, JSON.stringify(TASKS));
    window.localStorage.setItem(VAULT_KEY, '[]');
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens with a 25:00 work clock', async () => {
    const active = user();
    renderApp();
    await openFocus(active);

    expect(clock()).toBe('25:00');
    expect(screen.getByRole('button', { name: /Fokus/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('counts down about one second per tick and freezes on pause', async () => {
    const active = user();
    renderApp();
    await openFocus(active);

    await active.click(screen.getByRole('button', { name: /Start/ }));
    const running = await screen.findByText(/2[45]:/);
    expect(running).toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(3000);
    const ticked = clockSeconds();
    // Two or three seconds, never four: the tick recomputes from the stored end
    // instant, so a delayed callback cannot inflate the elapsed time.
    expect(ticked).toBeLessThanOrEqual(25 * 60 - 2);
    expect(ticked).toBeGreaterThanOrEqual(25 * 60 - 4);

    await active.click(screen.getByRole('button', { name: /Pause/ }));
    const frozen = clock();
    await vi.advanceTimersByTimeAsync(2000);
    expect(clock()).toBe(frozen);
  });

  it('resets to the full duration of the current mode', async () => {
    const active = user();
    renderApp();
    await openFocus(active);

    await active.click(screen.getByRole('button', { name: /Start/ }));
    await vi.advanceTimersByTimeAsync(4000);

    await active.click(screen.getByRole('button', { name: /Reset/ }));
    expect(clock()).toBe('25:00');
  });

  it('switches mode to the full break duration and changes the accent', async () => {
    const active = user();
    renderApp();
    await openFocus(active);

    await active.click(screen.getByRole('button', { name: /Istirahat Short/ }));
    expect(clock()).toBe('5:00');
    expect(screen.getByRole('timer').closest('section')).toHaveAttribute('data-mode', 'short');

    await active.click(screen.getByRole('button', { name: /Istirahat Long/ }));
    expect(clock()).toBe('15:00');
    expect(screen.getByRole('timer').closest('section')).toHaveAttribute('data-mode', 'long');
  });

  it('discards a running session when the mode changes', async () => {
    const active = user();
    renderApp();
    await openFocus(active);

    await active.click(screen.getByRole('button', { name: /Start/ }));
    await vi.advanceTimersByTimeAsync(2000);
    await active.click(screen.getByRole('button', { name: /Istirahat Short/ }));

    expect(clock()).toBe('5:00');
    expect(screen.getByRole('button', { name: /Pause/ })).toBeDisabled();
  });

  it('toasts and rolls into a break when a work session ends', async () => {
    const active = user();
    renderApp();
    await openFocus(active);

    await runToEnd(active, 25 * 60);

    expect(screen.getByText(/Sesi fokus selesai/)).toBeInTheDocument();
    // The break starts full and pauses: a finished run must not be auto-started.
    expect(clock()).toBe('5:00');
    expect(screen.getByRole('button', { name: /Pause/ })).toBeDisabled();
    expect(screen.getByRole('timer').closest('section')).toHaveAttribute('data-mode', 'short');
  });

  it('toasts and returns to focus when a break ends', async () => {
    const active = user();
    renderApp();
    await openFocus(active);

    await active.click(screen.getByRole('button', { name: /Istirahat Short/ }));
    await runToEnd(active, 5 * 60);

    expect(screen.getByText(/Istirahat singkat selesai/)).toBeInTheDocument();
    expect(clock()).toBe('25:00');
    expect(screen.getByRole('button', { name: /Pause/ })).toBeDisabled();
    expect(screen.getByRole('timer').closest('section')).toHaveAttribute('data-mode', 'work');
  });

  it('offers only To Do and In Progress items as a focus target', async () => {
    const active = user();
    renderApp();
    await openFocus(active);
    await waitForItems();

    const select = screen.getByLabelText('Fokus pada tugas') as HTMLSelectElement;
    const options = [...select.options].map((option) => option.textContent);

    expect(options).toEqual([
      'Tanpa tugas khusus',
      'Tugas 4 — Matriks',
      'UTS Fisika Dasar',
    ]);
    expect(options).not.toContain('Tugas 2 — Determinant');
  });

  it('names the selected task in the status line', async () => {
    const active = user();
    renderApp();
    await openFocus(active);
    await waitForItems();

    expect(screen.getByText('Belum memilih tugas fokus.')).toBeInTheDocument();

    await active.selectOptions(screen.getByLabelText('Fokus pada tugas'), 'wip');
    expect(screen.getByRole('status')).toHaveTextContent('Sedang fokus pada: UTS Fisika Dasar');
  });

  it('says so when there is nothing focusable', async () => {
    window.localStorage.setItem(TASK_KEY, JSON.stringify([makeItem({ id: 'd', title: 'Selesai', status: 'Done' })]));
    const active = user();
    renderApp();
    await openFocus(active);
    await vi.advanceTimersByTimeAsync(500);

    expect(
      screen.getByText(/Belum ada tugas To Do atau In Progress untuk difokuskan/),
    ).toBeInTheDocument();
  });

  it('resumes a running session from storage on remount', async () => {
    const active = user();
    renderApp();
    await openFocus(active);
    await waitForItems();

    await active.click(screen.getByRole('button', { name: /Start/ }));
    await vi.advanceTimersByTimeAsync(60_000);
    await active.selectOptions(screen.getByLabelText('Fokus pada tugas'), 'todo');
    const before = clock();

    // Navigate away and back: the page unmounts, so only storage can restore it.
    await active.click(screen.getByRole('button', { name: 'Beranda' }));
    await screen.findByRole('heading', { name: 'Ringkasan Kuliah' });
    await active.click(screen.getByRole('button', { name: 'Focus' }));
    await screen.findByRole('timer');

    await waitFor(() => expect(clock()).toBe(before));
    expect(screen.getByRole('button', { name: /Pause/ })).not.toBeDisabled();
    expect(screen.getByLabelText('Fokus pada tugas')).toHaveValue('todo');
  });

  it('does not restart a session that finished while away', async () => {
    window.localStorage.setItem(
      TIMER_KEY,
      JSON.stringify({ mode: 'work', endsAt: Date.now() - 5000, remaining: 0, cycles: 0, taskId: null }),
    );
    const active = user();
    renderApp();
    await openFocus(active);

    expect(clock()).toBe('25:00');
    expect(screen.getByRole('button', { name: /Pause/ })).toBeDisabled();
  });

  it('repairs a corrupt stored session instead of crashing', async () => {
    window.localStorage.setItem(TIMER_KEY, '{rusak');
    const active = user();
    renderApp();
    await openFocus(active);

    expect(clock()).toBe('25:00');
  });

  it('leaves the other modules intact', async () => {
    const active = user();
    renderApp();

    await screen.findByRole('heading', { name: 'Ringkasan Kuliah' });
    await vi.advanceTimersByTimeAsync(500);

    await active.click(screen.getByRole('button', { name: 'Study Vault' }));
    expect(await screen.findByRole('heading', { name: 'Study Vault' })).toBeInTheDocument();
    expect(await screen.findByText(/Vault masih kosong/)).toBeInTheDocument();

    await active.click(screen.getByRole('button', { name: 'Jadwal' }));
    expect(await screen.findByRole('heading', { name: 'Semua item' })).toBeInTheDocument();
  });
});
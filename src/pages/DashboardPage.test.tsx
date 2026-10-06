import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';
import { ToastProvider } from '../components/ui/Toast';
import type { Item } from '../types/item';
import type { VaultItem } from '../types/vault';

const TASK_KEY = 'student-tasks:v1';
const VAULT_KEY = 'student-tasks:vault';

const HOUR_MS = 60 * 60 * 1000;
const NOW = Date.now();

/** A stored deadline relative to now, as the service writes it: UTC + offset. */
function deadlineIn(ms: number): string {
  return new Date(NOW + ms).toISOString();
}

function makeItem(overrides: Partial<Item> & Pick<Item, 'id' | 'title'>): Item {
  return {
    type: 'assignment',
    course: 'Kalkulus Lanjut',
    description: '',
    deadline: deadlineIn(7 * 24 * HOUR_MS),
    priority: 'Medium',
    status: 'To Do',
    subtasks: [],
    createdAt: '2098-12-01T09:00:00+07:00',
    updatedAt: '2098-12-01T09:00:00+07:00',
    ...overrides,
  };
}

const TASKS: Item[] = [
  makeItem({ id: 'overdue', title: 'Tugas 4 — Matriks', deadline: deadlineIn(-3 * HOUR_MS) }),
  makeItem({
    id: 'soon',
    title: 'UTS Fisika Dasar',
    type: 'exam',
    deadline: deadlineIn(20 * HOUR_MS),
    status: 'In Progress',
  }),
  makeItem({ id: 'window', title: 'Kuis Basis Data', deadline: deadlineIn(44 * HOUR_MS) }),
  makeItem({ id: 'later', title: 'Laporan Praktikum', deadline: deadlineIn(10 * 24 * HOUR_MS) }),
  makeItem({
    id: 'finished',
    title: 'Tugas 2 — Determinant',
    status: 'Done',
    deadline: deadlineIn(2 * HOUR_MS),
  }),
];

function makeVaultItem(
  overrides: Partial<VaultItem> & Pick<VaultItem, 'id' | 'title'>,
): VaultItem {
  return {
    course: 'Kalkulus Lanjut',
    urlOrContent: 'Limit dari kiri dan kanan harus sama.',
    type: 'note',
    tags: ['limit'],
    isRead: false,
    createdAt: '2098-12-01T09:00:00.000Z',
    ...overrides,
  };
}

const VAULT: VaultItem[] = [
  makeVaultItem({ id: 'u1', title: 'Catatan Bab 1 — Limit' }),
  makeVaultItem({
    id: 'u2',
    title: 'Kalkulus — Wikipedia',
    type: 'link',
    urlOrContent: 'https://id.wikipedia.org/wiki/Kalkulus',
    createdAt: '2098-12-02T09:00:00.000Z',
  }),
  makeVaultItem({
    id: 'r1',
    title: 'Sudah dibaca saja',
    isRead: true,
    createdAt: '2098-12-03T09:00:00.000Z',
  }),
];

function renderApp() {
  return render(
    <ToastProvider>
      <App />
    </ToastProvider>,
  );
}

async function waitForDashboard() {
  await screen.findByRole('heading', { level: 2, name: 'Tenggat Waktu Dekat' });
}

function rowTitlesIn(name: string): string[] {
  return within(screen.getByRole('region', { name }))
    .getAllByRole('listitem')
    .map((row) => row.querySelector('[class*="rowTitle"]')?.textContent ?? '');
}

describe('Smart Dashboard', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem(TASK_KEY, JSON.stringify(TASKS));
    window.localStorage.setItem(VAULT_KEY, JSON.stringify(VAULT));
  });

  it('is the default view on load', async () => {
    renderApp();

    expect(await screen.findByRole('heading', { name: 'Ringkasan Kuliah' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Beranda' })).toHaveAttribute('aria-current', 'page');
    await waitForDashboard();
  });

  it('shows the level and XP progress on the landing page', async () => {
    window.localStorage.setItem(
      'student-tasks:user',
      JSON.stringify({ xp: 45 }),
    );
    renderApp();
    await waitForDashboard();

    // The navbar carries a compact copy of the same meter, so the
    // banner is scoped to the page content.
    const meter = within(screen.getByRole('main')).getByRole('group', {
      name: 'Level 1 — Pemula',
    });
    expect(meter).toHaveTextContent('Pemula');
    expect(within(meter).getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '45',
    );
    expect(meter).toHaveTextContent('45/100 XP');
  });

  it('shows both stats tiles from the two services', async () => {
    renderApp();
    await waitForDashboard();

    // Five tasks, one already Done.
    const stats = within(screen.getByLabelText('Statistik singkat'));
    expect(stats.getByText('Total Tugas Aktif')).toBeInTheDocument();
    expect(stats.getByText('4')).toBeInTheDocument();
    expect(stats.getByText('Total Materi Tersimpan')).toBeInTheDocument();
    expect(stats.getByText('3')).toBeInTheDocument();
    expect(stats.getByText('2 belum dibaca')).toBeInTheDocument();
  });

  it('lists only overdue and within-48h items, nearest first, skipping Done', async () => {
    renderApp();
    await waitForDashboard();

    const panel = screen.getByRole('region', { name: 'Tenggat Waktu Dekat' });

    expect(rowTitlesIn('Tenggat Waktu Dekat')).toEqual([
      'Tugas 4 — Matriks',
      'UTS Fisika Dasar',
      'Kuis Basis Data',
    ]);
    expect(panel).not.toHaveTextContent('Laporan Praktikum');
    expect(panel).not.toHaveTextContent('Tugas 2 — Determinant');
  });

  it('shows the newest unread vault items only', async () => {
    renderApp();
    await waitForDashboard();

    const panel = screen.getByRole('region', { name: 'Materi Belum Dibaca' });

    expect(rowTitlesIn('Materi Belum Dibaca')).toEqual([
      'Kalkulus — Wikipedia',
      'Catatan Bab 1 — Limit',
    ]);
    expect(panel).not.toHaveTextContent('Sudah dibaca saja');
  });

  it('navigates to the scheduler and the vault from the quick actions', async () => {
    const user = userEvent.setup();
    renderApp();
    await waitForDashboard();

    await user.click(screen.getAllByRole('button', { name: /Lihat Semua Tugas/ })[0]);
    expect(await screen.findByRole('heading', { name: 'Semua item' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Beranda' }));
    await waitForDashboard();

    await user.click(screen.getByRole('button', { name: /Buka Study Vault/ }));
    expect(await screen.findByRole('heading', { name: 'Study Vault' })).toBeInTheDocument();
  });

  it('keeps dashboard counts independent of scheduler filters', async () => {
    const user = userEvent.setup();
    renderApp();
    await waitForDashboard();

    await user.click(screen.getByRole('button', { name: 'Jadwal' }));
    await screen.findAllByRole('heading', { level: 3 });
    await user.selectOptions(screen.getByLabelText('Jenis'), 'exam');

    await user.click(screen.getByRole('button', { name: 'Beranda' }));
    await waitForDashboard();

    // The exam filter must not shrink the landing-page total back to 1.
    const stats = within(screen.getByLabelText('Statistik singkat'));
    expect(stats.getByText('Total Tugas Aktif')).toBeInTheDocument();
    expect(stats.getByText('4')).toBeInTheDocument();
  });

  it('reports an empty urgent window without an error state', async () => {
    window.localStorage.setItem(
      TASK_KEY,
      JSON.stringify([makeItem({ id: 'calm', title: 'Jauh nanti', deadline: deadlineIn(20 * 24 * HOUR_MS) })]),
    );
    renderApp();
    await waitForDashboard();

    expect(screen.getByText(/Tidak ada tenggat dalam 48 jam/)).toBeInTheDocument();
  });

  it('reports an empty vault distinctly from an empty urgent window', async () => {
    window.localStorage.setItem(VAULT_KEY, '[]');
    renderApp();
    await waitForDashboard();

    expect(screen.getByText('Vault masih kosong.')).toBeInTheDocument();
  });

  it('says everything is read when only read items remain', async () => {
    window.localStorage.setItem(
      VAULT_KEY,
      JSON.stringify([makeVaultItem({ id: 'r', title: 'Sudah dibaca', isRead: true })]),
    );
    renderApp();
    await waitForDashboard();

    expect(screen.getByText('Semua materi sudah dibaca.')).toBeInTheDocument();
  });

  it('shows one retryable error state when either module is broken', async () => {
    window.localStorage.setItem(VAULT_KEY, '{rusak');
    renderApp();

    expect(await screen.findByText('Gagal memuat data')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Coba lagi/ })).toBeInTheDocument();
  });
});
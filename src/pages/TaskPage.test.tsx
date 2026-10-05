import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ItemProvider } from '../context/ItemContext';
import { ToastProvider } from '../components/ui/Toast';
import { TaskPage } from './HomePage';
import type { Item, TaskStatus } from '../types/item';

const STORAGE_KEY = 'student-tasks:v1';

function makeItem(overrides: Partial<Item> & Pick<Item, 'id' | 'title'>): Item {
  return {
    type: 'assignment',
    course: 'Kalkulus Lanjut',
    description: '',
    deadline: '2099-01-01T09:00:00+07:00',
    priority: 'Medium',
    status: 'To Do',
    subtasks: [],
    createdAt: '2098-12-01T09:00:00+07:00',
    updatedAt: '2098-12-01T09:00:00+07:00',
    ...overrides,
  };
}

const SEED: Item[] = [
  makeItem({
    id: 'far',
    title: 'Tugas 3 — Matriks dan Determinan',
    deadline: '2099-03-01T09:00:00+07:00',
  }),
  makeItem({
    id: 'near',
    title: 'Kuis Pemrograman Berorientasi Objek',
    course: 'Pemrograman Berorientasi Objek',
    deadline: '2099-01-05T09:00:00+07:00',
    status: 'In Progress',
  }),
  makeItem({
    id: 'exam',
    title: 'UTS Aljabar Linear',
    course: 'Aljabar Linear',
    type: 'exam',
    deadline: '2099-01-10T09:00:00+07:00',
    status: 'Done',
  }),
];

function renderPage() {
  return render(
    <ToastProvider>
      <ItemProvider>
        <TaskPage />
      </ItemProvider>
    </ToastProvider>,
  );
}

/** Card titles are the only level-3 headings on the page. */
async function cardTitles(): Promise<string[]> {
  const headings = await screen.findAllByRole('heading', { level: 3 });
  return headings.map((node) => node.textContent ?? '');
}

function column(name: string) {
  return within(screen.getByLabelText(name));
}

async function switchToKanban(user: ReturnType<typeof userEvent.setup>) {
  // Wait for real data first: the toggle is reachable while still loading, and
  // the board would then show skeletons instead of columns.
  await screen.findAllByRole('heading', { level: 3 });
  await user.click(screen.getByRole('button', { name: /Kanban View/ }));
}

describe('dual view modes', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED));
  });

  it('lists items by nearest deadline first', async () => {
    renderPage();

    expect(await cardTitles()).toEqual([
      'Kuis Pemrograman Berorientasi Objek',
      'UTS Aljabar Linear',
      'Tugas 3 — Matriks dan Determinan',
    ]);
  });

  it('groups items into the three status columns in kanban view', async () => {
    const user = userEvent.setup();
    renderPage();
    await switchToKanban(user);

    expect(await column('To Do').findByText('Tugas 3 — Matriks dan Determinan')).toBeInTheDocument();
    expect(column('In Progress').getByText('Kuis Pemrograman Berorientasi Objek')).toBeInTheDocument();
    expect(column('Done').getByText('UTS Aljabar Linear')).toBeInTheDocument();
    expect(column('Done').queryByText('Tugas 3 — Matriks dan Determinan')).toBeNull();
  });

  it('moves an item between columns and persists the new status', async () => {
    const user = userEvent.setup();
    renderPage();
    await switchToKanban(user);

    const picker = await column('To Do').findByLabelText(
      'Status untuk Tugas 3 — Matriks dan Determinan',
    );
    await user.selectOptions(picker, 'In Progress');

    expect(
      await column('In Progress').findByText('Tugas 3 — Matriks dan Determinan'),
    ).toBeInTheDocument();
    expect(column('To Do').queryByText('Tugas 3 — Matriks dan Determinan')).toBeNull();

    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) as string) as Item[];
    const moved = stored.find((item) => item.id === 'far');
    expect(moved?.status).toBe<TaskStatus>('In Progress');
  });
});

describe('search and filters', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED));
  });

  it('narrows the list by title', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findAllByRole('heading', { level: 3 });

    await user.type(screen.getByLabelText('Cari'), 'matriks');

    expect(await cardTitles()).toEqual(['Tugas 3 — Matriks dan Determinan']);
  });

  it('narrows the list by course', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findAllByRole('heading', { level: 3 });

    await user.type(screen.getByLabelText('Cari'), 'aljabar');

    expect(await cardTitles()).toEqual(['UTS Aljabar Linear']);
  });

  it('shows only exams when the type filter is set', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findAllByRole('heading', { level: 3 });

    await user.selectOptions(screen.getByLabelText('Jenis'), 'exam');

    expect(await cardTitles()).toEqual(['UTS Aljabar Linear']);
  });

  it('composes search with the type filter and resets together', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findAllByRole('heading', { level: 3 });

    await user.selectOptions(screen.getByLabelText('Jenis'), 'exam');
    await user.type(screen.getByLabelText('Cari'), 'aljabar');
    expect(await cardTitles()).toEqual(['UTS Aljabar Linear']);

    await user.selectOptions(screen.getByLabelText('Jenis'), 'all');
    expect(await cardTitles()).toEqual(['UTS Aljabar Linear']);

    await user.click(screen.getByRole('button', { name: /Reset filter/ }));
    expect(await cardTitles()).toHaveLength(3);
  });

  it('explains an empty search result', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findAllByRole('heading', { level: 3 });

    await user.type(screen.getByLabelText('Cari'), 'tidak-ada-hasilnya');

    expect(await screen.findByText('Tidak ada item yang cocok')).toBeInTheDocument();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';
import { ToastProvider } from '../components/ui/Toast';

const DECK_KEY = 'student-tasks:flashcards';
const VAULT_KEY = 'student-tasks:vault';
const GEMINI_KEY = 'student-tasks:gemini-key';

const DECK = {
  id: 'd1',
  title: 'Kalkulus Lanjut — Limit',
  vaultItemId: 'v1',
  cards: [
    { id: 'c1', question: 'Apa syarat kontinu di x = a?', answer: 'Limit kiri sama dengan limit kanan.' },
    { id: 'c2', question: 'Kapan teorema kontinuitas dipakai?', answer: 'Jika f kontinu di a dan limit g = L.' },
  ],
  createdAt: '2098-10-01T09:00:00.000Z',
  lastStudied: null,
};

const NOTE = {
  id: 'v1',
  title: 'Catatan Bab 1 — Limit',
  course: 'Kalkulus Lanjut',
  urlOrContent: 'Limit dari kiri dan kanan harus sama.',
  type: 'note',
  tags: ['limit'],
  isRead: false,
  createdAt: '2098-10-01T09:00:00.000Z',
};

function storedDecks(): typeof DECK[] {
  return JSON.parse(window.localStorage.getItem(DECK_KEY) as string) as typeof DECK[];
}

function geminiFetch(text: string) {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
    text: async () => '',
  }));
}

async function openFlashcards(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Flashcards' }));
  await screen.findByRole('heading', { name: 'Flashcards' });
}

/** The vault loads through its own service latency, so the option may not be in
 *  the select yet on the first try. */
async function pickNote(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByRole('option', { name: /Catatan Bab 1/ });
  await user.selectOptions(screen.getByLabelText(/Materi sumber/), 'v1');
}

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem(DECK_KEY, JSON.stringify([DECK]));
  window.localStorage.setItem(VAULT_KEY, JSON.stringify([NOTE]));
  window.localStorage.setItem(GEMINI_KEY, 'AIzaTest');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Flashcards module', () => {
  it('lists a saved deck and opens Study Mode on click', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <App />
      </ToastProvider>,
    );
    await openFlashcards(user);

    expect(await screen.findByText('1 deck · 2 kartu tersimpan')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Kalkulus Lanjut — Limit/ }));

    expect(await screen.findByText('Kartu 1 dari 2')).toBeInTheDocument();
    expect(screen.getByText('Apa syarat kontinu di x = a?')).toBeInTheDocument();
    // Entering Study Mode stamps lastStudied and persists it.
    await waitFor(() => expect(storedDecks()[0].lastStudied).not.toBeNull());
  });

  it('flips the card on click and navigates with the controls', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <App />
      </ToastProvider>,
    );
    await openFlashcards(user);
    await user.click(await screen.findByRole('button', { name: /Kalkulus Lanjut — Limit/ }));

    const card = await screen.findByRole('button', { name: /Apa syarat kontinu/ });
    expect(card).toHaveAttribute('aria-pressed', 'false');

    await user.click(card);
    expect(card).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: /Berikutnya/ }));
    expect(screen.getByText('Kartu 2 dari 2')).toBeInTheDocument();
    // Moving lands on the question side, never on a half-answered card.
    expect(screen.getByRole('button', { name: /Kapan teorema/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('button', { name: /Berikutnya/ })).toBeDisabled();
  });

  it('generates a deck from vault material and drops the student into it', async () => {
    const fetchMock = geminiFetch(
      '```json\n[{"question":"Q1","answer":"A1"},{"question":"Q2","answer":"A2"}]\n```',
    );
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    render(
      <ToastProvider>
        <App />
      </ToastProvider>,
    );
    await openFlashcards(user);

    await user.click(screen.getByRole('button', { name: /Generate Flashcards dengan AI/ }));
    await pickNote(user);
    await user.click(screen.getByRole('button', { name: /Buat kartu/ }));

    // The fenced payload parsed into real cards, not into markdown text.
    expect(
      await screen.findByText('Deck "Catatan Bab 1 — Limit — Flashcards" tersimpan dengan 2 kartu.'),
    ).toBeInTheDocument();
    expect(await screen.findByText('Q1')).toBeInTheDocument();

    const saved = storedDecks();
    expect(saved).toHaveLength(2);
    expect(saved[0].cards).toHaveLength(2);
    expect(saved[0].cards.every((card) => card.id.length > 0)).toBe(true);
  });

  it('reports a Gemini failure and saves nothing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 429,
        text: async () => '{}',
      })) as unknown as ReturnType<typeof vi.fn>,
    );

    const user = userEvent.setup();
    render(
      <ToastProvider>
        <App />
      </ToastProvider>,
    );
    await openFlashcards(user);

    await user.click(screen.getByRole('button', { name: /Generate Flashcards dengan AI/ }));
    await pickNote(user);
    await user.click(screen.getByRole('button', { name: /Buat kartu/ }));

    // The failure is reported twice on purpose: inline in the modal and as a Toast.
    expect(await screen.findAllByText('Kuota Gemini habis. Coba lagi nanti.')).toHaveLength(2);
    expect(storedDecks()).toHaveLength(1);
  });

  it('confirms a deck delete by name, then removes it', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <App />
      </ToastProvider>,
    );
    await openFlashcards(user);

    const deck = (await screen.findByRole('button', { name: /Kalkulus Lanjut — Limit/ })).closest(
      'article',
    ) as HTMLElement;
    await user.click(within(deck).getByRole('button', { name: /Hapus/ }));

    expect(
      await screen.findByText(/"Kalkulus Lanjut — Limit" beserta seluruh kartunya akan dihapus./),
    ).toBeInTheDocument();
    expect(storedDecks()).toHaveLength(1);

    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Hapus' }));

    expect(await screen.findByText('Deck "Kalkulus Lanjut — Limit" dihapus.')).toBeInTheDocument();
    expect(storedDecks()).toHaveLength(0);
  });

  it('shows an empty state that starts the generator when no deck exists', async () => {
    window.localStorage.setItem(DECK_KEY, '[]');
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <App />
      </ToastProvider>,
    );
    await openFlashcards(user);

    expect(await screen.findByText('Belum ada deck flashcard')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Generate dengan AI/ }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });
});

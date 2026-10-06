import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';
import { ToastProvider } from '../components/ui/Toast';
import type { VaultItem } from '../types/vault';

const VAULT_KEY = 'student-tasks:vault';
const TASK_KEY = 'student-tasks:v1';

const encoder = new TextEncoder();

/** A minimal one-page PDF whose content stream draws `text`,
 *  so the vault upload path is exercised against a real file. */
function pdfFile(name: string, text: string): File {
  const content = encoder.encode(`BT /F1 12 Tf 72 720 Td (${text}) Tj ET`);
  const segments = [
    '%PDF-1.4\n',
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n',
    '3 0 obj << /Type /Page /Parent 2 0 R /Contents 4 0 R >> endobj\n',
    `4 0 obj << /Length ${content.length} >>\nstream\n`,
  ].map((segment) => encoder.encode(segment));
  const tail = encoder.encode('\nendstream\nendobj\ntrailer << /Root 1 0 R >>\n');
  const total =
    segments.reduce((sum, part) => sum + part.length, 0) +
    content.length +
    tail.length;
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const part of [...segments, content, tail]) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return new File([bytes], name, { type: 'application/pdf' });
}

function makeVaultItem(overrides: Partial<VaultItem> & Pick<VaultItem, 'id' | 'title'>): VaultItem {
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

const SEED: VaultItem[] = [
  makeVaultItem({ id: 'v1', title: 'Catatan Bab 1 — Limit', tags: ['limit', 'uts'] }),
  makeVaultItem({
    id: 'v2',
    title: 'Kalkulus — Wikipedia',
    course: 'Kalkulus Lanjut',
    type: 'link',
    urlOrContent: 'https://id.wikipedia.org/wiki/Kalkulus',
    tags: ['referensi'],
    isRead: true,
    createdAt: '2098-12-02T09:00:00.000Z',
  }),
  makeVaultItem({
    id: 'v3',
    title: 'Soal Past UTS',
    course: 'Aljabar Linear',
    tags: ['uts'],
    createdAt: '2098-12-03T09:00:00.000Z',
  }),
];

function storedVault(): VaultItem[] {
  return JSON.parse(window.localStorage.getItem(VAULT_KEY) as string) as VaultItem[];
}

async function openVault(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Study Vault' }));
  await screen.findByRole('heading', { name: 'Study Vault' });
}

/** Waits out the service latency so later assertions never race the skeleton. */
async function waitForCards() {
  await screen.findAllByRole('heading', { level: 3 });
}

function cardTitles(): string[] {
  return screen.getAllByRole('heading', { level: 3 }).map((node) => node.textContent ?? '');
}

async function openForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getAllByRole('button', { name: /Simpan materi/ })[0]);
  await screen.findByRole('dialog');
}

/** Scopes to the card holding a given title, so ordering never matters. */
function cardFor(title: string) {
  const heading = screen.getByRole('heading', { level: 3, name: title });
  const article = heading.closest('article');
  if (!article) throw new Error(`Card untuk "${title}" tidak ditemukan.`);
  return within(article);
}

/** Form fields live in the dialog; the filter bar has same-named controls. */
function dialog() {
  return within(screen.getByRole('dialog'));
}

async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  values: { title: string; course: string; url: string },
) {
  await user.type(dialog().getByLabelText(/Judul/), values.title);
  await user.type(dialog().getByLabelText(/Mata kuliah/), values.course);
  await user.type(dialog().getByLabelText(/^Tautan/), values.url);
}

describe('Study Vault module', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem(VAULT_KEY, JSON.stringify(SEED));
    window.localStorage.setItem(TASK_KEY, '[]');
  });

  it('navigates from the scheduler to the vault and back', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <App />
      </ToastProvider>,
    );

    await screen.findByText('TaSkill');

    await openVault(user);
    expect(await screen.findByText('Catatan Bab 1 — Limit')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Jadwal' }));
    expect(await screen.findByRole('heading', { name: 'Semua item' })).toBeInTheDocument();
  });

  it('lists newest first and marks read items distinctly', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <App />
      </ToastProvider>,
    );
    await openVault(user);
    await waitForCards();

    expect(cardTitles()).toEqual(['Soal Past UTS', 'Kalkulus — Wikipedia', 'Catatan Bab 1 — Limit']);
    expect(screen.getByText('Sudah dibaca')).toBeInTheDocument();
    expect(screen.getAllByText('Baru')).toHaveLength(2);
  });

  it('filters by tag and course, and clears together', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <App />
      </ToastProvider>,
    );
    await openVault(user);
    await waitForCards();

    await user.selectOptions(screen.getByLabelText('Tag'), 'uts');
    expect(cardTitles()).toEqual(['Soal Past UTS', 'Catatan Bab 1 — Limit']);

    await user.selectOptions(screen.getByLabelText('Mata kuliah'), 'Aljabar Linear');
    expect(cardTitles()).toEqual(['Soal Past UTS']);

    await user.click(screen.getByRole('button', { name: /Reset filter/ }));
    expect(cardTitles()).toHaveLength(3);
  });

  it('searches title and tag, and reports an empty result distinctly', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <App />
      </ToastProvider>,
    );
    await openVault(user);

    await user.type(screen.getByLabelText('Cari materi'), 'wikipedia');
    expect(cardTitles()).toEqual(['Kalkulus — Wikipedia']);

    await user.clear(screen.getByLabelText('Cari materi'));
    await user.type(screen.getByLabelText('Cari materi'), 'referensi');
    expect(cardTitles()).toEqual(['Kalkulus — Wikipedia']);

    await user.clear(screen.getByLabelText('Cari materi'));
    await user.type(screen.getByLabelText('Cari materi'), 'tidak-ada');
    expect(await screen.findByText('Tidak ada materi yang cocok')).toBeInTheDocument();
  });

  it('toggles read state and persists it', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <App />
      </ToastProvider>,
    );
    await openVault(user);
    await waitForCards();

    await user.click(cardFor('Soal Past UTS').getByRole('button', { name: /Tandai dibaca/ }));

    expect(await screen.findByText(/ditandai sudah dibaca/)).toBeInTheDocument();
    expect(storedVault().find((item) => item.id === 'v3')?.isRead).toBe(true);
  });

  it('creates a link with multiple tags entered as chips', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <App />
      </ToastProvider>,
    );
    await openVault(user);
    await waitForCards();
    await openForm(user);

    await fillForm(user, {
      title: 'Kalkulus Lanjut',
      course: 'Kalkulus Lanjut',
      url: 'https://id.wikipedia.org/wiki/Fungsi',
    });

    const tagField = dialog().getByLabelText('Tag');
    await user.type(tagField, 'limit{Enter}');
    await user.type(tagField, 'uts,referensi');

    expect(dialog().getByText('limit')).toBeInTheDocument();
    expect(dialog().getByText('uts')).toBeInTheDocument();

    await user.click(dialog().getByRole('button', { name: 'Simpan' }));

    expect(await screen.findByText('Materi berhasil disimpan.')).toBeInTheDocument();
    const created = storedVault().find((item) => item.title === 'Kalkulus Lanjut');
    expect(created?.tags).toEqual(['limit', 'uts', 'referensi']);
    expect(created?.isRead).toBe(false);
  });

  it('never submits the dialog when Enter is pressed in the tag field', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <App />
      </ToastProvider>,
    );
    await openVault(user);
    await waitForCards();
    await openForm(user);

    await fillForm(user, {
      title: 'Catatan Uji Enter',
      course: 'Fisika Dasar',
      url: 'https://example.org/fisika',
    });

    const tagField = dialog().getByLabelText('Tag');
    await user.type(tagField, 'penting{Enter}');
    await user.type(tagField, '{Enter}');

    // Still open, nothing written yet: Enter added a tag and did not save.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(storedVault()).toHaveLength(3);
  });

  it('blocks an invalid link and toasts that nothing was saved', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <App />
      </ToastProvider>,
    );
    await openVault(user);
    await openForm(user);

    await user.type(dialog().getByLabelText(/Judul/), 'Tanpa scheme');
    await user.type(dialog().getByLabelText(/Mata kuliah/), 'Fisika Dasar');
    await user.type(dialog().getByLabelText(/^Tautan/), 'wikipedia.org');

    await user.click(dialog().getByRole('button', { name: 'Simpan' }));

    expect(await screen.findByText('Tautan tidak valid.')).toBeInTheDocument();
    expect(screen.getByText(/Periksa kembali data/)).toBeInTheDocument();
    expect(storedVault()).toHaveLength(3);
  });

  it('swaps the content field when the type changes to a note', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <App />
      </ToastProvider>,
    );
    await openVault(user);
    await openForm(user);

    // The required-field asterisk lives inside the label, so match by regex.
    expect(dialog().getByLabelText(/^Tautan/)).toBeInTheDocument();

    await user.selectOptions(dialog().getByLabelText(/Jenis/), 'note');
    expect(dialog().getByLabelText(/Isi catatan/)).toBeInTheDocument();
    expect(dialog().queryByLabelText(/^Tautan/)).toBeNull();
  });

  it('saves an uploaded PDF as a document straight from the default form', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <App />
      </ToastProvider>,
    );
    await openVault(user);
    await openForm(user);

    // The upload pill is visible even before the type is switched.
    await user.upload(
      dialog().getByLabelText(/Unggah/),
      pdfFile('uts-kalkulus.pdf', 'Limit dan kontinuitas'),
    );

    expect(await screen.findByText('Konten uts-kalkulus.pdf berhasil dimuat.')).toBeInTheDocument();
    // Receiving a file flips the material to a document on its own.
    expect(dialog().getByLabelText(/Jenis/)).toHaveValue('document');
    expect(dialog().getByLabelText(/Isi dokumen/)).toHaveValue(
      'Limit dan kontinuitas',
    );
    // The file name seeds an empty title.
    expect(dialog().getByLabelText(/Judul/)).toHaveValue('uts-kalkulus');

    await user.clear(dialog().getByLabelText(/Judul/));
    await user.type(dialog().getByLabelText(/Judul/), 'Materi UTS Kalkulus');
    await user.type(dialog().getByLabelText(/Mata kuliah/), 'Kalkulus Lanjut');
    await user.click(dialog().getByRole('button', { name: 'Simpan' }));

    expect(await screen.findByText('Materi berhasil disimpan.')).toBeInTheDocument();
    const created = storedVault().find(
      (item) => item.title === 'Materi UTS Kalkulus',
    );
    expect(created?.type).toBe('document');
    expect(created?.urlOrContent).toBe('Limit dan kontinuitas');
  });

  it('edits an existing item, keeping id and read state', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <App />
      </ToastProvider>,
    );
    await openVault(user);
    await waitForCards();

    await user.click(cardFor('Catatan Bab 1 — Limit').getByRole('button', { name: /Ubah/ }));
    await screen.findByRole('dialog');

    const titleField = dialog().getByLabelText(/Judul/);
    await user.clear(titleField);
    await user.type(titleField, 'Catatan Bab 1 (direvisi)');

    await user.click(dialog().getByRole('button', { name: 'Simpan' }));

    expect(await screen.findByText('Materi berhasil diperbarui.')).toBeInTheDocument();
    const updated = storedVault().find((item) => item.id === 'v1');
    expect(updated?.title).toBe('Catatan Bab 1 (direvisi)');
    expect(updated?.isRead).toBe(false);
  });

  it('confirms a delete by name, then removes it', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <App />
      </ToastProvider>,
    );
    await openVault(user);
    await waitForCards();

    await user.click(cardFor('Soal Past UTS').getByRole('button', { name: /Hapus/ }));

    expect(await screen.findByText(/"Soal Past UTS" akan dihapus permanen dari vault\./)).toBeInTheDocument();
    expect(storedVault()).toHaveLength(3);

    await user.click(dialog().getByRole('button', { name: 'Hapus' }));

    expect(await screen.findByText('Materi berhasil dihapus.')).toBeInTheDocument();
    expect(storedVault()).toHaveLength(2);
    expect(screen.queryByText('Soal Past UTS')).toBeNull();
  });

  it('cancels a delete without touching storage', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <App />
      </ToastProvider>,
    );
    await openVault(user);
    await waitForCards();

    await user.click(cardFor('Soal Past UTS').getByRole('button', { name: /Hapus/ }));
    await user.click(await screen.findByRole('button', { name: 'Batal' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(storedVault()).toHaveLength(3);
  });

  it('shows a retryable error state when the vault payload is corrupt', async () => {
    window.localStorage.setItem(VAULT_KEY, '{rusak');
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <App />
      </ToastProvider>,
    );
    await openVault(user);

    expect(await screen.findByText('Gagal memuat data')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Coba lagi/ })).toBeInTheDocument();
    // The scheduler is untouched by a broken vault.
    await user.click(screen.getByRole('button', { name: 'Jadwal' }));
    expect(await screen.findByText('Belum ada tugas atau ujian')).toBeInTheDocument();
  });
});
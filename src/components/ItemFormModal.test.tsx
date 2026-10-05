import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ItemFormModal } from './ItemFormModal';
import { ToastProvider } from './ui/Toast';
import type { Item, ItemDraft } from '../types/item';

function renderForm(item: Item | null = null, onSubmit = vi.fn()) {
  render(
    <ToastProvider>
      <ItemFormModal
        open
        item={item}
        saving={false}
        formError={null}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    </ToastProvider>,
  );
  return onSubmit;
}

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/Judul/), 'Ujian Tengah Semester Fisika');
  await user.type(screen.getByLabelText(/Mata kuliah/), 'Fisika Dasar');
  await user.type(screen.getByLabelText(/Deadline/), '2099-10-05T09:00');
}

describe('ItemFormModal required fields', () => {
  it('blocks submit and toasts when required fields are empty', async () => {
    const user = userEvent.setup();
    const onSubmit = renderForm();

    await user.click(screen.getByRole('button', { name: /Simpan/ }));

    expect(screen.getByText('Judul wajib diisi.')).toBeInTheDocument();
    expect(screen.getByText('Mata kuliah wajib diisi.')).toBeInTheDocument();
    expect(screen.getByText('Deadline wajib diisi.')).toBeInTheDocument();
    expect(screen.getByText(/Periksa kembali data/)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits a valid assignment', async () => {
    const user = userEvent.setup();
    const onSubmit = renderForm();

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: /Simpan/ }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const draft = onSubmit.mock.calls[0][0] as ItemDraft;
    expect(draft.type).toBe('assignment');
    expect(draft.subtasks).toEqual([]);
  });

  it('warns but still saves a past deadline', async () => {
    const user = userEvent.setup();
    const onSubmit = renderForm();

    await user.type(screen.getByLabelText(/Judul/), 'Tugas Terlambat');
    await user.type(screen.getByLabelText(/Mata kuliah/), 'Aljabar Linear');
    await user.type(screen.getByLabelText(/Deadline/), '2000-01-01T09:00');
    await user.click(screen.getByRole('button', { name: /Simpan/ }));

    expect(screen.getByText(/sudah lewat/)).toBeInTheDocument();
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});

describe('Exam Study Planner', () => {
  it('is hidden for an assignment and appears when the type is switched to exam', async () => {
    const user = userEvent.setup();
    renderForm();

    expect(screen.queryByText('Rencana belajar')).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/Jenis/), 'exam');

    expect(screen.getByText('Rencana belajar')).toBeInTheDocument();
  });

  it('adds, toggles, renames, and removes chapters, then submits them', async () => {
    const user = userEvent.setup();
    const onSubmit = renderForm();

    await user.selectOptions(screen.getByLabelText(/Jenis/), 'exam');
    await fillRequiredFields(user);

    const addInput = screen.getByLabelText('Tambah bab baru');
    await user.type(addInput, 'Bab 1: Limit dan Kontinuitas');
    await user.click(screen.getByRole('button', { name: /^Tambah$/ }));
    await user.type(addInput, 'Bab 2: Turunan');
    await user.click(screen.getByRole('button', { name: /^Tambah$/ }));

    expect(screen.getByDisplayValue('Bab 1: Limit dan Kontinuitas')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Bab 2: Turunan')).toBeInTheDocument();
    expect(screen.getByText('0/2 selesai')).toBeInTheDocument();

    // Toggle the first chapter.
    await user.click(screen.getByLabelText('Tandai "Bab 1: Limit dan Kontinuitas" selesai'));
    expect(screen.getByText('1/2 selesai')).toBeInTheDocument();

    // Rename the second chapter.
    const titleInputs = screen.getAllByLabelText('Nama bab');
    await user.clear(titleInputs[1]);
    await user.type(titleInputs[1], 'Bab 2: Turunan (revisi)');
    expect(screen.getByDisplayValue('Bab 2: Turunan (revisi)')).toBeInTheDocument();

    // Remove the first chapter.
    await user.click(screen.getByLabelText('Hapus "Bab 1: Limit dan Kontinuitas"'));

    await user.click(screen.getByRole('button', { name: /Simpan/ }));

    // A single submit: adding a chapter must never submit the whole item.
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const draft = onSubmit.mock.calls[0][0] as ItemDraft;
    expect(draft.subtasks).toHaveLength(1);
    expect(draft.subtasks[0].title).toBe('Bab 2: Turunan (revisi)');
    expect(draft.subtasks[0].isCompleted).toBe(false);
  });

  it('ignores a blank chapter and keeps duplicates independent', async () => {
    const user = userEvent.setup();
    const onSubmit = renderForm();

    await user.selectOptions(screen.getByLabelText(/Jenis/), 'exam');
    await fillRequiredFields(user);

    const addInput = screen.getByLabelText('Tambah bab baru');
    await user.type(addInput, '   ');
    expect(screen.getByRole('button', { name: /^Tambah$/ })).toBeDisabled();

    await user.type(addInput, 'Latihan soal');
    await user.click(screen.getByRole('button', { name: /^Tambah$/ }));
    await user.type(addInput, 'Latihan soal');
    await user.click(screen.getByRole('button', { name: /^Tambah$/ }));

    const checks = screen.getAllByLabelText(/Tandai "Latihan soal" selesai/);
    expect(checks).toHaveLength(2);

    // Toggling the second must not affect the first.
    await user.click(checks[1]);

    await user.click(screen.getByRole('button', { name: /Simpan/ }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const draft = onSubmit.mock.calls[0][0] as ItemDraft;
    expect(draft.subtasks).toHaveLength(2);
    expect(draft.subtasks[0].isCompleted).toBe(false);
    expect(draft.subtasks[1].isCompleted).toBe(true);
    expect(draft.subtasks[0].id).not.toBe(draft.subtasks[1].id);
  });

  it('prefills the checklist when editing an existing exam', () => {
    const exam: Item = {
      id: 'exam-1',
      type: 'exam',
      title: 'UTS Kalkulus Lanjut',
      course: 'Kalkulus Lanjut',
      description: '',
      deadline: '2026-10-20T08:00:00+07:00',
      priority: 'High',
      status: 'To Do',
      subtasks: [
        { id: 's-1', title: 'Bab 1: Limit dan Kontinuitas', isCompleted: true },
        { id: 's-2', title: 'Bab 2: Turunan', isCompleted: false },
      ],
      createdAt: '2026-10-01T09:00:00+07:00',
      updatedAt: '2026-10-01T09:00:00+07:00',
    };

    renderForm(exam);

    expect(screen.getByDisplayValue('Bab 1: Limit dan Kontinuitas')).toBeInTheDocument();
    expect(screen.getByText('1/2 selesai')).toBeInTheDocument();
  });
});

describe('ItemFormModal layout', () => {
  it('keeps every control reachable inside the dialog', () => {
    renderForm();
    const dialog = screen.getByRole('dialog');

    for (const label of [/Judul/, /Mata kuliah/, /Jenis/, /Deadline/, /Prioritas/, /Status/, /Deskripsi/]) {
      expect(within(dialog).getByLabelText(label)).toBeInTheDocument();
    }
  });
});

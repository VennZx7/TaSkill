import { beforeEach, describe, expect, it } from 'vitest';
import { itemRepository } from './itemRepository';
import { addSubtask, createItem, deleteItem, listItems, removeSubtask, toggleSubtask, updateItem } from './itemService';
import { NotFoundError, ValidationError } from './errors';
import type { ItemDraft } from '../types/item';
import { parseDeadline, sortByDeadline } from '../utils/date';

const STORAGE_KEY = 'student-tasks:v1';

function futureDraft(overrides: Partial<ItemDraft> = {}): ItemDraft {
  const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 7 * 60 * 60 * 1000);
  const pad = (value: number) => String(value).padStart(2, '0');
  const deadline =
    `${future.getUTCFullYear()}-${pad(future.getUTCMonth() + 1)}-${pad(future.getUTCDate())}` +
    `T${pad(future.getUTCHours())}:${pad(future.getUTCMinutes())}`;

  return {
    type: 'assignment',
    title: 'Tugas Kalkulus Lanjut',
    course: 'Kalkulus Lanjut',
    description: 'Soal integral',
    deadline,
    priority: 'Medium',
    status: 'To Do',
    subtasks: [],
    ...overrides,
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('seed and legacy storage', () => {
  it('seeds realistic data when storage has never been written', async () => {
    const items = await listItems();

    expect(items.length).toBeGreaterThan(0);
    expect(items.every((item) => parseDeadline(item.deadline) !== null)).toBe(true);
    expect(items.every((item) => item.deadline.endsWith('+07:00'))).toBe(true);
    expect(items.some((item) => item.type === 'exam' && item.subtasks.length > 0)).toBe(true);
  });

  it('exercises overdue, due-today, and upcoming tiers on first load', async () => {
    const items = await listItems();
    const now = Date.now();

    expect(items.some((item) => parseDeadline(item.deadline)! < now)).toBe(true);
    expect(items.some((item) => parseDeadline(item.deadline)! > now)).toBe(true);
  });

  it('does not re-seed after the student deletes everything', async () => {
    await listItems();
    const emptied = itemRepository.readAll().map((item) => item.id);
    for (const id of emptied) itemRepository.remove(id);

    expect(itemRepository.readAll()).toHaveLength(0);
  });

  it('normalizes a legacy Task[] record that has no type or subtasks', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: 'legacy-1',
          title: 'Tugas Lama',
          course: 'Fisika Dasar',
          description: 'Tanpa type',
          deadline: '2026-10-05T14:00:00+07:00',
          priority: 'High',
          status: 'In Progress',
          createdAt: '2026-10-01T09:00:00+07:00',
          updatedAt: '2026-10-02T09:00:00+07:00',
        },
      ]),
    );

    const [item] = itemRepository.readAll();

    expect(item.type).toBe('assignment');
    expect(item.subtasks).toEqual([]);
    expect(item.title).toBe('Tugas Lama');
  });

  it('raises a typed error for a non-array payload', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ nope: true }));
    expect(() => itemRepository.readAll()).toThrowError(/rusak/i);
  });
});

describe('CRUD', () => {
  it('stamps system fields and refuses drafts that set them', async () => {
    const { item } = await createItem(futureDraft());

    expect(item.id).toBeTruthy();
    expect(parseDeadline(item.createdAt)).not.toBeNull();
    expect(parseDeadline(item.updatedAt)).not.toBeNull();
    expect(item.deadline.endsWith('+07:00')).toBe(true);
  });

  it('preserves id and createdAt on update', async () => {
    const { item } = await createItem(futureDraft());
    const { item: updated } = await updateItem(item.id, futureDraft({ title: 'Judul Baru' }));

    expect(updated.id).toBe(item.id);
    expect(updated.createdAt).toBe(item.createdAt);
    expect(updated.title).toBe('Judul Baru');
  });

  it('raises NotFoundError for an unknown id', async () => {
    await expect(updateItem('tidak-ada', futureDraft())).rejects.toBeInstanceOf(NotFoundError);
  });

  it('deletes only the target item and is safe to repeat', async () => {
    const first = await createItem(futureDraft());
    await createItem(futureDraft({ title: 'Penghapus' }));
    const before = (await listItems()).length;

    await deleteItem(first.item.id);
    const after = await listItems();

    expect(after).toHaveLength(before - 1);
    expect(after.some((item) => item.id === first.item.id)).toBe(false);

    await expect(deleteItem(first.item.id)).resolves.toBeUndefined();
  });
});

describe('subtasks', () => {
  it('toggles completion both ways and persists it', async () => {
    const { item } = await createItem(futureDraft({ type: 'exam' }));
    const withChapter = await addSubtask(item.id, 'Bab 1: Limit dan Kontinuitas');

    const toggled = await toggleSubtask(item.id, withChapter.subtasks[0].id);
    expect(toggled.subtasks[0].isCompleted).toBe(true);

    const back = await toggleSubtask(item.id, withChapter.subtasks[0].id);
    expect(back.subtasks[0].isCompleted).toBe(false);

    const reloaded = itemRepository.readAll().find((entry) => entry.id === item.id);
    expect(reloaded?.subtasks[0].isCompleted).toBe(false);
  });

  it('keeps duplicate titles independent, keyed by id not index', async () => {
    const { item } = await createItem(futureDraft({ type: 'exam' }));
    const first = await addSubtask(item.id, 'Latihan soal');
    const second = await addSubtask(item.id, 'Latihan soal');

    const targetId = second.subtasks[1].id;
    const toggled = await toggleSubtask(item.id, targetId);

    expect(toggled.subtasks[0].isCompleted).toBe(false);
    expect(toggled.subtasks[1].isCompleted).toBe(true);
    expect(first.subtasks[0].id).not.toBe(targetId);
  });

  it('removes only the requested chapter', async () => {
    const { item } = await createItem(futureDraft({ type: 'exam' }));
    const withOne = await addSubtask(item.id, 'Bab 1');
    const withTwo = await addSubtask(item.id, 'Bab 2');

    const removed = await removeSubtask(item.id, withTwo.subtasks[1].id);

    expect(removed.subtasks).toHaveLength(1);
    expect(removed.subtasks[0].id).toBe(withOne.subtasks[0].id);
  });

  it('rejects a blank chapter title', async () => {
    const { item } = await createItem(futureDraft({ type: 'exam' }));
    await expect(addSubtask(item.id, '   ')).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('deadline sorting', () => {
  it('orders by absolute instant, not by insertion or string', () => {
    const items = [
      { deadline: '2026-10-20T09:00:00+07:00', createdAt: '2026-10-01T00:00:00Z' },
      { deadline: '2026-10-05T14:00:00+07:00', createdAt: '2026-10-02T00:00:00Z' },
      { deadline: '2026-10-05T09:00:00+07:00', createdAt: '2026-10-03T00:00:00Z' },
    ];

    const sorted = sortByDeadline(items);

    expect(sorted[0].deadline).toBe('2026-10-05T09:00:00+07:00');
    expect(sorted[1].deadline).toBe('2026-10-05T14:00:00+07:00');
    expect(sorted[2].deadline).toBe('2026-10-20T09:00:00+07:00');
  });

  it('sorts an unparseable deadline last instead of breaking the sort', () => {
    const sorted = sortByDeadline([
      { deadline: 'bukan tanggal', createdAt: '2026-10-01T00:00:00Z' },
      { deadline: '2026-10-05T09:00:00+07:00', createdAt: '2026-10-02T00:00:00Z' },
    ]);

    expect(sorted[0].deadline).toBe('2026-10-05T09:00:00+07:00');
    expect(sorted[1].deadline).toBe('bukan tanggal');
  });

  it('treats an offset-bearing ISO and its UTC equivalent as the same instant', () => {
    // 2026-10-05T14:00:00+07:00 is 2026-10-05T07:00:00Z — the same moment.
    const sorted = sortByDeadline([
      { deadline: '2026-10-05T07:00:00Z', createdAt: '2026-10-02T00:00:00Z' },
      { deadline: '2026-10-05T14:00:00+07:00', createdAt: '2026-10-01T00:00:00Z' },
    ]);

    expect(parseDeadline(sorted[0].deadline)).toBe(parseDeadline(sorted[1].deadline));
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import type { VaultDraft } from '../types/vault';
import { createVaultItem, deleteVaultItem, listVaultItems, setVaultItemRead, updateVaultItem } from './vaultService';

const STORAGE_KEY = 'student-tasks:vault';

function stored(): Array<Record<string, unknown>> {
  return JSON.parse(window.localStorage.getItem(STORAGE_KEY) as string) as Array<Record<string, unknown>>;
}

function draft(overrides: Partial<VaultDraft> = {}): VaultDraft {
  return {
    title: 'Kalkulus — Wikipedia',
    course: 'Kalkulus Lanjut',
    urlOrContent: 'https://id.wikipedia.org/wiki/Kalkulus',
    type: 'link',
    tags: ['referensi'],
    ...overrides,
  };
}

/** A note draft with a deliberately messy tag list for normalization tests. */
function noteDraft(overrides: Partial<VaultDraft> = {}): VaultDraft {
  return draft({
    title: 'Catatan Bab 1 — Limit',
    urlOrContent: 'Limit dari kiri dan kanan harus sama.',
    type: 'note',
    tags: ['limit', 'Limit', 'uts'],
    ...overrides,
  });
}

/** Starts from an explicitly empty vault, so seed data never leaks into a count. */
function emptyVault() {
  window.localStorage.clear();
  window.localStorage.setItem(STORAGE_KEY, '[]');
}

describe('vaultService CRUD', () => {
  beforeEach(emptyVault);

  it('seeds on first run and keeps a cleared vault empty', async () => {
    window.localStorage.clear();
    const seeded = await listVaultItems();
    expect(seeded.length).toBeGreaterThan(0);
    expect(seeded.every((item) => item.type !== undefined)).toBe(true);

    for (const item of seeded) await deleteVaultItem(item.id);

    // An explicit empty array means "the student cleared it", not "first run".
    expect(stored()).toEqual([]);
    expect(await listVaultItems()).toEqual([]);
  });

  it('creates an unread item with a generated id and timestamp', async () => {
    const created = await createVaultItem(draft());

    expect(created.id).toBeTruthy();
    expect(created.isRead).toBe(false);
    expect(Number.isFinite(Date.parse(created.createdAt))).toBe(true);
    expect(stored()).toHaveLength(1);
  });

  it('rejects a blank title and a non-http link', async () => {
    await expect(createVaultItem({ ...draft(), title: '   ' })).rejects.toThrow();
    await expect(createVaultItem({ ...draft(), urlOrContent: 'wikipedia.org' })).rejects.toThrow();
    await expect(
      createVaultItem({ ...draft(), urlOrContent: 'javascript:alert(1)' }),
    ).rejects.toThrow();
    expect(stored()).toHaveLength(0);
  });

  it('normalizes tags: trims, blanks out, and dedupes case-insensitively', async () => {
    const created = await createVaultItem({ ...noteDraft(), tags: ['  limit  ', 'LIMIT', '', 'uts', 'limit'] });

    expect(created.tags).toEqual(['limit', 'uts']);
  });

  it('preserves id, isRead, and createdAt on update', async () => {
    const created = await createVaultItem(noteDraft());
    await setVaultItemRead(created.id, true);

    const updated = await updateVaultItem(created.id, {
      ...noteDraft(),
      title: 'Catatan Bab 1 — Limit dan Kontinuitas',
    });

    expect(updated.id).toBe(created.id);
    expect(updated.isRead).toBe(true);
    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.title).toBe('Catatan Bab 1 — Limit dan Kontinuitas');
  });

  it('toggles read state both ways and persists it', async () => {
    const created = await createVaultItem(noteDraft());

    expect((await setVaultItemRead(created.id, true)).isRead).toBe(true);
    expect((await setVaultItemRead(created.id, false)).isRead).toBe(false);
    expect(stored()[0].isRead).toBe(false);
  });

  it('deletes only the target and is safe to repeat', async () => {
    const keep = await createVaultItem(draft());
    const drop = await createVaultItem(noteDraft());

    await deleteVaultItem(drop.id);
    await deleteVaultItem(drop.id);

    const remaining = await listVaultItems();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(keep.id);
  });

  it('throws NotFoundError for an unknown id instead of writing a blank record', async () => {
    const before = stored().length;
    await expect(updateVaultItem('tidak-ada', noteDraft())).rejects.toThrow(/tidak ditemukan/i);
    await expect(setVaultItemRead('tidak-ada', true)).rejects.toThrow(/tidak ditemukan/i);
    expect(stored()).toHaveLength(before);
  });
});

describe('vaultService repair of stored records', () => {
  it('repairs a partial record and rejects a malformed payload', async () => {
    window.localStorage.clear();
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { id: 'a', title: 'Sains', course: 'Fisika Dasar', tags: 'bukan-array', isRead: 'ya' },
        { title: 'tanpa id' },
        'bukan objek',
      ]),
    );

    const items = await listVaultItems();

    expect(items).toHaveLength(1);
    expect(items[0].type).toBe('note');
    expect(items[0].tags).toEqual([]);
    expect(items[0].isRead).toBe(false);
    expect(items[0].urlOrContent).toBe('');
    expect(Number.isFinite(Date.parse(items[0].createdAt))).toBe(true);

    window.localStorage.setItem(STORAGE_KEY, '{bukan json');
    await expect(listVaultItems()).rejects.toThrow(/rusak/i);
  });
});
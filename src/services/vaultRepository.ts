import { isVaultType, type VaultItem } from '../types/vault';
import { StorageError, readJson, writeJson } from './localStorage';
import { buildSeedVaultItems } from './vaultSeed';

const STORAGE_KEY = 'student-tasks:vault';

/** Caps a hand-edited or corrupted record so one bad entry cannot flood the UI. */
const MAX_TAGS = 12;

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const clean = entry.trim();
    if (clean.length === 0) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(clean);
    if (tags.length === MAX_TAGS) break;
  }
  return tags;
}

/** Repairs a stored record so a partial entry becomes a valid VaultItem. */
function normalizeItem(value: unknown): VaultItem | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;

  if (typeof raw.id !== 'string' || !raw.id) return null;
  if (typeof raw.title !== 'string') return null;
  if (typeof raw.course !== 'string') return null;

  return {
    id: raw.id,
    title: raw.title,
    course: raw.course,
    urlOrContent: typeof raw.urlOrContent === 'string' ? raw.urlOrContent : '',
    type: isVaultType(raw.type) ? raw.type : 'note',
    tags: normalizeTags(raw.tags),
    isRead: raw.isRead === true,
    createdAt:
      typeof raw.createdAt === 'string' && Number.isFinite(Date.parse(raw.createdAt))
        ? raw.createdAt
        : new Date().toISOString(),
  };
}

function parseStored(raw: unknown): VaultItem[] {
  if (!Array.isArray(raw)) {
    throw new StorageError('malformed', 'Data vault tersimpan rusak dan tidak dapat dibaca.');
  }
  return raw.flatMap((entry) => {
    const item = normalizeItem(entry);
    return item ? [item] : [];
  });
}

function loadAll(): VaultItem[] {
  const raw = readJson<unknown>(STORAGE_KEY);

  // An absent key means a genuine first run, so seed it. A key holding an empty
  // array means the student cleared the vault, which we must not undo.
  if (raw === null) {
    const seeded = buildSeedVaultItems();
    writeJson(STORAGE_KEY, seeded);
    return seeded;
  }

  return parseStored(raw);
}

function saveAll(items: VaultItem[]): void {
  writeJson(STORAGE_KEY, items);
}

export const vaultRepository = {
  readAll(): VaultItem[] {
    return loadAll();
  },

  insert(item: VaultItem): VaultItem[] {
    const items = loadAll();
    items.unshift(item);
    saveAll(items);
    return items;
  },

  update(item: VaultItem): VaultItem[] {
    const items = loadAll();
    const index = items.findIndex((entry) => entry.id === item.id);
    if (index !== -1) {
      items[index] = item;
      saveAll(items);
    }
    return items;
  },

  remove(id: string): VaultItem[] {
    const remaining = loadAll().filter((item) => item.id !== id);
    saveAll(remaining);
    return remaining;
  },
};
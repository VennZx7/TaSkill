import type { VaultDraft, VaultItem } from '../types/vault';
import { createId } from '../utils/id';
import { validateVaultDraft } from '../utils/validation';
import { NotFoundError, ValidationError } from './errors';
import { SERVICE_LATENCY_MS as LATENCY_MS, toServiceError, wait } from './shared';
import { vaultRepository } from './vaultRepository';

/** Validates a draft and returns the cleaned value, or throws a typed error. */
function prepare(draft: VaultDraft): VaultDraft {
  const result = validateVaultDraft(draft);
  if (!result.ok) throw new ValidationError(result.errors);
  return result.value;
}

function findOrThrow(id: string): VaultItem {
  const found = vaultRepository.readAll().find((item) => item.id === id);
  if (!found) throw new NotFoundError('Materi tidak ditemukan. Mungkin sudah dihapus.');
  return found;
}

export async function listVaultItems(): Promise<VaultItem[]> {
  await wait(LATENCY_MS);
  try {
    return vaultRepository.readAll();
  } catch (error) {
    throw toServiceError(error);
  }
}

export async function createVaultItem(draft: VaultDraft): Promise<VaultItem> {
  await wait(LATENCY_MS);
  const value = prepare(draft);

  const item: VaultItem = {
    id: createId(),
    title: value.title,
    course: value.course,
    urlOrContent: value.urlOrContent,
    type: value.type,
    tags: value.tags,
    // Read state is system-owned: a freshly saved material has not been read.
    isRead: false,
    createdAt: new Date().toISOString(),
  };

  try {
    vaultRepository.insert(item);
  } catch (error) {
    throw toServiceError(error);
  }
  return item;
}

export async function updateVaultItem(id: string, draft: VaultDraft): Promise<VaultItem> {
  await wait(LATENCY_MS);
  const existing = findOrThrow(id);
  const value = prepare(draft);

  const item: VaultItem = {
    ...existing,
    title: value.title,
    course: value.course,
    urlOrContent: value.urlOrContent,
    type: value.type,
    tags: value.tags,
  };

  try {
    vaultRepository.update(item);
  } catch (error) {
    throw toServiceError(error);
  }
  return item;
}

export async function deleteVaultItem(id: string): Promise<void> {
  await wait(LATENCY_MS);
  try {
    vaultRepository.remove(id);
  } catch (error) {
    throw toServiceError(error);
  }
}

export async function setVaultItemRead(id: string, isRead: boolean): Promise<VaultItem> {
  await wait(LATENCY_MS);
  const next: VaultItem = { ...findOrThrow(id), isRead };
  try {
    vaultRepository.update(next);
  } catch (error) {
    throw toServiceError(error);
  }
  return next;
}
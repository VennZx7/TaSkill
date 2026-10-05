export type StorageErrorCode = 'unavailable' | 'quota' | 'malformed';

/** A storage failure surfaced with a user-safe message. */
export class StorageError extends Error {
  readonly code: StorageErrorCode;

  constructor(code: StorageErrorCode, message: string) {
    super(message);
    this.name = 'StorageError';
    this.code = code;
  }
}

let availability: boolean | null = null;

export function isStorageAvailable(): boolean {
  if (availability !== null) return availability;
  try {
    const probe = '__kilostudent_probe__';
    window.localStorage.setItem(probe, probe);
    window.localStorage.removeItem(probe);
    availability = true;
  } catch {
    availability = false;
  }
  return availability;
}

export function readJson<T>(key: string): T | null {
  if (!isStorageAvailable()) {
    throw new StorageError('unavailable', 'Penyimpanan browser tidak tersedia.');
  }

  let raw: string | null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    throw new StorageError('unavailable', 'Penyimpanan browser tidak dapat diakses.');
  }

  if (raw === null) return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new StorageError('malformed', 'Data tersimpan rusak dan tidak dapat dibaca.');
  }
}

export function writeJson(key: string, value: unknown): void {
  if (!isStorageAvailable()) {
    throw new StorageError('unavailable', 'Penyimpanan browser tidak tersedia.');
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    throw new StorageError('quota', 'Penyimpanan penuh. Hapus sebagian task lalu coba lagi.');
  }
}

import { StorageError } from './localStorage';
import { TaskServiceError } from './errors';

/** Deliberate delay so loading states are real, not theoretical. */
export const SERVICE_LATENCY_MS = 180;

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** The single boundary where a thrown error becomes a displayable one. */
export function toServiceError(error: unknown): TaskServiceError {
  if (error instanceof StorageError) {
    return new TaskServiceError(error.message, error);
  }
  return new TaskServiceError('Terjadi kesalahan tak terduga. Coba lagi.', error);
}
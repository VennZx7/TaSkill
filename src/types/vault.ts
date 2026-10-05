export const VAULT_TYPES = ['link', 'note', 'document'] as const;

export type VaultType = (typeof VAULT_TYPES)[number];

export const VAULT_TYPE_LABEL: Record<VaultType, string> = {
  link: 'Tautan',
  note: 'Catatan',
  document: 'Dokumen',
};

/** Label shown under the type badge when the material is a URL. */
export const VAULT_TYPE_HINT: Record<VaultType, string> = {
  link: 'Alamat URL',
  note: 'Catatan Anda',
  document: 'Nama berkas atau lokasi',
};

/**
 * A saved study material. `urlOrContent` is deliberately a single field: for a
 * link it holds the address, for a note or document the student's own text. One
 * field keeps the shape uniform instead of branching on two nullable columns.
 */
export interface VaultItem {
  id: string;
  title: string;
  course: string;
  urlOrContent: string;
  type: VaultType;
  tags: string[];
  isRead: boolean;
  /** ISO-8601 UTC. Newest first. */
  createdAt: string;
}

/**
 * A link holds a URL, not prose, so it cannot be sent to Gemini as study
 * context. Both the assistant and the flashcard generator accept the same two
 * kinds, so the rule lives next to the type instead of in each caller.
 */
export function isStudyMaterial(item: VaultItem): boolean {
  return item.type === 'note' || item.type === 'document';
}

/** The only fields a form may set. `id`, `isRead`, and `createdAt` are absent by design. */
export interface VaultDraft {
  title: string;
  course: string;
  urlOrContent: string;
  type: VaultType;
  tags: string[];
}

export function isVaultType(value: unknown): value is VaultType {
  return typeof value === 'string' && (VAULT_TYPES as readonly string[]).includes(value);
}

export function emptyVaultDraft(): VaultDraft {
  return { title: '', course: '', urlOrContent: '', type: 'link', tags: [] };
}
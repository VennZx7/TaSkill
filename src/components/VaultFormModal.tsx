import { useEffect, useState, type FormEvent } from 'react';
import {
  MAX_VAULT_SOURCES,
  VAULT_TYPES,
  VAULT_TYPE_HINT,
  VAULT_TYPE_LABEL,
  combineSources,
  emptyVaultDraft,
  splitSections,
  type VaultDraft,
  type VaultItem,
  type VaultType,
} from '../types/vault';
import { readTextFile, type LoadedDocument } from '../utils/documentLoader';
import { TITLE_MAX_LENGTH, validateVaultDraft } from '../utils/validation';
import { TagInput } from './TagInput';
import { Button } from './ui/Button';
import { Input, Select, Textarea } from './ui/Field';
import { UploadIcon } from './ui/icons';
import { Modal } from './ui/Modal';
import { useToast } from './ui/Toast';
import styles from './VaultFormModal.module.css';

export function toVaultDraft(item: VaultItem): VaultDraft {
  return {
    title: item.title,
    course: item.course,
    urlOrContent: item.urlOrContent,
    type: item.type,
    tags: [...item.tags],
    sources: (item.sources ?? []).map((source) => ({ ...source })),
  };
}

interface VaultFormModalProps {
  open: boolean;
  item: VaultItem | null;
  saving: boolean;
  formError: string | null;
  onClose: () => void;
  onSubmit: (draft: VaultDraft) => void;
}

export function VaultFormModal({
  open,
  item,
  saving,
  formError,
  onClose,
  onSubmit,
}: VaultFormModalProps) {
  const [draft, setDraft] = useState<VaultDraft>(emptyVaultDraft);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    setDraft(item ? toVaultDraft(item) : emptyVaultDraft());
    setErrors({});
    setIsLoadingFile(false);
  }, [open, item]);

  const update = <K extends keyof VaultDraft>(key: K, value: VaultDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const submit = () => {
    const result = validateVaultDraft(draft);
    if (!result.ok) {
      setErrors(result.errors);
      // Field errors show inline; the toast confirms nothing was saved.
      toast({ message: 'Periksa kembali data yang belum lengkap.', tone: 'warning' });
      return;
    }
    setErrors({});
    onSubmit(result.value);
  };

  const handleFormSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit();
  };

  // Each file contributes its extracted text (never the binary), under a
  // "=== nama ===" header so Gemini can tell the files apart.
  const handleFilesChosen = async (files: File[]) => {
    const existing = draft.sources ?? [];
    const room = MAX_VAULT_SOURCES - existing.length;
    if (room <= 0) {
      toast({ message: `Maksimal ${MAX_VAULT_SOURCES} berkas per materi.`, tone: 'warning' });
      return;
    }
    if (files.length > room) {
      toast({
        message: `Hanya ${room} berkas pertama yang diambil (maks ${MAX_VAULT_SOURCES}).`,
        tone: 'warning',
      });
    }

    setIsLoadingFile(true);
    const loaded: LoadedDocument[] = [];
    for (const file of files.slice(0, room)) {
      try {
        loaded.push(await readTextFile(file));
      } catch (error) {
        toast({
          message: `${file.name}: ${error instanceof Error ? error.message : 'gagal dimuat.'}`,
          tone: 'error',
        });
      }
    }
    setIsLoadingFile(false);
    if (loaded.length === 0) return;

    setDraft((current) => {
      // A link is an address, not study text, so it is never merged in.
      const base = current.type === 'link' ? '' : current.urlOrContent.trim();
      const added = combineSources(loaded);
      return {
        ...current,
        type: 'document',
        urlOrContent: base ? `${base}\n\n${added}` : added,
        sources: [
          ...(current.type === 'link' ? [] : (current.sources ?? [])),
          ...loaded.map((doc) => ({
            name: doc.name,
            chars: doc.text.length,
            ...(doc.pageCount !== undefined ? { pageCount: doc.pageCount } : {}),
          })),
        ],
        title:
          current.title.trim().length > 0
            ? current.title
            : loaded.length === 1
              ? loaded[0].name.replace(/\.[^.]+$/, '')
              : 'Kumpulan materi',
      };
    });
    toast({ message: `${loaded.length} berkas dimuat.`, tone: 'success' });
  };

  const removeSource = (index: number) => {
    const sources = draft.sources ?? [];
    const sections = splitSections(draft.urlOrContent);
    // Only safe while the text still has exactly one section per file.
    if (sections.length !== sources.length) {
      toast({
        message: 'Teks sudah diubah manual. Hapus bagian berkas itu langsung di kolom isi.',
        tone: 'warning',
      });
      return;
    }
    setDraft((current) => ({
      ...current,
      sources: sources.filter((_, i) => i !== index),
      urlOrContent: sections.filter((_, i) => i !== index).join('\n\n'),
    }));
  };

  // The control follows the type: a link needs a URL field with url
  // validation, while a note or document holds prose — typed or
  // read out of uploaded files.
  const isLink = draft.type === 'link';
  const sources = draft.sources ?? [];

  return (
    <Modal
      open={open}
      title={item ? 'Ubah materi' : 'Simpan materi'}
      description={
        item ? item.title : 'Kumpulkan catatan, tautan, dan dokumen referensi dalam satu tempat.'
      }
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>
            Batal
          </Button>
          <Button variant="primary" onClick={submit} disabled={saving}>
            {saving ? 'Menyimpan…' : 'Simpan'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleFormSubmit} noValidate>
        {formError ? (
          <div className={styles.formError} role="alert">
            {formError}
          </div>
        ) : null}

        <div className={styles.row}>
          <Select
            label="Jenis"
            required
            value={draft.type}
            error={errors.type}
            onChange={(event) => update('type', event.target.value as VaultType)}
          >
            {VAULT_TYPES.map((type) => (
              <option key={type} value={type}>
                {VAULT_TYPE_LABEL[type]}
              </option>
            ))}
          </Select>

          <Input
            label="Mata kuliah"
            required
            value={draft.course}
            error={errors.course}
            onChange={(event) => update('course', event.target.value)}
          />
        </div>

        <Input
          label="Judul"
          required
          maxLength={TITLE_MAX_LENGTH + 20}
          value={draft.title}
          error={errors.title}
          hint={`Maksimal ${TITLE_MAX_LENGTH} karakter`}
          onChange={(event) => update('title', event.target.value)}
        />

        {/* Uploading is the primary way to save a document, so the
            pill stays visible on every type; picking files flips
            the material to a document on its own. */}
        <div className={styles.fileRow}>
          <label className={styles.fileLabel}>
            <UploadIcon size={14} />
            <span>
              {isLoadingFile
                ? 'Membaca berkas…'
                : `Unggah berkas (${sources.length}/${MAX_VAULT_SOURCES}) — .txt .md .pdf .docx .xlsx .csv`}
            </span>
            <input
              type="file"
              multiple
              accept=".txt,.md,.pdf,.docx,.xlsx,.csv,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              className={styles.fileInput}
              disabled={isLoadingFile}
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                if (files.length > 0) void handleFilesChosen(files);
                // Reset so picking the same file twice still fires a change.
                event.target.value = '';
              }}
            />
          </label>
        </div>

        {errors.sources ? (
          <p className={styles.formError} role="alert">
            {errors.sources}
          </p>
        ) : null}

        {sources.length > 0 ? (
          <ul className={styles.sourceList}>
            {sources.map((source, index) => (
              <li key={`${source.name}-${index}`} className={styles.fileName}>
                <span title={source.name}>
                  {source.name}
                  {source.pageCount ? ` · ${source.pageCount} hlm` : ''}
                </span>
                <button
                  type="button"
                  aria-label={`Hapus ${source.name}`}
                  onClick={() => removeSource(index)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {isLink ? (
          <Input
            label="Tautan"
            type="url"
            required
            value={draft.urlOrContent}
            error={errors.urlOrContent}
            hint="Alamat lengkap, diawali http:// atau https://"
            placeholder="https://…"
            onChange={(event) => update('urlOrContent', event.target.value)}
          />
        ) : (
          <Textarea
            label={draft.type === 'note' ? 'Isi catatan' : 'Isi dokumen'}
            required
            rows={5}
            value={draft.urlOrContent}
            error={errors.urlOrContent}
            placeholder={VAULT_TYPE_HINT[draft.type]}
            onChange={(event) => update('urlOrContent', event.target.value)}
          />
        )}

        <TagInput
          label="Tag"
          tags={draft.tags}
          hint="Tekan Enter atau koma untuk menambah tag. Bisa juga tempel daftar tag sekaligus."
          onChange={(tags) => update('tags', tags)}
        />
      </form>
    </Modal>
  );
}
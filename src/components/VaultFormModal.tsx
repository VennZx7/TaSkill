import { useEffect, useState, type FormEvent } from 'react';
import {
  VAULT_TYPES,
  VAULT_TYPE_HINT,
  VAULT_TYPE_LABEL,
  emptyVaultDraft,
  type VaultDraft,
  type VaultItem,
  type VaultType,
} from '../types/vault';
import { readTextFile } from '../utils/documentLoader';
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
  const [fileName, setFileName] = useState<string | null>(null);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    setDraft(item ? toVaultDraft(item) : emptyVaultDraft());
    setErrors({});
    setFileName(null);
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

  // A document stores its extracted text, not the binary: that is
  // what makes the material usable as study context and flashcard
  // source. The file name only labels the upload.
  const handleFileChosen = async (file: File) => {
    setIsLoadingFile(true);
    try {
      const loaded = await readTextFile(file);
      update('urlOrContent', loaded.text);
      if (draft.title.trim().length === 0) {
        update('title', loaded.name.replace(/\.[^.]+$/, ''));
      }
      setFileName(loaded.name);
      toast({ message: `Konten ${loaded.name} berhasil dimuat.`, tone: 'success' });
    } catch (error) {
      toast({
        message: error instanceof Error ? error.message : 'File gagal dimuat.',
        tone: 'error',
      });
    } finally {
      setIsLoadingFile(false);
    }
  };

  // The control follows the type: a link needs a URL field with url
  // validation, while a note or document holds prose — typed or
  // read out of an uploaded file.
  const isLink = draft.type === 'link';

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

        {draft.type !== 'link' ? (
          <div className={styles.fileRow}>
            <label className={styles.fileLabel}>
              <UploadIcon size={14} />
              <span>
                {isLoadingFile
                  ? 'Membaca berkas…'
                  : 'Unggah .txt / .md / .pdf / .docx / .xlsx / .csv'}
              </span>
              <input
                type="file"
                accept=".txt,.md,.pdf,.docx,.xlsx,.csv,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                className={styles.fileInput}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleFileChosen(file);
                  // Reset so picking the same file twice still fires a change.
                  event.target.value = '';
                }}
              />
            </label>
            {fileName ? (
              <span className={styles.fileName} title={fileName}>
                {fileName}
              </span>
            ) : null}
          </div>
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
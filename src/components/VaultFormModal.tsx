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
import { TITLE_MAX_LENGTH, validateVaultDraft } from '../utils/validation';
import { TagInput } from './TagInput';
import { Button } from './ui/Button';
import { Input, Select, Textarea } from './ui/Field';
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
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    setDraft(item ? toVaultDraft(item) : emptyVaultDraft());
    setErrors({});
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

  // The control follows the type: a link needs a URL field with url validation,
  // a note needs room for prose, a document only needs one line for its name.
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
            label={draft.type === 'note' ? 'Isi catatan' : 'Nama berkas atau lokasi'}
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
import { useEffect, useState, type FormEvent } from 'react';
import {
  ITEM_TYPES,
  ITEM_TYPE_LABEL,
  TASK_PRIORITIES,
  TASK_STATUSES,
  emptyDraft,
  type Item,
  type ItemDraft,
  type ItemType,
} from '../types/item';
import { formatToInputValue } from '../utils/date';
import { TITLE_MAX_LENGTH, validateItemDraft } from '../utils/validation';
import { Button } from './ui/Button';
import { Input, Select, Textarea } from './ui/Field';
import { Modal } from './ui/Modal';
import { SubtaskList } from './SubtaskList';
import { useToast } from './ui/Toast';
import styles from './ItemFormModal.module.css';

export function toFormDraft(item: Item): ItemDraft {
  return {
    type: item.type,
    title: item.title,
    course: item.course,
    description: item.description,
    deadline: formatToInputValue(item.deadline),
    priority: item.priority,
    status: item.status,
    // Carried through untouched: the study-checklist editor is a separate step.
    subtasks: item.subtasks,
  };
}

interface ItemFormModalProps {
  open: boolean;
  item: Item | null;
  saving: boolean;
  formError: string | null;
  onClose: () => void;
  onSubmit: (draft: ItemDraft) => void;
}

export function ItemFormModal({ open, item, saving, formError, onClose, onSubmit }: ItemFormModalProps) {
  const [draft, setDraft] = useState<ItemDraft>(emptyDraft);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [warnings, setWarnings] = useState<string[]>([]);
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    setDraft(item ? toFormDraft(item) : emptyDraft());
    setErrors({});
    setWarnings([]);
  }, [open, item]);

  const update = <K extends keyof ItemDraft>(key: K, value: ItemDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const submit = () => {
    const result = validateItemDraft(draft);
    if (!result.ok) {
      setErrors(result.errors);
      setWarnings(result.warnings);
      // Field errors are shown inline; the toast confirms nothing was saved.
      toast({ message: 'Periksa kembali data yang belum lengkap.', tone: 'warning' });
      return;
    }
    setErrors({});
    setWarnings(result.warnings);
    onSubmit(draft);
  };

  const handleFormSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit();
  };

  return (
    <Modal
      open={open}
      title={item ? 'Ubah item' : 'Tambah item'}
      description={item ? item.title : 'Isi judul, mata kuliah, jenis, dan deadline.'}
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

        {warnings.length > 0 ? (
          <div className={styles.warnings} role="status">
            {warnings.map((warning) => (
              <span key={warning}>{warning}</span>
            ))}
          </div>
        ) : null}

        <div className={styles.row}>
          <Select
            label="Jenis"
            required
            value={draft.type}
            error={errors.type}
            onChange={(event) => update('type', event.target.value as ItemType)}
          >
            {ITEM_TYPES.map((type) => (
              <option key={type} value={type}>
                {ITEM_TYPE_LABEL[type]}
              </option>
            ))}
          </Select>

          <Select
            label="Prioritas"
            value={draft.priority}
            error={errors.priority}
            onChange={(event) => update('priority', event.target.value as ItemDraft['priority'])}
          >
            {TASK_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </Select>
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

        <Input
          label="Mata kuliah"
          required
          value={draft.course}
          error={errors.course}
          onChange={(event) => update('course', event.target.value)}
        />

        <Input
          label="Deadline"
          type="datetime-local"
          required
          value={draft.deadline}
          error={errors.deadline}
          hint="Waktu Indonesia Barat (WIB)"
          onChange={(event) => update('deadline', event.target.value)}
        />

        <Select
          label="Status"
          value={draft.status}
          error={errors.status}
          onChange={(event) => update('status', event.target.value as ItemDraft['status'])}
        >
          {TASK_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </Select>

        <Textarea
          label="Deskripsi"
          value={draft.description}
          onChange={(event) => update('description', event.target.value)}
        />

        {draft.type === 'exam' ? (
          <div className={styles.planner}>
            <SubtaskList subtasks={draft.subtasks} onChange={(subtasks) => update('subtasks', subtasks)} />
            {errors.subtasks ? (
              <span className={styles.subtaskError} role="alert">
                {errors.subtasks}
              </span>
            ) : null}
          </div>
        ) : null}
      </form>
    </Modal>
  );
}

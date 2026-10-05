import { useState, type KeyboardEvent } from 'react';
import type { Subtask } from '../types/item';
import { createId } from '../utils/id';
import { Button } from './ui/Button';
import { PlusIcon, XIcon } from './ui/icons';
import styles from './SubtaskList.module.css';

interface SubtaskListProps {
  subtasks: Subtask[];
  onChange: (subtasks: Subtask[]) => void;
}

/**
 * The exam study checklist, edited as part of the draft and persisted on save.
 * Keys are subtask ids, never the index, because titles may repeat.
 */
export function SubtaskList({ subtasks, onChange }: SubtaskListProps) {
  const [draftTitle, setDraftTitle] = useState('');

  const doneCount = subtasks.filter((subtask) => subtask.isCompleted).length;
  const percent = subtasks.length === 0 ? 0 : Math.round((doneCount / subtasks.length) * 100);

  const patch = (id: string, changes: Partial<Subtask>) => {
    onChange(subtasks.map((subtask) => (subtask.id === id ? { ...subtask, ...changes } : subtask)));
  };

  const remove = (id: string) => {
    onChange(subtasks.filter((subtask) => subtask.id !== id));
  };

  const add = () => {
    const title = draftTitle.trim();
    if (title.length === 0) return;
    onChange([...subtasks, { id: createId(), title, isCompleted: false }]);
    setDraftTitle('');
  };

  // Not a <form>: this component lives inside the modal's form, and nesting
  // them would make Enter or the add button submit the whole item.
  const onAddKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    add();
  };

  return (
    <div className={styles.section}>
      <div className={styles.header}>
        <span className={styles.label}>Rencana belajar</span>
        <span className={styles.progress}>
          {doneCount}/{subtasks.length} selesai
        </span>
      </div>

      {subtasks.length > 0 ? (
        <>
          <div className={styles.track}>
            <div className={styles.fill} style={{ width: `${percent}%` }} />
          </div>
          <ul className={styles.list}>
            {subtasks.map((subtask) => (
              <li key={subtask.id} className={`${styles.row} ${subtask.isCompleted ? styles.done : ''}`}>
                <input
                  type="checkbox"
                  className={styles.check}
                  checked={subtask.isCompleted}
                  onChange={() => patch(subtask.id, { isCompleted: !subtask.isCompleted })}
                  aria-label={`Tandai "${subtask.title}" selesai`}
                />
                <input
                  type="text"
                  className={styles.title}
                  value={subtask.title}
                  onChange={(event) => patch(subtask.id, { title: event.target.value })}
                  aria-label="Nama bab"
                />
                <button
                  type="button"
                  className={styles.remove}
                  onClick={() => remove(subtask.id)}
                  aria-label={`Hapus "${subtask.title}"`}
                >
                  <XIcon size={14} />
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className={styles.empty}>Belum ada materi yang ditambahkan.</p>
      )}

      <div className={styles.addRow}>
        <input
          type="text"
          className={styles.addInput}
          value={draftTitle}
          onChange={(event) => setDraftTitle(event.target.value)}
          onKeyDown={onAddKeyDown}
          placeholder="Tambah bab atau materi…"
          aria-label="Tambah bab baru"
        />
        <Button size="sm" onClick={add} disabled={draftTitle.trim().length === 0}>
          <PlusIcon size={14} />
          Tambah
        </Button>
      </div>
    </div>
  );
}

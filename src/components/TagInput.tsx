import { useRef, useState, type KeyboardEvent } from 'react';
import { normalizeTagList } from '../utils/validation';
import { TagIcon, XIcon } from './ui/icons';
import styles from './TagInput.module.css';

interface TagInputProps {
  label: string;
  hint?: string;
  tags: string[];
  onChange: (tags: string[]) => void;
}

/**
 * Chip-style tag entry. Enter or a comma commits the typed text, Backspace on an
 * empty field removes the last chip. The text input is a plain field, never its
 * own <form>: a nested form inside the item form would make Enter submit the
 * whole dialog.
 */
export function TagInput({ label, hint, tags, onChange }: TagInputProps) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = (raw: string) => {
    // A comma-separated paste is the fastest way in, so split on both separators.
    const parts = raw.split(',').map((part) => part.trim());
    const existing = tags.map((tag) => tag.toLowerCase());
    const added = parts.filter(
      (part) => part.length > 0 && !existing.includes(part.toLowerCase()),
    );
    if (added.length > 0) onChange(normalizeTagList([...tags, ...added]));
    setText('');
  };

  const remove = (tag: string) => onChange(tags.filter((entry) => entry !== tag));

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      // Enter would otherwise submit the surrounding form and save the dialog.
      event.preventDefault();
      if (text.trim().length > 0) commit(text);
      return;
    }
    if (event.key === 'Backspace' && text.length === 0 && tags.length > 0) {
      remove(tags[tags.length - 1]);
    }
  };

  return (
    <div className={styles.field}>
      <span className={styles.label}>{label}</span>

      <div className={styles.box} onClick={() => inputRef.current?.focus()}>
        {tags.map((tag) => (
          <span key={tag} className={styles.chip}>
            <TagIcon size={12} />
            {tag}
            <button
              type="button"
              className={styles.chipRemove}
              aria-label={`Hapus tag ${tag}`}
              onClick={(event) => {
                event.stopPropagation();
                remove(tag);
              }}
            >
              <XIcon size={11} />
            </button>
          </span>
        ))}

        <input
          ref={inputRef}
          type="text"
          className={styles.input}
          value={text}
          placeholder={tags.length === 0 ? 'Ketik tag lalu Enter' : ''}
          aria-label={label}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => {
            if (text.trim().length > 0) commit(text);
          }}
        />
      </div>

      {hint ? <span className={styles.hint}>{hint}</span> : null}
    </div>
  );
}
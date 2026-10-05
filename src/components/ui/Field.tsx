import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import styles from './Field.module.css';

interface BaseFieldProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
}

interface FieldProps extends BaseFieldProps {
  id: string;
  children: ReactNode;
}

function Field({ id, label, error, hint, required, children }: FieldProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
        {required ? <span className={styles.required}>*</span> : null}
      </label>
      {children}
      {hint && !error ? (
        <span className={styles.hint} id={hintId}>
          {hint}
        </span>
      ) : null}
      {error ? (
        <span className={styles.error} id={errorId} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

function describedBy(id: string, error?: string, hint?: string): string | undefined {
  const ids = [error ? `${id}-error` : '', !error && hint ? `${id}-hint` : ''].filter(Boolean);
  return ids.length > 0 ? ids.join(' ') : undefined;
}

type InputProps = BaseFieldProps & InputHTMLAttributes<HTMLInputElement>;

export function Input({ label, error, hint, required, className, ...rest }: InputProps) {
  const id = useId();
  return (
    <Field id={id} label={label} error={error} hint={hint} required={required}>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={`${styles.input} ${error ? styles.invalid : ''} ${className ?? ''}`.trim()}
        {...rest}
      />
    </Field>
  );
}

type TextareaProps = BaseFieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ label, error, hint, required, className, ...rest }: TextareaProps) {
  const id = useId();
  return (
    <Field id={id} label={label} error={error} hint={hint} required={required}>
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={`${styles.textarea} ${error ? styles.invalid : ''} ${className ?? ''}`.trim()}
        {...rest}
      />
    </Field>
  );
}

type SelectProps = BaseFieldProps & SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ label, error, hint, required, className, children, ...rest }: SelectProps) {
  const id = useId();
  return (
    <Field id={id} label={label} error={error} hint={hint} required={required}>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={`${styles.input} ${error ? styles.invalid : ''} ${className ?? ''}`.trim()}
        {...rest}
      >
        {children}
      </select>
    </Field>
  );
}

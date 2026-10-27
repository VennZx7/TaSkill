import type {
  GeneratorMaterial,
  GeneratorSource,
  GeneratorTarget,
} from '../hooks/useQuizGenerator';
import type { FlashcardCount } from '../types/flashcard';
import { MAX_CONTEXT_CHARS } from '../services/geminiService';
import { Button } from './ui/Button';
import { Input, Select } from './ui/Field';
import { Modal } from './ui/Modal';
import {
  CardsIcon,
  ListIcon,
  NoteIcon,
  SparkleIcon,
  UploadIcon,
} from './ui/icons';
import shared from './CollectionStates.module.css';
import styles from './QuizGeneratorModal.module.css';

const SOURCE_OPTIONS: { value: GeneratorSource; label: string }[] = [
  { value: 'vault', label: 'Study Vault' },
  { value: 'file', label: 'Unggah berkas (.pdf, .txt, .md)' },
  { value: 'url', label: 'Tautan / topik' },
];

/** The three generator choices, as one interactive
 *  selection card: a radio per option, styled as a
 *  chromatic tile. */
const TARGET_OPTIONS: {
  value: GeneratorTarget;
  label: string;
  body: string;
  Icon: typeof ListIcon;
}[] = [
  {
    value: 'quiz',
    label: 'Generate Quiz',
    body: 'Pilihan ganda & jawaban singkat, dinilai otomatis.',
    Icon: ListIcon,
  },
  {
    value: 'flashcards',
    label: 'Generate Flashcards',
    body: 'Kartu tanya-jawab interaktif dengan flip 3D.',
    Icon: CardsIcon,
  },
  {
    value: 'both',
    label: 'Generate Both',
    body: 'Satu set kuis dan satu deck flashcard sekaligus.',
    Icon: SparkleIcon,
  },
];

const TARGET_COUNT_LABEL: Record<GeneratorTarget, string> = {
  quiz: 'Jumlah soal',
  flashcards: 'Jumlah kartu',
  both: 'Jumlah soal & kartu',
};

const TARGET_SUBMIT_LABEL: Record<GeneratorTarget, string> = {
  quiz: 'Buat kuis',
  flashcards: 'Buat kartu',
  both: 'Buat keduanya',
};

const TARGET_PENDING_LABEL: Record<GeneratorTarget, string> = {
  quiz: 'soal',
  flashcards: 'kartu',
  both: 'soal dan kartu',
};

interface QuizGeneratorModalProps {
  open: boolean;
  sourceMode: GeneratorSource;
  onSourceModeChange: (mode: GeneratorSource) => void;
  materials: GeneratorMaterial[];
  materialId: string;
  onMaterialChange: (id: string) => void;
  onFileChosen: (file: File) => void;
  isLoadingSource: boolean;
  source: GeneratorMaterial | null;
  urlText: string;
  onUrlChange: (value: string) => void;
  target: GeneratorTarget;
  onTargetChange: (target: GeneratorTarget) => void;
  title: string;
  onTitleChange: (title: string) => void;
  count: FlashcardCount;
  counts: readonly FlashcardCount[];
  onCountChange: (count: FlashcardCount) => void;
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  needsKey: boolean;
  isGenerating: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: () => void;
}

/**
 * The one place a quiz, a flashcard deck, or both are
 * generated. While Gemini is working the form is replaced
 * by a skeleton: there is nothing to edit until the
 * content exists, and a disabled button alone would not
 * say why.
 */
export function QuizGeneratorModal({
  open,
  sourceMode,
  onSourceModeChange,
  materials,
  materialId,
  onMaterialChange,
  onFileChosen,
  isLoadingSource,
  source,
  urlText,
  onUrlChange,
  target,
  onTargetChange,
  title,
  onTitleChange,
  count,
  counts,
  onCountChange,
  apiKey,
  onApiKeyChange,
  needsKey,
  isGenerating,
  error,
  onClose,
  onSubmit,
}: QuizGeneratorModalProps) {
  const canSubmit =
    source !== null && count > 0 && (needsKey || apiKey.trim().length > 0);

  return (
    <Modal
      open={open}
      title="Generate Quiz & Flashcards dengan AI"
      description="Pilih sumber materinya, lalu pilih mau dibuat kuis, flashcard, atau keduanya."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isGenerating}>
            Batal
          </Button>
          <Button
            variant="primary"
            onClick={onSubmit}
            disabled={isGenerating || !canSubmit}
            aria-busy={isGenerating}
          >
            <SparkleIcon size={16} />
            {isGenerating ? 'Sedang membuat…' : TARGET_SUBMIT_LABEL[target]}
          </Button>
        </>
      }
    >
      {isGenerating ? (
        <div className={styles.pending} aria-busy="true" aria-live="polite">
          <div className={`${shared.skeleton} ${styles.pendingBar}`} />
          <div className={`${shared.skeleton} ${styles.pendingBar}`} />
          <p className={styles.pendingNote}>
            Gemini sedang menyusun {count} {TARGET_PENDING_LABEL[target]} dari “
            {source?.title ?? 'materi'}”. Materi dipotong maksimal{' '}
            {MAX_CONTEXT_CHARS.toLocaleString('id-ID')} karakter.
          </p>
        </div>
      ) : (
        <div className={styles.form}>
          {/* --- Unified study material source --- */}
          <Select
            label="Sumber materi"
            required
            value={sourceMode}
            onChange={(event) =>
              onSourceModeChange(event.target.value as GeneratorSource)
            }
          >
            {SOURCE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>

          {sourceMode === 'vault' ? (
            <Select
              label="Materi dari Study Vault"
              required
              value={materialId}
              onChange={(event) => onMaterialChange(event.target.value)}
              hint="Hanya catatan dan dokumen yang bisa dikirim, tautan tidak berisi teks."
            >
              <option value="">Pilih dari Study Vault…</option>
              {materials.map((material) => (
                <option key={material.id} value={material.id}>
                  {material.title} — {material.course}
                </option>
              ))}
            </Select>
          ) : null}

          {sourceMode === 'file' ? (
            <label className={styles.upload}>
              <UploadIcon size={14} />
              <span>
                {isLoadingSource
                  ? 'Membaca berkas…'
                  : 'Pilih .pdf, .txt, atau .md — teks diekstrak di browser'}
              </span>
              <input
                type="file"
                accept=".txt,.md,.pdf,text/plain,text/markdown,application/pdf"
                className={styles.fileInput}
                disabled={isLoadingSource}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void onFileChosen(file);
                  // Reset so picking the same file twice still fires a change.
                  event.target.value = '';
                }}
              />
            </label>
          ) : null}

          {sourceMode === 'url' ? (
            <Input
              label="Tautan atau topik"
              required
              type="url"
              autoComplete="off"
              spellCheck={false}
              placeholder="https://… atau ketik topiknya, mis. Limit fungsi"
              value={urlText}
              onChange={(event) => onUrlChange(event.target.value)}
              hint="Gemini menyusun soal dari tautan atau topik yang kamu berikan."
            />
          ) : null}

          {isLoadingSource ? (
            <div className={styles.sourceBar} role="status">
              <span className={styles.typing} aria-hidden="true">
                <span className={styles.dot} />
                <span className={styles.dot} />
                <span className={styles.dot} />
              </span>
              <span className={styles.sourceName}>Membaca berkas…</span>
            </div>
          ) : source ? (
            <div className={styles.sourceBar}>
              <NoteIcon size={13} />
              <span className={styles.sourceName} title={source.title}>
                {source.title}
              </span>
              <span className={styles.sourceBadge}>
                {source.pageCount ? `${source.pageCount} halaman · ` : ''}
                {source.text.length.toLocaleString('id-ID')} karakter
                {source.text.length > MAX_CONTEXT_CHARS ? ' (dipotong)' : ''}
              </span>
            </div>
          ) : null}

          {/* --- Generator selection card --- */}
          <div
            className={styles.options}
            role="radiogroup"
            aria-label="Pilih generator"
          >
            {TARGET_OPTIONS.map(({ value, label, body, Icon }) => {
              const active = target === value;
              return (
                <label
                  key={value}
                  className={`${styles.option} ${active ? styles.optionActive : ''}`.trim()}
                >
                  <input
                    type="radio"
                    name="generator-target"
                    className={styles.optionInput}
                    checked={active}
                    onChange={() => onTargetChange(value)}
                  />
                  <Icon size={18} className={styles.optionIcon} />
                  <span className={styles.optionLabel}>{label}</span>
                  <span className={styles.optionBody}>{body}</span>
                </label>
              );
            })}
          </div>

          <div className={styles.row}>
            <Input
              label="Judul"
              placeholder="Kosongkan untuk memakai judul materi"
              maxLength={100}
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
            />
            <Select
              label={TARGET_COUNT_LABEL[target]}
              value={String(count)}
              onChange={(event) =>
                onCountChange(Number(event.target.value) as FlashcardCount)
              }
            >
              {counts.map((option) => (
                <option key={option} value={String(option)}>
                  {option} {target === 'flashcards' ? 'kartu' : 'soal'}
                </option>
              ))}
            </Select>
          </div>

          {needsKey ? (
            <Input
              label="Gemini API Key"
              required
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="AIza…"
              value={apiKey}
              onChange={(event) => onApiKeyChange(event.target.value)}
              hint="Sama dengan key pada modul AI Assistant. Disimpan hanya di browser ini."
            />
          ) : null}

          {sourceMode === 'vault' && materials.length === 0 ? (
            <p className={styles.notice}>
              Belum ada catatan atau dokumen di Study Vault. Simpan materi
              terlebih dahulu, atau pilih sumber lain.
            </p>
          ) : null}

          {error ? (
            <p className={styles.formError} role="alert">
              {error}
            </p>
          ) : null}
        </div>
      )}
    </Modal>
  );
}

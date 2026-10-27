import type { GeneratorMaterial } from '../hooks/useFlashcardGenerator';
import type { FlashcardCount } from '../types/flashcard';
import { MAX_CONTEXT_CHARS } from '../services/geminiService';
import { Button } from './ui/Button';
import { Input, Select } from './ui/Field';
import { Modal } from './ui/Modal';
import { SparkleIcon } from './ui/icons';
import shared from './CollectionStates.module.css';
import styles from './FlashcardGeneratorModal.module.css';

interface FlashcardGeneratorModalProps {
  open: boolean;
  materials: GeneratorMaterial[];
  materialId: string;
  title: string;
  count: FlashcardCount;
  counts: readonly FlashcardCount[];
  apiKey: string;
  needsKey: boolean;
  isGenerating: boolean;
  error: string | null;
  onMaterialChange: (id: string) => void;
  onTitleChange: (title: string) => void;
  onCountChange: (count: FlashcardCount) => void;
  onApiKeyChange: (key: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}

/**
 * The one place a deck is generated. While Gemini is working the form is replaced
 * by a skeleton: there is nothing to edit until the cards exist, and a disabled
 * button alone would not say why.
 */
export function FlashcardGeneratorModal({
  open,
  materials,
  materialId,
  title,
  count,
  counts,
  apiKey,
  needsKey,
  isGenerating,
  error,
  onMaterialChange,
  onTitleChange,
  onCountChange,
  onApiKeyChange,
  onClose,
  onSubmit,
}: FlashcardGeneratorModalProps) {
  const selected = materials.find((item) => item.id === materialId);
  const canSubmit = selected !== undefined && count > 0 && (needsKey || apiKey.trim().length > 0);

  return (
    <Modal
      open={open}
      narrow
      title="Generate Flashcards dengan AI"
      description="Gemini membaca materi dari Study Vault lalu menyusun kartu tanya-jawab."
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
            {isGenerating ? 'Sedang membuat…' : 'Buat kartu'}
          </Button>
        </>
      }
    >
      {isGenerating ? (
        <div className={styles.pending} aria-busy="true" aria-live="polite">
          <div className={`${shared.skeleton} ${styles.pendingBar}`} />
          <div className={`${shared.skeleton} ${styles.pendingBar}`} />
          <p className={styles.pendingNote}>
            Gemini sedang menyusun {count} kartu dari “{selected?.title ?? 'materi'}”. Materi dipotong
            maksimal {MAX_CONTEXT_CHARS.toLocaleString('id-ID')} karakter.
          </p>
        </div>
      ) : (
        <div className={styles.form}>
          <Select
            label="Materi sumber"
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

          <div className={styles.row}>
            <Input
              label="Judul deck"
              placeholder="Kosongkan untuk memakai judul materi"
              maxLength={100}
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
            />
            <Select
              label="Jumlah kartu"
              value={String(count)}
              onChange={(event) => onCountChange(Number(event.target.value) as FlashcardCount)}
            >
              {counts.map((option) => (
                <option key={option} value={String(option)}>
                  {option} kartu
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

          {materials.length === 0 ? (
            <p className={styles.notice}>
              Belum ada catatan atau dokumen di Study Vault. Simpan materi terlebih dahulu untuk
              membuat deck.
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

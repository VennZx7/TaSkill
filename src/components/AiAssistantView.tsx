import { useState, type FormEvent } from 'react';
import { MAX_CONTEXT_CHARS } from '../services/geminiService';
import type { AssistantContextSource, ChatMessage } from '../hooks/useAiAssistant';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { KeyIcon, NoteIcon, SendIcon, SparkleIcon, UploadIcon } from './ui/icons';
import styles from './AiAssistantView.module.css';

interface SelectableItem {
  id: string;
  title: string;
}

interface AiAssistantViewProps {
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  messages: ChatMessage[];
  isThinking: boolean;
  contextLabel: string | null;
  contextChars: number;
  contextPages: number | null;
  contextSource: AssistantContextSource | null;
  contextError: string | null;
  isLoadingContext: boolean;
  selectableItems: SelectableItem[];
  onPickVaultItem: (id: string) => void;
  onFileChosen: (file: File) => void;
  onClearContext: () => void;
  onSend: (message: string) => void;
  onSummarize: () => void;
}

export function AiAssistantView({
  apiKey,
  onApiKeyChange,
  messages,
  isThinking,
  contextLabel,
  contextChars,
  contextPages,
  contextSource,
  contextError,
  isLoadingContext,
  selectableItems,
  onPickVaultItem,
  onFileChosen,
  onClearContext,
  onSend,
  onSummarize,
}: AiAssistantViewProps) {
  const [draft, setDraft] = useState('');
  const [selectedId, setSelectedId] = useState('');

  const sendDraft = () => {
    if (draft.trim().length === 0 || isThinking) return;
    onSend(draft);
    setDraft('');
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    sendDraft();
  };

  const hasKey = apiKey.trim().length > 0;

  return (
    <div className={styles.root}>
      <section className={styles.setup}>
        <h3 className={styles.setupTitle}><span className={styles.sectionSticker}><NoteIcon size={19} /></span>Sumber Materi</h3>
        <div className={styles.setupRow}>
          <div className={styles.setupField}>
            <label className={styles.label} htmlFor="gemini-key"><KeyIcon size={16} /> Gemini API Key</label>
            <input
              id="gemini-key"
              className={styles.input}
              type="password"
              value={apiKey}
              autoComplete="off"
              spellCheck={false}
              placeholder="AIza…"
              onChange={(event) => onApiKeyChange(event.target.value)}
            />
            <p className={styles.hint}>
              Disimpan hanya di browser ini (localStorage), dikirim ke server Gemini saja. Jangan
              pernah memakai key bersama orang lain.
            </p>
            <span className={`${styles.keyStatus} ${hasKey ? styles.keyReady : ''}`} role="status">
              {hasKey ? 'Key tersimpan di browser ini' : 'Masukkan key untuk mulai memakai AI'}
            </span>
          </div>

          <div className={styles.setupField}>
            <label className={styles.label} htmlFor="material-select">
              Pilih Materi
            </label>
            <select
              id="material-select"
              className={styles.input}
              value={selectedId}
              onChange={(event) => {
                setSelectedId(event.target.value);
                if (event.target.value === '') return;
                onPickVaultItem(event.target.value);
                setSelectedId('');
              }}
            >
              <option value="">Pilih dari Study Vault…</option>
              {selectableItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>

            <label className={`${styles.upload} ${styles.input}`}>
              <UploadIcon size={14} />
              <span>Unggah .txt / .md / .pdf / .docx / .xlsx / .csv</span>
              <input
                type="file"
                accept=".txt,.md,.pdf,.docx,.xlsx,.csv,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                className={styles.fileInput}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) onFileChosen(file);
                  // Reset so picking the same file twice still fires a change.
                  event.target.value = '';
                }}
              />
            </label>
            <p className={styles.hint}>
              Unggahan di sini hanya dipakai sementara untuk AI. Untuk menyimpannya di Study Vault, gunakan menu Study Vault → Simpan materi.
            </p>
          </div>
        </div>

        {contextError ? <p className={styles.uploadError} role="alert">{contextError}</p> : null}

        {isLoadingContext ? (
          <div className={styles.contextBar} role="status" aria-live="polite">
            <span className={styles.typing} aria-hidden="true">
              <span className={styles.dot} />
              <span className={styles.dot} />
              <span className={styles.dot} />
            </span>
            <span className={styles.contextName}>Membaca materi yang diunggah…</span>
          </div>
        ) : contextLabel ? (
          <div className={styles.contextBar}>
            <NoteIcon size={13} />
            <span className={styles.contextName} title={contextLabel}>
              {contextLabel}
            </span>
            <span className={styles.contextSource}>
              {contextSource === 'upload' ? 'Unggahan sementara · belum disimpan ke Vault' : 'Dari Study Vault'}
            </span>
            <Badge tone="accent">
              {contextPages ? `${contextPages} halaman · ` : ''}
              {contextChars.toLocaleString('id-ID')} karakter
              {contextChars > MAX_CONTEXT_CHARS ? ' (dipotong)' : ''}
            </Badge>
              <Button
              variant="primary"
              size="sm"
              className={styles.summarize}
              onClick={onSummarize}
              disabled={isThinking}
              title="Buat ringkasan otomatis dari materi ini"
            >
              <SparkleIcon size={16} />
              Rangkum
            </Button>
            <Button variant="ghost" size="sm" onClick={onClearContext}>
              Hapus konteks
            </Button>
          </div>
        ) : (
          <p className={styles.contextEmpty}>
            Belum ada materi dipilih. Gemini akan menjawab tanpa konteks, atau pilih catatan dari
            Study Vault.
          </p>
        )}
      </section>

      <section className={styles.chat} aria-label="Percakapan dengan AI">
        <div className={styles.messages} role="log" aria-live="polite">
          {messages.length === 0 ? (
            <div className={styles.welcome}>
              <span className={styles.welcomeIcon}>
                <SparkleIcon size={24} />
              </span>
              <h3 className={styles.welcomeTitle}>Tanya apa saja tentang materimu</h3>
              <p className={styles.welcomeBody}>
                Contoh: “Jelaskan bedanya limit dari kiri dan kanan dengan satu contoh soal.” Pilih
                atau unggah materi (.txt, .md, .pdf, .docx, .xlsx) dulu supaya jawabannya berdasarkan catatanmu.
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <article
                key={message.id}
                className={`${styles.message} ${
                  message.role === 'user' ? styles.fromUser : styles.fromAssistant
                }`}
              >
                {message.role === 'assistant' ? <span className={styles.avatar} aria-label="Gemini"><SparkleIcon size={15} /></span> : null}
                <span className={styles.bubble}>{message.text}</span>
              </article>
            ))
          )}

          {isThinking ? (
            <article className={`${styles.message} ${styles.fromAssistant}`}>
              <span className={styles.avatar} aria-hidden="true"><SparkleIcon size={15} /></span>
              <span className={styles.bubble}>
                <span className={styles.typing} aria-label="Gemini sedang menjawab">
                  <span className={styles.dot} />
                  <span className={styles.dot} />
                  <span className={styles.dot} />
                </span>
                <span className={styles.thinkingText}>Gemini sedang membaca materimu...</span>
              </span>
            </article>
          ) : null}
        </div>

        <form className={styles.composer} onSubmit={submit}>
          <label className={styles.visuallyHidden} htmlFor="chat-input">
            Pesan untuk AI
          </label>
          <textarea
            id="chat-input"
            className={styles.textarea}
            rows={2}
            value={draft}
            placeholder={hasKey ? 'Tulis pertanyaan…' : 'Masukkan API Key terlebih dahulu'}
            disabled={!hasKey}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              // Enter sends; Shift+Enter is a newline. Expected in a chat box.
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                sendDraft();
              }
            }}
          />
          <Button
            type="submit"
            variant="primary"
            disabled={!hasKey || draft.trim().length === 0 || isThinking}
          >
            <SendIcon size={16} />
            Kirim
          </Button>
        </form>
      </section>
    </div>
  );
}

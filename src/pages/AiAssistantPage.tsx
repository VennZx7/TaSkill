import { AiAssistantView } from '../components/AiAssistantView';
import { useAiAssistant } from '../hooks/useAiAssistant';
import styles from './AiAssistantPage.module.css';

export function AiAssistantPage() {
  const assistant = useAiAssistant();

  return (
    // Fills the shell's flex column so the chat scrolls internally and the
    // API key block stays put.
    <div className={styles.page}>
      <div className={styles.intro}>
        <h2 className={styles.heading}>AI Study Assistant</h2>
        <p className={styles.subheading}>
          Tanya Gemini tentang materi pilihanmu. Konteks dikirim bersama pertanyaan, jadi
          jawabannya spesifik pada catatanmu, bukan umum.
        </p>
      </div>

      <AiAssistantView
        apiKey={assistant.apiKey}
        onApiKeyChange={assistant.setApiKey}
        messages={assistant.messages}
        isThinking={assistant.isThinking}
        contextLabel={assistant.contextLabel}
        contextChars={assistant.contextChars}
        contextPages={assistant.contextPages}
        isLoadingContext={assistant.isLoadingContext}
        selectableItems={assistant.selectableItems.map((item) => ({
          id: item.id,
          title: item.title,
        }))}
        onPickVaultItem={(id) => {
          const item = assistant.selectableItems.find((entry) => entry.id === id);
          if (item) assistant.loadFromVault(item);
        }}
        onFileChosen={(file) => void assistant.loadFromFile(file)}
        onClearContext={assistant.clearContext}
        onSend={(message) => void assistant.send(message)}
      />
    </div>
  );
}
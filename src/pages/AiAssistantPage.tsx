import { AiAssistantView } from '../components/AiAssistantView';
import { useAiAssistant } from '../hooks/useAiAssistant';
import { SparkleIcon } from '../components/ui/icons';
import styles from './AiAssistantPage.module.css';

export function AiAssistantPage() {
  const assistant = useAiAssistant();

  return (
    // Fills the shell's flex column so the chat scrolls internally and the
    // API key block stays put.
    <div className={styles.page}>
      <div className={styles.intro}>
        <span className={styles.sticker}><SparkleIcon size={28} /></span>
        <div>
          <h2 className={styles.heading}>Asisten AI</h2>
          <p className={styles.subheading}>Tanya materi kuliahmu atau minta rangkuman dari Gemini.</p>
        </div>
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
        onSummarize={() => void assistant.summarize()}
      />
    </div>
  );
}

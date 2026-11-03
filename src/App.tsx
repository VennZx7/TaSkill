import { useState } from 'react';
import { useTheme } from './hooks/useTheme';
import { AppShell, type Module } from './components/AppShell';
import shellStyles from './components/AppShell.module.css';
import { Button } from './components/ui/Button';
import { ToastProvider } from './components/ui/Toast';
import { FlashcardProvider } from './context/FlashcardContext';
import { ItemProvider } from './context/ItemContext';
import { QuizProvider } from './context/QuizContext';
import { UserProvider } from './context/UserContext';
import { VaultProvider } from './context/VaultContext';
import { DashboardPage } from './pages/DashboardPage';
import { TaskPage } from './pages/HomePage';
import { PomodoroPage } from './pages/PomodoroPage';
import { QuizView } from './pages/QuizPage';
import { VaultPage } from './pages/VaultPage';
import { AiAssistantPage } from './pages/AiAssistantPage';
import { LandingPage } from './pages/landing/LandingPage';

/**
 * No router is installed, and one is not needed: six modules behind one shell,
 * so the current module is local state. The dashboard is the landing view.
 */
function Workspace({ onExit, theme, onThemeToggle }: { onExit: () => void; theme: 'light' | 'dark'; onThemeToggle: () => void }) {
  const [module, setModule] = useState<Module>('dashboard');
  const [hasVisitedAi, setHasVisitedAi] = useState(false);
  const navigate = (next: Module) => {
    if (next === 'ai') setHasVisitedAi(true);
    setModule(next);
  };

  return (
    <AppShell
      module={module}
      onNavigate={navigate}
      theme={theme}
      onThemeToggle={onThemeToggle}
      actions={
        <>
          <Button variant="ghost" size="sm" onClick={onExit}>
            ← Kembali
          </Button>
        </>
      }
    >
      <div
        className={module === 'ai' ? shellStyles.aiHostActive : shellStyles.aiHostInactive}
        aria-hidden={module !== 'ai'}
      >
        {hasVisitedAi ? <AiAssistantPage /> : null}
      </div>
      {module === 'dashboard' ? (
          <DashboardPage onNavigate={navigate} />
        ) : module === 'scheduler' ? (
          <TaskPage />
        ) : module === 'pomodoro' ? (
          <PomodoroPage />
        ) : module === 'ai' ? null : module === 'flashcards' ? (
          <QuizView />
        ) : (
          <VaultPage />
        )}
    </AppShell>
  );
}

export function App() {
  const [entered, setEntered] = useState(false);
  const { theme, toggle } = useTheme();

  if (!entered) {
    return <LandingPage onEnter={() => setEntered(true)} theme={theme} onThemeToggle={toggle} />;
  }

  return (
      <ToastProvider>
        <ItemProvider>
          <VaultProvider>
            <FlashcardProvider>
              <QuizProvider>
                <UserProvider>
                  <Workspace onExit={() => setEntered(false)} theme={theme} onThemeToggle={toggle} />
                </UserProvider>
              </QuizProvider>
            </FlashcardProvider>
          </VaultProvider>
        </ItemProvider>
      </ToastProvider>
  );
}

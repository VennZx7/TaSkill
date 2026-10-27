import { useState } from 'react';
import { AppShell, type Module } from './components/AppShell';
import { ThemeToggle } from './components/ui/ThemeToggle';
import { ToastProvider } from './components/ui/Toast';
import { FlashcardProvider } from './context/FlashcardContext';
import { ItemProvider } from './context/ItemContext';
import { QuizProvider } from './context/QuizContext';
import { UserProvider } from './context/UserContext';
import { VaultProvider } from './context/VaultContext';
import { useTheme } from './hooks/useTheme';
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
function Workspace() {
  const [module, setModule] = useState<Module>('dashboard');
  const { theme, toggle } = useTheme();

  return (
    <AppShell
      module={module}
      onNavigate={setModule}
      actions={<ThemeToggle theme={theme} onToggle={toggle} />}
    >
        {module === 'dashboard' ? (
          <DashboardPage onNavigate={setModule} />
        ) : module === 'scheduler' ? (
          <TaskPage />
        ) : module === 'pomodoro' ? (
          <PomodoroPage />
        ) : module === 'ai' ? (
          <AiAssistantPage />
        ) : module === 'flashcards' ? (
          <QuizView />
        ) : (
          <VaultPage />
        )}
    </AppShell>
  );
}

export function App() {
  const [entered, setEntered] = useState(false);

  if (!entered) {
    return <LandingPage onEnter={() => setEntered(true)} />;
  }

  return (
      <ToastProvider>
        <ItemProvider>
          <VaultProvider>
            <FlashcardProvider>
              <QuizProvider>
                <UserProvider>
                  <Workspace />
                </UserProvider>
              </QuizProvider>
            </FlashcardProvider>
          </VaultProvider>
        </ItemProvider>
      </ToastProvider>
  );
}

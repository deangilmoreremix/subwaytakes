import { useState } from 'react';
import { AuthProvider, useAuth } from './lib/auth';
import { AppShell } from './components/AppLayout/AppShell';
import { AuthPage } from './pages/AuthPage';
import { CreatePage } from './pages/CreatePage';
import { ClipPage } from './pages/ClipPage';
import { LibraryPage } from './pages/LibraryPage';
import { EpisodeBuilderPage } from './pages/EpisodeBuilderPage';
import { EpisodePage } from './pages/EpisodePage';
import { QuestionBankPage } from './pages/QuestionBankPage';
import { DashboardPage } from './pages/DashboardPage';
import { TemplateManagerPage } from './pages/TemplateManagerPage';
import { EnhancePage } from './pages/EnhancePage';
import { SettingsPage } from './pages/SettingsPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Loader2 } from 'lucide-react';

type Page = 'shell' | 'dashboard' | 'create' | 'library' | 'clip' | 'episode-builder' | 'episode' | 'question-bank' | 'templates' | 'enhance-clip' | 'enhance-episode' | 'settings';

function AppContent() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('shell');
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  function handleClipCreated(clipId: string) {
    setSelectedClipId(clipId);
    setCurrentPage('clip');
  }

  function handleSelectClip(clipId: string) {
    setSelectedClipId(clipId);
    setCurrentPage('clip');
  }

  function handleSelectEpisode(episodeId: string) {
    setSelectedEpisodeId(episodeId);
    setCurrentPage('episode');
  }

  function handleBackFromClip() {
    setSelectedClipId(null);
    setCurrentPage('shell');
  }

  function handleBackFromEpisode() {
    setSelectedEpisodeId(null);
    setCurrentPage('shell');
  }

  function handleEpisodeCreated(episodeId: string) {
    setSelectedEpisodeId(episodeId);
    setCurrentPage('episode');
  }

  function handleEnhanceClip(clipId: string) {
    setSelectedClipId(clipId);
    setCurrentPage('enhance-clip');
  }

  function handleEnhanceEpisode(episodeId: string) {
    setSelectedEpisodeId(episodeId);
    setCurrentPage('enhance-episode');
  }

  function renderPage() {
    switch (currentPage) {
      case 'shell':
      case 'create':
        return <CreatePage onClipCreated={handleClipCreated} />;

      case 'dashboard':
        return (
          <DashboardPage
            onCreateClip={() => setCurrentPage('shell')}
            onViewLibrary={() => setCurrentPage('library')}
            onViewClip={handleSelectClip}
            onViewEpisode={handleSelectEpisode}
            onEpisodeBuilder={() => setCurrentPage('episode-builder')}
          />
        );

      case 'clip':
        return selectedClipId ? (
          <ClipPage
            clipId={selectedClipId}
            onBack={handleBackFromClip}
            onNavigateToClip={handleSelectClip}
            onEnhance={handleEnhanceClip}
          />
        ) : null;

      case 'library':
        return (
          <LibraryPage
            onSelectClip={handleSelectClip}
            onSelectEpisode={handleSelectEpisode}
          />
        );

      case 'episode-builder':
        return (
          <EpisodeBuilderPage
            onEpisodeCreated={handleEpisodeCreated}
            onBack={() => setCurrentPage('shell')}
            onOpenQuestionBank={() => setCurrentPage('question-bank')}
          />
        );

      case 'question-bank':
        return <QuestionBankPage onBack={() => setCurrentPage('shell')} />;

      case 'templates':
        return <TemplateManagerPage onBack={() => setCurrentPage('shell')} />;

      case 'episode':
        return selectedEpisodeId ? (
          <EpisodePage
            episodeId={selectedEpisodeId}
            onBack={handleBackFromEpisode}
            onEnhance={handleEnhanceEpisode}
          />
        ) : null;

      case 'enhance-clip':
        return selectedClipId ? (
          <EnhancePage
            contentType="clip"
            contentId={selectedClipId}
            onBack={() => setCurrentPage('clip')}
          />
        ) : null;

      case 'enhance-episode':
        return selectedEpisodeId ? (
          <EnhancePage
            contentType="episode"
            contentId={selectedEpisodeId}
            onBack={() => setCurrentPage('episode')}
          />
        ) : null;

      case 'settings':
        return <SettingsPage onBack={() => setCurrentPage('shell')} />;

      default:
        return null;
    }
  }

  return (
    <AppShell
      activePage={currentPage}
      onNavigateToDashboard={() => setCurrentPage('dashboard')}
      onNavigateToLibrary={() => setCurrentPage('library')}
      onNavigateToCreate={() => setCurrentPage('shell')}
      onNavigateToTemplates={() => setCurrentPage('templates')}
      onNavigateToSettings={() => setCurrentPage('settings')}
    >
      <ErrorBoundary>
        {renderPage()}
      </ErrorBoundary>
    </AppShell>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;

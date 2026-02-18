import { useState } from 'react';
import { AppShell } from './components/AppLayout/AppShell';
import { CreatePage } from './pages/CreatePage';
import { ClipPage } from './pages/ClipPage';
import { LibraryPage } from './pages/LibraryPage';
import { EpisodeBuilderPage } from './pages/EpisodeBuilderPage';
import { EpisodePage } from './pages/EpisodePage';
import { QuestionBankPage } from './pages/QuestionBankPage';
import { DashboardPage } from './pages/DashboardPage';
import { TemplateManagerPage } from './pages/TemplateManagerPage';
import { ErrorBoundary } from './components/ErrorBoundary';

type Page = 'shell' | 'dashboard' | 'create' | 'library' | 'clip' | 'episode-builder' | 'episode' | 'question-bank' | 'templates';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('shell');
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(null);

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

  function handleGoToEpisodeBuilder() {
    setCurrentPage('episode-builder');
  }

  function handleBackFromEpisodeBuilder() {
    setCurrentPage('shell');
  }

  function handleGoToQuestionBank() {
    setCurrentPage('question-bank');
  }

  function handleBackFromQuestionBank() {
    setCurrentPage('shell');
  }

  function handleGoToDashboard() {
    setCurrentPage('dashboard');
  }

  function handleGoToLibrary() {
    setCurrentPage('library');
  }

  // Render AppShell with CreatePage as the main content
  if (currentPage === 'shell') {
    return (
      <div className="min-h-screen bg-zinc-950">
        <AppShell
          onNavigateToDashboard={handleGoToDashboard}
          onNavigateToLibrary={handleGoToLibrary}
          onNavigateToTemplates={() => setCurrentPage('templates')}
        >
          <CreatePage onClipCreated={handleClipCreated} />
        </AppShell>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <main>
        <ErrorBoundary>
          {currentPage === 'dashboard' && (
            <DashboardPage
              onCreateClip={() => setCurrentPage('create')}
              onViewLibrary={() => setCurrentPage('library')}
              onViewClip={handleSelectClip}
              onViewEpisode={handleSelectEpisode}
              onEpisodeBuilder={handleGoToEpisodeBuilder}
            />
          )}

          {currentPage === 'create' && (
            <CreatePage onClipCreated={handleClipCreated} />
          )}

          {currentPage === 'clip' && selectedClipId && (
            <ClipPage
              clipId={selectedClipId}
              onBack={handleBackFromClip}
              onNavigateToClip={handleSelectClip}
            />
          )}

          {currentPage === 'library' && (
            <LibraryPage
              onSelectClip={handleSelectClip}
              onSelectEpisode={handleSelectEpisode}
            />
          )}

          {currentPage === 'episode-builder' && (
            <EpisodeBuilderPage
              onEpisodeCreated={handleEpisodeCreated}
              onBack={handleBackFromEpisodeBuilder}
              onOpenQuestionBank={handleGoToQuestionBank}
            />
          )}

          {currentPage === 'question-bank' && (
            <QuestionBankPage onBack={handleBackFromQuestionBank} />
          )}

          {currentPage === 'templates' && (
            <TemplateManagerPage onBack={() => setCurrentPage('shell')} />
          )}

          {currentPage === 'episode' && selectedEpisodeId && (
            <EpisodePage
              episodeId={selectedEpisodeId}
              onBack={handleBackFromEpisode}
            />
          )}
        </ErrorBoundary>
      </main>
    </div>
  );
}

export default App;

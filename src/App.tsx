import { useState } from 'react';
import { AppHeader } from './components/AppHeader';
import { CreatePage } from './pages/CreatePage';
import { ClipPage } from './pages/ClipPage';
import { LibraryPage } from './pages/LibraryPage';
import { EpisodeBuilderPage } from './pages/EpisodeBuilderPage';
import { EpisodePage } from './pages/EpisodePage';
import { QuestionBankPage } from './pages/QuestionBankPage';
import { DashboardPage } from './pages/DashboardPage';
import { ErrorBoundary } from './components/ErrorBoundary';

type Page = 'dashboard' | 'create' | 'library' | 'clip' | 'episode-builder' | 'episode' | 'question-bank';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(null);

  function handleNavigate(page: 'dashboard' | 'create' | 'library') {
    setCurrentPage(page);
    setSelectedClipId(null);
    setSelectedEpisodeId(null);
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
    setCurrentPage('create');
    setSelectedClipId(null);
  }

  function handleBackFromEpisode() {
    setCurrentPage('library');
    setSelectedEpisodeId(null);
  }

  function handleEpisodeCreated(episodeId: string) {
    setSelectedEpisodeId(episodeId);
    setCurrentPage('episode');
  }

  function handleGoToEpisodeBuilder() {
    setCurrentPage('episode-builder');
  }

  function handleBackFromEpisodeBuilder() {
    setCurrentPage('create');
  }

  function handleGoToQuestionBank() {
    setCurrentPage('question-bank');
  }

  function handleBackFromQuestionBank() {
    setCurrentPage('episode-builder');
  }

  function handleGoToDashboard() {
    setCurrentPage('dashboard');
    setSelectedClipId(null);
    setSelectedEpisodeId(null);
  }

  const getHeaderPage = (): 'dashboard' | 'create' | 'library' | 'clip' => {
    if (currentPage === 'episode-builder' || currentPage === 'question-bank') return 'create';
    if (currentPage === 'episode') return 'library';
    if (currentPage === 'clip') return 'create';
    return currentPage;
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <AppHeader
        currentPage={getHeaderPage()}
        onNavigate={handleNavigate}
        onEpisodeBuilder={handleGoToEpisodeBuilder}
      />

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

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
import { EnhancePage } from './pages/EnhancePage';
import { ErrorBoundary } from './components/ErrorBoundary';

type Page = 'shell' | 'dashboard' | 'create' | 'library' | 'clip' | 'episode-builder' | 'episode' | 'question-bank' | 'templates' | 'enhance-clip' | 'enhance-episode';

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

  function handleGoToCreate() {
    setCurrentPage('shell');
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
            onCreateClip={handleGoToCreate}
            onViewLibrary={handleGoToLibrary}
            onViewClip={handleSelectClip}
            onViewEpisode={handleSelectEpisode}
            onEpisodeBuilder={handleGoToEpisodeBuilder}
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
            onBack={handleBackFromEpisodeBuilder}
            onOpenQuestionBank={handleGoToQuestionBank}
          />
        );

      case 'question-bank':
        return <QuestionBankPage onBack={handleBackFromQuestionBank} />;

      case 'templates':
        return <TemplateManagerPage onBack={handleGoToCreate} />;

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

      default:
        return null;
    }
  }

  return (
    <AppShell
      activePage={currentPage}
      onNavigateToDashboard={handleGoToDashboard}
      onNavigateToLibrary={handleGoToLibrary}
      onNavigateToCreate={handleGoToCreate}
      onNavigateToTemplates={() => setCurrentPage('templates')}
    >
      <ErrorBoundary>
        {renderPage()}
      </ErrorBoundary>
    </AppShell>
  );
}

export default App;

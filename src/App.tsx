import { useState } from 'react';
import { AppHeader } from './components/AppHeader';
import { CreatePage } from './pages/CreatePage';
import { ClipPage } from './pages/ClipPage';
import { LibraryPage } from './pages/LibraryPage';
import { EpisodeBuilderPage } from './pages/EpisodeBuilderPage';
import { EpisodePage } from './pages/EpisodePage';
import { QuestionBankPage } from './pages/QuestionBankPage';

type Page = 'create' | 'library' | 'clip' | 'episode-builder' | 'episode' | 'question-bank';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('create');
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(null);

  function handleNavigate(page: 'create' | 'library') {
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

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <AppHeader
        currentPage={currentPage === 'episode-builder' ? 'create' : currentPage === 'episode' ? 'library' : currentPage === 'clip' ? 'create' : currentPage}
        onNavigate={handleNavigate}
        onEpisodeBuilder={handleGoToEpisodeBuilder}
      />

      <main>
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
      </main>
    </div>
  );
}

export default App;

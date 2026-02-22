import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { AppShell } from './components/AppLayout/AppShell';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Loader2 } from 'lucide-react';

const AuthPage = lazy(() => import('./pages/AuthPage').then(m => ({ default: m.AuthPage })));
const CreateHubPage = lazy(() => import('./pages/CreateHubPage').then(m => ({ default: m.CreateHubPage })));
const CreateSubwayPage = lazy(() => import('./pages/create/CreateSubwayPage').then(m => ({ default: m.CreateSubwayPage })));
const CreateStreetPage = lazy(() => import('./pages/create/CreateStreetPage').then(m => ({ default: m.CreateStreetPage })));
const CreateMotivationalPage = lazy(() => import('./pages/create/CreateMotivationalPage').then(m => ({ default: m.CreateMotivationalPage })));
const CreateWisdomPage = lazy(() => import('./pages/create/CreateWisdomPage').then(m => ({ default: m.CreateWisdomPage })));
const CreateStudioPage = lazy(() => import('./pages/create/CreateStudioPage').then(m => ({ default: m.CreateStudioPage })));
const ClipPage = lazy(() => import('./pages/ClipPage').then(m => ({ default: m.ClipPage })));
const LibraryPage = lazy(() => import('./pages/LibraryPage').then(m => ({ default: m.LibraryPage })));
const EpisodeBuilderPage = lazy(() => import('./pages/EpisodeBuilderPage').then(m => ({ default: m.EpisodeBuilderPage })));
const EpisodePage = lazy(() => import('./pages/EpisodePage').then(m => ({ default: m.EpisodePage })));
const QuestionBankPage = lazy(() => import('./pages/QuestionBankPage').then(m => ({ default: m.QuestionBankPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const TemplateManagerPage = lazy(() => import('./pages/TemplateManagerPage').then(m => ({ default: m.TemplateManagerPage })));
const EnhancePage = lazy(() => import('./pages/EnhancePage').then(m => ({ default: m.EnhancePage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage').then(m => ({ default: m.AnalyticsPage })));
const PromptsPage = lazy(() => import('./pages/prompts/PromptsPage').then(m => ({ default: m.PromptsPage })));
const CompilationBuilderPage = lazy(() => import('./pages/CompilationBuilderPage'));
const CompilationPage = lazy(() => import('./pages/CompilationPage'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
    </div>
  );
}

function AppContent() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    );
  }

  return (
    <AppShell>
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Navigate to="/create" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/create" element={<CreateHubPage />} />
            <Route path="/create/subway" element={<CreateSubwayPage />} />
            <Route path="/create/street" element={<CreateStreetPage />} />
            <Route path="/create/motivational" element={<CreateMotivationalPage />} />
            <Route path="/create/wisdom" element={<CreateWisdomPage />} />
            <Route path="/create/studio" element={<CreateStudioPage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/clips/:id" element={<ClipPage />} />
            <Route path="/clips/:id/enhance" element={<EnhancePage contentType="clip" />} />
            <Route path="/episodes/new" element={<EpisodeBuilderPage />} />
            <Route path="/episodes/:id" element={<EpisodePage />} />
            <Route path="/episodes/:id/enhance" element={<EnhancePage contentType="episode" />} />
            <Route path="/compilations/new" element={<CompilationBuilderPage />} />
            <Route path="/compilations/:id" element={<CompilationPage />} />
            <Route path="/compilations/:id/enhance" element={<EnhancePage contentType="compilation" />} />
            <Route path="/questions" element={<QuestionBankPage />} />
            <Route path="/templates" element={<TemplateManagerPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/prompts" element={<PromptsPage />} />
            <Route path="/login" element={<AuthPage />} />
            <Route path="*" element={<Navigate to="/create" replace />} />
          </Routes>
        </Suspense>
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

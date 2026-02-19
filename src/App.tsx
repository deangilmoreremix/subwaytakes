import { Routes, Route, Navigate } from 'react-router-dom';
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
import { AnalyticsPage } from './pages/AnalyticsPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Loader2 } from 'lucide-react';

function AppContent() {
  const { user, loading } = useAuth();

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

  return (
    <AppShell>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Navigate to="/create" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/create" element={<CreatePage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/clips/:id" element={<ClipPage />} />
          <Route path="/clips/:id/enhance" element={<EnhancePage contentType="clip" />} />
          <Route path="/episodes/new" element={<EpisodeBuilderPage />} />
          <Route path="/episodes/:id" element={<EpisodePage />} />
          <Route path="/episodes/:id/enhance" element={<EnhancePage contentType="episode" />} />
          <Route path="/questions" element={<QuestionBankPage />} />
          <Route path="/templates" element={<TemplateManagerPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="*" element={<Navigate to="/create" replace />} />
        </Routes>
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

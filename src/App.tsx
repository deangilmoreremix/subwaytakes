import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { StudioShell as AppShell } from './components/studio/StudioShell';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Loader2 } from 'lucide-react';

const AuthPage = lazy(() => import('./pages/AuthPage').then(m => ({ default: m.AuthPage })));
const CreateTakePage = lazy(() => import('./pages/CreateTakePage').then(m => ({ default: m.CreateTakePage })));
const CastPage = lazy(() => import('./pages/CastPage').then(m => ({ default: m.CastPage })));
const RecastPage = lazy(() => import('./pages/RecastPage').then(m => ({ default: m.RecastPage })));
const GalleryPage = lazy(() => import('./pages/GalleryPage').then(m => ({ default: m.GalleryPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
    </div>
  );
}

function FullScreenLoader() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
    </div>
  );
}

/** Signed-out visitors go to /login and come back to where they were headed. */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenLoader />;
  if (!isAuthenticated) {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />;
  }

  return <>{children}</>;
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenLoader />;

  if (isAuthenticated) {
    const params = new URLSearchParams(location.search);
    const returnTo = params.get('returnTo') || '/create';
    return <Navigate to={returnTo} replace />;
  }

  return <>{children}</>;
}

function AppContent() {
  const { loading } = useAuth();

  if (loading) return <FullScreenLoader />;

  return (
    <ErrorBoundary>
      <Suspense fallback={<FullScreenLoader />}>
        <Routes>
          <Route path="/login" element={
            <PublicOnlyRoute>
              <AuthPage />
            </PublicOnlyRoute>
          } />
          <Route path="/*" element={
            <ProtectedRoute>
              <AppShell>
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/" element={<Navigate to="/create" replace />} />
                    <Route path="/create" element={<CreateTakePage />} />
                    <Route path="/cast" element={<CastPage />} />
                    <Route path="/recast" element={<RecastPage />} />
                    <Route path="/library" element={<GalleryPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="*" element={<Navigate to="/create" replace />} />
                  </Routes>
                </Suspense>
              </AppShell>
            </ProtectedRoute>
          } />
        </Routes>
      </Suspense>
    </ErrorBoundary>
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

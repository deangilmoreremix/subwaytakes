import { Film, Library, Plus, Clapperboard, LayoutDashboard } from 'lucide-react';

interface AppHeaderProps {
  currentPage: 'dashboard' | 'create' | 'library' | 'clip';
  onNavigate: (page: 'dashboard' | 'create' | 'library') => void;
  onEpisodeBuilder?: () => void;
}

export function AppHeader({ currentPage, onNavigate, onEpisodeBuilder }: AppHeaderProps) {
  return (
    <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="mx-auto max-w-6xl px-4 py-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => onNavigate('dashboard')}
            className="flex items-center gap-2 text-zinc-100 hover:text-white transition"
          >
            <Film className="h-6 w-6 text-amber-400" />
            <span className="text-lg font-semibold tracking-tight">SubwayTakes</span>
          </button>

          <nav className="flex items-center gap-2">
            <button
              onClick={() => onNavigate('dashboard')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
                currentPage === 'dashboard'
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </button>
            <button
              onClick={() => onNavigate('create')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
                currentPage === 'create'
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <Plus className="h-4 w-4" />
              Clip
            </button>
            {onEpisodeBuilder && (
              <button
                onClick={onEpisodeBuilder}
                className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition"
              >
                <Clapperboard className="h-4 w-4" />
                Episode
              </button>
            )}
            <button
              onClick={() => onNavigate('library')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
                currentPage === 'library'
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <Library className="h-4 w-4" />
              Library
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
}

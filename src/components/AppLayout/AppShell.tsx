import { useState, useCallback } from 'react';
import {
  LayoutDashboard,
  PlusCircle,
  Library,
  Settings,
  Film,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Palette,
} from 'lucide-react';
import { clsx } from '../../lib/format';

interface NavSection {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

export interface AppShellProps {
  activePage?: string;
  onNavigateToDashboard?: () => void;
  onNavigateToLibrary?: () => void;
  onNavigateToCreate?: () => void;
  onNavigateToTemplates?: () => void;
  children?: React.ReactNode;
}

const NAV_SECTIONS: NavSection[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'create', label: 'Create', icon: PlusCircle, badge: 'New' },
  { id: 'library', label: 'Library', icon: Library },
  { id: 'templates', label: 'Templates', icon: Palette },
];

const PAGE_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  create: 'Create Interview',
  shell: 'Create Interview',
  library: 'Library',
  templates: 'Templates',
  clip: 'Clip Preview',
  episode: 'Episode',
  'episode-builder': 'Episode Builder',
  'question-bank': 'Question Bank',
  'enhance-clip': 'Enhance Video',
  'enhance-episode': 'Enhance Episode',
};

export function AppShell({
  activePage = 'create',
  onNavigateToDashboard,
  onNavigateToLibrary,
  onNavigateToCreate,
  onNavigateToTemplates,
  children,
}: AppShellProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed(prev => !prev);
  }, []);

  const resolvedActive = activePage === 'shell' ? 'create' : activePage;
  const title = PAGE_TITLES[activePage] || 'SubwayTakes';

  return (
    <div className="flex h-screen bg-zinc-950">
      <aside
        className={clsx(
          "flex flex-col border-r border-zinc-800 bg-zinc-900 transition-all duration-300",
          isSidebarCollapsed ? "w-[72px]" : "w-[280px]"
        )}
      >
        <div className="flex items-center gap-3 px-4 py-5 border-b border-zinc-800">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-500/10 flex-shrink-0">
            <Film className="w-5 h-5 text-amber-400" />
          </div>
          {!isSidebarCollapsed && (
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-white truncate">SubwayTakes</h1>
              <p className="text-xs text-gray-500">Interview Creator</p>
            </div>
          )}
          <button
            onClick={toggleSidebar}
            className="ml-auto p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-zinc-800 transition-colors flex-shrink-0"
          >
            {isSidebarCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_SECTIONS.map((section) => {
            const Icon = section.icon;
            const isActive = resolvedActive === section.id
              || (section.id === 'create' && ['clip', 'enhance-clip', 'episode', 'enhance-episode', 'episode-builder', 'question-bank'].includes(resolvedActive));

            return (
              <button
                key={section.id}
                onClick={() => {
                  if (section.id === 'dashboard' && onNavigateToDashboard) {
                    onNavigateToDashboard();
                  } else if (section.id === 'create' && onNavigateToCreate) {
                    onNavigateToCreate();
                  } else if (section.id === 'library' && onNavigateToLibrary) {
                    onNavigateToLibrary();
                  } else if (section.id === 'templates' && onNavigateToTemplates) {
                    onNavigateToTemplates();
                  }
                }}
                className={clsx(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all relative",
                  isActive
                    ? "bg-amber-500/10 text-amber-400"
                    : "text-gray-400 hover:text-white hover:bg-zinc-800"
                )}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!isSidebarCollapsed && (
                  <span className="text-sm font-medium">{section.label}</span>
                )}
                {section.badge && !isSidebarCollapsed && (
                  <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
                    {section.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {!isSidebarCollapsed && (
          <div className="px-4 py-4 border-t border-zinc-800">
            <div className="p-3 rounded-xl bg-zinc-800/50 border border-zinc-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span className="text-sm font-medium text-white">Tokens</span>
                </div>
                <button className="text-xs text-amber-400 hover:text-amber-300">
                  + Top up
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-white">{title}</h1>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-zinc-800 transition-colors">
              <Settings className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
              <span className="text-sm font-medium text-amber-400">U</span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}

export default AppShell;

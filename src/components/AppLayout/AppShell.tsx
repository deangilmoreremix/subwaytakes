import { useState, useCallback } from 'react';
import {
  LayoutDashboard,
  PlusCircle,
  Library,
  User,
  Wrench,
  BarChart,
  Settings,
  Film,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { clsx } from '../../lib/format';

interface NavSection {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeColor?: string;
}

export interface AppShellProps {
  onNavigateToDashboard?: () => void;
  onNavigateToLibrary?: () => void;
  onNavigateToCreate?: () => void;
  children?: React.ReactNode;
}

const NAV_SECTIONS: NavSection[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'create', label: 'Create', icon: PlusCircle, badge: 'New', badgeColor: 'amber' },
  { id: 'library', label: 'Library', icon: Library },
  { id: 'self-clone', label: 'Self-Clone', icon: User },
  { id: 'tools', label: 'Tools', icon: Wrench },
  { id: 'analytics', label: 'Analytics', icon: BarChart },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function AppShell({ onNavigateToDashboard, onNavigateToLibrary, children }: AppShellProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed(prev => !prev);
  }, []);

  return (
    <div className="flex h-screen bg-zinc-950">
      {/* Sidebar */}
      <aside
        className={clsx(
          "flex flex-col border-r border-zinc-800 bg-zinc-900 transition-all duration-300",
          isSidebarCollapsed ? "w-18" : "w-70"
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-zinc-800">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-500/10">
            <Film className="w-5 h-5 text-amber-400" />
          </div>
          {!isSidebarCollapsed && (
            <div>
              <h1 className="text-base font-semibold text-white">SubwayTakes</h1>
              <p className="text-xs text-gray-500">Interview Creator</p>
            </div>
          )}
          <button
            onClick={toggleSidebar}
            className="ml-auto p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-zinc-800 transition-colors"
          >
            {isSidebarCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_SECTIONS.map((section) => {
            const Icon = section.icon;
            const isActive = section.id === 'create';
            
            return (
              <button
                key={section.id}
                onClick={() => {
                  if (section.id === 'dashboard' && onNavigateToDashboard) {
                    onNavigateToDashboard();
                  } else if (section.id === 'library' && onNavigateToLibrary) {
                    onNavigateToLibrary();
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

        {/* Token Balance */}
        {!isSidebarCollapsed && (
          <div className="px-4 py-4 border-t border-zinc-800">
            <div className="p-3 rounded-xl bg-zinc-800/50 border border-zinc-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span className="text-sm font-medium text-white">247 tokens</span>
                </div>
                <button className="text-xs text-amber-400 hover:text-amber-300">
                  + Top up
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-white">Create Interview</h1>
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}

export default AppShell;

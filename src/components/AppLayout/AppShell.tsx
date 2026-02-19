import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  LogOut,
  BarChart3,
} from 'lucide-react';
import { clsx } from '../../lib/format';
import { useAuth } from '../../lib/auth';

interface NavSection {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  badge?: string;
  matchPaths?: string[];
}

export interface AppShellProps {
  children?: React.ReactNode;
}

const NAV_SECTIONS: NavSection[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  {
    id: 'create',
    label: 'Create',
    icon: PlusCircle,
    path: '/create',
    badge: 'New',
    matchPaths: ['/create', '/clips', '/episodes', '/questions'],
  },
  { id: 'library', label: 'Library', icon: Library, path: '/library' },
  { id: 'templates', label: 'Templates', icon: Palette, path: '/templates' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, path: '/analytics' },
];

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/create': 'Create Interview',
  '/library': 'Library',
  '/templates': 'Templates',
  '/questions': 'Question Bank',
  '/settings': 'Settings',
  '/analytics': 'Analytics',
};

function getTitleFromPath(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.startsWith('/clips/') && pathname.endsWith('/enhance')) return 'Enhance Video';
  if (pathname.startsWith('/clips/')) return 'Clip Preview';
  if (pathname === '/episodes/new') return 'Episode Builder';
  if (pathname.startsWith('/episodes/') && pathname.endsWith('/enhance')) return 'Enhance Episode';
  if (pathname.startsWith('/episodes/')) return 'Episode';
  return 'SubwayTakes';
}

export function AppShell({ children }: AppShellProps) {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed(prev => !prev);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const title = getTitleFromPath(location.pathname);
  const displayInitial = profile?.display_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U';
  const credits = profile?.credits_balance ?? 0;

  function isNavActive(section: NavSection): boolean {
    const paths = section.matchPaths || [section.path];
    return paths.some(p => location.pathname === p || location.pathname.startsWith(p + '/'));
  }

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
            const active = isNavActive(section);

            return (
              <button
                key={section.id}
                onClick={() => navigate(section.path)}
                className={clsx(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all relative",
                  active
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
                  <span className="text-sm font-medium text-white">{credits} credits</span>
                </div>
                <span className="text-xs text-zinc-500 capitalize">{profile?.subscription_tier || 'free'}</span>
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
            <button
              onClick={() => navigate('/settings')}
              className={clsx(
                "p-2 rounded-lg transition-colors",
                location.pathname === '/settings'
                  ? "text-amber-400 bg-amber-500/10"
                  : "text-gray-400 hover:text-white hover:bg-zinc-800"
              )}
            >
              <Settings className="w-5 h-5" />
            </button>
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center hover:bg-amber-500/30 transition"
              >
                <span className="text-sm font-medium text-amber-400">{displayInitial}</span>
              </button>
              {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 w-56 rounded-xl bg-zinc-900 border border-zinc-800 shadow-xl py-2 z-50">
                  <div className="px-4 py-2 border-b border-zinc-800">
                    <p className="text-sm font-medium text-zinc-200 truncate">
                      {profile?.display_name || 'User'}
                    </p>
                    <p className="text-xs text-zinc-500 truncate">{user?.email}</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      navigate('/settings');
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 transition"
                  >
                    <Settings className="w-4 h-4" />
                    Settings
                  </button>
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      signOut();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-zinc-800 transition"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              )}
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

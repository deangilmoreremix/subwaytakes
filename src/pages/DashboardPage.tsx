import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Film,
  ChevronRight,
  ChevronLeft,
  Users,
  Flame,
  Sparkles,
  Train,
  Video,
  Heart,
  ArrowRight,
  Clapperboard,
  TrendingUp,
  CalendarDays,
  Plus,
  Library,
  BarChart3,
  MessageSquare,
  LayoutGrid,
  Settings,
  Lightbulb,
  Loader2,
} from 'lucide-react';
import { TokenDisplay } from '../components/TokenDisplay';
import type { Clip, Episode, TokenBalance, ViralScore, ClipType } from '../lib/types';
import { supabase } from '../lib/supabase';
import { formatDistanceToNow } from '../lib/format';
import { useAuth } from '../lib/auth';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return 'Good evening';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const TIPS = [
  { title: 'Hook in 2 seconds', text: 'The first 2 seconds decide whether viewers stay. Use "Hot Take Challenge" mode to craft a hook that stops the scroll.' },
  { title: 'Optimal clip length', text: '4-6 second clips perform best on TikTok and Reels. Use the "Hook" duration preset for maximum engagement.' },
  { title: 'Studio for authority', text: 'Studio interviews with professional lighting establish you as an expert. Pair with "Podcast Desk" setup for credibility.' },
  { title: 'Street for authenticity', text: 'Street interviews feel real and relatable. Pick "Busy Sidewalk" scene and "Man on Street" style for raw energy.' },
  { title: 'Boost viral score', text: 'Higher controversy + emotional arc = higher viral score. Try "Unpopular Opinion" or "Debate Challenge" interview styles.' },
  { title: 'Episodes multiply reach', text: 'Multi-shot episodes keep viewers watching longer. More watch time signals algorithms to push your content further.' },
];

interface CreationMode {
  type: ClipType;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ReactNode;
  gradient: string;
  borderColor: string;
  accentColor: string;
  route: string;
  tags: string[];
}

const CREATION_MODES: CreationMode[] = [
  {
    type: 'subway_interview',
    title: 'Subway Interview',
    subtitle: 'SubwayTakes viral style',
    description: 'Capture raw, authentic reactions in subway settings with city styles for maximum engagement.',
    icon: <Train className="h-7 w-7" />,
    gradient: 'from-amber-500/20 to-orange-500/10',
    borderColor: 'border-amber-500/30 hover:border-amber-500/60',
    accentColor: 'text-amber-400',
    route: '/create/subway',
    tags: ['Viral', 'NYC', 'Authentic'],
  },
  {
    type: 'street_interview',
    title: 'Street Interview',
    subtitle: 'Sidewalk documentary style',
    description: 'Man-on-the-street interviews with neighborhood selection and urban soundscapes.',
    icon: <Users className="h-7 w-7" />,
    gradient: 'from-emerald-500/20 to-teal-500/10',
    borderColor: 'border-emerald-500/30 hover:border-emerald-500/60',
    accentColor: 'text-emerald-400',
    route: '/create/street',
    tags: ['Documentary', 'Vox Pop', 'Street'],
  },
  {
    type: 'motivational',
    title: 'Motivational',
    subtitle: 'Cinematic b-roll / kinetic vibe',
    description: 'Powerful motivational speaker clips with dramatic camera work and transformation arcs.',
    icon: <Sparkles className="h-7 w-7" />,
    gradient: 'from-red-500/20 to-rose-500/10',
    borderColor: 'border-red-500/30 hover:border-red-500/60',
    accentColor: 'text-red-400',
    route: '/create/motivational',
    tags: ['Cinematic', 'Inspiring', 'High Energy'],
  },
  {
    type: 'wisdom_interview',
    title: 'Wisdom Interview',
    subtitle: '55+ life experience & advice',
    description: 'Heartfelt conversations with experienced voices for genuine storytelling.',
    icon: <Heart className="h-7 w-7" />,
    gradient: 'from-amber-500/20 to-yellow-500/10',
    borderColor: 'border-amber-500/30 hover:border-amber-500/60',
    accentColor: 'text-amber-400',
    route: '/create/wisdom',
    tags: ['Heartfelt', 'Life Lessons', '55+'],
  },
  {
    type: 'studio_interview',
    title: 'Studio Interview',
    subtitle: 'Professional studio setup',
    description: 'Polished studio interviews with configurable desk setups and professional lighting.',
    icon: <Video className="h-7 w-7" />,
    gradient: 'from-sky-500/20 to-blue-500/10',
    borderColor: 'border-sky-500/30 hover:border-sky-500/60',
    accentColor: 'text-sky-400',
    route: '/create/studio',
    tags: ['Professional', 'Podcast', 'Polished'],
  },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  queued: { label: 'Queued', color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20', dot: 'bg-yellow-400' },
  running: { label: 'Running', color: 'text-sky-400 bg-sky-400/10 border-sky-400/20', dot: 'bg-sky-400' },
  generating: { label: 'Generating', color: 'text-sky-400 bg-sky-400/10 border-sky-400/20', dot: 'bg-sky-400' },
  stitching: { label: 'Stitching', color: 'text-teal-400 bg-teal-400/10 border-teal-400/20', dot: 'bg-teal-400' },
  done: { label: 'Done', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', dot: 'bg-emerald-400' },
  error: { label: 'Error', color: 'text-red-400 bg-red-400/10 border-red-400/20', dot: 'bg-red-400' },
};

export function DashboardPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [clips, setClips] = useState<Clip[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalClips, setTotalClips] = useState(0);
  const [totalEpisodes, setTotalEpisodes] = useState(0);
  const [clipsThisWeek, setClipsThisWeek] = useState(0);
  const [currentTip, setCurrentTip] = useState(0);

  const tokenBalance: TokenBalance | null = profile
    ? {
        userId: profile.id,
        monthlyTokens: profile.credits_balance,
        purchasedTokens: 0,
        usedThisMonth: 0,
        lastResetDate: profile.updated_at || profile.created_at,
      }
    : null;

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTip((prev) => (prev + 1) % TIPS.length);
    }, 12000);
    return () => clearInterval(timer);
  }, []);

  async function loadDashboardData() {
    setIsLoading(true);
    try {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const [
        { data: clipsData },
        { data: episodesData },
        { count: clipCount },
        { count: episodeCount },
        { count: weekCount },
      ] = await Promise.all([
        supabase
          .from('clips')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('episodes')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('clips')
          .select('*', { count: 'exact', head: true }),
        supabase
          .from('episodes')
          .select('*', { count: 'exact', head: true }),
        supabase
          .from('clips')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', weekAgo.toISOString()),
      ]);

      setClips(clipsData || []);
      setEpisodes(episodesData || []);
      setTotalClips(clipCount ?? (clipsData || []).length);
      setTotalEpisodes(episodeCount ?? (episodesData || []).length);
      setClipsThisWeek(weekCount ?? 0);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const scoredClips = clips.filter(c => c.viral_score && c.viral_score.overall > 0);
  const avgViralScore = scoredClips.length > 0
    ? Math.round(scoredClips.reduce((sum, c) => sum + (c.viral_score?.overall || 0), 0) / scoredClips.length)
    : 0;
  const viralClips = clips
    .filter(c => c.viral_score && c.viral_score.overall >= 60)
    .sort((a, b) => (b.viral_score?.overall || 0) - (a.viral_score?.overall || 0))
    .slice(0, 5);

  const greeting = getGreeting();
  const displayName = profile?.display_name || 'Creator';
  const tip = TIPS[currentTip];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8 space-y-6">
      {/* Welcome Section */}
      <div className="relative overflow-hidden rounded-2xl border border-zinc-800/60 bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800/50 p-6 sm:p-8">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-amber-500/5 to-transparent rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-emerald-500/5 to-transparent rounded-full translate-y-1/2 -translate-x-1/4 pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100 tracking-tight">
              {greeting}, {displayName}
            </h1>
            <p className="text-zinc-400 mt-1.5 text-sm sm:text-base">
              Here's an overview of your content studio.
            </p>
          </div>
          <div className="shrink-0">
            <TokenDisplay balance={tokenBalance} isLoading={isLoading} compact />
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl border border-zinc-800/60 bg-zinc-900/50 p-5 animate-pulse">
              <div className="flex items-start justify-between">
                <div>
                  <div className="h-3 w-20 bg-zinc-800 rounded" />
                  <div className="h-7 w-12 bg-zinc-800 rounded mt-2" />
                </div>
                <div className="h-10 w-10 bg-zinc-800 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<Film className="h-5 w-5 text-sky-400" />}
            label="Total Clips"
            value={String(totalClips)}
            subtitle="All time"
            gradient="from-sky-500/5 via-zinc-900 to-zinc-900"
            iconBg="bg-sky-500/10"
          />
          <StatCard
            icon={<Clapperboard className="h-5 w-5 text-amber-400" />}
            label="Episodes"
            value={String(totalEpisodes)}
            subtitle="Produced"
            gradient="from-amber-500/5 via-zinc-900 to-zinc-900"
            iconBg="bg-amber-500/10"
          />
          <StatCard
            icon={<TrendingUp className="h-5 w-5 text-emerald-400" />}
            label="Avg Viral Score"
            value={avgViralScore > 0 ? String(avgViralScore) : 'N/A'}
            subtitle={avgViralScore >= 70 ? 'Trending potential' : avgViralScore > 0 ? 'Room to grow' : 'No scores yet'}
            gradient="from-emerald-500/5 via-zinc-900 to-zinc-900"
            iconBg="bg-emerald-500/10"
            valueColor={avgViralScore >= 70 ? 'text-emerald-400' : undefined}
          />
          <StatCard
            icon={<CalendarDays className="h-5 w-5 text-rose-400" />}
            label="This Week"
            value={String(clipsThisWeek)}
            subtitle="Clips created"
            gradient="from-rose-500/5 via-zinc-900 to-zinc-900"
            iconBg="bg-rose-500/10"
          />
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <QuickActionCard
            icon={<Plus className="h-5 w-5 text-amber-400" />}
            title="Create New Clip"
            description="Start a new video project"
            onClick={() => navigate('/create')}
            hoverBorder="hover:border-amber-500/40"
            iconBg="bg-amber-500/10"
          />
          <QuickActionCard
            icon={<Clapperboard className="h-5 w-5 text-sky-400" />}
            title="Start Episode"
            description="Build a multi-shot episode"
            onClick={() => navigate('/episodes/new')}
            hoverBorder="hover:border-sky-500/40"
            iconBg="bg-sky-500/10"
          />
          <QuickActionCard
            icon={<Library className="h-5 w-5 text-emerald-400" />}
            title="Browse Library"
            description="View all your content"
            onClick={() => navigate('/library')}
            hoverBorder="hover:border-emerald-500/40"
            iconBg="bg-emerald-500/10"
          />
        </div>
      </div>

      {/* Navigation Shortcuts */}
      <div>
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">Explore</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <NavShortcut icon={<BarChart3 className="h-4 w-4 text-sky-400" />} label="Analytics" onClick={() => navigate('/analytics')} />
          <NavShortcut icon={<MessageSquare className="h-4 w-4 text-amber-400" />} label="Questions" onClick={() => navigate('/questions')} />
          <NavShortcut icon={<LayoutGrid className="h-4 w-4 text-emerald-400" />} label="Templates" onClick={() => navigate('/templates')} />
          <NavShortcut icon={<Settings className="h-4 w-4 text-zinc-400" />} label="Settings" onClick={() => navigate('/settings')} />
        </div>
      </div>

      <div className="border-t border-zinc-800/40" />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Activity */}
          <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-zinc-200">Recent Activity</h2>
              {(clips.length > 0 || episodes.length > 0) && (
                <button
                  onClick={() => navigate('/library')}
                  className="text-xs font-medium text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors"
                >
                  View all <ChevronRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {clips.length === 0 && episodes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-zinc-800/50 flex items-center justify-center mb-4">
                  <Film className="h-8 w-8 text-zinc-600" />
                </div>
                <h3 className="text-sm font-medium text-zinc-400">No content yet</h3>
                <p className="text-xs text-zinc-600 mt-1 max-w-[220px]">
                  Create your first clip to start seeing your activity here.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {clips.slice(0, 4).map((clip) => (
                  <ActivityItem
                    key={clip.id}
                    type="clip"
                    title={clip.topic}
                    videoType={clip.video_type}
                    subtitle={`${clip.duration_seconds}s`}
                    status={clip.status}
                    timestamp={clip.created_at}
                    onClick={() => navigate('/clips/' + clip.id)}
                    viralScore={clip.viral_score}
                  />
                ))}
                {episodes.slice(0, 2).map((episode) => (
                  <ActivityItem
                    key={episode.id}
                    type="episode"
                    title={episode.script?.topic || 'Episode'}
                    videoType="episode"
                    subtitle={`${episode.total_duration_seconds}s`}
                    status={episode.status}
                    timestamp={episode.created_at}
                    onClick={() => navigate('/episodes/' + episode.id)}
                  />
                ))}
              </div>
            )}
          </div>

          <TokenDisplay balance={tokenBalance} isLoading={isLoading} />
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Viral Potential */}
          <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <Flame className="h-4 w-4 text-orange-400" />
              </div>
              <h2 className="text-base font-semibold text-zinc-200">Viral Potential</h2>
            </div>
            {viralClips.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-12 h-12 rounded-xl bg-zinc-800/50 flex items-center justify-center mb-3">
                  <TrendingUp className="h-6 w-6 text-zinc-600" />
                </div>
                <p className="text-xs font-medium text-zinc-500">No viral scores yet</p>
                <p className="text-[11px] text-zinc-600 mt-1">Generate clips to see their viral potential</p>
              </div>
            ) : (
              <div className="space-y-3">
                {viralClips.map((clip, index) => (
                  <button
                    key={clip.id}
                    onClick={() => navigate('/clips/' + clip.id)}
                    className="w-full p-3 rounded-xl bg-zinc-800/30 hover:bg-zinc-800/60 border border-transparent hover:border-zinc-700/40 cursor-pointer transition-all duration-200 text-left group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[11px] font-bold text-zinc-600 w-4 shrink-0">#{index + 1}</span>
                        <span className="text-sm text-zinc-300 truncate group-hover:text-zinc-100 transition-colors">
                          {clip.topic}
                        </span>
                      </div>
                      <span className={`text-sm font-bold tabular-nums shrink-0 ml-2 ${getScoreColor(clip.viral_score?.overall || 0)}`}>
                        {clip.viral_score?.overall}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${getScoreBarColor(clip.viral_score?.overall || 0)}`}
                          style={{ width: `${clip.viral_score?.overall || 0}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-zinc-600 shrink-0">{prettyVideoType(clip.video_type)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Pro Tips */}
          <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Lightbulb className="h-4 w-4 text-amber-400" />
                </div>
                <h2 className="text-base font-semibold text-zinc-200">Pro Tip</h2>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentTip((prev) => (prev - 1 + TIPS.length) % TIPS.length)}
                  className="p-1 rounded-md hover:bg-zinc-800 text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span className="text-[11px] text-zinc-600 tabular-nums w-8 text-center">
                  {currentTip + 1}/{TIPS.length}
                </span>
                <button
                  onClick={() => setCurrentTip((prev) => (prev + 1) % TIPS.length)}
                  className="p-1 rounded-md hover:bg-zinc-800 text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="min-h-[64px]">
              <p className="text-sm font-medium text-zinc-300 mb-1">{tip.title}</p>
              <p className="text-xs text-zinc-500 leading-relaxed">{tip.text}</p>
            </div>
            <div className="flex gap-1 mt-3">
              {TIPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentTip(i)}
                  className={`h-1 rounded-full transition-all duration-300 ${
                    i === currentTip ? 'bg-amber-400/60 w-6' : 'bg-zinc-800 w-2'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-zinc-800/40" />

      {/* Creation Modes */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-200">Create New Content</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Choose a style to start building your next viral clip.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {CREATION_MODES.map((mode) => (
            <button
              key={mode.type}
              onClick={() => navigate(mode.route)}
              className={`group relative flex flex-col rounded-2xl border bg-gradient-to-br ${mode.gradient} ${mode.borderColor} p-6 text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-black/20`}
            >
              <div className="flex items-start justify-between">
                <div className={`${mode.accentColor}`}>
                  {mode.icon}
                </div>
                <ArrowRight className={`h-4 w-4 ${mode.accentColor} opacity-0 group-hover:opacity-100 translate-x-0 group-hover:translate-x-1 transition-all`} />
              </div>

              <h3 className="text-lg font-semibold text-zinc-100 mt-4">{mode.title}</h3>
              <p className="mt-1 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                {mode.subtitle}
              </p>

              <p className="mt-3 text-sm text-zinc-400 leading-relaxed flex-1">
                {mode.description}
              </p>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {mode.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md bg-zinc-800/80 border border-zinc-700/40 px-2 py-0.5 text-[11px] text-zinc-500"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function getScoreColor(value: number) {
  if (value >= 80) return 'text-emerald-400';
  if (value >= 60) return 'text-amber-400';
  return 'text-orange-400';
}

function getScoreBarColor(value: number) {
  if (value >= 80) return 'bg-emerald-400';
  if (value >= 60) return 'bg-amber-400';
  return 'bg-orange-400';
}

function prettyVideoType(type: string) {
  return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle: string;
  gradient: string;
  iconBg: string;
  valueColor?: string;
}

function StatCard({ icon, label, value, subtitle, gradient, iconBg, valueColor }: StatCardProps) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-zinc-800/60 bg-gradient-to-br ${gradient} p-5 transition-all duration-300 hover:border-zinc-700/60 hover:shadow-lg hover:shadow-black/20`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{label}</p>
          <p className={`text-2xl font-bold mt-1.5 ${valueColor || 'text-zinc-100'}`}>{value}</p>
          <p className="text-xs text-zinc-500 mt-1">{subtitle}</p>
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

interface QuickActionCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  hoverBorder: string;
  iconBg: string;
}

function QuickActionCard({ icon, title, description, onClick, hoverBorder, iconBg }: QuickActionCardProps) {
  return (
    <button
      onClick={onClick}
      className={`group relative flex items-center gap-4 rounded-xl border border-zinc-800/60 ${hoverBorder} bg-zinc-900/50 p-4 text-left transition-all duration-300 hover:bg-zinc-900 hover:shadow-lg hover:shadow-black/20 w-full`}
    >
      <div className={`relative w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-zinc-200">{title}</p>
        <p className="text-xs text-zinc-500 mt-0.5">{description}</p>
      </div>
      <ArrowRight className="h-4 w-4 text-zinc-600 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0" />
    </button>
  );
}

interface NavShortcutProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}

function NavShortcut({ icon, label, onClick }: NavShortcutProps) {
  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-3 rounded-xl border border-zinc-800/40 bg-zinc-900/30 px-4 py-3 transition-all duration-200 hover:bg-zinc-800/50 hover:border-zinc-700/50"
    >
      {icon}
      <span className="text-sm text-zinc-400 group-hover:text-zinc-200 transition-colors">{label}</span>
      <ChevronRight className="h-3.5 w-3.5 text-zinc-600 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

const TYPE_ICON_MAP: Record<string, { color: string; bg: string }> = {
  subway_interview: { color: 'text-amber-400', bg: 'bg-amber-500/10' },
  street_interview: { color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  motivational: { color: 'text-rose-400', bg: 'bg-rose-500/10' },
  wisdom_interview: { color: 'text-amber-400', bg: 'bg-amber-500/10' },
  studio_interview: { color: 'text-sky-400', bg: 'bg-sky-500/10' },
  episode: { color: 'text-amber-400', bg: 'bg-amber-500/10' },
};

interface ActivityItemProps {
  type: 'clip' | 'episode';
  title: string;
  videoType: string;
  subtitle: string;
  status: string;
  timestamp: string;
  onClick: () => void;
  viralScore?: ViralScore | null;
}

function ActivityItem({ type, title, videoType, subtitle, status, timestamp, onClick, viralScore }: ActivityItemProps) {
  const typeConfig = TYPE_ICON_MAP[videoType] || TYPE_ICON_MAP.subway_interview;
  const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.queued;
  const isProcessing = status === 'running' || status === 'generating' || status === 'stitching';

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 p-3.5 rounded-xl bg-zinc-800/30 hover:bg-zinc-800/60 border border-transparent hover:border-zinc-700/40 cursor-pointer transition-all duration-200 text-left group"
    >
      <div className={`relative w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${typeConfig.bg}`}>
        {isProcessing ? (
          <Loader2 className={`h-5 w-5 ${typeConfig.color} animate-spin`} />
        ) : type === 'clip' ? (
          <Film className={`h-5 w-5 ${typeConfig.color}`} />
        ) : (
          <Users className={`h-5 w-5 ${typeConfig.color}`} />
        )}
        {isProcessing && (
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-200 truncate">{title}</span>
          {viralScore && viralScore.overall >= 70 && (
            <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md bg-orange-500/15 text-orange-400 border border-orange-500/20 shrink-0">
              {viralScore.overall}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-xs text-zinc-500">{prettyVideoType(type === 'clip' ? videoType : 'episode')}</span>
          <span className="text-zinc-700 text-xs">--</span>
          <span className="text-xs text-zinc-500">{subtitle}</span>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full border ${statusConfig.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot} ${isProcessing ? 'animate-pulse' : ''}`} />
          {statusConfig.label}
        </span>
        <span className="text-[11px] text-zinc-600">{formatDistanceToNow(timestamp)}</span>
      </div>
    </button>
  );
}

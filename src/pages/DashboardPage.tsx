import { useState, useEffect } from 'react';
import {
  Film,
  TrendingUp,
  Clock,
  Zap,
  Plus,
  Library,
  Sparkles,
  ChevronRight,
  BarChart3,
  Users,
  Flame,
} from 'lucide-react';
import { TokenDisplay } from '../components/TokenDisplay';
import { ViralScoreCard } from '../components/ViralScoreCard';
import type { Clip, Episode, TokenBalance, ViralScore } from '../lib/types';
import { supabase } from '../lib/supabase';
import { formatDistanceToNow } from '../lib/format';

interface DashboardPageProps {
  onCreateClip: () => void;
  onViewLibrary: () => void;
  onViewClip: (clipId: string) => void;
  onViewEpisode: (episodeId: string) => void;
  onEpisodeBuilder: () => void;
}

interface DashboardStats {
  totalClips: number;
  totalEpisodes: number;
  clipsThisWeek: number;
  averageViralScore: number;
}

export function DashboardPage({
  onCreateClip,
  onViewLibrary,
  onViewClip,
  onViewEpisode,
  onEpisodeBuilder,
}: DashboardPageProps) {
  const [clips, setClips] = useState<Clip[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [tokenBalance, setTokenBalance] = useState<TokenBalance | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalClips: 0,
    totalEpisodes: 0,
    clipsThisWeek: 0,
    averageViralScore: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    setIsLoading(true);
    try {
      // Load recent clips
      const { data: clipsData } = await supabase
        .from('clips')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      // Load recent episodes
      const { data: episodesData } = await supabase
        .from('episodes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3);

      // Load stats
      const { count: totalClips } = await supabase
        .from('clips')
        .select('*', { count: 'exact', head: true });

      const { count: totalEpisodes } = await supabase
        .from('episodes')
        .select('*', { count: 'exact', head: true });

      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const { count: clipsThisWeek } = await supabase
        .from('clips')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', oneWeekAgo.toISOString());

      setClips(clipsData || []);
      setEpisodes(episodesData || []);
      setStats({
        totalClips: totalClips || 0,
        totalEpisodes: totalEpisodes || 0,
        clipsThisWeek: clipsThisWeek || 0,
        averageViralScore: 0, // Would calculate from viral_scores table
      });

      // Mock token balance for now
      setTokenBalance({
        userId: 'user',
        monthlyTokens: 200,
        purchasedTokens: 50,
        usedThisMonth: 75,
        lastResetDate: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const viralClips = clips.filter(c => c.viral_score && c.viral_score.overall >= 70).slice(0, 3);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-zinc-100">Dashboard</h1>
          <p className="text-zinc-400 mt-1">Welcome back! Here's what's happening with your content.</p>
        </div>
        <TokenDisplay balance={tokenBalance} isLoading={isLoading} compact />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={<Film className="h-5 w-5" />}
          label="Total Clips"
          value={stats.totalClips}
          trend={`+${stats.clipsThisWeek} this week`}
          color="blue"
        />
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Episodes"
          value={stats.totalEpisodes}
          color="purple"
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Avg Viral Score"
          value={stats.averageViralScore || '--'}
          color="emerald"
        />
        <StatCard
          icon={<Clock className="h-5 w-5" />}
          label="Recent Activity"
          value={clips.length > 0 ? formatDistanceToNow(clips[0]?.created_at) : '--'}
          color="amber"
        />
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-zinc-100 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <QuickActionButton
            icon={<Plus className="h-5 w-5" />}
            label="Create Clip"
            description="Generate a new video"
            onClick={onCreateClip}
            color="emerald"
          />
          <QuickActionButton
            icon={<Film className="h-5 w-5" />}
            label="Episode Builder"
            description="Create full episodes"
            onClick={onEpisodeBuilder}
            color="amber"
          />
          <QuickActionButton
            icon={<Library className="h-5 w-5" />}
            label="Library"
            description="View all content"
            onClick={onViewLibrary}
            color="blue"
          />
          <QuickActionButton
            icon={<BarChart3 className="h-5 w-5" />}
            label="Analytics"
            description="Coming soon"
            onClick={() => {}}
            color="purple"
            disabled
          />
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-zinc-100">Recent Activity</h2>
              <button
                onClick={onViewLibrary}
                className="text-sm text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
              >
                View all <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {clips.length === 0 && episodes.length === 0 ? (
              <div className="text-center py-8 text-zinc-500">
                <Film className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No content yet</p>
                <p className="text-sm mt-1">Create your first clip to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {clips.slice(0, 3).map((clip) => (
                  <ActivityItem
                    key={clip.id}
                    type="clip"
                    title={clip.topic}
                    subtitle={`${clip.video_type.replace('_', ' ')} • ${clip.duration_seconds}s`}
                    status={clip.status}
                    timestamp={clip.created_at}
                    onClick={() => onViewClip(clip.id)}
                    viralScore={clip.viral_score}
                  />
                ))}
                {episodes.slice(0, 2).map((episode) => (
                  <ActivityItem
                    key={episode.id}
                    type="episode"
                    title={episode.script?.topic || 'Episode'}
                    subtitle={`${episode.total_duration_seconds}s • ${episode.city_style}`}
                    status={episode.status}
                    timestamp={episode.created_at}
                    onClick={() => onViewEpisode(episode.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Token Balance Full */}
          <TokenDisplay balance={tokenBalance} isLoading={isLoading} />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Viral Potential */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Flame className="h-5 w-5 text-orange-400" />
              <h2 className="text-lg font-semibold text-zinc-100">Viral Potential</h2>
            </div>

            {viralClips.length === 0 ? (
              <div className="text-center py-6 text-zinc-500">
                <p className="text-sm">No viral scores yet</p>
                <p className="text-xs mt-1">Generate clips to see viral potential</p>
              </div>
            ) : (
              <div className="space-y-3">
                {viralClips.map((clip) => (
                  <div
                    key={clip.id}
                    onClick={() => onViewClip(clip.id)}
                    className="p-3 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 cursor-pointer transition"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-300 truncate">{clip.topic}</span>
                      <span className="text-sm font-medium text-emerald-400">
                        {clip.viral_score?.overall}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-500 mt-1">
                      {clip.video_type.replace('_', ' ')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tips */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-5 w-5 text-amber-400" />
              <h2 className="text-lg font-semibold text-zinc-100">Tips</h2>
            </div>
            <ul className="space-y-3 text-sm text-zinc-400">
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 mt-0.5">•</span>
                Use "Hot Take Challenge" mode for controversial topics
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 mt-0.5">•</span>
                4-6 second clips perform best on social media
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 mt-0.5">•</span>
                Studio interviews work great for expert content
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  trend?: string;
  color: 'blue' | 'purple' | 'emerald' | 'amber';
}

function StatCard({ icon, label, value, trend, color }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  };

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
      <div className={`w-10 h-10 rounded-xl ${colorClasses[color]} flex items-center justify-center mb-3`}>
        {icon}
      </div>
      <div className="text-2xl font-bold text-zinc-100">{value}</div>
      <div className="text-sm text-zinc-500">{label}</div>
      {trend && <div className="text-xs text-emerald-400 mt-1">{trend}</div>}
    </div>
  );
}

interface QuickActionButtonProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
  color: 'emerald' | 'amber' | 'blue' | 'purple';
  disabled?: boolean;
}

function QuickActionButton({ icon, label, description, onClick, color, disabled }: QuickActionButtonProps) {
  const colorClasses = {
    emerald: 'hover:bg-emerald-500/10 hover:border-emerald-500/30',
    amber: 'hover:bg-amber-500/10 hover:border-amber-500/30',
    blue: 'hover:bg-blue-500/10 hover:border-blue-500/30',
    purple: 'hover:bg-purple-500/10 hover:border-purple-500/30',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`p-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 text-left transition-all ${
        disabled ? 'opacity-50 cursor-not-allowed' : colorClasses[color]
      }`}
    >
      <div className="text-zinc-400 mb-2">{icon}</div>
      <div className="font-medium text-zinc-100">{label}</div>
      <div className="text-xs text-zinc-500">{description}</div>
    </button>
  );
}

interface ActivityItemProps {
  type: 'clip' | 'episode';
  title: string;
  subtitle: string;
  status: string;
  timestamp: string;
  onClick: () => void;
  viralScore?: ViralScore | null;
}

function ActivityItem({ type, title, subtitle, status, timestamp, onClick, viralScore }: ActivityItemProps) {
  const statusColors: Record<string, string> = {
    queued: 'text-yellow-400 bg-yellow-400/10',
    running: 'text-blue-400 bg-blue-400/10',
    generating: 'text-blue-400 bg-blue-400/10',
    stitching: 'text-purple-400 bg-purple-400/10',
    done: 'text-emerald-400 bg-emerald-400/10',
    error: 'text-red-400 bg-red-400/10',
  };

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-4 p-3 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 cursor-pointer transition"
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${type === 'clip' ? 'bg-blue-500/10 text-blue-400' : 'bg-amber-500/10 text-amber-400'}`}>
        {type === 'clip' ? <Film className="h-5 w-5" /> : <Users className="h-5 w-5" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-100 truncate">{title}</span>
          {viralScore && viralScore.overall >= 70 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400">
              {viralScore.overall}
            </span>
          )}
        </div>
        <div className="text-xs text-zinc-500">{subtitle}</div>
      </div>
      <div className="text-right">
        <span className={`text-xs px-2 py-1 rounded-full ${statusColors[status] || 'text-zinc-400 bg-zinc-800'}`}>
          {status}
        </span>
        <div className="text-xs text-zinc-600 mt-1">{formatDistanceToNow(timestamp)}</div>
      </div>
    </div>
  );
}

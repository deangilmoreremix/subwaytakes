import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Film,
  ChevronRight,
  Users,
  Flame,
  Sparkles,
  Train,
  Video,
  Heart,
  ArrowRight,
  Clapperboard,
  TrendingUp,
  Clock,
} from 'lucide-react';
import { TokenDisplay } from '../components/TokenDisplay';
import type { Clip, Episode, TokenBalance, ViralScore, ClipType } from '../lib/types';
import { supabase } from '../lib/supabase';
import { formatDistanceToNow } from '../lib/format';
import { useAuth } from '../lib/auth';

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

export function DashboardPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [clips, setClips] = useState<Clip[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  async function loadDashboardData() {
    setIsLoading(true);
    try {
      const [{ data: clipsData }, { data: episodesData }] = await Promise.all([
        supabase
          .from('clips')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('episodes')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(3),
      ]);

      setClips(clipsData || []);
      setEpisodes(episodesData || []);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const viralClips = clips.filter(c => c.viral_score && c.viral_score.overall >= 70).slice(0, 3);
  const avgViralScore = viralClips.length > 0
    ? Math.round(viralClips.reduce((sum, c) => sum + (c.viral_score?.overall || 0), 0) / viralClips.length)
    : 0;
  const recentClip = clips[0];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-zinc-100">Dashboard</h1>
          <p className="text-zinc-400 mt-1">Overview of your content and quick access to creation tools.</p>
        </div>
        <TokenDisplay balance={tokenBalance} isLoading={isLoading} compact />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={<Film className="h-5 w-5" />}
          label="Total Clips"
          value={isLoading ? '--' : String(clips.length)}
          iconBg="bg-blue-500/10 text-blue-400"
        />
        <StatCard
          icon={<Clapperboard className="h-5 w-5" />}
          label="Episodes"
          value={isLoading ? '--' : String(episodes.length)}
          iconBg="bg-amber-500/10 text-amber-400"
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Avg Viral Score"
          value={isLoading ? '--' : avgViralScore > 0 ? String(avgViralScore) : 'N/A'}
          iconBg="bg-emerald-500/10 text-emerald-400"
        />
        <StatCard
          icon={<Clock className="h-5 w-5" />}
          label="Last Created"
          value={isLoading ? '--' : recentClip ? formatDistanceToNow(recentClip.created_at) : 'Never'}
          iconBg="bg-rose-500/10 text-rose-400"
        />
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-semibold text-zinc-100 mb-4">Create New Content</h2>
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 mb-10">
        {CREATION_MODES.map((mode) => (
          <button
            key={mode.type}
            onClick={() => navigate(mode.route)}
            className={`group relative flex flex-col rounded-2xl border bg-gradient-to-br ${mode.gradient} ${mode.borderColor} p-6 text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-black/20`}
          >
            <div className={`mb-4 ${mode.accentColor}`}>
              {mode.icon}
            </div>

            <h3 className="text-lg font-semibold text-zinc-100">{mode.title}</h3>
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
                  className="rounded-full bg-zinc-800/80 px-2.5 py-0.5 text-xs text-zinc-400"
                >
                  {tag}
                </span>
              ))}
            </div>

            <div className={`mt-5 flex items-center gap-1.5 text-sm font-medium ${mode.accentColor} opacity-0 group-hover:opacity-100 transition-opacity`}>
              Start creating
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-zinc-100">Recent Activity</h2>
              <button
                onClick={() => navigate('/library')}
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
                    onClick={() => navigate('/clips/' + clip.id)}
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
                    onClick={() => navigate('/episodes/' + episode.id)}
                  />
                ))}
              </div>
            )}
          </div>

          <TokenDisplay balance={tokenBalance} isLoading={isLoading} />
        </div>

        <div className="space-y-6">
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
                    onClick={() => navigate('/clips/' + clip.id)}
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
  value: string;
  iconBg: string;
}

function StatCard({ icon, label, value, iconBg }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
        <div>
          <p className="text-xs text-zinc-500">{label}</p>
          <p className="text-lg font-semibold text-zinc-100">{value}</p>
        </div>
      </div>
    </div>
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

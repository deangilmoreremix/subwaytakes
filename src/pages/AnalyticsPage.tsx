import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Film,
  TrendingUp,
  Clock,
  Zap,
  Download,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { clsx, prettyType } from '../lib/format';
import type { Clip, ViralScore } from '../lib/types';

type TimeRange = '7d' | '30d' | '90d' | 'all';

interface AnalyticsData {
  totalClips: number;
  totalEpisodes: number;
  totalExports: number;
  clipsInRange: number;
  previousClipsInRange: number;
  episodesInRange: number;
  exportsInRange: number;
  avgViralScore: number;
  statusBreakdown: Record<string, number>;
  typeBreakdown: Record<string, number>;
  platformBreakdown: Record<string, number>;
  topClips: Array<Clip & { viral_score: ViralScore }>;
  dailyClips: Array<{ date: string; count: number }>;
}

function getDateRange(range: TimeRange): Date | null {
  if (range === 'all') return null;
  const now = new Date();
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function getPreviousDateRange(range: TimeRange): { start: Date; end: Date } | null {
  if (range === 'all') return null;
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  const end = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  return { start, end };
}

export function AnalyticsPage() {
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  async function loadAnalytics() {
    setLoading(true);
    try {
      const rangeStart = getDateRange(timeRange);
      const prevRange = getPreviousDateRange(timeRange);

      const [
        { count: totalClips },
        { count: totalEpisodes },
        { count: totalExports },
        { data: rangeClips },
        { count: previousClipsInRange },
        { count: episodesInRange },
        { count: exportsInRange },
        { data: exportData },
      ] = await Promise.all([
        supabase.from('clips').select('*', { count: 'exact', head: true }),
        supabase.from('episodes').select('*', { count: 'exact', head: true }),
        supabase.from('video_exports').select('*', { count: 'exact', head: true }),
        rangeStart
          ? supabase.from('clips').select('*').gte('created_at', rangeStart.toISOString()).order('created_at', { ascending: false })
          : supabase.from('clips').select('*').order('created_at', { ascending: false }),
        prevRange
          ? supabase.from('clips').select('*', { count: 'exact', head: true }).gte('created_at', prevRange.start.toISOString()).lt('created_at', prevRange.end.toISOString())
          : supabase.from('clips').select('*', { count: 'exact', head: true }),
        rangeStart
          ? supabase.from('episodes').select('*', { count: 'exact', head: true }).gte('created_at', rangeStart.toISOString())
          : supabase.from('episodes').select('*', { count: 'exact', head: true }),
        rangeStart
          ? supabase.from('video_exports').select('*', { count: 'exact', head: true }).gte('created_at', rangeStart.toISOString())
          : supabase.from('video_exports').select('*', { count: 'exact', head: true }),
        supabase.from('video_exports').select('platform').not('platform', 'is', null),
      ]);

      const clips = rangeClips || [];

      const statusBreakdown: Record<string, number> = {};
      const typeBreakdown: Record<string, number> = {};
      let viralTotal = 0;
      let viralCount = 0;

      clips.forEach((clip: Clip) => {
        statusBreakdown[clip.status] = (statusBreakdown[clip.status] || 0) + 1;
        typeBreakdown[clip.video_type] = (typeBreakdown[clip.video_type] || 0) + 1;
        if (clip.viral_score && clip.viral_score.overall > 0) {
          viralTotal += clip.viral_score.overall;
          viralCount++;
        }
      });

      const platformBreakdown: Record<string, number> = {};
      (exportData || []).forEach((exp: { platform: string }) => {
        platformBreakdown[exp.platform] = (platformBreakdown[exp.platform] || 0) + 1;
      });

      const topClips = clips
        .filter((c: Clip) => c.viral_score && c.viral_score.overall > 0)
        .sort((a: Clip, b: Clip) => (b.viral_score?.overall || 0) - (a.viral_score?.overall || 0))
        .slice(0, 5) as Array<Clip & { viral_score: ViralScore }>;

      const dailyMap = new Map<string, number>();
      clips.forEach((clip: Clip) => {
        const day = clip.created_at.slice(0, 10);
        dailyMap.set(day, (dailyMap.get(day) || 0) + 1);
      });
      const dailyClips = Array.from(dailyMap.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      setData({
        totalClips: totalClips || 0,
        totalEpisodes: totalEpisodes || 0,
        totalExports: totalExports || 0,
        clipsInRange: clips.length,
        previousClipsInRange: previousClipsInRange || 0,
        episodesInRange: episodesInRange || 0,
        exportsInRange: exportsInRange || 0,
        avgViralScore: viralCount > 0 ? Math.round(viralTotal / viralCount) : 0,
        statusBreakdown,
        typeBreakdown,
        platformBreakdown,
        topClips,
        dailyClips,
      });
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 text-amber-500 animate-spin" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const clipsTrend = data.previousClipsInRange > 0
    ? Math.round(((data.clipsInRange - data.previousClipsInRange) / data.previousClipsInRange) * 100)
    : data.clipsInRange > 0 ? 100 : 0;

  const maxDaily = Math.max(...data.dailyClips.map(d => d.count), 1);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-zinc-100">Analytics</h1>
          <p className="text-zinc-400 mt-1">Track your content creation performance</p>
        </div>
        <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-900 border border-zinc-800">
          {(['7d', '30d', '90d', 'all'] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition',
                timeRange === range
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'text-zinc-400 hover:text-zinc-200'
              )}
            >
              {range === 'all' ? 'All Time' : range.replace('d', ' days')}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <MetricCard
          icon={<Film className="h-5 w-5" />}
          label="Clips Created"
          value={data.clipsInRange}
          total={data.totalClips}
          trend={clipsTrend}
          color="blue"
        />
        <MetricCard
          icon={<BarChart3 className="h-5 w-5" />}
          label="Episodes"
          value={data.episodesInRange}
          total={data.totalEpisodes}
          color="amber"
        />
        <MetricCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Avg Viral Score"
          value={data.avgViralScore || '--'}
          color="emerald"
        />
        <MetricCard
          icon={<Download className="h-5 w-5" />}
          label="Exports"
          value={data.exportsInRange}
          total={data.totalExports}
          color="cyan"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="text-sm font-semibold text-zinc-100 mb-4">Clip Generation Activity</h2>
          {data.dailyClips.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">
              <Clock className="h-8 w-8 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No activity data for this period</p>
            </div>
          ) : (
            <div className="flex items-end gap-1 h-40">
              {data.dailyClips.map((day) => (
                <div
                  key={day.date}
                  className="flex-1 min-w-[4px] group relative"
                  title={`${day.date}: ${day.count} clips`}
                >
                  <div
                    className="w-full rounded-t bg-amber-500/60 hover:bg-amber-500/80 transition-colors"
                    style={{ height: `${(day.count / maxDaily) * 100}%`, minHeight: '4px' }}
                  />
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block z-10">
                    <div className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-[10px] text-zinc-200 whitespace-nowrap shadow-lg">
                      {day.date}: {day.count} clip{day.count !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="text-sm font-semibold text-zinc-100 mb-4">Generation Status</h2>
          <div className="space-y-3">
            {Object.entries(data.statusBreakdown).map(([status, count]) => {
              const total = data.clipsInRange || 1;
              const pct = Math.round((count / total) * 100);
              const colors: Record<string, string> = {
                done: 'bg-emerald-500',
                running: 'bg-amber-500',
                queued: 'bg-blue-500',
                error: 'bg-red-500',
              };
              return (
                <div key={status}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-zinc-400 capitalize">{status}</span>
                    <span className="text-xs text-zinc-300">{count} ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={clsx('h-full rounded-full transition-all', colors[status] || 'bg-zinc-600')}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {Object.keys(data.statusBreakdown).length === 0 && (
              <p className="text-xs text-zinc-500 text-center py-4">No data</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="text-sm font-semibold text-zinc-100 mb-4">By Video Type</h2>
          <div className="space-y-3">
            {Object.entries(data.typeBreakdown)
              .sort(([, a], [, b]) => b - a)
              .map(([type, count]) => (
                <div key={type} className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">{prettyType(type)}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full"
                        style={{ width: `${(count / (data.clipsInRange || 1)) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-zinc-300 w-8 text-right">{count}</span>
                  </div>
                </div>
              ))}
            {Object.keys(data.typeBreakdown).length === 0 && (
              <p className="text-xs text-zinc-500 text-center py-4">No data</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="text-sm font-semibold text-zinc-100 mb-4">Export Platforms</h2>
          <div className="space-y-3">
            {Object.entries(data.platformBreakdown)
              .sort(([, a], [, b]) => b - a)
              .map(([platform, count]) => (
                <div key={platform} className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">{prettyType(platform)}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${(count / Math.max(...Object.values(data.platformBreakdown), 1)) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-zinc-300 w-8 text-right">{count}</span>
                  </div>
                </div>
              ))}
            {Object.keys(data.platformBreakdown).length === 0 && (
              <p className="text-xs text-zinc-500 text-center py-4">No exports yet</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-zinc-100">Top Clips</h2>
            <Zap className="h-4 w-4 text-amber-400" />
          </div>
          <div className="space-y-2">
            {data.topClips.map((clip, index) => (
              <button
                key={clip.id}
                onClick={() => navigate('/clips/' + clip.id)}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-zinc-800/40 hover:bg-zinc-800 transition text-left"
              >
                <span className="text-xs font-bold text-zinc-600 w-5">{index + 1}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-zinc-200 block truncate">{clip.topic}</span>
                  <span className="text-[10px] text-zinc-500">{prettyType(clip.video_type)}</span>
                </div>
                <span className={clsx(
                  'text-xs font-bold px-2 py-0.5 rounded-full',
                  clip.viral_score.overall >= 80 ? 'text-emerald-400 bg-emerald-500/10' :
                  clip.viral_score.overall >= 60 ? 'text-amber-400 bg-amber-500/10' :
                  'text-orange-400 bg-orange-500/10'
                )}>
                  {clip.viral_score.overall}
                </span>
              </button>
            ))}
            {data.topClips.length === 0 && (
              <p className="text-xs text-zinc-500 text-center py-4">No scored clips yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  total?: number;
  trend?: number;
  color: 'blue' | 'amber' | 'emerald' | 'cyan';
}

function MetricCard({ icon, label, value, total, trend, color }: MetricCardProps) {
  const colorClasses = {
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    cyan: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  };

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
      <div className={`w-10 h-10 rounded-xl ${colorClasses[color]} flex items-center justify-center mb-3`}>
        {icon}
      </div>
      <div className="text-2xl font-bold text-zinc-100">{value}</div>
      <div className="text-sm text-zinc-500">{label}</div>
      <div className="flex items-center gap-2 mt-1">
        {total !== undefined && (
          <span className="text-[10px] text-zinc-600">{total} total</span>
        )}
        {trend !== undefined && trend !== 0 && (
          <span className={clsx(
            'text-[10px] flex items-center gap-0.5',
            trend > 0 ? 'text-emerald-400' : 'text-red-400'
          )}>
            {trend > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(trend)}%
          </span>
        )}
        {trend === 0 && total !== undefined && (
          <span className="text-[10px] text-zinc-600 flex items-center gap-0.5">
            <Minus className="h-3 w-3" />
            0%
          </span>
        )}
      </div>
    </div>
  );
}

import type { ViralScore } from '../lib/types';
import { clsx } from '../lib/format';
import { TrendingUp, Share2, RefreshCw, MessageCircle, Zap } from 'lucide-react';

interface ViralScoreCardProps {
  score: ViralScore | null;
  isLoading?: boolean;
}

export function ViralScoreCard({ score, isLoading }: ViralScoreCardProps) {
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-8 w-8 rounded-lg bg-zinc-800 animate-pulse" />
          <div className="h-6 w-32 bg-zinc-800 rounded animate-pulse" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-4 bg-zinc-800 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!score) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 text-center">
        <TrendingUp className="h-8 w-8 text-zinc-600 mx-auto mb-3" />
        <h3 className="text-sm font-medium text-zinc-400">No Viral Score Yet</h3>
        <p className="text-xs text-zinc-500 mt-1">Generate analysis to see viral potential</p>
      </div>
    );
  }

  const getScoreColor = (value: number) => {
    if (value >= 80) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    if (value >= 60) return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
    if (value >= 40) return 'text-orange-400 bg-orange-500/10 border-orange-500/30';
    return 'text-red-400 bg-red-500/10 border-red-500/30';
  };

  const getScoreBarColor = (value: number) => {
    if (value >= 80) return 'bg-emerald-400';
    if (value >= 60) return 'bg-yellow-400';
    if (value >= 40) return 'bg-orange-400';
    return 'bg-red-400';
  };

  const metrics = [
    { key: 'hookStrength', label: 'Hook Strength', icon: Zap, value: score.components.hookStrength },
    { key: 'emotionalArc', label: 'Emotional Arc', icon: TrendingUp, value: score.components.emotionalArc },
    { key: 'shareability', label: 'Shareability', icon: Share2, value: score.components.shareability },
    { key: 'replayValue', label: 'Replay Value', icon: RefreshCw, value: score.components.replayValue },
    { key: 'commentBait', label: 'Comment Bait', icon: MessageCircle, value: score.components.commentBait },
  ];

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={clsx(
            'h-10 w-10 rounded-xl flex items-center justify-center border',
            getScoreColor(score.overall)
          )}>
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-zinc-300">Viral Score</h3>
            <p className="text-xs text-zinc-500">Overall potential</p>
          </div>
        </div>
        <div className={clsx(
          'text-2xl font-bold px-4 py-2 rounded-xl border',
          getScoreColor(score.overall)
        )}>
          {score.overall}
        </div>
      </div>

      <div className="space-y-4">
        {metrics.map((metric) => (
          <div key={metric.key} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <metric.icon className="h-4 w-4 text-zinc-500" />
                <span className="text-sm text-zinc-400">{metric.label}</span>
              </div>
              <span className={clsx(
                'text-sm font-medium',
                metric.value >= 80 ? 'text-emerald-400' :
                metric.value >= 60 ? 'text-yellow-400' :
                metric.value >= 40 ? 'text-orange-400' : 'text-red-400'
              )}>
                {metric.value}
              </span>
            </div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={clsx('h-full rounded-full transition-all duration-500', getScoreBarColor(metric.value))}
                style={{ width: `${metric.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {score.suggestions.length > 0 && (
        <div className="mt-6 pt-4 border-t border-zinc-800">
          <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">Suggestions</h4>
          <ul className="space-y-2">
            {score.suggestions.map((suggestion, index) => (
              <li key={index} className="text-sm text-zinc-400 flex items-start gap-2">
                <span className="text-emerald-400 mt-0.5">•</span>
                {suggestion}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

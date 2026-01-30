import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { clsx } from '../lib/format';

interface StatusCardProps {
  status: 'planning' | 'generating' | 'done' | 'error';
  message?: string;
}

const STATUS_CONFIG = {
  planning: {
    icon: Loader2,
    text: 'Planning prompt...',
    color: 'text-amber-400',
    animate: true,
  },
  generating: {
    icon: Loader2,
    text: 'Generating clip...',
    color: 'text-emerald-400',
    animate: true,
  },
  done: {
    icon: CheckCircle2,
    text: 'Done!',
    color: 'text-emerald-400',
    animate: false,
  },
  error: {
    icon: XCircle,
    text: 'Generation failed',
    color: 'text-rose-400',
    animate: false,
  },
};

export function StatusCard({ status, message }: StatusCardProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
      <div className="flex items-center gap-3">
        <Icon
          className={clsx(
            'h-5 w-5',
            config.color,
            config.animate && 'animate-spin'
          )}
        />
        <div>
          <p className={clsx('text-sm font-medium', config.color)}>
            {message || config.text}
          </p>
        </div>
      </div>
    </div>
  );
}

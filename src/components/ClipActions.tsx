import { RefreshCw, Shuffle, Download, Link, Loader2 } from 'lucide-react';
import { clsx } from '../lib/format';

interface ClipActionsProps {
  canDownload: boolean;
  downloadUrl?: string;
  busy?: boolean;
  onRegenerate: () => void;
  onVariation: () => void;
  onCopyLink: () => void;
}

export function ClipActions({
  canDownload,
  downloadUrl,
  busy,
  onRegenerate,
  onVariation,
  onCopyLink,
}: ClipActionsProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <button
        onClick={onRegenerate}
        disabled={busy}
        className={clsx(
          'flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 transition',
          busy ? 'opacity-60 cursor-not-allowed' : 'hover:bg-zinc-200'
        )}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        Regenerate
      </button>

      <button
        onClick={onVariation}
        disabled={busy}
        className={clsx(
          'flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-zinc-100 transition',
          busy ? 'opacity-60 cursor-not-allowed' : 'hover:bg-zinc-800'
        )}
      >
        <Shuffle className="h-4 w-4" />
        Variation
      </button>

      <a
        href={canDownload ? downloadUrl : undefined}
        download
        className={clsx(
          'flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-zinc-100 transition',
          canDownload ? 'hover:bg-zinc-800' : 'opacity-50 pointer-events-none'
        )}
      >
        <Download className="h-4 w-4" />
        Download
      </a>

      <button
        onClick={onCopyLink}
        className="flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-zinc-100 transition hover:bg-zinc-800"
      >
        <Link className="h-4 w-4" />
        Copy Link
      </button>
    </div>
  );
}

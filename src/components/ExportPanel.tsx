import { useState, useEffect } from 'react';
import {
  Download,
  Check,
  Loader2,
  AlertCircle,
  Monitor,
  Smartphone,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { PLATFORM_SPECS } from '../lib/types';
import { getExportsForContent } from '../lib/templates';

interface ExportPanelProps {
  parentId: string;
  parentType: 'clip' | 'episode';
  videoUrl: string | null;
  onExport: (platform: string) => void;
  exporting: boolean;
}

interface ExistingExport {
  id: string;
  platform: string;
  status: string;
  url: string | null;
}

const PLATFORM_ICONS: Record<string, { label: string; icon: 'mobile' | 'desktop'; color: string }> = {
  tiktok: { label: 'TikTok', icon: 'mobile', color: 'text-pink-400' },
  instagram_reel: { label: 'IG Reel', icon: 'mobile', color: 'text-rose-400' },
  youtube_shorts: { label: 'YT Shorts', icon: 'mobile', color: 'text-red-400' },
  instagram_post: { label: 'IG Post', icon: 'mobile', color: 'text-rose-400' },
  facebook: { label: 'Facebook', icon: 'desktop', color: 'text-blue-400' },
  youtube: { label: 'YouTube', icon: 'desktop', color: 'text-red-500' },
  twitter: { label: 'Twitter/X', icon: 'desktop', color: 'text-sky-400' },
};

function ExportStatusBadge({ existing, onRetry }: { existing: ExistingExport; onRetry: () => void }) {
  if (existing.status === 'done' && existing.url) {
    return (
      <a
        href={existing.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[10px] font-medium hover:bg-emerald-500/20 transition"
      >
        <ExternalLink className="h-2.5 w-2.5" />
        Download
      </a>
    );
  }

  if (existing.status === 'done') {
    return <Check className="h-3 w-3 text-emerald-400" />;
  }

  if (existing.status === 'processing' || existing.status === 'queued') {
    return <Loader2 className="h-3 w-3 text-amber-400 animate-spin" />;
  }

  if (existing.status === 'error') {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); onRetry(); }}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 text-[10px] font-medium hover:bg-red-500/20 transition"
      >
        <RefreshCw className="h-2.5 w-2.5" />
        Retry
      </button>
    );
  }

  return null;
}

function PlatformButton({
  platformKey,
  spec,
  existing,
  isSelected,
  disabled,
  onToggle,
  onRetry,
}: {
  platformKey: string;
  spec: { width: number; height: number };
  existing?: ExistingExport;
  isSelected: boolean;
  disabled: boolean;
  onToggle: () => void;
  onRetry: () => void;
}) {
  const platformInfo = PLATFORM_ICONS[platformKey];

  return (
    <button
      disabled={disabled}
      onClick={onToggle}
      className={`flex flex-col items-center gap-1 p-2.5 rounded-lg border text-xs transition ${
        existing?.status === 'error'
          ? 'border-red-500/30 bg-red-500/5 text-red-300'
          : isSelected
            ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
            : existing?.status === 'done'
              ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300'
              : 'border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-600 disabled:opacity-40'
      }`}
    >
      <span className={`font-medium ${platformInfo?.color || ''}`}>
        {platformInfo?.label || platformKey}
      </span>
      <span className="text-[10px] text-zinc-500">{spec.width}x{spec.height}</span>
      {existing && <ExportStatusBadge existing={existing} onRetry={onRetry} />}
    </button>
  );
}

export function ExportPanel({ parentId, parentType, videoUrl, onExport, exporting }: ExportPanelProps) {
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [existingExports, setExistingExports] = useState<ExistingExport[]>([]);

  useEffect(() => {
    loadExports();
  }, [parentId, parentType]);

  async function loadExports() {
    const data = await getExportsForContent(parentId, parentType);
    setExistingExports(data);
  }

  function togglePlatform(platform: string) {
    setSelectedPlatforms(prev =>
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  }

  function handleExportAll() {
    selectedPlatforms.forEach(platform => onExport(platform));
    setTimeout(loadExports, 2000);
  }

  function handleRetry(platform: string) {
    onExport(platform);
    setTimeout(loadExports, 2000);
  }

  const verticalPlatforms = Object.entries(PLATFORM_SPECS).filter(([, spec]) => spec.height > spec.width);
  const horizontalPlatforms = Object.entries(PLATFORM_SPECS).filter(([, spec]) => spec.height <= spec.width);
  const squarePlatforms = Object.entries(PLATFORM_SPECS).filter(([, spec]) => spec.height === spec.width);

  const completedExports = existingExports.filter(e => e.status === 'done' && e.url);
  const errorExports = existingExports.filter(e => e.status === 'error');

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Download className="h-5 w-5 text-amber-400" />
        <h3 className="text-base font-semibold text-zinc-100">Export</h3>
        {completedExports.length > 0 && (
          <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            {completedExports.length} ready
          </span>
        )}
      </div>

      {!videoUrl && (
        <div className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2">
          <AlertCircle className="h-4 w-4 text-zinc-500" />
          <span className="text-xs text-zinc-400">Video must be generated before exporting</span>
        </div>
      )}

      {errorExports.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2">
          <AlertCircle className="h-4 w-4 text-red-400" />
          <span className="text-xs text-red-300">
            {errorExports.length} export{errorExports.length !== 1 ? 's' : ''} failed -- click "Retry" to try again
          </span>
        </div>
      )}

      <div className="space-y-3">
        <div>
          <p className="text-xs text-zinc-500 mb-2 flex items-center gap-1.5">
            <Smartphone className="h-3 w-3" />
            Vertical (9:16)
          </p>
          <div className="grid grid-cols-3 gap-2">
            {verticalPlatforms.filter(([key]) => !squarePlatforms.find(([k]) => k === key)).map(([key, spec]) => (
              <PlatformButton
                key={key}
                platformKey={key}
                spec={spec}
                existing={existingExports.find(e => e.platform === key)}
                isSelected={selectedPlatforms.includes(key)}
                disabled={!videoUrl}
                onToggle={() => togglePlatform(key)}
                onRetry={() => handleRetry(key)}
              />
            ))}
          </div>
        </div>

        {squarePlatforms.length > 0 && (
          <div>
            <p className="text-xs text-zinc-500 mb-2">Square (1:1)</p>
            <div className="grid grid-cols-3 gap-2">
              {squarePlatforms.map(([key, spec]) => (
                <PlatformButton
                  key={key}
                  platformKey={key}
                  spec={spec}
                  existing={existingExports.find(e => e.platform === key)}
                  isSelected={selectedPlatforms.includes(key)}
                  disabled={!videoUrl}
                  onToggle={() => togglePlatform(key)}
                  onRetry={() => handleRetry(key)}
                />
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="text-xs text-zinc-500 mb-2 flex items-center gap-1.5">
            <Monitor className="h-3 w-3" />
            Landscape (16:9)
          </p>
          <div className="grid grid-cols-3 gap-2">
            {horizontalPlatforms.filter(([key]) => !squarePlatforms.find(([k]) => k === key)).map(([key, spec]) => (
              <PlatformButton
                key={key}
                platformKey={key}
                spec={spec}
                existing={existingExports.find(e => e.platform === key)}
                isSelected={selectedPlatforms.includes(key)}
                disabled={!videoUrl}
                onToggle={() => togglePlatform(key)}
                onRetry={() => handleRetry(key)}
              />
            ))}
          </div>
        </div>
      </div>

      {completedExports.length > 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
          <p className="text-xs text-zinc-500 mb-2 font-medium">Ready for download</p>
          <div className="space-y-1.5">
            {completedExports.map((exp) => {
              const platformInfo = PLATFORM_ICONS[exp.platform];
              return (
                <a
                  key={exp.id}
                  href={exp.url!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700 transition"
                >
                  <span className={`text-xs font-medium ${platformInfo?.color || 'text-zinc-300'}`}>
                    {platformInfo?.label || exp.platform}
                  </span>
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    <Download className="h-3 w-3" />
                    <span className="text-[10px]">Download</span>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      )}

      {selectedPlatforms.length > 0 && (
        <button
          onClick={handleExportAll}
          disabled={exporting || !videoUrl}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-amber-400 disabled:opacity-50 transition"
        >
          {exporting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              Export to {selectedPlatforms.length} platform{selectedPlatforms.length !== 1 ? 's' : ''}
            </>
          )}
        </button>
      )}
    </div>
  );
}

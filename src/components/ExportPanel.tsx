import { useState, useEffect } from 'react';
import {
  Download,
  Check,
  Loader2,
  AlertCircle,
  Monitor,
  Smartphone,
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

const PLATFORM_ICONS: Record<string, { label: string; icon: 'mobile' | 'desktop'; color: string }> = {
  tiktok: { label: 'TikTok', icon: 'mobile', color: 'text-pink-400' },
  instagram_reel: { label: 'IG Reel', icon: 'mobile', color: 'text-rose-400' },
  youtube_shorts: { label: 'YT Shorts', icon: 'mobile', color: 'text-red-400' },
  instagram_post: { label: 'IG Post', icon: 'mobile', color: 'text-rose-400' },
  facebook: { label: 'Facebook', icon: 'desktop', color: 'text-blue-400' },
  youtube: { label: 'YouTube', icon: 'desktop', color: 'text-red-500' },
  twitter: { label: 'Twitter/X', icon: 'desktop', color: 'text-sky-400' },
};

export function ExportPanel({ parentId, parentType, videoUrl, onExport, exporting }: ExportPanelProps) {
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [existingExports, setExistingExports] = useState<Array<{
    id: string;
    platform: string;
    status: string;
    url: string | null;
  }>>([]);

  useEffect(() => {
    getExportsForContent(parentId, parentType).then(setExistingExports);
  }, [parentId, parentType]);

  function togglePlatform(platform: string) {
    setSelectedPlatforms(prev =>
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  }

  function handleExportAll() {
    selectedPlatforms.forEach(platform => onExport(platform));
  }

  const verticalPlatforms = Object.entries(PLATFORM_SPECS).filter(([, spec]) => spec.height > spec.width);
  const horizontalPlatforms = Object.entries(PLATFORM_SPECS).filter(([, spec]) => spec.height <= spec.width);
  const squarePlatforms = Object.entries(PLATFORM_SPECS).filter(([, spec]) => spec.height === spec.width);

  const allNonSquare = [
    ...verticalPlatforms.filter(([key]) => !squarePlatforms.find(([k]) => k === key)),
    ...horizontalPlatforms.filter(([key]) => !squarePlatforms.find(([k]) => k === key)),
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Download className="h-5 w-5 text-amber-400" />
        <h3 className="text-base font-semibold text-zinc-100">Export</h3>
      </div>

      {!videoUrl && (
        <div className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2">
          <AlertCircle className="h-4 w-4 text-zinc-500" />
          <span className="text-xs text-zinc-400">Video must be generated before exporting</span>
        </div>
      )}

      <div className="space-y-3">
        <div>
          <p className="text-xs text-zinc-500 mb-2 flex items-center gap-1.5">
            <Smartphone className="h-3 w-3" />
            Vertical (9:16)
          </p>
          <div className="grid grid-cols-3 gap-2">
            {verticalPlatforms.filter(([key]) => !squarePlatforms.find(([k]) => k === key)).map(([key, spec]) => {
              const platformInfo = PLATFORM_ICONS[key];
              const existing = existingExports.find(e => e.platform === key);
              const isSelected = selectedPlatforms.includes(key);

              return (
                <button
                  key={key}
                  disabled={!videoUrl}
                  onClick={() => togglePlatform(key)}
                  className={`flex flex-col items-center gap-1 p-2.5 rounded-lg border text-xs transition ${
                    isSelected
                      ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                      : existing?.status === 'done'
                        ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300'
                        : 'border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-600 disabled:opacity-40'
                  }`}
                >
                  <span className={`font-medium ${platformInfo?.color || ''}`}>
                    {platformInfo?.label || key}
                  </span>
                  <span className="text-[10px] text-zinc-500">{spec.width}x{spec.height}</span>
                  {existing?.status === 'done' && <Check className="h-3 w-3 text-emerald-400" />}
                  {existing?.status === 'processing' && <Loader2 className="h-3 w-3 text-amber-400 animate-spin" />}
                </button>
              );
            })}
          </div>
        </div>

        {squarePlatforms.length > 0 && (
          <div>
            <p className="text-xs text-zinc-500 mb-2">Square (1:1)</p>
            <div className="grid grid-cols-3 gap-2">
              {squarePlatforms.map(([key, spec]) => {
                const platformInfo = PLATFORM_ICONS[key];
                const existing = existingExports.find(e => e.platform === key);
                const isSelected = selectedPlatforms.includes(key);

                return (
                  <button
                    key={key}
                    disabled={!videoUrl}
                    onClick={() => togglePlatform(key)}
                    className={`flex flex-col items-center gap-1 p-2.5 rounded-lg border text-xs transition ${
                      isSelected
                        ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                        : existing?.status === 'done'
                          ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300'
                          : 'border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-600 disabled:opacity-40'
                    }`}
                  >
                    <span className={`font-medium ${platformInfo?.color || ''}`}>
                      {platformInfo?.label || key}
                    </span>
                    <span className="text-[10px] text-zinc-500">{spec.width}x{spec.height}</span>
                    {existing?.status === 'done' && <Check className="h-3 w-3 text-emerald-400" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <p className="text-xs text-zinc-500 mb-2 flex items-center gap-1.5">
            <Monitor className="h-3 w-3" />
            Landscape (16:9)
          </p>
          <div className="grid grid-cols-3 gap-2">
            {horizontalPlatforms.filter(([key]) => !squarePlatforms.find(([k]) => k === key)).map(([key, spec]) => {
              const platformInfo = PLATFORM_ICONS[key];
              const existing = existingExports.find(e => e.platform === key);
              const isSelected = selectedPlatforms.includes(key);

              return (
                <button
                  key={key}
                  disabled={!videoUrl}
                  onClick={() => togglePlatform(key)}
                  className={`flex flex-col items-center gap-1 p-2.5 rounded-lg border text-xs transition ${
                    isSelected
                      ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                      : existing?.status === 'done'
                        ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300'
                        : 'border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-600 disabled:opacity-40'
                  }`}
                >
                  <span className={`font-medium ${platformInfo?.color || ''}`}>
                    {platformInfo?.label || key}
                  </span>
                  <span className="text-[10px] text-zinc-500">{spec.width}x{spec.height}</span>
                  {existing?.status === 'done' && <Check className="h-3 w-3 text-emerald-400" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

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

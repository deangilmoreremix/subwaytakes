import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Play,
  Download,
  Film,
} from 'lucide-react';
import { EnhancementPanel } from '../components/EnhancementPanel';
import { ExportPanel } from '../components/ExportPanel';
import { getClipById } from '../lib/clips';
import { getEpisodeById } from '../lib/episodes';
import {
  triggerClipCompose,
  triggerComposeOverlay,
  createVideoExport,
} from '../lib/templates';
import { generateUserId, prettyType, clsx } from '../lib/format';
import type { Clip, Episode, EnhancementConfig } from '../lib/types';

interface EnhancePageProps {
  contentType: 'clip' | 'episode';
  contentId: string;
  onBack: () => void;
}

const DEFAULT_CONFIG: EnhancementConfig = {
  watermark: true,
  lowerThird: false,
  lowerThirdStyle: 'modern',
  lowerThirdName: '',
  lowerThirdTitle: '',
  captions: true,
  captionAnimation: 'static',
  musicTrackId: null,
  musicVolume: 0.3,
  sfxEnabled: false,
  colorGrade: 'none',
  endcard: false,
  endcardStyle: 'minimal',
  progressBar: true,
};

function getVideoUrl(content: Clip | Episode, type: 'clip' | 'episode'): string | null {
  if (type === 'episode') {
    const ep = content as Episode;
    return ep.composed_video_url || ep.final_video_url || null;
  }
  const clip = content as Clip;
  return clip.composed_video_url || clip.result_url || null;
}

function getRawVideoUrl(content: Clip | Episode, type: 'clip' | 'episode'): string | null {
  if (type === 'episode') {
    return (content as Episode).final_video_url || null;
  }
  return (content as Clip).result_url || null;
}

export function EnhancePage({ contentType, contentId, onBack }: EnhancePageProps) {
  const [content, setContent] = useState<Clip | Episode | null>(null);
  const [loading, setLoading] = useState(true);
  const [enhancementConfig, setEnhancementConfig] = useState<EnhancementConfig>(DEFAULT_CONFIG);
  const [composing, setComposing] = useState(false);
  const [composeStatus, setComposeStatus] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const loadContent = useCallback(async () => {
    try {
      if (contentType === 'clip') {
        const data = await getClipById(contentId);
        setContent(data);
      } else {
        const data = await getEpisodeById(contentId);
        setContent(data);
      }
    } catch (err) {
      console.error('Failed to load content:', err);
    } finally {
      setLoading(false);
    }
  }, [contentType, contentId]);

  useEffect(() => {
    loadContent();
  }, [loadContent]);

  useEffect(() => {
    if (!content) return;
    const overlayStatus = contentType === 'clip'
      ? (content as Clip).overlay_status
      : (content as Episode).overlay_status;

    if (overlayStatus === 'composing') {
      const interval = setInterval(loadContent, 3000);
      return () => clearInterval(interval);
    }
  }, [content, contentType, loadContent]);

  async function handleCompose() {
    if (!content) return;
    setComposing(true);
    setComposeStatus('composing');

    try {
      if (contentType === 'clip') {
        await triggerClipCompose(contentId);
      } else {
        await triggerComposeOverlay(contentId);
      }

      const pollInterval = setInterval(async () => {
        await loadContent();
        const fresh = contentType === 'clip'
          ? await getClipById(contentId)
          : await getEpisodeById(contentId);

        if (fresh) {
          const status = contentType === 'clip'
            ? (fresh as Clip).overlay_status
            : (fresh as Episode).overlay_status;

          if (status === 'done' || status === 'error') {
            clearInterval(pollInterval);
            setComposing(false);
            setComposeStatus(status);
            setContent(fresh);
          }
        }
      }, 3000);
    } catch (err) {
      console.error('Compose failed:', err);
      setComposing(false);
      setComposeStatus('error');
    }
  }

  async function handleExport(platform: string) {
    if (!content) return;
    setExporting(true);
    try {
      const userId = generateUserId();
      await createVideoExport(contentId, contentType, platform, userId);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 text-amber-500 animate-spin" />
        </div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-8 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-rose-400" />
          <h2 className="mt-4 text-lg font-semibold text-zinc-100">Content not found</h2>
          <button onClick={onBack} className="mt-4 rounded-xl bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700">
            Go back
          </button>
        </div>
      </div>
    );
  }

  const videoUrl = getVideoUrl(content, contentType);
  const rawUrl = getRawVideoUrl(content, contentType);
  const hasComposed = contentType === 'clip'
    ? !!(content as Clip).composed_video_url
    : !!(content as Episode).composed_video_url;
  const overlayStatus = contentType === 'clip'
    ? (content as Clip).overlay_status
    : (content as Episode).overlay_status;

  const title = contentType === 'clip'
    ? (content as Clip).topic
    : `Episode ${(content as Episode).episode_number || ''}`;

  const subtitle = contentType === 'clip'
    ? prettyType((content as Clip).video_type)
    : (content as Episode).city_style?.toUpperCase() || '';

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Sparkles className="h-6 w-6 text-amber-400" />
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
            Enhance Video
          </h1>
        </div>
        <p className="text-sm text-zinc-500 ml-9">
          {title} <span className="text-zinc-700 mx-1">/</span> {subtitle}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 overflow-hidden">
            <div className="aspect-[9/16] max-h-[540px] w-full bg-zinc-950 relative">
              {videoUrl ? (
                <video
                  src={videoUrl}
                  controls
                  playsInline
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <div className="text-center">
                    <Film className="mx-auto h-10 w-10 text-zinc-700" />
                    <p className="mt-3 text-sm text-zinc-500">No video available yet</p>
                  </div>
                </div>
              )}
              {hasComposed && (
                <div className="absolute top-3 right-3">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                    <CheckCircle2 className="h-3 w-3" />
                    Enhanced
                  </span>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-zinc-800 space-y-3">
              <button
                onClick={handleCompose}
                disabled={composing || !rawUrl}
                className={clsx(
                  'w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition',
                  composing
                    ? 'bg-amber-500/20 text-amber-300 cursor-wait'
                    : 'bg-amber-500 text-zinc-900 hover:bg-amber-400 disabled:opacity-40'
                )}
              >
                {composing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Composing overlay...
                  </>
                ) : overlayStatus === 'done' ? (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Re-compose with new settings
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    Apply Enhancements
                  </>
                )}
              </button>

              {composeStatus === 'error' && (
                <p className="text-xs text-rose-400 text-center">
                  Composition encountered an issue. The raw video is available as fallback.
                </p>
              )}

              {videoUrl && (
                <a
                  href={videoUrl}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-800 transition"
                >
                  <Download className="h-4 w-4" />
                  Download {hasComposed ? 'Enhanced' : 'Raw'} Video
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <EnhancementPanel
            config={enhancementConfig}
            onChange={setEnhancementConfig}
            contentType={contentType}
          />
        </div>

        <div className="lg:col-span-3">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
            <ExportPanel
              parentId={contentId}
              parentType={contentType}
              videoUrl={videoUrl}
              onExport={handleExport}
              exporting={exporting}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

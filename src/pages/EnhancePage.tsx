import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import { getCompilationById, triggerCompilationCompose } from '../lib/compilations';
import {
  triggerClipCompose,
  triggerComposeOverlay,
  createVideoExport,
} from '../lib/templates';
import { getUserId } from '../lib/auth';
import { prettyType, clsx } from '../lib/format';
import { useRealtimeStatus } from '../hooks/useRealtimeStatus';
import type { Clip, Episode, Compilation, EnhancementConfig, ClipType } from '../lib/types';

interface EnhancePageProps {
  contentType: 'clip' | 'episode' | 'compilation';
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

const TYPE_PRESETS: Record<ClipType, Partial<EnhancementConfig>> = {
  wisdom_interview: {
    captions: true,
    captionAnimation: 'word_by_word',
    colorGrade: 'warm',
    lowerThird: true,
    lowerThirdStyle: 'modern',
    endcard: true,
    endcardStyle: 'minimal',
  },
  studio_interview: {
    captions: true,
    captionAnimation: 'static',
    colorGrade: 'cinematic',
    lowerThird: true,
    lowerThirdStyle: 'classic',
    endcard: true,
    endcardStyle: 'branded',
  },
  subway_interview: {
    captions: true,
    captionAnimation: 'pop_up',
    colorGrade: 'none',
    lowerThird: true,
    lowerThirdStyle: 'minimal',
    progressBar: true,
  },
  street_interview: {
    captions: true,
    captionAnimation: 'word_by_word',
    colorGrade: 'none',
    lowerThird: true,
    lowerThirdStyle: 'classic',
  },
  motivational: {
    captions: true,
    captionAnimation: 'karaoke',
    colorGrade: 'dramatic',
    lowerThird: false,
    endcard: true,
    endcardStyle: 'cta',
    progressBar: true,
  },
};

type ContentUnion = Clip | Episode | Compilation;

function getVideoUrl(content: ContentUnion, type: 'clip' | 'episode' | 'compilation'): string | null {
  if (type === 'compilation') {
    const comp = content as Compilation;
    return comp.composed_video_url || comp.final_video_url || null;
  }
  if (type === 'episode') {
    const ep = content as Episode;
    return ep.composed_video_url || ep.final_video_url || null;
  }
  const clip = content as Clip;
  return clip.composed_video_url || clip.result_url || null;
}

function getRawVideoUrl(content: ContentUnion, type: 'clip' | 'episode' | 'compilation'): string | null {
  if (type === 'compilation') {
    return (content as Compilation).final_video_url || null;
  }
  if (type === 'episode') {
    return (content as Episode).final_video_url || null;
  }
  return (content as Clip).result_url || null;
}

export function EnhancePage({ contentType }: EnhancePageProps) {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const contentId = id ?? '';
  const [content, setContent] = useState<ContentUnion | null>(null);
  const [loading, setLoading] = useState(true);
  const [enhancementConfig, setEnhancementConfig] = useState<EnhancementConfig>(DEFAULT_CONFIG);
  const [composing, setComposing] = useState(false);
  const [composeStatus, setComposeStatus] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const [presetApplied, setPresetApplied] = useState(false);

  const loadContent = useCallback(async () => {
    try {
      if (contentType === 'clip') {
        const data = await getClipById(contentId);
        setContent(data);
      } else if (contentType === 'episode') {
        const data = await getEpisodeById(contentId);
        setContent(data);
      } else {
        const data = await getCompilationById(contentId);
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
    if (!content || presetApplied) return;
    if (contentType === 'clip') {
      const videoType = (content as Clip).video_type;
      const preset = TYPE_PRESETS[videoType];
      if (preset) {
        setEnhancementConfig({ ...DEFAULT_CONFIG, ...preset });
      }
    }
    setPresetApplied(true);
  }, [content, contentType, presetApplied]);

  const overlayStatus = content
    ? (content as Clip | Episode | Compilation).overlay_status
    : undefined;

  const realtimeTable = contentType === 'clip' ? 'clips'
    : contentType === 'episode' ? 'episodes'
    : 'compilations';

  useRealtimeStatus({
    table: realtimeTable,
    id: contentId,
    enabled: overlayStatus === 'composing',
    onUpdate: (payload) => {
      const status = payload.overlay_status as string | undefined;
      if (status === 'done' || status === 'error') {
        setComposing(false);
        setComposeStatus(status);
        loadContent();
      }
    },
  });

  async function handleCompose() {
    if (!content) return;
    setComposing(true);
    setComposeStatus('composing');

    const config = {
      watermark: enhancementConfig.watermark,
      lowerThird: enhancementConfig.lowerThird,
      lowerThirdStyle: enhancementConfig.lowerThirdStyle,
      lowerThirdName: enhancementConfig.lowerThirdName,
      lowerThirdTitle: enhancementConfig.lowerThirdTitle,
      captions: enhancementConfig.captions,
      captionAnimation: enhancementConfig.captionAnimation,
      musicTrackId: enhancementConfig.musicTrackId,
      musicVolume: enhancementConfig.musicVolume,
      sfxEnabled: enhancementConfig.sfxEnabled,
      colorGrade: enhancementConfig.colorGrade,
      endcard: enhancementConfig.endcard,
      endcardStyle: enhancementConfig.endcardStyle,
      progressBar: enhancementConfig.progressBar,
    };

    try {
      if (contentType === 'clip') {
        await triggerClipCompose(contentId, config);
      } else if (contentType === 'episode') {
        await triggerComposeOverlay(contentId, config);
      } else {
        await triggerCompilationCompose(contentId, config);
      }
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
      const userId = getUserId();
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
          <button onClick={() => navigate(
            contentType === 'clip' ? '/clips/' + id
            : contentType === 'episode' ? '/episodes/' + id
            : '/compilations/' + id
          )} className="mt-4 rounded-xl bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700">
            Go back
          </button>
        </div>
      </div>
    );
  }

  const videoUrl = getVideoUrl(content, contentType);
  const rawUrl = getRawVideoUrl(content, contentType);
  const hasComposed = !!(content as Clip & Episode & Compilation).composed_video_url;

  const title = contentType === 'clip'
    ? (content as Clip).topic
    : contentType === 'episode'
    ? `Episode ${(content as Episode).episode_number || ''}`
    : (content as Compilation).name;

  const subtitle = contentType === 'clip'
    ? prettyType((content as Clip).video_type)
    : contentType === 'episode'
    ? (content as Episode).city_style?.toUpperCase() || ''
    : `${(content as Compilation).clips?.length || 0} clips`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <button
        onClick={() => navigate(
          contentType === 'clip' ? '/clips/' + id
          : contentType === 'episode' ? '/episodes/' + id
          : '/compilations/' + id
        )}
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
          {contentType === 'clip' && content && (
            <PresetBar
              currentType={(content as Clip).video_type}
              onApplyPreset={(type) => {
                const preset = TYPE_PRESETS[type];
                if (preset) {
                  setEnhancementConfig({ ...DEFAULT_CONFIG, ...preset });
                }
              }}
            />
          )}
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

function PresetBar({ currentType, onApplyPreset }: { currentType: ClipType; onApplyPreset: (type: ClipType) => void }) {
  const presets: { type: ClipType; label: string }[] = [
    { type: 'wisdom_interview', label: 'Wisdom' },
    { type: 'studio_interview', label: 'Studio' },
    { type: 'subway_interview', label: 'Subway' },
    { type: 'street_interview', label: 'Street' },
    { type: 'motivational', label: 'Motivational' },
  ];

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
      <p className="text-xs text-zinc-500 mb-2">Quick Presets</p>
      <div className="flex flex-wrap gap-1.5">
        {presets.map(({ type, label }) => (
          <button
            key={type}
            onClick={() => onApplyPreset(type)}
            className={clsx(
              'px-2.5 py-1 rounded-lg text-xs font-medium transition',
              type === currentType
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-600'
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

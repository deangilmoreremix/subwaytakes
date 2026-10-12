import { useState, useEffect, useCallback, useRef } from 'react';
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
  Subtitles,
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
import type { StudioRenderJobRow } from '../studio/types';
import { isMediaRef, type MediaRef } from '../studio/mediaRefs';
import {
  DEFAULT_MUAPI_LANGUAGE,
  DEFAULT_MUAPI_THEME,
  MUAPI_CAPTION_LANGUAGES,
  MUAPI_CAPTION_THEMES,
  type MuapiCaptionLanguage,
  type MuapiCaptionTheme,
} from '../lib/studioCaptions';
import { callEdgeFunction } from '../lib/edgeFunctions';
import { captionSubmit, describeError } from '../lib/studioProjects';
import { supabase } from '../lib/supabase';

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
  muapi: {
    captions: true,
    captionAnimation: 'word_by_word',
    colorGrade: 'cinematic',
    lowerThird: true,
    lowerThirdStyle: 'minimal',
    endcard: true,
    endcardStyle: 'minimal',
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
          <MuapiCaptionsSection />
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

type MuapiCaptionJobStatus = 'queued' | 'pending' | 'processing' | 'completed' | 'failed';

interface StudioProjectRow {
  id: string;
  title: string;
}

interface MuapiCaptionPollResponse {
  status?: string | null;
  output_url?: string | null;
  output_ref?: unknown;
  error?: string | null;
}

const CAPTION_POLL_INTERVAL_MS = 5000;

function normalizeMuapiCaptionStatus(raw: string | null | undefined): MuapiCaptionJobStatus {
  const value = (raw ?? '').toLowerCase();
  if (value === 'done' || value === 'completed' || value === 'succeeded' || value === 'success') {
    return 'completed';
  }
  if (value === 'failed' || value === 'error' || value === 'cancelled') return 'failed';
  if (value === 'queued') return 'queued';
  if (value === 'pending' || value === 'submitted') return 'pending';
  return 'processing';
}

/**
 * MuAPI AI Captions (styled burn-in) — Enhanced Studio projects.
 *
 * The muapi-captions edge function is scoped to studio projects (its job rows
 * reference studio_projects), so this card applies MuAPI's 18 caption themes /
 * 45 languages to a project's RENDERED video. Both versions stay visible after
 * a run: the original render and the captioned output. The server signs a
 * 1-hour URL for MuAPI to fetch the private render and for playback here — this
 * UI never asks for or exposes long-lived public URLs.
 */
function MuapiCaptionsSection() {
  const [projects, setProjects] = useState<StudioProjectRow[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [projectId, setProjectId] = useState('');
  const [renderJob, setRenderJob] = useState<StudioRenderJobRow | null>(null);
  const [loadingJob, setLoadingJob] = useState(false);
  const [language, setLanguage] = useState<MuapiCaptionLanguage>(DEFAULT_MUAPI_LANGUAGE);
  const [theme, setTheme] = useState<MuapiCaptionTheme>(DEFAULT_MUAPI_THEME);
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<MuapiCaptionJobStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captionedUrl, setCaptionedUrl] = useState<string | null>(null);
  const [captionedRef, setCaptionedRef] = useState<MediaRef | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const autoSelectedRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  useEffect(() => {
    let cancelled = false;
    async function loadProjects() {
      try {
        const { data, error: projectsError } = await supabase
          .from('studio_projects')
          .select('id,title')
          .order('updated_at', { ascending: false })
          .limit(50);
        if (cancelled) return;
        if (projectsError) {
          setError(describeError(projectsError, 'Could not load your studio projects'));
          return;
        }
        const rows = (data ?? []) as StudioProjectRow[];
        setProjects(rows);
        if (rows.length && !autoSelectedRef.current) {
          autoSelectedRef.current = true;
          setProjectId(rows[0].id);
        }
      } catch (err) {
        if (!cancelled) setError(describeError(err, 'Could not load your studio projects'));
      } finally {
        if (!cancelled) setLoadingProjects(false);
      }
    }
    void loadProjects();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!projectId) {
      setRenderJob(null);
      return;
    }
    let cancelled = false;
    async function loadRenderJob() {
      setLoadingJob(true);
      try {
        const { data, error: jobError } = await supabase
          .from('studio_render_jobs')
          .select('*')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cancelled) return;
        setRenderJob(jobError ? null : ((data as StudioRenderJobRow | null) ?? null));
      } catch {
        if (!cancelled) setRenderJob(null);
      } finally {
        if (!cancelled) setLoadingJob(false);
      }
    }
    void loadRenderJob();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const startPolling = useCallback(
    (id: string) => {
      stopPolling();
      const tick = async () => {
        try {
          const response = await callEdgeFunction<MuapiCaptionPollResponse>('muapi-captions', {
            action: 'status',
            project_id: projectId,
            job_id: id,
          });
          const nextStatus = normalizeMuapiCaptionStatus(response?.status);
          setStatus(nextStatus);
          if (nextStatus === 'completed') {
            stopPolling();
            setBusy(false);
            const rawRef = response?.output_ref;
            setCaptionedRef(isMediaRef(rawRef) ? rawRef : null);
            setCaptionedUrl(
              (typeof response?.output_url === 'string' && response.output_url) ||
                (typeof rawRef === 'string' && rawRef) ||
                null,
            );
            if (!response?.output_url && !rawRef) {
              setError('Caption job finished without a captioned output');
            }
            return;
          }
          if (nextStatus === 'failed') {
            stopPolling();
            setBusy(false);
            setError(
              (typeof response?.error === 'string' && response.error) || 'MuAPI caption job failed',
            );
          }
        } catch (err) {
          stopPolling();
          setBusy(false);
          setError(describeError(err, 'Could not poll the caption job'));
        }
      };
      void tick();
      pollTimerRef.current = window.setInterval(() => {
        void tick();
      }, CAPTION_POLL_INTERVAL_MS);
    },
    [projectId, stopPolling],
  );

  const handleSubmit = useCallback(async () => {
    if (!projectId) return;
    if (!renderJob || renderJob.status !== 'done' || !renderJob.output_url) {
      setError(
        'This studio project has no completed render yet — export it once in the Studio editor, then apply MuAPI captions here.',
      );
      return;
    }
    setBusy(true);
    setError(null);
    setCaptionedUrl(null);
    setCaptionedRef(null);
    setStatus('pending');
    try {
      const id = await captionSubmit({
        projectId,
        mode: 'styled',
        language,
        theme,
        videoUrl: renderJob.output_url,
        renderJobId: renderJob.id,
      });
      setJobId(id);
      startPolling(id);
    } catch (err) {
      setBusy(false);
      setError(describeError(err, 'Could not submit the MuAPI caption job'));
    }
  }, [language, projectId, renderJob, startPolling, theme]);

  const statusChip: Record<MuapiCaptionJobStatus | 'idle', string> = {
    idle: 'border-zinc-700 bg-zinc-800/60 text-zinc-400',
    queued: 'border-zinc-600 bg-zinc-700/40 text-zinc-300',
    pending: 'border-zinc-600 bg-zinc-700/40 text-zinc-300',
    processing: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
    completed: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    failed: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
  };

  const renderReady = Boolean(renderJob && renderJob.status === 'done' && renderJob.output_url);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
      <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
        <Subtitles className="w-4 h-4 text-amber-400" />
        AI Captions (MuAPI)
      </h3>
      <p className="mt-1 text-xs text-zinc-500">
        Burn MuAPI's animated caption themes into a Studio project render. The private render is
        signed for 1 hour on the server for MuAPI to fetch and for playback here — no public URLs
        are ever needed.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs text-zinc-500 block mb-1">Studio project</span>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            disabled={loadingProjects || projects.length === 0}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-amber-500 disabled:opacity-50"
          >
            {loadingProjects && <option value="">Loading projects…</option>}
            {!loadingProjects && projects.length === 0 && <option value="">No studio projects yet</option>}
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.title || project.id}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-zinc-500 block mb-1">Caption language</span>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as MuapiCaptionLanguage)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-amber-500"
          >
            {MUAPI_CAPTION_LANGUAGES.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs text-zinc-500 block mb-1">Caption theme</span>
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value as MuapiCaptionTheme)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-amber-500"
          >
            {MUAPI_CAPTION_THEMES.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={handleSubmit}
          disabled={busy || !projectId || !renderReady}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
          {busy ? 'Submitting…' : 'Apply MuAPI captions'}
        </button>
        <span className={clsx('px-2 py-0.5 rounded-full border text-[10px] font-medium uppercase tracking-wide', statusChip[status ?? 'idle'])}>
          {status ?? 'idle'}
        </span>
        {jobId && <span className="text-[10px] text-zinc-500">job {jobId.slice(0, 8)}</span>}
        {loadingJob && <span className="text-[11px] text-zinc-500">Checking latest render…</span>}
        {!loadingJob && projectId && !renderReady && (
          <span className="text-[11px] text-zinc-500">
            No completed render for this project yet.
          </span>
        )}
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 p-2 bg-rose-500/10 border border-rose-500/30 rounded-lg">
          <AlertCircle className="w-3.5 h-3.5 text-rose-400 mt-0.5 shrink-0" />
          <p className="text-xs text-rose-300">{error}</p>
        </div>
      )}

      {(renderJob?.output_url || captionedUrl) && (
        <div className="mt-4 space-y-3">
          {renderJob?.output_url && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-zinc-500 mb-1 flex items-center gap-1">
                <Film className="w-3 h-3" /> Original render
              </p>
              <video
                src={renderJob.output_url}
                controls
                className="w-full rounded-lg border border-zinc-800 bg-black max-h-64"
              />
              <a
                href={renderJob.output_url}
                download
                className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-zinc-800 text-zinc-300 border border-zinc-700 hover:border-zinc-500 transition"
              >
                <Download className="w-3 h-3" /> Download original
              </a>
            </div>
          )}
          {captionedUrl && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-amber-400 mb-1 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Captioned with {theme} · {language}
              </p>
              <video
                src={captionedUrl}
                controls
                className="w-full rounded-lg border border-amber-500/40 bg-black max-h-64"
              />
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <a
                  href={captionedUrl}
                  download
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition"
                >
                  <Download className="w-3 h-3" /> Download captioned version
                </a>
              </div>
              {captionedRef && (
                <p className="mt-1 text-[10px] text-emerald-300">
                  Stored durably ({captionedRef.bucket}/{captionedRef.path}) — the playback link is a
                  fresh 1-hour signed URL that can be re-signed at any time.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <p className="mt-3 text-[10px] text-zinc-600 flex items-center gap-1">
        <Play className="w-3 h-3" /> Renders are created in the Studio editor (Scenes → Export MP4).
      </p>
    </div>
  );
}

import { useState } from 'react';
import { Film, Plus, Trash2, Clock, Moon, Sun, Sparkles } from 'lucide-react';
import type { TransformationArc, TransformationScene, TransformationSceneConfig } from '../lib/types';
import { TRANSFORMATION_SCENES } from '../lib/constants';

interface TransformationArcBuilderProps {
  value: TransformationArc | undefined;
  onChange: (arc: TransformationArc | undefined) => void;
  disabled?: boolean;
}

const NARRATIVE_ARCS = [
  { value: 'struggle_to_triumph', label: 'Struggle to Triumph', emoji: '💪', description: 'Overcoming obstacles to achieve victory' },
  { value: 'doubt_to_confidence', label: 'Doubt to Confidence', emoji: '🦋', description: 'Finding self-assurance through journey' },
  { value: 'failure_to_success', label: 'Failure to Success', emoji: '📈', description: 'Learning from mistakes to win' },
  { value: 'ordinary_to_extraordinary', label: 'Ordinary to Extraordinary', emoji: '⭐', description: 'Transforming into something greater' },
] as const;

const SCENE_ICONS: Record<TransformationScene, typeof Moon> = {
  before: Moon,
  during: Sun,
  after: Sparkles,
};

const SCENE_COLORS: Record<TransformationScene, { bg: string; border: string; text: string }> = {
  before: { bg: 'bg-slate-500/15', border: 'border-slate-500/50', text: 'text-slate-400' },
  during: { bg: 'bg-amber-500/15', border: 'border-amber-500/50', text: 'text-amber-400' },
  after: { bg: 'bg-emerald-500/15', border: 'border-emerald-500/50', text: 'text-emerald-400' },
};

export function TransformationArcBuilder({ value, onChange, disabled }: TransformationArcBuilderProps) {
  const [isEnabled, setIsEnabled] = useState(value?.enabled ?? false);
  const [scenes, setScenes] = useState<TransformationSceneConfig[]>(value?.scenes ?? [
    { scene: 'before', duration: 20, visualStyle: 'dark and moody', emotionalTone: 'struggling' },
    { scene: 'during', duration: 30, visualStyle: 'dynamic action', emotionalTone: 'fighting' },
    { scene: 'after', duration: 20, visualStyle: 'bright and triumphant', emotionalTone: 'victorious' },
  ]);
  const [narrativeArc, setNarrativeArc] = useState<TransformationArc['narrativeArc']>(value?.narrativeArc ?? 'struggle_to_triumph');
  const [visualProgression, setVisualProgression] = useState<TransformationArc['visualProgression']>(value?.visualProgression ?? 'dramatic');

  const enabled = isEnabled && !disabled;

  function toggleEnabled() {
    const newEnabled = !isEnabled;
    setIsEnabled(newEnabled);
    if (newEnabled) {
      onChange({
        enabled: true,
        scenes,
        narrativeArc,
        visualProgression,
      });
    } else {
      onChange(undefined);
    }
  }

  function updateScene(sceneType: TransformationScene, updates: Partial<TransformationSceneConfig>) {
    const newScenes = scenes.map(s => s.scene === sceneType ? { ...s, ...updates } : s);
    setScenes(newScenes);
    onChange({ enabled: true, scenes: newScenes, narrativeArc, visualProgression });
  }

  function updateNarrativeArc(arc: TransformationArc['narrativeArc']) {
    setNarrativeArc(arc);
    onChange({ enabled: true, scenes, narrativeArc: arc, visualProgression });
  }

  function updateVisualProgression(progression: TransformationArc['visualProgression']) {
    setVisualProgression(progression);
    onChange({ enabled: true, scenes, narrativeArc, visualProgression: progression });
  }

  const totalDuration = scenes.reduce((sum, s) => sum + s.duration, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
              type="button"
              onClick={toggleEnabled}
              disabled={disabled}
              aria-label="Enable multi-scene transformation arc"
              aria-pressed={isEnabled}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                isEnabled ? 'bg-red-500' : 'bg-zinc-700'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                isEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
          <div>
            <span className="text-sm font-medium text-zinc-200">Multi-Scene Transformation Arc</span>
            <p className="text-xs text-zinc-500">Before/During/After scenes with visual progression</p>
          </div>
        </div>
        {isEnabled && (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Clock className="h-4 w-4" />
            {totalDuration}s total
          </div>
        )}
      </div>

      {enabled && (
        <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          {/* Narrative Arc Selection */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Transformation Arc</label>
            <div className="grid grid-cols-2 gap-2">
              {NARRATIVE_ARCS.map((arc) => (
                <button
                  key={arc.value}
                  type="button"
                  onClick={() => updateNarrativeArc(arc.value)}
                  className={`flex items-start gap-2 p-2 rounded-lg border text-left transition-all ${
                    narrativeArc === arc.value
                      ? 'border-red-500/50 bg-red-500/10'
                      : 'border-zinc-700 bg-zinc-800/30 hover:border-zinc-600'
                  }`}
                >
                  <span className="text-lg">{arc.emoji}</span>
                  <div>
                    <span className={`text-xs font-medium block ${narrativeArc === arc.value ? 'text-red-200' : 'text-zinc-300'}`}>
                      {arc.label}
                    </span>
                    <span className="text-[10px] text-zinc-500">{arc.description}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Visual Progression */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Visual Progression</label>
            <div className="flex gap-2">
              {(['subtle', 'dramatic', 'cinematic'] as const).map((prog) => (
                <button
                  key={prog}
                  type="button"
                  onClick={() => updateVisualProgression(prog)}
                  className={`flex-1 px-3 py-1.5 rounded-lg border text-xs transition-all ${
                    visualProgression === prog
                      ? 'bg-red-500/15 border-red-500/50 text-red-400'
                      : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
                  }`}
                >
                  {prog.charAt(0).toUpperCase() + prog.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Scenes */}
          <div className="space-y-3">
            <label className="text-xs font-medium text-zinc-400">Scene Breakdown</label>
            {scenes.map((scene) => {
              const colors = SCENE_COLORS[scene.scene];
              const Icon = SCENE_ICONS[scene.scene];
              const sceneInfo = TRANSFORMATION_SCENES.find(s => s.value === scene.scene);

              return (
                <div
                  key={scene.scene}
                  className={`rounded-lg border ${colors.border} ${colors.bg} p-3 space-y-3`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${colors.text}`} />
                    <span className={`text-xs font-medium ${colors.text}`}>
                      {sceneInfo?.label} Phase
                    </span>
                    <span className="text-xs text-zinc-500">({scene.duration}s)</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-zinc-500 block mb-1">Duration</label>
                      <select
                        value={scene.duration}
                        onChange={(e) => updateScene(scene.scene, { duration: parseInt(e.target.value) })}
                        className="w-full rounded-md border border-zinc-700 bg-zinc-800/50 px-2 py-1.5 text-xs text-zinc-200 focus:border-red-500/50 focus:outline-none"
                      >
                        {[10, 15, 20, 25, 30, 40, 50, 60].map((d) => (
                          <option key={d} value={d}>{d}s</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-zinc-500 block mb-1">Emotional Tone</label>
                      <input
                        type="text"
                        value={scene.emotionalTone}
                        onChange={(e) => updateScene(scene.scene, { emotionalTone: e.target.value })}
                        placeholder="e.g., struggling"
                        className="w-full rounded-md border border-zinc-700 bg-zinc-800/50 px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:border-red-500/50 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-zinc-500 block mb-1">Visual Style</label>
                    <input
                      type="text"
                      value={scene.visualStyle}
                      onChange={(e) => updateScene(scene.scene, { visualStyle: e.target.value })}
                      placeholder="e.g., dark and moody"
                      className="w-full rounded-md border border-zinc-700 bg-zinc-800/50 px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:border-red-500/50 focus:outline-none"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Preview */}
          <div className="rounded-lg bg-zinc-800/30 p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <Film className="h-3.5 w-3.5" />
              <span>Arc Preview</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              {scenes.map((scene, i) => (
                <span key={scene.scene} className={SCENE_COLORS[scene.scene].text}>
                  {scene.scene} ({scene.duration}s)
                  {i < scenes.length - 1 && <span className="text-zinc-600 mx-1">→</span>}
                </span>
              ))}
            </div>
            <p className="text-xs text-zinc-500">
              {NARRATIVE_ARCS.find(a => a.value === narrativeArc)?.label} • {visualProgression} progression
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

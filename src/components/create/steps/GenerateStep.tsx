import { ReactNode, useState } from 'react';
import { Zap, Layers, Sparkles, RefreshCw, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import type { ClipCreationHook } from '../../../hooks/useClipCreation';
import { ModelTierSelector } from '../../ModelTierSelector';
import { AngleInput } from '../../AngleInput';
import { StatusCard } from '../../StatusCard';
import { CompactEffectsBar } from '../../CompactEffectsBar';
import {
  generateClipScript,
  formatScriptPreview,
  scriptToSpeechText,
  type ClipScript,
} from '../../../lib/clipScriptGenerator';

interface GenerateStepProps {
  clip: ClipCreationHook;
  onGenerate: () => void;
  showSpeechScript: boolean;
  showBatchMode?: boolean;
  summaryCard: ReactNode;
  scriptContext?: {
    interviewStyle?: string;
    energyLevel?: string;
    sceneType?: string;
    neighborhood?: string;
    speakerStyle?: string;
    studioSetup?: string;
    studioLighting?: string;
    cameraStyle?: string;
    lightingMood?: string;
    wisdomTone?: string;
    wisdomFormat?: string;
    wisdomDemographic?: string;
    wisdomSetting?: string;
  };
}

export function GenerateStep({
  clip,
  onGenerate,
  showSpeechScript,
  showBatchMode,
  summaryCard,
  scriptContext,
}: GenerateStepProps) {
  const [generatedScript, setGeneratedScript] = useState<ClipScript | null>(null);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [scriptError, setScriptError] = useState('');
  const [showScriptDetails, setShowScriptDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleGenerateScript() {
    setIsGeneratingScript(true);
    setScriptError('');
    try {
      const script = await generateClipScript({
        topic: clip.topic,
        videoType: clip.clipType,
        energyLevel: scriptContext?.energyLevel,
        interviewStyle: scriptContext?.interviewStyle,
        sceneType: scriptContext?.sceneType,
        neighborhood: scriptContext?.neighborhood,
        speakerStyle: scriptContext?.speakerStyle,
        studioSetup: scriptContext?.studioSetup,
        studioLighting: scriptContext?.studioLighting,
        cameraStyle: scriptContext?.cameraStyle,
        lightingMood: scriptContext?.lightingMood,
        durationSeconds: clip.durationSeconds,
        wisdomTone: scriptContext?.wisdomTone,
        wisdomFormat: scriptContext?.wisdomFormat,
        wisdomDemographic: scriptContext?.wisdomDemographic,
        wisdomSetting: scriptContext?.wisdomSetting,
        targetAgeGroup: clip.targetAgeGroup,
      });
      setGeneratedScript(script);
      clip.setSpeechScript(scriptToSpeechText(script));
      setShowScriptDetails(true);
    } catch (err) {
      setScriptError(err instanceof Error ? err.message : 'Failed to generate script');
    } finally {
      setIsGeneratingScript(false);
    }
  }

  function handleUseScript() {
    if (generatedScript) {
      clip.setSpeechScript(scriptToSpeechText(generatedScript));
    }
  }

  function handleCopyScript() {
    if (generatedScript) {
      navigator.clipboard.writeText(formatScriptPreview(generatedScript));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6 space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-zinc-300 mb-3">Your Selections</h3>
        {summaryCard}
      </div>

      <div className="border-t border-zinc-800 pt-5 space-y-5">
        <ModelTierSelector
          value={clip.modelTier}
          onChange={clip.setModelTier}
          disabled={clip.busy}
        />

        {showSpeechScript && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-zinc-300">
                Speech Script
              </label>
              <button
                type="button"
                onClick={handleGenerateScript}
                disabled={clip.busy || isGeneratingScript}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGeneratingScript ? (
                  <>
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    Generating...
                  </>
                ) : generatedScript ? (
                  <>
                    <RefreshCw className="h-3 w-3" />
                    Regenerate
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3 w-3" />
                    AI Generate Script
                  </>
                )}
              </button>
            </div>

            {scriptError && (
              <p className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">
                {scriptError}
              </p>
            )}

            {generatedScript && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowScriptDetails(!showScriptDetails)}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-amber-400"
                >
                  <span className="flex items-center gap-2">
                    <Sparkles className="h-3 w-3" />
                    AI-Generated Script
                    {generatedScript.source === 'ai' && (
                      <span className="px-1.5 py-0.5 bg-amber-500/20 rounded text-[10px]">GPT-4o</span>
                    )}
                  </span>
                  {showScriptDetails ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </button>

                {showScriptDetails && (
                  <div className="px-4 pb-3 space-y-2.5">
                    <ScriptField label="HOOK" speaker="HOST" value={generatedScript.hook_question} />
                    <ScriptField label="ANSWER" speaker="GUEST" value={generatedScript.guest_answer} />
                    <ScriptField label="FOLLOW-UP" speaker="HOST" value={generatedScript.follow_up_question} />
                    <ScriptField label="RESPONSE" speaker="GUEST" value={generatedScript.follow_up_answer} />
                    <ScriptField label="REACTION" speaker="HOST" value={generatedScript.reaction_line} />
                    <ScriptField label="CLOSE" speaker="" value={generatedScript.close_punchline} />

                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleUseScript}
                        className="text-xs px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 transition-all"
                      >
                        Use as Speech Script
                      </button>
                      <button
                        type="button"
                        onClick={handleCopyScript}
                        className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-all"
                      >
                        {copied ? (
                          <><Check className="h-3 w-3" /> Copied</>
                        ) : (
                          <><Copy className="h-3 w-3" /> Copy</>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <textarea
              value={clip.speechScript}
              onChange={(e) => clip.setSpeechScript(e.target.value)}
              disabled={clip.busy}
              placeholder="What should the person say? Use AI Generate above, or write your own..."
              rows={3}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50 disabled:opacity-50 disabled:cursor-not-allowed resize-none"
            />
            {clip.speechScript && (
              <p className="text-xs text-zinc-500">
                {clip.speechScript.length}/2000 characters
              </p>
            )}
          </div>
        )}

        <AngleInput
          value={clip.angle}
          placeholder={clip.getPlaceholderText()}
          onChange={clip.setAngle}
          disabled={clip.busy}
          label="Additional Direction (optional)"
        />

        <CompactEffectsBar
          clipType={clip.clipType}
          effects={clip.effects}
          onCustomize={() => clip.setShowEffectsModal(true)}
        />
      </div>

      {showBatchMode && (
        <div className="border-t border-zinc-800 pt-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => clip.setBatchMode(!clip.batchMode)}
                disabled={clip.busy}
                className={`relative h-6 w-11 rounded-full transition-colors ${clip.batchMode ? 'bg-amber-500' : 'bg-zinc-700'} ${clip.busy ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${clip.batchMode ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
              <div>
                <span className="text-sm font-medium text-zinc-200">Generate Series</span>
                <p className="text-xs text-zinc-500">Create multiple clips at once</p>
              </div>
            </div>
            {clip.batchMode && (
              <div className="flex gap-2">
                {clip.BATCH_SIZE_OPTIONS.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => clip.setBatchSize(size)}
                    disabled={clip.busy}
                    className={`px-3 py-1.5 text-sm rounded-lg border transition-all ${clip.batchSize === size ? 'bg-amber-500/15 border-amber-500/50 text-amber-400' : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'} ${clip.busy ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {size} clips
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="border-t border-zinc-800 pt-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={onGenerate}
            disabled={clip.busy}
            className="flex items-center justify-center gap-2 rounded-2xl bg-amber-500 px-8 py-3.5 text-sm font-semibold text-black transition hover:bg-amber-400 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {clip.batchMode ? (
              <>
                <Layers className="h-4 w-4" />
                {clip.busy ? 'Working...' : `Generate ${clip.batchSize} Clips`}
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                {clip.busy ? 'Working...' : 'Generate Clip'}
              </>
            )}
          </button>
          <p className="text-sm text-zinc-500">
            Vertical 9:16 | {clip.batchMode ? `${clip.batchSize} clip series` : 'Single clip'}
          </p>
        </div>
      </div>

      {clip.status !== 'idle' && (
        <StatusCard
          status={clip.status === 'planning' ? 'planning' : clip.status === 'generating' ? 'generating' : clip.status === 'error' ? 'error' : 'done'}
          message={clip.errorMessage || undefined}
        />
      )}
    </div>
  );
}

function ScriptField({
  label,
  speaker,
  value,
}: {
  label: string;
  speaker: string;
  value: string;
}) {
  if (!value) return null;
  return (
    <div className="flex gap-2">
      <div className="flex-shrink-0 pt-0.5">
        {speaker === 'HOST' && (
          <span className="inline-block px-1.5 py-0.5 text-[10px] font-bold rounded bg-sky-500/20 text-sky-400">
            {label}
          </span>
        )}
        {speaker === 'GUEST' && (
          <span className="inline-block px-1.5 py-0.5 text-[10px] font-bold rounded bg-emerald-500/20 text-emerald-400">
            {label}
          </span>
        )}
        {!speaker && (
          <span className="inline-block px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-500/20 text-amber-400">
            {label}
          </span>
        )}
      </div>
      <p className="text-xs text-zinc-300 leading-relaxed">{value}</p>
    </div>
  );
}

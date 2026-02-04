import { useState } from 'react';
import { Film, Sparkles, Users, Play, ChevronRight, ChevronLeft, Loader2, Flame, Music } from 'lucide-react';
import { CityStyleSelector } from '../components/CityStyleSelector';
import { TopicSelector } from '../components/TopicSelector';
import { ScriptEditor } from '../components/ScriptEditor';
import { QuestionPicker } from '../components/QuestionPicker';
import { BeatBuilder } from '../components/BeatBuilder';
import { InterviewModeSelector } from '../components/InterviewModeSelector';
import { createEpisode, calculateEpisodeCost, getEstimatedGenerationTime } from '../lib/episodes';
import { generateScript } from '../lib/scriptEngine';
import { generateRandomGuest, DEFAULT_HOST } from '../lib/characters';
import { incrementUsageCount } from '../lib/questionBank';
import type { CityStyle, EpisodeScript, CharacterBible, Beat, InterviewMode } from '../lib/types';

interface EpisodeBuilderPageProps {
  onEpisodeCreated: (episodeId: string) => void;
  onBack: () => void;
  onOpenQuestionBank?: () => void;
}

type WizardStep = 'topic' | 'script' | 'beats' | 'characters' | 'preview' | 'generating';

export function EpisodeBuilderPage({ onEpisodeCreated, onBack, onOpenQuestionBank }: EpisodeBuilderPageProps) {
  const [step, setStep] = useState<WizardStep>('topic');
  const [selectedTopic, setSelectedTopic] = useState<string>('hottakes');
  const [cityStyle, setCityStyle] = useState<CityStyle>('nyc');
  const [script, setScript] = useState<EpisodeScript | null>(null);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [host] = useState(DEFAULT_HOST);
  const [guest, setGuest] = useState(() => generateRandomGuest());
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customHookQuestion, setCustomHookQuestion] = useState('');
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [beats, setBeats] = useState<Beat[]>([]);
  const [interviewMode, setInterviewMode] = useState<InterviewMode>('none');

  const totalDuration = 36;
  const estimatedCost = calculateEpisodeCost(totalDuration, 'premium');
  const estimatedTime = getEstimatedGenerationTime(6);

  async function handleGenerateScript() {
    setIsGeneratingScript(true);
    setError(null);
    try {
      const generatedScript = await generateScript(selectedTopic);
      if (customHookQuestion.trim()) {
        generatedScript.hook_question = customHookQuestion;
      }
      if (selectedQuestionId) {
        incrementUsageCount(selectedQuestionId).catch(() => {});
      }
      setScript(generatedScript);
      setStep('script');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate script');
    } finally {
      setIsGeneratingScript(false);
    }
  }

  function handleQuestionSelect(question: string, questionId?: string) {
    setCustomHookQuestion(question);
    setSelectedQuestionId(questionId || null);
  }

  function handleRandomizeGuest() {
    setGuest(generateRandomGuest());
  }

  async function handleCreateEpisode() {
    if (!script) return;

    setIsCreating(true);
    setStep('generating');
    setError(null);

    try {
      const episode = await createEpisode({
        topic: selectedTopic,
        cityStyle,
        customScript: script,
        beats: beats.length > 0 ? beats : undefined,
        interviewMode,
      });
      onEpisodeCreated(episode.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create episode');
      setStep('preview');
      setIsCreating(false);
    }
  }

  function renderTopicStep() {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-zinc-100 mb-2">Choose Your Topic</h2>
          <p className="text-sm text-zinc-400">Select the theme for your SubwayTakes episode</p>
        </div>

        <TopicSelector value={selectedTopic} onChange={setSelectedTopic} />

        <div className="pt-2">
          <CityStyleSelector value={cityStyle} onChange={setCityStyle} />
        </div>

        <div className="pt-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-zinc-300">Hook Question (optional)</label>
            {onOpenQuestionBank && (
              <button
                onClick={onOpenQuestionBank}
                className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition"
              >
                <Flame className="h-3 w-3" />
                Manage Question Bank
              </button>
            )}
          </div>
          <QuestionPicker
            value={customHookQuestion}
            onChange={handleQuestionSelect}
            onOpenBank={onOpenQuestionBank}
          />
          <p className="text-xs text-zinc-500 mt-1.5">
            Pick a specific question or leave blank for AI-generated hooks
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="flex justify-end pt-4">
          <button
            onClick={handleGenerateScript}
            disabled={isGeneratingScript}
            className="flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-3 text-sm font-semibold text-black transition hover:bg-amber-400 disabled:opacity-60"
          >
            {isGeneratingScript ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating Script...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate Script
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  function renderScriptStep() {
    if (!script) return null;

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-zinc-100 mb-2">Review Your Script</h2>
          <p className="text-sm text-zinc-400">Edit the dialogue, regenerate individual fields, or save as a template</p>
        </div>

        <ScriptEditor
          script={script}
          topic={selectedTopic}
          onChange={setScript}
          onRegenerateAll={handleGenerateScript}
          isRegeneratingAll={isGeneratingScript}
        />

        <div className="flex items-center justify-between pt-4">
          <button
            onClick={() => setStep('topic')}
            className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>

          <button
            onClick={() => setStep('beats')}
            className="flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-2.5 text-sm font-semibold text-black transition hover:bg-amber-400"
          >
            Next: Beats
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  function renderBeatsStep() {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-zinc-100 mb-2">Conversation Beats</h2>
          <p className="text-sm text-zinc-400">Structure your episode flow with beats (Take → Reaction → Discussion)</p>
        </div>

        <InterviewModeSelector
          value={interviewMode}
          onChange={setInterviewMode}
        />

        <BeatBuilder
          beats={beats}
          onChange={setBeats}
        />

        <div className="flex items-center justify-between pt-4">
          <button
            onClick={() => setStep('script')}
            className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>

          <button
            onClick={() => setStep('characters')}
            className="flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-2.5 text-sm font-semibold text-black transition hover:bg-amber-400"
          >
            Next: Characters
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  function renderCharactersStep() {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-zinc-100 mb-2">Characters</h2>
          <p className="text-sm text-zinc-400">Review the host and guest for your episode</p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <CharacterCard character={host} role="Host" />
          <CharacterCard
            character={guest}
            role="Guest"
            onRandomize={handleRandomizeGuest}
          />
        </div>

        <div className="flex items-center justify-between pt-4">
          <button
            onClick={() => setStep('beats')}
            className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>

          <button
            onClick={() => setStep('preview')}
            className="flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-2.5 text-sm font-semibold text-black transition hover:bg-amber-400"
          >
            Preview Episode
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  function renderPreviewStep() {
    if (!script) return null;

    const shots = [
      { name: 'Cold Open', duration: 6, speaker: 'Host', dialogue: script.hook_question },
      { name: 'Guest Answer', duration: 8, speaker: 'Guest', dialogue: script.guest_answer },
      { name: 'Follow Up', duration: 6, speaker: 'Both', dialogue: script.follow_up_question },
      { name: 'Reaction', duration: 4, speaker: 'Host', dialogue: script.reaction_line },
      { name: 'B-Roll', duration: 4, speaker: '-', dialogue: 'Subway ambience' },
      { name: 'Close', duration: 8, speaker: 'Host', dialogue: script.close_punchline },
    ];

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-zinc-100 mb-2">Episode Preview</h2>
          <p className="text-sm text-zinc-400">Review your 6-shot episode before generating</p>
        </div>

        {interviewMode !== 'none' && (
          <div className="rounded-xl border border-pink-500/30 bg-pink-500/10 p-3 flex items-center gap-3">
            <Music className="h-4 w-4 text-pink-400" />
            <span className="text-sm text-pink-400">
              Interview Mode: <span className="font-medium capitalize">{interviewMode.replace(/_/g, ' ')}</span>
            </span>
          </div>
        )}

        {beats.length > 0 && (
          <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Music className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-medium text-blue-400">Custom Beats ({beats.length})</span>
            </div>
            <div className="text-xs text-blue-300/70">
              {beats.reduce((sum, b) => sum + b.duration, 0)}s total duration
            </div>
          </div>
        )}

        <div className="rounded-xl border border-zinc-700 bg-zinc-800/30 overflow-hidden">
          <div className="grid grid-cols-6 gap-px bg-zinc-700">
            {shots.map((shot, i) => (
              <div key={i} className="bg-zinc-800 p-3 text-center">
                <div className="text-xs text-zinc-500 mb-1">Shot {i + 1}</div>
                <div className="text-sm font-medium text-zinc-200">{shot.name}</div>
                <div className="text-xs text-zinc-500 mt-1">{shot.duration}s</div>
              </div>
            ))}
          </div>

          <div className="p-4 space-y-3">
            {shots.map((shot, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <span className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center text-xs text-zinc-400 shrink-0">
                  {i + 1}
                </span>
                <div>
                  <span className="text-amber-400 font-medium">{shot.speaker}:</span>
                  <span className="text-zinc-300 ml-2">{shot.dialogue}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-700 bg-zinc-800/30 p-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-semibold text-zinc-100">{totalDuration}s</div>
              <div className="text-xs text-zinc-500">Total Duration</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-zinc-100">${estimatedCost.toFixed(2)}</div>
              <div className="text-xs text-zinc-500">Est. Cost</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-zinc-100">{estimatedTime}</div>
              <div className="text-xs text-zinc-500">Est. Time</div>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between pt-4">
          <button
            onClick={() => setStep('characters')}
            className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>

          <button
            onClick={handleCreateEpisode}
            disabled={isCreating}
            className="flex items-center gap-2 rounded-xl bg-amber-500 px-8 py-3 text-sm font-semibold text-black transition hover:bg-amber-400 disabled:opacity-60"
          >
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating Episode...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Generate Episode
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  function renderGeneratingStep() {
    return (
      <div className="text-center py-12 space-y-6">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-amber-500/10 border border-amber-500/30">
          <Film className="h-10 w-10 text-amber-500 animate-pulse" />
        </div>

        <div>
          <h2 className="text-xl font-semibold text-zinc-100 mb-2">Creating Your Episode</h2>
          <p className="text-sm text-zinc-400">
            Generating 6 shots and stitching them together...
          </p>
        </div>

        <div className="flex justify-center gap-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="w-3 h-3 rounded-full bg-amber-500/30 animate-pulse"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>

        <p className="text-xs text-zinc-600">
          This typically takes {estimatedTime}. You'll be redirected when it's ready.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition mb-4"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Create
        </button>

        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <Film className="h-6 w-6 text-amber-500" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
              Episode Builder
            </h1>
            <p className="text-sm text-zinc-400">
              Create a full 6-shot SubwayTakes episode
            </p>
          </div>
        </div>
      </div>

      {step !== 'generating' && (
        <div className="flex items-center gap-2 mb-8">
          {(['topic', 'script', 'beats', 'characters', 'preview'] as const).map((s, i) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition ${
                  step === s
                    ? 'bg-amber-500 text-black'
                    : ['topic', 'script', 'beats', 'characters', 'preview'].indexOf(step) > i
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-zinc-800 text-zinc-500'
                }`}
              >
                {i + 1}
              </div>
              {i < 4 && (
                <div
                  className={`w-12 h-0.5 ${
                    ['topic', 'script', 'beats', 'characters', 'preview'].indexOf(step) > i
                      ? 'bg-amber-500/30'
                      : 'bg-zinc-800'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
        {step === 'topic' && renderTopicStep()}
        {step === 'script' && renderScriptStep()}
        {step === 'beats' && renderBeatsStep()}
        {step === 'characters' && renderCharactersStep()}
        {step === 'preview' && renderPreviewStep()}
        {step === 'generating' && renderGeneratingStep()}
      </div>
    </div>
  );
}

function CharacterCard({
  character,
  role,
  onRandomize,
}: {
  character: Omit<CharacterBible, 'id' | 'user_id' | 'created_at'>;
  role: string;
  onRandomize?: () => void;
}) {
  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-800/30 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-amber-500" />
          <span className="font-medium text-zinc-200">{role}</span>
        </div>
        {onRandomize && (
          <button
            onClick={onRandomize}
            className="text-xs text-amber-400 hover:text-amber-300 transition"
          >
            Randomize
          </button>
        )}
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-zinc-500">Appearance</span>
          <span className="text-zinc-300">{character.gender}, {character.ethnicity}, {character.age_range}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Style</span>
          <span className="text-zinc-300 text-right max-w-[200px] truncate">{character.clothing_style}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Energy</span>
          <span className="text-zinc-300 text-right max-w-[200px] truncate">{character.energy_persona}</span>
        </div>
      </div>
    </div>
  );
}

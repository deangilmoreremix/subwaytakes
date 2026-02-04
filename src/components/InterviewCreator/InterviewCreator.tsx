import { useState, useMemo, useCallback, useRef } from 'react';
import { ChevronRight, ChevronLeft, Sparkles, Video, Layers, Check, Plus, Trash2, GripVertical, Play, Loader2 } from 'lucide-react';
import { clsx } from '../../lib/format';
import type { 
  ClipType, 
  InterviewStyle, 
  InterviewFormat, 
  DurationPreset,
  SupportedLanguage,
} from '../../lib/types';
import { 
  INTERVIEW_STYLES, 
  TOPICS,
  INTERVIEW_FORMATS,
  DURATION_PRESETS,
  LANGUAGE_OPTIONS,
} from '../../lib/constants';

// Types
interface Clip {
  id: string;
  contentType: ClipType;
  interviewStyle: InterviewStyle;
  interviewFormat: InterviewFormat;
  durationPreset: DurationPreset;
  topic: string;
  language: SupportedLanguage;
  customQuestion?: string;
  additionalDirection?: string;
  status: 'draft' | 'generating' | 'generated' | 'error';
}

interface Transition {
  fromClipId: string;
  toClipId: string;
  type: 'fade' | 'dissolve' | 'slide' | 'zoom' | 'blur' | 'cut';
  duration: number;
}

interface CreatorState {
  currentStep: number;
  clips: Clip[];
  currentClipId: string | null;
  transitions: Transition[];
  episodeTitle: string;
  episodeDescription: string;
}

interface Step1State {
  contentType: ClipType;
  interviewStyle: InterviewStyle;
  interviewFormat: InterviewFormat;
  durationPreset: DurationPreset;
}

interface Step2State {
  topic: string;
  language: SupportedLanguage;
  customQuestion: string;
  additionalDirection: string;
}

// Content Type Config
const CONTENT_TYPE_CONFIG: Record<ClipType, { label: string; icon: string; color: string }> = {
  wisdom_interview: { label: 'Life Wisdom', icon: '👴', color: 'amber' },
  street_interview: { label: 'Street Takes', icon: '🎤', color: 'emerald' },
  subway_interview: { label: 'Subway Secrets', icon: '🚇', color: 'orange' },
  motivational: { label: 'Motivation', icon: '💪', color: 'rose' },
  studio_interview: { label: 'Professional', icon: '🎙️', color: 'purple' },
};

// Constants
const STEPS = [
  { id: 1, name: 'CREATE', icon: Sparkles },
  { id: 2, name: 'DETAILS', icon: Video },
  { id: 3, name: 'CONNECT', icon: Layers },
  { id: 4, name: 'REVIEW', icon: Check },
];

const CONTENT_TYPES: { value: ClipType; label: string; icon: string; color: string }[] = [
  { value: 'wisdom_interview', label: 'Life Wisdom', icon: '👴', color: 'bg-amber-500' },
  { value: 'street_interview', label: 'Street Takes', icon: '🎤', color: 'bg-emerald-500' },
  { value: 'subway_interview', label: 'Subway Secrets', icon: '🚇', color: 'bg-orange-500' },
  { value: 'motivational', label: 'Motivation', icon: '💪', color: 'bg-rose-500' },
  { value: 'studio_interview', label: 'Professional', icon: '🎙️', color: 'bg-purple-500' },
];

// Helper functions - using crypto for production-safe IDs
const generateId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().substring(0, 9);
  }
  return Math.random().toString(36).substring(2, 9);
};

const getDurationSeconds = (preset: DurationPreset): number => {
  const presetConfig = DURATION_PRESETS.find(p => p.value === preset);
  return presetConfig ? Math.round((presetConfig.min + presetConfig.max) / 2) : 30;
};

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`;
};

export function InterviewCreator() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [autoStitch, setAutoStitch] = useState(false);
  
  const [state, setState] = useState<CreatorState>({
    currentStep: 1,
    clips: [],
    currentClipId: null,
    transitions: [],
    episodeTitle: '',
    episodeDescription: '',
  });

  // Step 1 state (for creating new clip)
  const [step1State, setStep1State] = useState<Step1State>({
    contentType: 'street_interview' as ClipType,
    interviewStyle: 'hot_take' as InterviewStyle,
    interviewFormat: 'solo' as InterviewFormat,
    durationPreset: 'quick' as DurationPreset,
  });

  // Step 2 state
  const [step2State, setStep2State] = useState<Step2State>({
    topic: '',
    language: 'en' as SupportedLanguage,
    customQuestion: '',
    additionalDirection: '',
  });

  // Computed values
  const currentClip = useMemo(() => 
    state.clips.find(c => c.id === state.currentClipId),
    [state.clips, state.currentClipId]
  );

  const totalDuration = useMemo(() => 
    state.clips.reduce((acc, clip) => acc + getDurationSeconds(clip.durationPreset), 0),
    [state.clips]
  );

  const topics = useMemo(() => 
    TOPICS[step1State.contentType] || [],
    [step1State.contentType]
  );

  // Actions
  const addClip = useCallback(() => {
    const newClip: Clip = {
      id: generateId(),
      contentType: step1State.contentType,
      interviewStyle: step1State.interviewStyle,
      interviewFormat: step1State.interviewFormat,
      durationPreset: step1State.durationPreset,
      topic: step2State.topic,
      language: step2State.language,
      customQuestion: step2State.customQuestion || undefined,
      additionalDirection: step2State.additionalDirection || undefined,
      status: 'draft',
    };

    setState(prev => ({
      ...prev,
      clips: [...prev.clips, newClip],
      currentClipId: newClip.id,
    }));
  }, [step1State, step2State]);

  const removeClip = useCallback((id: string) => {
    setState(prev => {
      const remainingClips = prev.clips.filter(c => c.id !== id);
      return {
        ...prev,
        clips: remainingClips,
        currentClipId: prev.currentClipId === id 
          ? (remainingClips.length > 0 ? remainingClips[0]?.id || null : null)
          : prev.currentClipId,
        transitions: prev.transitions.filter(t => t.fromClipId !== id && t.toClipId !== id),
      };
    });
  }, []);

  const updateClip = useCallback((id: string, updates: Partial<Clip>) => {
    setState(prev => ({
      ...prev,
      clips: prev.clips.map(c => c.id === id ? { ...c, ...updates } : c),
    }));
  }, []);

  // Fixed: Added bounds checking
  const moveClip = useCallback((fromIndex: number, toIndex: number) => {
    setState(prev => {
      // Bounds checking
      if (fromIndex < 0 || fromIndex >= prev.clips.length || toIndex < 0 || toIndex >= prev.clips.length) {
        return prev;
      }
      // Don't move if same position
      if (fromIndex === toIndex) return prev;
      
      const newClips = [...prev.clips];
      const [moved] = newClips.splice(fromIndex, 1);
      newClips.splice(toIndex, 0, moved);
      return { ...prev, clips: newClips };
    });
  }, []);

  // Fixed: Added generateEpisode with loading state
  const generateEpisode = useCallback(async () => {
    setIsGenerating(true);
    // Simulate API call - in production, this would call the actual API
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsGenerating(false);
    // Handle generation result
  }, [state.clips, autoStitch]);

  const nextStep = useCallback(() => {
    setState(prev => {
      if (prev.currentStep < 4) {
        return { ...prev, currentStep: prev.currentStep + 1 };
      }
      return prev;
    });
  }, []);

  const prevStep = useCallback(() => {
    setState(prev => {
      if (prev.currentStep > 1) {
        return { ...prev, currentStep: prev.currentStep - 1 };
      }
      return prev;
    });
  }, []);

  const goToStep = useCallback((step: number) => {
    if (step >= 1 && step <= 4) {
      setState(prev => ({ ...prev, currentStep: step }));
    }
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Progress Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-4">Create Interview</h1>
        
        {/* Progress Steps */}
        <div className="flex items-center justify-between" role="navigation" aria-label="Interview creation steps">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = state.currentStep === step.id;
            const isCompleted = state.currentStep > step.id;
            
            return (
              <div key={step.id} className="flex items-center">
                <button
                  onClick={() => goToStep(step.id)}
                  disabled={state.clips.length === 0 && step.id > 1}
                  aria-label={`Go to ${step.name} step`}
                  aria-current={isActive ? 'step' : undefined}
                  className={clsx(
                    'flex items-center gap-2 px-4 py-2 rounded-lg transition-all',
                    isActive && 'bg-amber-500/20 text-amber-400',
                    isCompleted && 'bg-emerald-500/20 text-emerald-400',
                    !isActive && !isCompleted && 'text-zinc-500 hover:text-zinc-300',
                    state.clips.length === 0 && step.id > 1 && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <div className={clsx(
                    'w-8 h-8 rounded-full flex items-center justify-center',
                    isActive && 'bg-amber-500 text-black',
                    isCompleted && 'bg-emerald-500 text-black',
                    !isActive && !isCompleted && 'bg-zinc-800 text-zinc-400'
                  )}>
                    {isCompleted ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <span className="hidden sm:inline font-medium">{step.name}</span>
                </button>
                
                {index < STEPS.length - 1 && (
                  <div className="w-8 sm:w-16 h-0.5 bg-zinc-700 mx-2" aria-hidden="true">
                    <div 
                      className={clsx(
                        'h-full bg-amber-500 transition-all',
                        isCompleted || isActive ? 'w-full' : 'w-0'
                      )}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Content Area with Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Step Content */}
        <div className="lg:col-span-2 space-y-6">
          {state.currentStep === 1 && (
            <Step1Create 
              state={step1State}
              onChange={setStep1State}
              onAddClip={addClip}
            />
          )}
          
          {state.currentStep === 2 && currentClip && (
            <Step2Details
              clip={currentClip}
              topics={topics}
              state={step2State}
              onChange={setStep2State}
              onSave={(updates) => updateClip(currentClip.id, updates)}
            />
          )}
          
          {state.currentStep === 3 && (
            <Step3Connect
              clips={state.clips}
              currentClipId={state.currentClipId}
              transitions={state.transitions}
              onSelectClip={(id) => setState(prev => ({ ...prev, currentClipId: id }))}
              onRemoveClip={removeClip}
              onMoveClip={moveClip}
              onAddClip={addClip}
              onUpdateClip={updateClip}
              autoStitch={autoStitch}
              onAutoStitchChange={setAutoStitch}
            />
          )}
          
          {state.currentStep === 4 && (
            <Step4Review
              clips={state.clips}
              totalDuration={totalDuration}
              episodeTitle={state.episodeTitle}
              episodeDescription={state.episodeDescription}
              onTitleChange={(title) => setState(prev => ({ ...prev, episodeTitle: title }))}
              onDescriptionChange={(desc) => setState(prev => ({ ...prev, episodeDescription: desc }))}
            />
          )}
        </div>

        {/* Right Column - Preview Panel */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 space-y-4">
            {/* Preview Card */}
            <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
              <h3 className="text-sm font-medium text-zinc-400 mb-3 flex items-center gap-2">
                <Play className="w-4 h-4" aria-hidden="true" />
                Preview
              </h3>
              
              {/* Preview Area */}
              <div className="aspect-[9/16] bg-zinc-800 rounded-lg flex items-center justify-center" role="img" aria-label="Clip preview">
                {state.clips.length > 0 && currentClip ? (
                  <div className="text-center p-6">
                    <div className="text-4xl mb-4" aria-hidden="true">
                      {CONTENT_TYPE_CONFIG[currentClip.contentType]?.icon || '🎬'}
                    </div>
                    <div className="text-white font-medium">
                      {currentClip.topic || 'Select a topic'}
                    </div>
                    <div className="text-zinc-500 text-sm mt-2">
                      {currentClip.interviewStyle.replace(/_/g, ' ')}
                    </div>
                    <div className="text-amber-400 text-sm mt-4">
                      {formatDuration(getDurationSeconds(currentClip.durationPreset))}
                    </div>
                  </div>
                ) : (
                  <div className="text-zinc-500 text-center p-6">
                    <Video className="w-12 h-12 mx-auto mb-3 opacity-50" aria-hidden="true" />
                    <p className="text-sm">Add clips to see preview</p>
                  </div>
                )}
              </div>

              {/* Timeline Summary */}
              {state.clips.length > 0 && (
                <div className="mt-4 pt-4 border-t border-zinc-800">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">
                      {state.clips.length} clip{state.clips.length !== 1 ? 's' : ''}
                    </span>
                    <span className="text-amber-400 font-medium">
                      {formatDuration(totalDuration)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Navigation Buttons */}
            <div className="flex gap-3">
              {state.currentStep > 1 && (
                <button
                  onClick={prevStep}
                  className="flex-1 px-4 py-3 rounded-xl bg-zinc-800 text-white font-medium hover:bg-zinc-700 transition-colors flex items-center justify-center gap-2"
                  aria-label="Go to previous step"
                >
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                  Back
                </button>
              )}
              
              {state.currentStep < 4 ? (
                <button
                  onClick={nextStep}
                  disabled={state.clips.length === 0 && state.currentStep > 1}
                  className="flex-1 px-4 py-3 rounded-xl bg-amber-500 text-black font-medium hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  aria-label="Continue to next step"
                >
                  Continue
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </button>
              ) : (
                <button
                  onClick={generateEpisode}
                  disabled={isGenerating}
                  className="flex-1 px-4 py-3 rounded-xl bg-emerald-500 text-black font-medium hover:bg-emerald-400 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
                  aria-label={isGenerating ? 'Generating episode...' : 'Generate episode'}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" aria-hidden="true" />
                      Generate
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Step 1: Create Component
interface Step1CreateProps {
  state: Step1State;
  onChange: React.Dispatch<React.SetStateAction<Step1State>>;
  onAddClip: () => void;
}

function Step1Create({ state, onChange, onAddClip }: Step1CreateProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent, value: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onChange(prev => ({ ...prev, contentType: value as ClipType }));
    }
  };

  return (
    <div className="space-y-6" role="region" aria-label="Create new clip">
      {/* Content Type Selection */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">What do you want to create?</h2>
        <div className="grid grid-cols-5 gap-3" role="radiogroup" aria-label="Content type">
          {CONTENT_TYPES.map((type) => (
            <button
              key={type.value}
              onClick={() => onChange(prev => ({ ...prev, contentType: type.value }))}
              onKeyDown={(e) => handleKeyDown(e, type.value)}
              role="radio"
              aria-checked={state.contentType === type.value}
              aria-label={type.label}
              className={clsx(
                'p-4 rounded-xl border-2 transition-all text-center focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-zinc-900',
                state.contentType === type.value
                  ? `${type.color}/20 border-current`
                  : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
              )}
            >
              <div className="text-3xl mb-2" aria-hidden="true">{type.icon}</div>
              <div className="text-xs font-medium text-zinc-300">{type.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Interview Style Selection */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">How should it feel?</h2>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2" role="radiogroup" aria-label="Interview style">
          {INTERVIEW_STYLES.slice(0, 12).map((style) => (
            <button
              key={style.value}
              onClick={() => onChange(prev => ({ ...prev, interviewStyle: style.value as InterviewStyle }))}
              role="radio"
              aria-checked={state.interviewStyle === style.value}
              aria-label={style.label}
              className={clsx(
                'px-3 py-2 rounded-lg border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-amber-500',
                state.interviewStyle === style.value
                  ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                  : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-300'
              )}
            >
              {style.label}
            </button>
          ))}
        </div>
      </div>

      {/* Format & Length */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="format-select" className="block text-sm font-medium text-zinc-400 mb-2">Format</label>
          <select
            id="format-select"
            value={state.interviewFormat}
            onChange={(e) => onChange(prev => ({ ...prev, interviewFormat: e.target.value as InterviewFormat }))}
            className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white focus:border-amber-500 focus:outline-none"
          >
            {INTERVIEW_FORMATS.map(fmt => (
              <option key={fmt.value} value={fmt.value}>{fmt.label}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label htmlFor="duration-select" className="block text-sm font-medium text-zinc-400 mb-2">Length</label>
          <select
            id="duration-select"
            value={state.durationPreset}
            onChange={(e) => onChange(prev => ({ ...prev, durationPreset: e.target.value as DurationPreset }))}
            className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white focus:border-amber-500 focus:outline-none"
          >
            {DURATION_PRESETS.map(preset => (
              <option key={preset.value} value={preset.value}>
                {preset.label} - {preset.description}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Add Clip Button */}
      <button
        ref={buttonRef}
        onClick={onAddClip}
        className="w-full px-4 py-4 rounded-xl bg-zinc-800 border border-dashed border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600 hover:bg-zinc-900 transition-all flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
        aria-label="Add this clip to timeline"
      >
        <Plus className="w-5 h-5" aria-hidden="true" />
        Add this clip to timeline
      </button>
    </div>
  );
}

// Step 2: Details Component
interface Step2DetailsProps {
  clip: Clip;
  topics: string[];
  state: Step2State;
  onChange: React.Dispatch<React.SetStateAction<Step2State>>;
  onSave: (updates: Partial<Clip>) => void;
}

function Step2Details({ clip, topics, state, onChange, onSave }: Step2DetailsProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-6" role="region" aria-label="Clip details">
      {/* Topic Selection */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">What's your topic?</h2>
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={state.topic}
            onChange={(e) => onChange(prev => ({ ...prev, topic: e.target.value }))}
            placeholder="Search topics..."
            aria-autocomplete="list"
            aria-controls="topic-list"
            className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white focus:border-amber-500 focus:outline-none"
          />
        </div>
        
        {topics.length > 0 && (
          <div 
            id="topic-list"
            className="mt-3 flex flex-wrap gap-2" 
            role="listbox" 
            aria-label="Suggested topics"
          >
            {topics.slice(0, 8).map((topic) => (
              <button
                key={topic}
                onClick={() => onChange(prev => ({ ...prev, topic }))}
                role="option"
                aria-selected={state.topic === topic}
                className={clsx(
                  'px-3 py-1 rounded-full text-sm transition-all focus:outline-none focus:ring-2 focus:ring-amber-500',
                  state.topic === topic
                    ? 'bg-amber-500 text-black'
                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                )}
              >
                {topic}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Language Selection */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Language</h2>
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2" role="radiogroup" aria-label="Language">
          {LANGUAGE_OPTIONS.slice(0, 12).map((lang) => (
            <button
              key={lang.code}
              onClick={() => onChange(prev => ({ ...prev, language: lang.code as SupportedLanguage }))}
              role="radio"
              aria-checked={state.language === lang.code}
              aria-label={lang.name}
              className={clsx(
                'px-3 py-2 rounded-lg text-sm transition-all focus:outline-none focus:ring-2 focus:ring-amber-500',
                state.language === lang.code
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                  : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-300'
              )}
            >
              {lang.code.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Optional Fields */}
      <div className="space-y-3">
        <button
          onClick={() => {
            const isExpanded = state.customQuestion !== '';
            onChange(prev => ({ 
              ...prev, 
              customQuestion: isExpanded ? '' : 'What is your take on this topic?' 
            }));
          }}
          className="text-sm text-amber-400 hover:text-amber-300 flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-amber-500 rounded"
          aria-expanded={state.customQuestion !== ''}
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          {state.customQuestion ? 'Hide' : 'Add'} custom question
        </button>
        
        {state.customQuestion && (
          <input
            type="text"
            value={state.customQuestion}
            onChange={(e) => onChange(prev => ({ ...prev, customQuestion: e.target.value }))}
            placeholder="Enter your question..."
            aria-label="Custom question"
            className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white focus:border-amber-500 focus:outline-none"
          />
        )}
      </div>

      {/* Save Button */}
      <button
        onClick={() => onSave({
          topic: state.topic,
          language: state.language,
          customQuestion: state.customQuestion || undefined,
          additionalDirection: state.additionalDirection || undefined,
        })}
        disabled={!state.topic}
        className="w-full px-4 py-3 rounded-xl bg-amber-500 text-black font-medium hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-amber-500"
        aria-label="Save and continue"
      >
        Save & Continue
      </button>
    </div>
  );
}

// Step 3: Connect Component
interface Step3ConnectProps {
  clips: Clip[];
  currentClipId: string | null;
  transitions: Transition[];
  onSelectClip: (id: string) => void;
  onRemoveClip: (id: string) => void;
  onMoveClip: (from: number, to: number) => void;
  onAddClip: () => void;
  onUpdateClip: (id: string, updates: Partial<Clip>) => void;
  autoStitch: boolean;
  onAutoStitchChange: (value: boolean) => void;
}

function Step3Connect({
  clips,
  currentClipId,
  transitions,
  onSelectClip,
  onRemoveClip,
  onMoveClip,
  onAddClip,
  onUpdateClip,
  autoStitch,
  onAutoStitchChange,
}: Step3ConnectProps) {
  return (
    <div className="space-y-6" role="region" aria-label="Timeline">
      {/* Timeline */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Your Timeline</h2>
        
        {clips.length === 0 ? (
          <div className="text-center py-12 bg-zinc-900 rounded-xl border border-zinc-800">
            <Layers className="w-12 h-12 mx-auto mb-3 text-zinc-600" aria-hidden="true" />
            <p className="text-zinc-400 mb-4">No clips yet. Create your first clip!</p>
            <button
              onClick={onAddClip}
              className="px-4 py-2 bg-amber-500 text-black rounded-lg font-medium hover:bg-amber-400 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500"
              aria-label="Create first clip"
            >
              Create First Clip
            </button>
          </div>
        ) : (
          <div className="space-y-3" role="list" aria-label="Clips in timeline">
            {clips.map((clip, index) => {
              const contentConfig = CONTENT_TYPE_CONFIG[clip.contentType];
              const nextClip = clips[index + 1];
              const canMoveUp = index > 0;
              const canMoveDown = index < clips.length - 1;
              
              return (
                <div key={clip.id}>
                  {/* Clip Card */}
                  <div
                    onClick={() => onSelectClip(clip.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectClip(clip.id);
                      }
                    }}
                    role="listitem"
                    tabIndex={0}
                    aria-label={`Clip ${index + 1}: ${clip.topic || 'Untitled'}`}
                    aria-selected={currentClipId === clip.id}
                    className={clsx(
                      'p-4 rounded-xl border-2 cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-zinc-900',
                      currentClipId === clip.id
                        ? 'border-amber-500 bg-amber-500/10'
                        : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            onMoveClip(index, index - 1); 
                          }}
                          disabled={!canMoveUp}
                          aria-label={`Move clip ${index + 1} up`}
                          className="text-zinc-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-amber-500 rounded"
                        >
                          <GripVertical className="w-4 h-4 rotate-90" aria-hidden="true" />
                        </button>
                        <button
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            onMoveClip(index, index + 1); 
                          }}
                          disabled={!canMoveDown}
                          aria-label={`Move clip ${index + 1} down`}
                          className="text-zinc-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-amber-500 rounded"
                        >
                          <GripVertical className="w-4 h-4 -rotate-90" aria-hidden="true" />
                        </button>
                      </div>
                      
                      <div className="w-12 h-12 rounded-lg bg-zinc-800 flex items-center justify-center text-2xl" aria-hidden="true">
                        {contentConfig?.icon || '🎬'}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-amber-400 font-medium">#{index + 1}</span>
                          <span className="text-white font-medium">{clip.topic || 'Untitled'}</span>
                        </div>
                        <div className="text-zinc-500 text-sm">
                          {clip.interviewStyle.replace(/_/g, ' ')} • {formatDuration(getDurationSeconds(clip.durationPreset))}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            onUpdateClip(clip.id, { 
                              interviewStyle: clip.interviewStyle === 'hot_take' ? 'red_flag_detector' : 'hot_take' 
                            }); 
                          }}
                          className="p-2 text-zinc-500 hover:text-amber-400 transition-colors"
                          aria-label="Edit clip settings"
                        >
                          <GripVertical className="w-4 h-4" aria-hidden="true" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onRemoveClip(clip.id); }}
                          className="p-2 text-zinc-500 hover:text-red-400 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 rounded"
                          aria-label={`Remove clip ${index + 1}`}
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                        <ChevronRight className="w-4 h-4 text-zinc-600" aria-hidden="true" />
                      </div>
                    </div>
                  </div>
                  
                  {/* Transition Connector */}
                  {nextClip && (
                    <div className="flex items-center py-2 pl-8">
                      <div className="w-0.5 h-6 bg-zinc-700" aria-hidden="true" />
                      <div className="px-3 py-1 text-xs text-zinc-500 bg-zinc-900 rounded-full border border-zinc-800">
                        Transition
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            
            {/* Add Button */}
            <button
              onClick={onAddClip}
              className="w-full p-4 rounded-xl border-2 border-dashed border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition-all flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
              aria-label="Add another clip"
            >
              <Plus className="w-5 h-5" aria-hidden="true" />
              Add another clip
            </button>
          </div>
        )}
      </div>

      {/* Episode Summary */}
      {clips.length > 0 && (
        <div className="p-4 bg-zinc-900 rounded-xl border border-zinc-800">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-white font-medium">{clips.length} clips</div>
              <div className="text-zinc-500 text-sm">
                Total: {formatDuration(clips.reduce((acc, c) => acc + getDurationSeconds(c.durationPreset), 0))}
              </div>
            </div>
            <button
              onClick={() => onAutoStitchChange(!autoStitch)}
              className={clsx(
                'px-3 py-1 text-sm rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500',
                autoStitch 
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500' 
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              )}
              aria-pressed={autoStitch}
              aria-label="Toggle auto-stitch"
            >
              Auto-Stitch {autoStitch ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Step 4: Review Component
interface Step4ReviewProps {
  clips: Clip[];
  totalDuration: number;
  episodeTitle: string;
  episodeDescription: string;
  onTitleChange: (title: string) => void;
  onDescriptionChange: (desc: string) => void;
}

function Step4Review({
  clips,
  totalDuration,
  episodeTitle,
  episodeDescription,
  onTitleChange,
  onDescriptionChange
}: Step4ReviewProps) {
  return (
    <div className="space-y-6" role="region" aria-label="Review episode">
      {/* Episode Info */}
      <div className="space-y-4">
        <div>
          <label htmlFor="episode-title" className="block text-sm font-medium text-zinc-400 mb-2">Episode Title</label>
          <input
            id="episode-title"
            type="text"
            value={episodeTitle}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="My Interview Episode"
            aria-required="false"
            className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        
        <div>
          <label htmlFor="episode-description" className="block text-sm font-medium text-zinc-400 mb-2">Description</label>
          <textarea
            id="episode-description"
            value={episodeDescription}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="Describe your episode..."
            rows={3}
            aria-required="false"
            className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
          />
        </div>
      </div>

      {/* Episode Summary */}
      <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
        <h3 className="text-white font-medium mb-4">Episode Summary</h3>
        
        <div className="space-y-3" role="list" aria-label="Clips in episode">
          {clips.map((clip, index) => (
            <div key={clip.id} className="flex items-center gap-3" role="listitem">
              <span className="text-amber-400 font-medium">#{index + 1}</span>
              <div className="flex-1">
                <div className="text-white">{clip.topic}</div>
                <div className="text-zinc-500 text-sm">
                  {clip.interviewStyle.replace(/_/g, ' ')}
                </div>
              </div>
              <span className="text-zinc-400">
                {formatDuration(getDurationSeconds(clip.durationPreset))}
              </span>
            </div>
          ))}
        </div>
        
        <div className="mt-4 pt-4 border-t border-zinc-800 flex items-center justify-between">
          <span className="text-zinc-400">{clips.length} clips</span>
          <span className="text-amber-400 font-medium">{formatDuration(totalDuration)}</span>
        </div>
      </div>
    </div>
  );
}

export default InterviewCreator;

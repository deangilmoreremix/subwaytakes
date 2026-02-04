import { useState } from 'react';
import { BarChart3, Plus, Trash2, Users, Check, X } from 'lucide-react';
import type { StreetPoll, PollQuestionType } from '../lib/types';

interface StreetPollProps {
  value: StreetPoll | undefined;
  onChange: (poll: StreetPoll | undefined) => void;
  disabled?: boolean;
}

const POLL_TYPES: { value: PollQuestionType; label: string; emoji: string; description: string }[] = [
  { value: 'agree_disagree', label: 'Agree/Disagree', emoji: '👍👎', description: 'Classic hot take poll' },
  { value: 'this_or_that', label: 'This or That', emoji: '🔴🔵', description: 'Choose between two options' },
  { value: 'rating', label: 'Rate It', emoji: '⭐', description: '1-5 or 1-10 rating' },
  { value: 'would_you_rather', label: 'Would You Rather', emoji: '🤔', description: 'Hypothetical choices' },
];

const VISUAL_STYLES = [
  { value: 'bar_chart', label: 'Bar Chart', emoji: '📊' },
  { value: 'pie_chart', label: 'Pie Chart', emoji: '🥧' },
  { value: 'tally', label: 'Tally Marks', emoji: ' tally' },
  { value: 'emoji_reactions', label: 'Emoji', emoji: '😀' },
] as const;

export function StreetPoll({ value, onChange, disabled }: StreetPollProps) {
  const [isEnabled, setIsEnabled] = useState(value?.enabled ?? false);
  const [pollType, setPollType] = useState<PollQuestionType>(value?.pollType ?? 'agree_disagree');
  const [question, setQuestion] = useState(value?.question ?? '');
  const [responses, setResponses] = useState(value?.responses ?? [
    { option: 'Agree', passerbyCount: 5, reaction: 'Nods of approval' },
    { option: 'Disagree', passerbyCount: 3, reaction: 'Head shakes' },
  ]);
  const [showResults, setShowResults] = useState(value?.showResults ?? true);
  const [visualStyle, setVisualStyle] = useState(value?.visualStyle ?? 'bar_chart');

  const enabled = isEnabled && !disabled;

  function toggleEnabled() {
    const newEnabled = !isEnabled;
    setIsEnabled(newEnabled);
    if (newEnabled) {
      onChange({
        enabled: true,
        pollType,
        question: question || getDefaultQuestion(pollType),
        responses,
        showResults,
        visualStyle,
      });
    } else {
      onChange(undefined);
    }
  }

  function getDefaultQuestion(type: PollQuestionType): string {
    const defaults: Record<PollQuestionType, string> = {
      agree_disagree: 'Is this a hot take or FACTS?',
      this_or_that: 'NYC Pizza or $1 Slice?',
      rating: 'Rate this take 1-10',
      would_you_rather: 'Would you rather commute 2 hours or pay $4K rent?',
    };
    return defaults[type];
  }

  function getDefaultResponses(type: PollQuestionType): StreetPoll['responses'] {
    switch (type) {
      case 'agree_disagree':
        return [
          { option: 'Agree', passerbyCount: 5, reaction: 'Nods of approval' },
          { option: 'Disagree', passerbyCount: 3, reaction: 'Head shakes' },
        ];
      case 'this_or_that':
        return [
          { option: 'Option A', passerbyCount: 4, reaction: 'Enthusiastic' },
          { option: 'Option B', passerbyCount: 4, reaction: 'Thoughtful' },
        ];
      case 'rating':
        return [
          { option: 'High (8-10)', passerbyCount: 3, reaction: 'Impressed' },
          { option: 'Mid (4-7)', passerbyCount: 4, reaction: 'Considering' },
          { option: 'Low (1-3)', passerbyCount: 1, reaction: 'Disappointed' },
        ];
      case 'would_you_rather':
        return [
          { option: 'First Option', passerbyCount: 5, reaction: 'Pragmatic' },
          { option: 'Second Option', passerbyCount: 3, reaction: 'Idealistic' },
        ];
    }
  }

  function updatePollType(type: PollQuestionType) {
    setPollType(type);
    const newResponses = getDefaultResponses(type);
    setResponses(newResponses);
    onChange({
      enabled: true,
      pollType: type,
      question: question || getDefaultQuestion(type),
      responses: newResponses,
      showResults,
      visualStyle,
    });
  }

  function updateQuestion(newQuestion: string) {
    setQuestion(newQuestion);
    onChange({ enabled: true, pollType, question: newQuestion, responses, showResults, visualStyle });
  }

  function updateResponse(index: number, updates: Partial<StreetPoll['responses'][0]>) {
    const newResponses = responses.map((r, i) => i === index ? { ...r, ...updates } : r);
    setResponses(newResponses);
    onChange({ enabled: true, pollType, question, responses: newResponses, showResults, visualStyle });
  }

  function addResponse() {
    const newResponses = [...responses, { option: 'New Option', passerbyCount: 1, reaction: '' }];
    setResponses(newResponses);
    onChange({ enabled: true, pollType, question, responses: newResponses, showResults, visualStyle });
  }

  function removeResponse(index: number) {
    if (responses.length <= 2) return;
    const newResponses = responses.filter((_, i) => i !== index);
    setResponses(newResponses);
    onChange({ enabled: true, pollType, question, responses: newResponses, showResults, visualStyle });
  }

  function toggleShowResults() {
    const newShowResults = !showResults;
    setShowResults(newShowResults);
    onChange({ enabled: true, pollType, question, responses, showResults: newShowResults, visualStyle });
  }

  function updateVisualStyle(style: StreetPoll['visualStyle']) {
    setVisualStyle(style);
    onChange({ enabled: true, pollType, question, responses, showResults, visualStyle: style });
  }

  const totalPassersby = responses.reduce((sum, r) => sum + r.passerbyCount, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
              type="button"
              onClick={toggleEnabled}
              disabled={disabled}
              aria-label="Enable street poll"
              aria-pressed={isEnabled}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                isEnabled ? 'bg-emerald-500' : 'bg-zinc-700'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                  isEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          <div>
            <span className="text-sm font-medium text-zinc-200">Street Poll</span>
            <p className="text-xs text-zinc-500">Live voting with passersby</p>
          </div>
        </div>
      </div>

      {enabled && (
        <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          {/* Poll Type */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Poll Type</label>
            <div className="flex flex-wrap gap-2">
              {POLL_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => updatePollType(type.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-all ${
                    pollType === type.value
                      ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400'
                      : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
                  }`}
                >
                  <span>{type.emoji}</span>
                  <span>{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Question */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Poll Question</label>
            <input
              type="text"
              value={question}
              onChange={(e) => updateQuestion(e.target.value)}
              placeholder={getDefaultQuestion(pollType)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-emerald-500/50 focus:outline-none"
            />
          </div>

          {/* Responses */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Passerby Responses</label>
            {responses.map((response, index) => (
              <div
                key={index}
                className="flex items-center gap-2 p-2 rounded-lg border border-zinc-800 bg-zinc-800/30"
              >
                <input
                  type="text"
                  value={response.option}
                  onChange={(e) => updateResponse(index, { option: e.target.value })}
                  className="flex-1 min-w-0 rounded-md border border-zinc-700 bg-zinc-800/50 px-2 py-1.5 text-xs text-zinc-200 focus:border-emerald-500/50 focus:outline-none"
                />

                <div className="flex items-center gap-1">
                  <Users className="h-3 w-3 text-zinc-500" />
                  <input
                    type="number"
                    value={response.passerbyCount}
                    onChange={(e) => updateResponse(index, { passerbyCount: parseInt(e.target.value) || 0 })}
                    min={0}
                    max={20}
                    className="w-12 rounded-md border border-zinc-700 bg-zinc-800/50 px-1 py-1.5 text-xs text-zinc-200 focus:border-emerald-500/50 focus:outline-none text-center"
                  />
                </div>

                <input
                  type="text"
                  value={response.reaction}
                  onChange={(e) => updateResponse(index, { reaction: e.target.value })}
                  placeholder="Reaction"
                  className="w-24 rounded-md border border-zinc-700 bg-zinc-800/50 px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:border-emerald-500/50 focus:outline-none"
                />

                {responses.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeResponse(index)}
                    className="text-zinc-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}

            {responses.length < 5 && (
              <button
                type="button"
                onClick={addResponse}
                className="flex items-center justify-center gap-2 w-full py-2 rounded-lg border border-dashed border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300 transition-colors text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Response Option
              </button>
            )}
          </div>

          {/* Visual Style */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Visual Result Style</label>
            <div className="flex gap-2">
              {VISUAL_STYLES.map((style) => (
                <button
                  key={style.value}
                  type="button"
                  onClick={() => updateVisualStyle(style.value)}
                  className={`flex-1 px-2 py-1.5 rounded-md border text-[10px] transition-all ${
                    visualStyle === style.value
                      ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400'
                      : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
                  }`}
                >
                  {style.label}
                </button>
              ))}
            </div>
          </div>

          {/* Show Results Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400">Show results on screen</span>
            <button
              type="button"
              onClick={toggleShowResults}
              className={`relative h-5 w-9 rounded-full transition-colors ${
                showResults ? 'bg-emerald-500' : 'bg-zinc-700'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                  showResults ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Preview */}
          <div className="rounded-lg bg-zinc-800/30 p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <BarChart3 className="h-3.5 w-3.5" />
              <span>Poll Preview</span>
            </div>
            <p className="text-xs text-zinc-300 font-medium">{question || getDefaultQuestion(pollType)}</p>
            <div className="space-y-1">
              {responses.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex-1 h-4 bg-zinc-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500/60 rounded-full"
                      style={{ width: `${totalPassersby > 0 ? (r.passerbyCount / totalPassersby) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-zinc-500 w-16 truncate">{r.option}</span>
                  <span className="text-[10px] text-zinc-600">{r.passerbyCount}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-zinc-600">
              {totalPassersby} people polled • {showResults ? 'Results shown' : 'Results hidden'} • {visualStyle.replace('_', ' ')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

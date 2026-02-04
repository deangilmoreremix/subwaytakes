import { useState } from 'react';
import { ArrowRightLeft, MapPin, ArrowRight, CornerDownRight, MessageSquare, Brain, Heart, Smile } from 'lucide-react';
import type { TransferPoint, PivotDirection, SubwayLine } from '../lib/types';
import { PIVOT_DIRECTIONS, SUBWAY_LINES, SUBWAY_STATIONS } from '../lib/constants';

interface TransferPointBuilderProps {
  value: TransferPoint | undefined;
  onChange: (point: TransferPoint | undefined) => void;
  disabled?: boolean;
  currentLine?: SubwayLine;
}

const PIVOT_ICONS: Record<PivotDirection, typeof ArrowRight> = {
  deeper: CornerDownRight,
  challenge: MessageSquare,
  personal: Heart,
  philosophical: Brain,
  comedic: Smile,
};

export function TransferPointBuilder({ value, onChange, disabled, currentLine }: TransferPointBuilderProps) {
  const [isEnabled, setIsEnabled] = useState(value?.enabled ?? false);
  const [pivotType, setPivotType] = useState<PivotDirection>(value?.pivotType ?? 'deeper');
  const [triggerStation, setTriggerStation] = useState(value?.triggerStation ?? 'Union Square');
  const [newLine, setNewLine] = useState<SubwayLine | undefined>(value?.newLine);
  const [newQuestion, setNewQuestion] = useState(value?.newQuestion ?? '');
  const [transitionPhrase, setTransitionPhrase] = useState(value?.transitionPhrase ?? '');

  const enabled = isEnabled && !disabled;

  function toggleEnabled() {
    const newEnabled = !isEnabled;
    setIsEnabled(newEnabled);
    if (newEnabled) {
      onChange({
        enabled: true,
        triggerStation,
        newLine,
        pivotType,
        newQuestion: newQuestion || getDefaultQuestion(pivotType),
        transitionPhrase: transitionPhrase || getDefaultTransition(pivotType),
      });
    } else {
      onChange(undefined);
    }
  }

  function getDefaultQuestion(type: PivotDirection): string {
    const defaults: Record<PivotDirection, string> = {
      deeper: 'But why do you really think that?',
      challenge: 'What would you say to someone who disagrees?',
      personal: 'Has this ever happened to you personally?',
      philosophical: 'What does that say about human nature?',
      comedic: 'Whats the most ridiculous version of that?',
    };
    return defaults[type];
  }

  function getDefaultTransition(type: PivotDirection): string {
    const defaults: Record<PivotDirection, string> = {
      deeper: 'Let me push back on that...',
      challenge: 'But heres the thing...',
      personal: 'Speaking of which...',
      philosophical: 'That makes me think...',
      comedic: 'Okay but imagine...',
    };
    return defaults[type];
  }

  function updatePivotType(type: PivotDirection) {
    setPivotType(type);
    onChange({
      enabled: true,
      triggerStation,
      newLine,
      pivotType: type,
      newQuestion: newQuestion || getDefaultQuestion(type),
      transitionPhrase: transitionPhrase || getDefaultTransition(type),
    });
  }

  function updateTriggerStation(station: string) {
    setTriggerStation(station);
    onChange({ enabled: true, triggerStation: station, newLine, pivotType, newQuestion, transitionPhrase });
  }

  function updateNewLine(line: SubwayLine | undefined) {
    setNewLine(line);
    onChange({ enabled: true, triggerStation, newLine: line, pivotType, newQuestion, transitionPhrase });
  }

  function updateNewQuestion(question: string) {
    setNewQuestion(question);
    onChange({ enabled: true, triggerStation, newLine, pivotType, newQuestion: question, transitionPhrase });
  }

  function updateTransitionPhrase(phrase: string) {
    setTransitionPhrase(phrase);
    onChange({ enabled: true, triggerStation, newLine, pivotType, newQuestion, transitionPhrase: phrase });
  }

  const stations = currentLine ? SUBWAY_STATIONS[currentLine] : SUBWAY_STATIONS.any;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
              type="button"
              onClick={toggleEnabled}
              disabled={disabled}
              aria-label="Enable transfer point pivot"
              aria-pressed={isEnabled}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                isEnabled ? 'bg-amber-500' : 'bg-zinc-700'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                isEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
          <div>
            <span className="text-sm font-medium text-zinc-200">Transfer Point Pivot</span>
            <p className="text-xs text-zinc-500">Interview changes direction at transfers</p>
          </div>
        </div>
      </div>

      {enabled && (
        <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          {/* Pivot Direction */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Pivot Direction</label>
            <div className="grid grid-cols-2 gap-2">
              {PIVOT_DIRECTIONS.map((dir) => {
                const Icon = PIVOT_ICONS[dir.value];
                const isSelected = pivotType === dir.value;

                return (
                  <button
                    key={dir.value}
                    type="button"
                    onClick={() => updatePivotType(dir.value)}
                    className={`flex items-start gap-2 p-2 rounded-lg border text-left transition-all ${
                      isSelected
                        ? 'border-amber-500/50 bg-amber-500/10'
                        : 'border-zinc-700 bg-zinc-800/30 hover:border-zinc-600'
                    }`}
                  >
                    <Icon className={`h-4 w-4 mt-0.5 ${isSelected ? 'text-amber-400' : 'text-zinc-500'}`} />
                    <div>
                      <span className={`text-xs font-medium block ${isSelected ? 'text-amber-200' : 'text-zinc-300'}`}>
                        {dir.label}
                      </span>
                      <span className="text-[10px] text-zinc-500">{dir.description}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Transfer Station */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Transfer Station</label>
            <select
              value={triggerStation}
              onChange={(e) => updateTriggerStation(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-xs text-zinc-200 focus:border-amber-500/50 focus:outline-none"
            >
              {stations.map((station) => (
                <option key={station} value={station}>
                  {station}
                </option>
              ))}
            </select>
          </div>

          {/* New Line (Optional) */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Transfer To Line (Optional)</label>
            <select
              value={newLine || ''}
              onChange={(e) => updateNewLine(e.target.value as SubwayLine || undefined)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-xs text-zinc-200 focus:border-amber-500/50 focus:outline-none"
            >
              <option value="">Stay on same line</option>
              {SUBWAY_LINES.filter(l => l.value !== 'any').map((line) => (
                <option key={line.value} value={line.value}>
                  {line.label}
                </option>
              ))}
            </select>
          </div>

          {/* New Question */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">New Question</label>
            <input
              type="text"
              value={newQuestion}
              onChange={(e) => updateNewQuestion(e.target.value)}
              placeholder={getDefaultQuestion(pivotType)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none"
            />
          </div>

          {/* Transition Phrase */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Transition Phrase</label>
            <input
              type="text"
              value={transitionPhrase}
              onChange={(e) => updateTransitionPhrase(e.target.value)}
              placeholder={getDefaultTransition(pivotType)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none"
            />
          </div>

          {/* Preview */}
          <div className="rounded-lg bg-zinc-800/30 p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <ArrowRightLeft className="h-3.5 w-3.5" />
              <span>Pivot Preview</span>
            </div>
            <div className="space-y-1 text-xs">
              <p className="text-zinc-500">
                <MapPin className="h-3 w-3 inline mr-1" />
                At {triggerStation}...
              </p>
              <p className="text-amber-400">
                <ArrowRight className="h-3 w-3 inline mr-1" />
                "{transitionPhrase || getDefaultTransition(pivotType)}"
              </p>
              <p className="text-zinc-300">
                {newQuestion || getDefaultQuestion(pivotType)}
              </p>
              {newLine && (
                <p className="text-zinc-500">
                  (Boarding the {SUBWAY_LINES.find(l => l.value === newLine)?.label})
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

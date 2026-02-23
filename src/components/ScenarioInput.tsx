import { useState } from 'react';
import { Clapperboard, ChevronDown } from 'lucide-react';

interface ScenarioInputProps {
  value: string;
  onChange: (v: string) => void;
  variant?: 'subway' | 'street';
  disabled?: boolean;
}

const SCENARIO_EXAMPLES: Record<string, string[]> = {
  subway: [
    'A heated debate breaks out between two strangers about pineapple on pizza',
    'An elderly musician plays saxophone as the train approaches',
    'Someone drops their phone on the tracks right before the interview',
    'A group of tourists ask the interviewee for directions mid-answer',
    'The interviewee gets recognized by a fan during the conversation',
  ],
  street: [
    'A street performer draws a crowd behind the interviewee',
    'Rain suddenly starts and everyone scrambles for cover',
    'A delivery bike nearly clips the interviewer mid-question',
    'The smell from a nearby food cart distracts the conversation',
    'A dog runs up and interrupts the interview with affection',
  ],
};

export function ScenarioInput({
  value,
  onChange,
  variant = 'subway',
  disabled = false,
}: ScenarioInputProps) {
  const [showExamples, setShowExamples] = useState(false);
  const examples = SCENARIO_EXAMPLES[variant] || SCENARIO_EXAMPLES.subway;

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-zinc-300">
        <Clapperboard className="inline w-4 h-4 mr-1.5 -mt-0.5 text-zinc-400" />
        Scenario Description
        <span className="ml-2 text-xs text-zinc-500 font-normal">Optional</span>
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, 300))}
        placeholder="Describe what's happening in the scene..."
        disabled={disabled}
        rows={3}
        className="w-full rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30 focus:outline-none resize-none transition-colors disabled:opacity-50"
      />
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setShowExamples(!showExamples)}
          className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors"
        >
          Example scenarios
          <ChevronDown className={`w-3 h-3 transition-transform ${showExamples ? 'rotate-180' : ''}`} />
        </button>
        <span className="text-xs text-zinc-600">{value.length}/300</span>
      </div>

      {showExamples && (
        <div className="space-y-1.5 mt-1">
          {examples.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => {
                onChange(ex);
                setShowExamples(false);
              }}
              className="block w-full text-left text-xs px-3 py-2 rounded-lg border border-zinc-700/50 bg-zinc-800/30 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors"
            >
              {ex}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

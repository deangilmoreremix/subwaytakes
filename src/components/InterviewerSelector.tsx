import { Mic, Video, Eye, Camera } from 'lucide-react';
import type { InterviewerType, InterviewerPosition } from '../lib/types';
import { INTERVIEWER_TYPES, INTERVIEWER_POSITIONS } from '../lib/constants';

interface InterviewerSelectorProps {
  type: InterviewerType;
  position: InterviewerPosition;
  onTypeChange: (value: InterviewerType) => void;
  onPositionChange: (value: InterviewerPosition) => void;
  disabled?: boolean;
}

const TYPE_ICONS: Record<InterviewerType, typeof Mic> = {
  podcaster: Mic,
  documentary_journalist: Video,
  casual_creator: Camera,
  news_reporter: Mic,
  hidden_voice_only: Eye,
};

export function InterviewerSelector({
  type,
  position,
  onTypeChange,
  onPositionChange,
  disabled,
}: InterviewerSelectorProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <label className="block text-sm font-medium text-zinc-300">
          Interviewer Type
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {INTERVIEWER_TYPES.map((item) => {
            const isSelected = type === item.value;
            const Icon = TYPE_ICONS[item.value];

            return (
              <button
                key={item.value}
                type="button"
                onClick={() => onTypeChange(item.value)}
                disabled={disabled}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
                  isSelected
                    ? 'bg-amber-500/15 border-amber-500/50 ring-1 ring-amber-500/30'
                    : 'bg-zinc-800/50 border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Icon className={`h-5 w-5 ${isSelected ? 'text-amber-400' : 'text-zinc-400'}`} />
                <span className={`text-xs font-medium text-center ${isSelected ? 'text-amber-400' : 'text-zinc-300'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
        {type && (
          <p className="text-xs text-zinc-500">
            {INTERVIEWER_TYPES.find(t => t.value === type)?.description}
          </p>
        )}
      </div>

      <div className="space-y-3">
        <label className="block text-sm font-medium text-zinc-300">
          Camera Position
        </label>
        <div className="flex flex-wrap gap-2">
          {INTERVIEWER_POSITIONS.map((item) => {
            const isSelected = position === item.value;

            return (
              <button
                key={item.value}
                type="button"
                onClick={() => onPositionChange(item.value)}
                disabled={disabled}
                className={`px-4 py-2 rounded-lg border transition-all ${
                  isSelected
                    ? 'bg-amber-500/15 border-amber-500/50 ring-1 ring-amber-500/30'
                    : 'bg-zinc-800/50 border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span className={`text-sm font-medium ${isSelected ? 'text-amber-400' : 'text-zinc-300'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
        {position && (
          <p className="text-xs text-zinc-500">
            {INTERVIEWER_POSITIONS.find(p => p.value === position)?.description}
          </p>
        )}
      </div>
    </div>
  );
}

import type { SubjectDemographic, SubjectGender, SubjectStyle } from '../lib/types';
import { SUBJECT_DEMOGRAPHICS, SUBJECT_GENDERS, SUBJECT_STYLES } from '../lib/constants';

interface SubjectSelectorProps {
  demographic: SubjectDemographic;
  gender: SubjectGender;
  style: SubjectStyle;
  onDemographicChange: (value: SubjectDemographic) => void;
  onGenderChange: (value: SubjectGender) => void;
  onStyleChange: (value: SubjectStyle) => void;
  disabled?: boolean;
}

export function SubjectSelector({
  demographic,
  gender,
  style,
  onDemographicChange,
  onGenderChange,
  onStyleChange,
  disabled,
}: SubjectSelectorProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <label className="block text-sm font-medium text-zinc-300">
          Subject Type
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {SUBJECT_DEMOGRAPHICS.map((item) => {
            const isSelected = demographic === item.value;

            return (
              <button
                key={item.value}
                type="button"
                onClick={() => onDemographicChange(item.value)}
                disabled={disabled}
                className={`px-3 py-2.5 rounded-lg border transition-all text-left ${
                  isSelected
                    ? 'bg-emerald-500/15 border-emerald-500/50 ring-1 ring-emerald-500/30'
                    : 'bg-zinc-800/50 border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span className={`text-sm font-medium block ${isSelected ? 'text-emerald-400' : 'text-zinc-300'}`}>
                  {item.label}
                </span>
                <span className="text-xs text-zinc-500 block mt-0.5 truncate">
                  {item.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-3">
          <label className="block text-sm font-medium text-zinc-300">
            Gender
          </label>
          <div className="flex gap-2">
            {SUBJECT_GENDERS.map((item) => {
              const isSelected = gender === item.value;

              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => onGenderChange(item.value)}
                  disabled={disabled}
                  className={`flex-1 px-4 py-2 rounded-lg border transition-all ${
                    isSelected
                      ? 'bg-emerald-500/15 border-emerald-500/50 ring-1 ring-emerald-500/30'
                      : 'bg-zinc-800/50 border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800'
                  } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span className={`text-sm font-medium ${isSelected ? 'text-emerald-400' : 'text-zinc-300'}`}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-medium text-zinc-300">
            Style
          </label>
          <select
            value={style}
            onChange={(e) => onStyleChange(e.target.value as SubjectStyle)}
            disabled={disabled}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-2 text-sm text-zinc-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {SUBJECT_STYLES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          {style && (
            <p className="text-xs text-zinc-500">
              {SUBJECT_STYLES.find(s => s.value === style)?.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

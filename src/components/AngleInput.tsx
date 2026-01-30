import { clsx } from '../lib/format';

interface AngleInputProps {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  label?: string;
}

export function AngleInput({ value, placeholder, onChange, disabled, label }: AngleInputProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-300 mb-2">
        {label || 'Angle'} <span className="text-zinc-500 font-normal">(optional)</span>
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        rows={3}
        className={clsx(
          'w-full resize-none rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-sm text-zinc-100',
          'placeholder:text-zinc-600 outline-none transition',
          'focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600',
          disabled && 'opacity-60 cursor-not-allowed'
        )}
      />
      <p className="mt-2 text-xs text-zinc-500">
        Add specific direction for your clip. We generate the full production prompt for you.
      </p>
    </div>
  );
}

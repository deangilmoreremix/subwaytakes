import { ReactNode, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface EnhancementToggleCardProps {
  icon: LucideIcon;
  title: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  disabled?: boolean;
  accentColor?: string;
  children: ReactNode;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const COLOR_MAP: Record<string, { border: string; bg: string; text: string; dot: string }> = {
  amber: { border: 'border-amber-500/30', bg: 'bg-amber-500/5', text: 'text-amber-400', dot: 'bg-amber-500' },
  emerald: { border: 'border-emerald-500/30', bg: 'bg-emerald-500/5', text: 'text-emerald-400', dot: 'bg-emerald-500' },
  red: { border: 'border-red-500/30', bg: 'bg-red-500/5', text: 'text-red-400', dot: 'bg-red-500' },
  sky: { border: 'border-sky-500/30', bg: 'bg-sky-500/5', text: 'text-sky-400', dot: 'bg-sky-500' },
};

export function EnhancementToggleCard({
  icon: Icon,
  title,
  enabled,
  onToggle,
  disabled,
  accentColor = 'amber',
  children,
  isOpen,
  onOpenChange,
}: EnhancementToggleCardProps) {
  const colors = COLOR_MAP[accentColor] || COLOR_MAP.amber;

  return (
    <div className={`rounded-xl border transition-colors ${enabled ? colors.border : 'border-zinc-800'} ${enabled ? colors.bg : 'bg-zinc-900/30'}`}>
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={() => {
            if (!enabled) {
              onToggle(true);
              onOpenChange(true);
            } else {
              onOpenChange(!isOpen);
            }
          }}
          disabled={disabled}
          className="flex items-center gap-2.5 flex-1 min-w-0 text-left disabled:opacity-50"
        >
          <Icon className={`w-4 h-4 flex-shrink-0 ${enabled ? colors.text : 'text-zinc-600'}`} />
          <span className={`text-sm font-medium ${enabled ? 'text-zinc-200' : 'text-zinc-500'}`}>
            {title}
          </span>
          {enabled && (
            isOpen ? <ChevronUp className="w-3.5 h-3.5 text-zinc-500" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            onToggle(!enabled);
            if (!enabled) onOpenChange(true);
            if (enabled) onOpenChange(false);
          }}
          disabled={disabled}
          className={`relative h-5 w-9 rounded-full transition-colors flex-shrink-0 ${enabled ? 'bg-amber-500' : 'bg-zinc-700'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${enabled ? 'translate-x-4' : 'translate-x-0'}`} />
        </button>
      </div>

      {enabled && isOpen && (
        <div className="px-4 pb-4 pt-1 border-t border-zinc-800/50">
          {children}
        </div>
      )}
    </div>
  );
}

export function useAccordion() {
  const [openId, setOpenId] = useState<string | null>(null);
  return {
    isOpen: (id: string) => openId === id,
    onOpenChange: (id: string) => (open: boolean) => setOpenId(open ? id : null),
  };
}

import { X, Zap, SlidersHorizontal } from 'lucide-react';

interface DefaultSummaryItem {
  label: string;
  value: string;
}

interface QuickGenerateModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onCustomize: () => void;
  defaults: DefaultSummaryItem[];
}

export function QuickGenerateModal({ open, onClose, onConfirm, onCustomize, defaults }: QuickGenerateModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl">
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <h3 className="text-lg font-semibold text-zinc-100">Quick Generate</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 pb-4">
          <p className="text-sm text-zinc-400 mb-4">
            Generate a clip with these default settings:
          </p>

          <div className="rounded-xl border border-zinc-800 bg-zinc-800/30 divide-y divide-zinc-800">
            {defaults.map((item, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-zinc-500">{item.label}</span>
                <span className="text-sm font-medium text-zinc-200">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 px-6 pb-6 pt-2">
          <button
            type="button"
            onClick={onCustomize}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-zinc-300 rounded-xl border border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800 transition-all"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Customize
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-black bg-amber-500 hover:bg-amber-400 rounded-xl transition-colors"
          >
            <Zap className="w-4 h-4" />
            Generate
          </button>
        </div>
      </div>
    </div>
  );
}

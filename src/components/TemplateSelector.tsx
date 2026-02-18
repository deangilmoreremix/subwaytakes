import { useState, useEffect } from 'react';
import { Palette, Check } from 'lucide-react';
import { clsx } from '../lib/format';
import type { VideoTemplate } from '../lib/templates';
import { fetchTemplates } from '../lib/templates';
import { TemplatePreviewCard } from './TemplatePreviewCard';

interface TemplateSelectorProps {
  selectedId: string | null;
  onSelect: (templateId: string | null) => void;
}

export function TemplateSelector({ selectedId, onSelect }: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<VideoTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    async function load() {
      const data = await fetchTemplates();
      setTemplates(data);
      setLoading(false);
      if (!selectedId && data.length > 0) {
        const defaultTpl = data.find((t) => t.is_default);
        if (defaultTpl) onSelect(defaultTpl.id);
      }
    }
    load();
  }, []);

  const selected = templates.find((t) => t.id === selectedId);

  if (loading) {
    return (
      <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
        <div className="flex items-center gap-2 text-zinc-500 text-sm">
          <Palette className="w-4 h-4" />
          Loading templates...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl hover:border-zinc-600 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Palette className="w-5 h-5 text-amber-400" />
          <div className="text-left">
            <div className="text-sm font-medium text-white">
              {selected ? selected.name : 'No Template'}
            </div>
            <div className="text-xs text-zinc-500">
              Visual overlay template for branding
            </div>
          </div>
        </div>
        <span className="text-xs text-zinc-500">
          {expanded ? 'Close' : 'Change'}
        </span>
      </button>

      {expanded && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <button
            onClick={() => {
              onSelect(null);
              setExpanded(false);
            }}
            className={clsx(
              'rounded-xl border overflow-hidden transition-all',
              !selectedId
                ? 'border-amber-500 ring-1 ring-amber-500/30'
                : 'border-zinc-800 hover:border-zinc-600'
            )}
          >
            <div className="h-28 bg-zinc-900 flex items-center justify-center">
              <span className="text-xs text-zinc-500">No overlay</span>
            </div>
            <div className="p-2 text-xs text-zinc-400 text-center">None</div>
          </button>

          {templates.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => {
                onSelect(tpl.id);
                setExpanded(false);
              }}
              className={clsx(
                'rounded-xl border overflow-hidden transition-all relative',
                selectedId === tpl.id
                  ? 'border-amber-500 ring-1 ring-amber-500/30'
                  : 'border-zinc-800 hover:border-zinc-600'
              )}
            >
              <TemplatePreviewCard template={tpl} compact />
              <div className="p-2 text-xs text-zinc-400 text-center truncate">
                {tpl.name}
              </div>
              {selectedId === tpl.id && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
                  <Check className="w-3 h-3 text-black" />
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

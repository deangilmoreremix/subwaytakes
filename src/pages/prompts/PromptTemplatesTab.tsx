import { useState } from 'react';
import {
  FileText,
  ChevronDown,
  ChevronUp,
  Save,
  Loader2,
  ToggleLeft,
  ToggleRight,
  EyeOff,
} from 'lucide-react';
import { clsx, prettyType, formatDate } from '../../lib/format';
import type { PromptTemplate } from '../../lib/promptAdmin';
import { updatePromptTemplate, VIDEO_TYPE_LABELS, VIDEO_TYPE_COLORS } from '../../lib/promptAdmin';

interface Props {
  templates: PromptTemplate[];
  onRefresh: () => void;
}

export function PromptTemplatesTab({ templates, onRefresh }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBasePrompt, setEditBasePrompt] = useState('');
  const [editNegativePrompt, setEditNegativePrompt] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function handleExpand(template: PromptTemplate) {
    if (expandedId === template.id) {
      setExpandedId(null);
      setEditingId(null);
    } else {
      setExpandedId(template.id);
      setEditingId(null);
    }
  }

  function handleEdit(template: PromptTemplate) {
    setEditingId(template.id);
    setEditBasePrompt(template.base_prompt);
    setEditNegativePrompt(template.negative_prompt);
  }

  async function handleSave(id: string) {
    setSaving(true);
    setError('');
    try {
      await updatePromptTemplate(id, {
        base_prompt: editBasePrompt,
        negative_prompt: editNegativePrompt,
      });
      setEditingId(null);
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(template: PromptTemplate) {
    try {
      await updatePromptTemplate(template.id, { is_active: !template.is_active });
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle');
    }
  }

  const COLOR_CLASS_MAP: Record<string, { badge: string; ring: string }> = {
    amber: { badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30', ring: 'border-amber-500/30' },
    emerald: { badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', ring: 'border-emerald-500/30' },
    red: { badge: 'bg-red-500/15 text-red-400 border-red-500/30', ring: 'border-red-500/30' },
    sky: { badge: 'bg-sky-500/15 text-sky-400 border-sky-500/30', ring: 'border-sky-500/30' },
    rose: { badge: 'bg-rose-500/15 text-rose-400 border-rose-500/30', ring: 'border-rose-500/30' },
    cyan: { badge: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30', ring: 'border-cyan-500/30' },
    zinc: { badge: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30', ring: 'border-zinc-500/30' },
  };

  function getColorClasses(videoType: string) {
    const color = VIDEO_TYPE_COLORS[videoType] || 'zinc';
    return COLOR_CLASS_MAP[color] || COLOR_CLASS_MAP.zinc;
  }

  if (templates.length === 0) {
    return (
      <div className="text-center py-16">
        <FileText className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
        <p className="text-zinc-400">No prompt templates found</p>
        <p className="text-sm text-zinc-600 mt-1">Templates will appear after seeding the database</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
          {error}
        </div>
      )}

      {templates.map((template) => {
        const isExpanded = expandedId === template.id;
        const isEditing = editingId === template.id;
        const colors = getColorClasses(template.video_type);

        return (
          <div
            key={template.id}
            className={clsx(
              'rounded-xl border bg-zinc-900/50 transition-all',
              isExpanded ? 'border-zinc-700' : 'border-zinc-800'
            )}
          >
            <button
              onClick={() => handleExpand(template)}
              className="w-full flex items-center justify-between px-5 py-4 text-left"
            >
              <div className="flex items-center gap-3">
                <span className={clsx(
                  'px-2.5 py-1 rounded-lg text-xs font-semibold border',
                  colors.badge
                )}>
                  {VIDEO_TYPE_LABELS[template.video_type] || prettyType(template.video_type)}
                </span>
                <span className="text-sm text-zinc-300">v{template.version}</span>
                {!template.is_active && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-700/50 text-zinc-500">
                    <EyeOff className="w-3 h-3" />
                    Inactive
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-zinc-600">{formatDate(template.updated_at)}</span>
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-zinc-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-zinc-500" />
                )}
              </div>
            </button>

            {isExpanded && (
              <div className="px-5 pb-5 space-y-4 border-t border-zinc-800 pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleToggleActive(template)}
                      className="flex items-center gap-2 text-xs text-zinc-400 hover:text-zinc-200 transition"
                    >
                      {template.is_active ? (
                        <><ToggleRight className="w-5 h-5 text-emerald-400" /> Active</>
                      ) : (
                        <><ToggleLeft className="w-5 h-5 text-zinc-600" /> Inactive</>
                      )}
                    </button>
                  </div>
                  {!isEditing && (
                    <button
                      onClick={() => handleEdit(template)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition"
                    >
                      Edit
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">Base Prompt</label>
                  {isEditing ? (
                    <textarea
                      value={editBasePrompt}
                      onChange={(e) => setEditBasePrompt(e.target.value)}
                      rows={12}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-sm text-zinc-200 font-mono leading-relaxed focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50 resize-y"
                    />
                  ) : (
                    <pre className="rounded-xl bg-zinc-800/40 border border-zinc-800 px-4 py-3 text-xs text-zinc-300 font-mono leading-relaxed overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap">
                      {template.base_prompt}
                    </pre>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">Negative Prompt</label>
                  {isEditing ? (
                    <textarea
                      value={editNegativePrompt}
                      onChange={(e) => setEditNegativePrompt(e.target.value)}
                      rows={4}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-sm text-zinc-200 font-mono leading-relaxed focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50 resize-y"
                    />
                  ) : (
                    <pre className="rounded-xl bg-zinc-800/40 border border-zinc-800 px-4 py-3 text-xs text-zinc-300 font-mono leading-relaxed overflow-x-auto max-h-32 overflow-y-auto whitespace-pre-wrap">
                      {template.negative_prompt}
                    </pre>
                  )}
                </div>

                {isEditing && (
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-xs px-4 py-2 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleSave(template.id)}
                      disabled={saving}
                      className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg bg-amber-500 text-black font-semibold hover:bg-amber-400 disabled:opacity-50 transition"
                    >
                      {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                      Save
                    </button>
                  </div>
                )}

                {template.metadata && Object.keys(template.metadata).length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 mb-1.5">Metadata</label>
                    <pre className="rounded-xl bg-zinc-800/40 border border-zinc-800 px-4 py-3 text-xs text-zinc-400 font-mono overflow-x-auto max-h-32 overflow-y-auto">
                      {JSON.stringify(template.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

import { useState } from 'react';
import {
  Brain,
  ChevronDown,
  ChevronUp,
  Save,
  Loader2,
  ToggleLeft,
  ToggleRight,
  EyeOff,
} from 'lucide-react';
import { clsx, prettyType, formatDate } from '../../lib/format';
import type { SystemPrompt } from '../../lib/promptAdmin';
import { updateSystemPrompt, VIDEO_TYPE_LABELS, VIDEO_TYPE_COLORS } from '../../lib/promptAdmin';

interface Props {
  prompts: SystemPrompt[];
  onRefresh: () => void;
}

export function SystemPromptsTab({ prompts, onRefresh }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSystemPrompt, setEditSystemPrompt] = useState('');
  const [editUserTemplate, setEditUserTemplate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function handleExpand(prompt: SystemPrompt) {
    if (expandedId === prompt.id) {
      setExpandedId(null);
      setEditingId(null);
    } else {
      setExpandedId(prompt.id);
      setEditingId(null);
    }
  }

  function handleEdit(prompt: SystemPrompt) {
    setEditingId(prompt.id);
    setEditSystemPrompt(prompt.system_prompt);
    setEditUserTemplate(prompt.user_prompt_template);
  }

  async function handleSave(id: string) {
    setSaving(true);
    setError('');
    try {
      await updateSystemPrompt(id, {
        system_prompt: editSystemPrompt,
        user_prompt_template: editUserTemplate,
      });
      setEditingId(null);
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(prompt: SystemPrompt) {
    try {
      await updateSystemPrompt(prompt.id, { is_active: !prompt.is_active });
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle');
    }
  }

  function getColorClasses(videoType: string) {
    const color = VIDEO_TYPE_COLORS[videoType] || 'zinc';
    return `bg-${color}-500/15 text-${color}-400 border-${color}-500/30`;
  }

  if (prompts.length === 0) {
    return (
      <div className="text-center py-16">
        <Brain className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
        <p className="text-zinc-400">No system prompts found</p>
        <p className="text-sm text-zinc-600 mt-1">System prompts control AI script generation behavior</p>
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

      {prompts.map((prompt) => {
        const isExpanded = expandedId === prompt.id;
        const isEditing = editingId === prompt.id;
        const meta = prompt.metadata as Record<string, unknown> | null;
        const model = (meta?.model as string) || 'gpt-4o-mini';

        return (
          <div
            key={prompt.id}
            className={clsx(
              'rounded-xl border bg-zinc-900/50 transition-all',
              isExpanded ? 'border-zinc-700' : 'border-zinc-800'
            )}
          >
            <button
              onClick={() => handleExpand(prompt)}
              className="w-full flex items-center justify-between px-5 py-4 text-left"
            >
              <div className="flex items-center gap-3">
                <Brain className="w-4 h-4 text-zinc-500" />
                <span className={clsx(
                  'px-2.5 py-1 rounded-lg text-xs font-semibold border',
                  getColorClasses(prompt.video_type)
                )}>
                  {VIDEO_TYPE_LABELS[prompt.video_type] || prettyType(prompt.video_type)}
                </span>
                <span className="text-sm text-zinc-300">v{prompt.version}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-500 font-mono">{model}</span>
                {!prompt.is_active && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-700/50 text-zinc-500">
                    <EyeOff className="w-3 h-3" />
                    Inactive
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-zinc-600">{formatDate(prompt.updated_at)}</span>
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
                      onClick={() => handleToggleActive(prompt)}
                      className="flex items-center gap-2 text-xs text-zinc-400 hover:text-zinc-200 transition"
                    >
                      {prompt.is_active ? (
                        <><ToggleRight className="w-5 h-5 text-emerald-400" /> Active</>
                      ) : (
                        <><ToggleLeft className="w-5 h-5 text-zinc-600" /> Inactive</>
                      )}
                    </button>
                    {meta && (
                      <div className="flex gap-2">
                        {meta.temperature !== undefined && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500">
                            temp: {String(meta.temperature)}
                          </span>
                        )}
                        {meta.max_tokens !== undefined && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500">
                            max: {String(meta.max_tokens)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  {!isEditing && (
                    <button
                      onClick={() => handleEdit(prompt)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition"
                    >
                      Edit
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">System Prompt</label>
                  {isEditing ? (
                    <textarea
                      value={editSystemPrompt}
                      onChange={(e) => setEditSystemPrompt(e.target.value)}
                      rows={14}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-sm text-zinc-200 font-mono leading-relaxed focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50 resize-y"
                    />
                  ) : (
                    <pre className="rounded-xl bg-zinc-800/40 border border-zinc-800 px-4 py-3 text-xs text-zinc-300 font-mono leading-relaxed overflow-x-auto max-h-72 overflow-y-auto whitespace-pre-wrap">
                      {prompt.system_prompt}
                    </pre>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">User Prompt Template</label>
                  {isEditing ? (
                    <textarea
                      value={editUserTemplate}
                      onChange={(e) => setEditUserTemplate(e.target.value)}
                      rows={6}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-sm text-zinc-200 font-mono leading-relaxed focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50 resize-y"
                    />
                  ) : (
                    <pre className="rounded-xl bg-zinc-800/40 border border-zinc-800 px-4 py-3 text-xs text-zinc-300 font-mono leading-relaxed overflow-x-auto max-h-40 overflow-y-auto whitespace-pre-wrap">
                      {prompt.user_prompt_template}
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
                      onClick={() => handleSave(prompt.id)}
                      disabled={saving}
                      className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg bg-amber-500 text-black font-semibold hover:bg-amber-400 disabled:opacity-50 transition"
                    >
                      {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                      Save
                    </button>
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

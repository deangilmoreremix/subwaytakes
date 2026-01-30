import { useState } from 'react';
import { Sparkles, Loader2, Save, FolderOpen, Star, Trash2, X } from 'lucide-react';
import {
  regenerateScriptField,
  saveAsTemplate,
  listTemplates,
  deleteTemplate,
  toggleTemplateFavorite,
  type ScriptFieldKey,
  type SavedTemplate,
} from '../lib/scriptEngine';
import type { EpisodeScript } from '../lib/types';

interface ScriptEditorProps {
  script: EpisodeScript;
  topic: string;
  onChange: (script: EpisodeScript) => void;
  onRegenerateAll?: () => void;
  isRegeneratingAll?: boolean;
}

interface FieldConfig {
  key: ScriptFieldKey;
  label: string;
  speaker: 'HOST' | 'GUEST';
}

const FIELD_CONFIGS: FieldConfig[] = [
  { key: 'hook_question', label: 'Hook Question', speaker: 'HOST' },
  { key: 'guest_answer', label: 'Guest Answer', speaker: 'GUEST' },
  { key: 'follow_up_question', label: 'Follow-Up Question', speaker: 'HOST' },
  { key: 'follow_up_answer', label: 'Follow-Up Answer', speaker: 'GUEST' },
  { key: 'reaction_line', label: 'Host Reaction', speaker: 'HOST' },
  { key: 'close_punchline', label: 'Close / Punchline', speaker: 'HOST' },
];

export function ScriptEditor({
  script,
  topic,
  onChange,
  onRegenerateAll,
  isRegeneratingAll,
}: ScriptEditorProps) {
  const [regeneratingField, setRegeneratingField] = useState<ScriptFieldKey | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateTone, setTemplateTone] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRegenerateField(field: ScriptFieldKey) {
    setRegeneratingField(field);
    setError(null);
    try {
      const newValue = await regenerateScriptField(topic, field, script);
      onChange({ ...script, [field]: newValue });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate');
    } finally {
      setRegeneratingField(null);
    }
  }

  async function handleSaveTemplate() {
    if (!templateName.trim()) return;

    setIsSaving(true);
    setError(null);
    try {
      await saveAsTemplate(script, templateName, templateTone || undefined);
      setShowSaveModal(false);
      setTemplateName('');
      setTemplateTone('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleOpenLoadModal() {
    setShowLoadModal(true);
    setIsLoadingTemplates(true);
    try {
      const data = await listTemplates();
      setTemplates(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setIsLoadingTemplates(false);
    }
  }

  function handleLoadTemplate(template: SavedTemplate) {
    onChange({
      ...script,
      hook_question: template.hook_question,
      guest_answer: template.guest_answer,
      follow_up_question: template.follow_up_question,
      follow_up_answer: template.follow_up_answer,
      reaction_line: template.reaction_line,
      close_punchline: template.close_punchline,
    });
    setShowLoadModal(false);
  }

  async function handleDeleteTemplate(id: string) {
    try {
      await deleteTemplate(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete template');
    }
  }

  async function handleToggleFavorite(id: string, currentValue: boolean) {
    try {
      await toggleTemplateFavorite(id, !currentValue);
      setTemplates((prev) =>
        prev.map((t) => (t.id === id ? { ...t, is_favorite: !currentValue } : t))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update template');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSaveModal(true)}
            className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-300 transition hover:border-zinc-600 hover:text-zinc-100"
          >
            <Save className="h-4 w-4" />
            Save Template
          </button>
          <button
            onClick={handleOpenLoadModal}
            className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-300 transition hover:border-zinc-600 hover:text-zinc-100"
          >
            <FolderOpen className="h-4 w-4" />
            Load Template
          </button>
        </div>
        {onRegenerateAll && (
          <button
            onClick={onRegenerateAll}
            disabled={isRegeneratingAll}
            className="flex items-center gap-2 rounded-lg border border-zinc-600 px-3 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100 disabled:opacity-50"
          >
            {isRegeneratingAll ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Regenerate All
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400 flex items-center justify-between">
          {error}
          <button onClick={() => setError(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="space-y-4">
        {FIELD_CONFIGS.map((field) => (
          <ScriptFieldEditor
            key={field.key}
            label={field.label}
            speaker={field.speaker}
            value={script[field.key]}
            onChange={(value) => onChange({ ...script, [field.key]: value })}
            onRegenerate={() => handleRegenerateField(field.key)}
            isRegenerating={regeneratingField === field.key}
          />
        ))}
      </div>

      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-zinc-100">Save as Template</h3>
              <button
                onClick={() => setShowSaveModal(false)}
                className="text-zinc-400 hover:text-zinc-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">
                  Template Name
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g., Viral Money Question"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">
                  Tone (optional)
                </label>
                <select
                  value={templateTone}
                  onChange={(e) => setTemplateTone(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2.5 text-sm text-zinc-100 focus:border-amber-500/50 focus:outline-none"
                >
                  <option value="">Select tone...</option>
                  <option value="funny">Funny</option>
                  <option value="controversial">Controversial</option>
                  <option value="wholesome">Wholesome</option>
                  <option value="thought-provoking">Thought-provoking</option>
                  <option value="edgy">Edgy</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowSaveModal(false)}
                  className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveTemplate}
                  disabled={!templateName.trim() || isSaving}
                  className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-amber-400 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showLoadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-700 bg-zinc-900 p-6 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-zinc-100">Load Template</h3>
              <button
                onClick={() => setShowLoadModal(false)}
                className="text-zinc-400 hover:text-zinc-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {isLoadingTemplates ? (
                <div className="flex items-center justify-center py-8 text-zinc-500">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Loading templates...
                </div>
              ) : templates.length === 0 ? (
                <div className="text-center py-8 text-zinc-500">
                  No saved templates yet. Save your first template to reuse it later.
                </div>
              ) : (
                <div className="space-y-2">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className="rounded-xl border border-zinc-700 bg-zinc-800/30 p-4 hover:border-zinc-600 transition"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-zinc-100">
                              {template.template_name}
                            </span>
                            {template.is_favorite && (
                              <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs px-2 py-0.5 rounded bg-zinc-700 text-zinc-400">
                              {template.topic}
                            </span>
                            {template.tone && (
                              <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">
                                {template.tone}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleToggleFavorite(template.id, template.is_favorite)}
                            className={`p-1.5 rounded transition ${
                              template.is_favorite
                                ? 'text-amber-400 hover:text-amber-300'
                                : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                          >
                            <Star className={`h-4 w-4 ${template.is_favorite ? 'fill-current' : ''}`} />
                          </button>
                          <button
                            onClick={() => handleDeleteTemplate(template.id)}
                            className="p-1.5 rounded text-zinc-500 hover:text-red-400 transition"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <p className="text-sm text-zinc-400 line-clamp-2 mb-3">
                        {template.hook_question}
                      </p>

                      <button
                        onClick={() => handleLoadTemplate(template)}
                        className="w-full rounded-lg bg-zinc-700/50 px-3 py-2 text-sm text-zinc-200 transition hover:bg-zinc-700"
                      >
                        Use This Template
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ScriptFieldEditor({
  label,
  speaker,
  value,
  onChange,
  onRegenerate,
  isRegenerating,
}: {
  label: string;
  speaker: 'HOST' | 'GUEST';
  value: string;
  onChange: (value: string) => void;
  onRegenerate: () => void;
  isRegenerating: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            {label}
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded ${
              speaker === 'HOST'
                ? 'bg-blue-500/20 text-blue-400'
                : 'bg-emerald-500/20 text-emerald-400'
            }`}
          >
            {speaker}
          </span>
        </div>
        <button
          onClick={onRegenerate}
          disabled={isRegenerating}
          className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition disabled:opacity-50"
        >
          {isRegenerating ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Sparkles className="h-3 w-3" />
          )}
          Regenerate
        </button>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50 resize-none"
      />
    </div>
  );
}

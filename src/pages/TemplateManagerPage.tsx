import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Copy,
  Trash2,
  Palette,
  Type,
  Layout,
  Film,
  Shield,
} from 'lucide-react';
import { clsx } from '../lib/format';
import type { VideoTemplate } from '../lib/templates';
import { fetchTemplates, deleteTemplate, duplicateTemplate } from '../lib/templates';
import { TemplateEditor } from '../components/TemplateEditor';
import { TemplatePreviewCard } from '../components/TemplatePreviewCard';

export function TemplateManagerPage() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<VideoTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<VideoTemplate | null>(null);
  const [creating, setCreating] = useState(false);

  const [actionBusy, setActionBusy] = useState(false);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchTemplates();
      setTemplates(data);
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  async function handleDelete(id: string) {
    const confirmed = window.confirm('Delete this template?');
    if (!confirmed) return;
    setActionBusy(true);
    try {
      const success = await deleteTemplate(id);
      if (success) {
        setTemplates(prev => prev.filter((t) => t.id !== id));
      }
    } catch {
      // silent - deleteTemplate handles its own error
    } finally {
      setActionBusy(false);
    }
  }

  async function handleDuplicate(template: VideoTemplate) {
    setActionBusy(true);
    try {
      const result = await duplicateTemplate(
        template.id,
        `${template.name} (Copy)`,
        template.user_id
      );
      if (result) {
        setTemplates(prev => [result, ...prev]);
      }
    } catch {
      // silent - duplicateTemplate handles its own error
    } finally {
      setActionBusy(false);
    }
  }

  function handleSaved() {
    setEditingTemplate(null);
    setCreating(false);
    loadTemplates();
  }

  if (editingTemplate || creating) {
    return (
      <TemplateEditor
        template={editingTemplate}
        onBack={() => {
          setEditingTemplate(null);
          setCreating(false);
        }}
        onSaved={handleSaved}
      />
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/create')}
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Palette className="w-6 h-6 text-amber-400" />
              Video Templates
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              Manage visual overlay templates for your subway interview videos
            </p>
          </div>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 text-black font-medium hover:bg-amber-400 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Template
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-20">
          <Film className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-zinc-400">No templates yet</h3>
          <p className="text-sm text-zinc-600 mt-1">
            Create your first video template to get started
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => (
            <div
              key={template.id}
              className="group relative bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden hover:border-zinc-600 transition-all"
            >
              <TemplatePreviewCard template={template} />

              <div className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-base font-semibold text-white truncate">
                    {template.name}
                  </h3>
                  {template.is_system && (
                    <Shield className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  )}
                  {template.is_default && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
                      Default
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 text-xs text-zinc-500 mb-4">
                  <span className="flex items-center gap-1">
                    <Layout className="w-3 h-3" />
                    {template.resolution_width}x{template.resolution_height}
                  </span>
                  <span className="flex items-center gap-1">
                    <Type className="w-3 h-3" />
                    {template.caption_font}
                  </span>
                  <span>{template.fps}fps</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditingTemplate(template)}
                    className={clsx(
                      "flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      template.is_system
                        ? "bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700"
                        : "bg-zinc-800 text-white hover:bg-zinc-700"
                    )}
                  >
                    {template.is_system ? 'View' : 'Edit'}
                  </button>
                  <button
                    onClick={() => handleDuplicate(template)}
                    disabled={actionBusy}
                    className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:pointer-events-none"
                    title="Duplicate"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  {!template.is_system && (
                    <button
                      onClick={() => handleDelete(template.id)}
                      disabled={actionBusy}
                      className="p-2 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:pointer-events-none"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

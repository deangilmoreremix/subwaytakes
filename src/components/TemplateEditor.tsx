import { useState } from 'react';
import {
  ArrowLeft,
  Save,
  Eye,
  Type,
  Crosshair,
  Thermometer,
  BarChart3,
} from 'lucide-react';
import { clsx } from '../lib/format';
import type { VideoTemplate } from '../lib/templates';
import { createTemplate, updateTemplate } from '../lib/templates';
import { TemplatePreviewCard } from './TemplatePreviewCard';

interface TemplateEditorProps {
  template: VideoTemplate | null;
  onBack: () => void;
  onSaved: () => void;
}

const POSITIONS = [
  'top-left', 'top-center', 'top-right',
  'bottom-left', 'bottom-center', 'bottom-right',
] as const;

const CAPTION_POSITIONS = ['top', 'center', 'bottom'] as const;

const COLOR_TEMPS = [
  { value: 'warm', label: 'Warm' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'cool', label: 'Cool' },
] as const;

export function TemplateEditor({ template, onBack, onSaved }: TemplateEditorProps) {
  const isNew = !template;
  const isReadOnly = template?.is_system || false;

  const [form, setForm] = useState({
    name: template?.name || 'New Template',
    template_type: template?.template_type || 'custom' as const,
    format: template?.format || 'vertical' as const,
    resolution_width: template?.resolution_width || 1080,
    resolution_height: template?.resolution_height || 1920,
    fps: template?.fps || 30,
    watermark_text: template?.watermark_text || '@subwaytakes',
    watermark_position: template?.watermark_position || 'top-left',
    watermark_font_size: template?.watermark_font_size || 18,
    watermark_color: template?.watermark_color || '#FFFFFF',
    watermark_opacity: template?.watermark_opacity || 0.85,
    logo_enabled: template?.logo_enabled ?? true,
    logo_position: template?.logo_position || 'top-left',
    episode_prefix_format: template?.episode_prefix_format || 'Episode {number}:',
    caption_font: template?.caption_font || 'Inter',
    caption_font_size: template?.caption_font_size || 40,
    caption_color: template?.caption_color || '#FFFFFF',
    caption_bg_opacity: template?.caption_bg_opacity || 0.6,
    caption_position: template?.caption_position || 'bottom',
    reaction_text_enabled: template?.reaction_text_enabled ?? true,
    reaction_text_position: template?.reaction_text_position || 'bottom-right',
    reaction_text_font_size: template?.reaction_text_font_size || 28,
    color_temperature: template?.color_temperature || 'warm' as const,
    saturation_adjust: template?.saturation_adjust || 0,
    contrast_adjust: template?.contrast_adjust || 0.05,
    vignette_enabled: template?.vignette_enabled || false,
    progress_bar_enabled: template?.progress_bar_enabled ?? true,
    progress_bar_color: template?.progress_bar_color || '#F59E0B',
    is_default: template?.is_default || false,
  });

  const [saving, setSaving] = useState(false);

  const previewTemplate: VideoTemplate = {
    id: template?.id || '',
    user_id: template?.user_id || 'preview',
    is_system: false,
    created_at: '',
    updated_at: '',
    ...form,
  } as VideoTemplate;

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (isReadOnly) return;
    setSaving(true);

    if (isNew) {
      const result = await createTemplate({
        ...form,
        user_id: 'anonymous',
        is_default: false,
      });
      if (result) onSaved();
    } else if (template) {
      const result = await updateTemplate(template.id, form);
      if (result) onSaved();
    }

    setSaving(false);
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-white">
            {isNew ? 'Create Template' : isReadOnly ? 'View Template' : 'Edit Template'}
          </h1>
        </div>
        {!isReadOnly && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 text-black font-medium hover:bg-amber-400 disabled:opacity-50 transition-colors"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Template'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Section title="General" icon={<Eye className="w-4 h-4" />}>
            <Field label="Template Name">
              <input
                type="text"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                disabled={isReadOnly}
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-amber-500"
              />
            </Field>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Width">
                <input
                  type="number"
                  value={form.resolution_width}
                  onChange={(e) => update('resolution_width', Number(e.target.value))}
                  disabled={isReadOnly}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-amber-500"
                />
              </Field>
              <Field label="Height">
                <input
                  type="number"
                  value={form.resolution_height}
                  onChange={(e) => update('resolution_height', Number(e.target.value))}
                  disabled={isReadOnly}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-amber-500"
                />
              </Field>
              <Field label="FPS">
                <input
                  type="number"
                  value={form.fps}
                  onChange={(e) => update('fps', Number(e.target.value))}
                  disabled={isReadOnly}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-amber-500"
                />
              </Field>
            </div>
          </Section>

          <Section title="Watermark" icon={<Type className="w-4 h-4" />}>
            <Field label="Handle Text">
              <input
                type="text"
                value={form.watermark_text}
                onChange={(e) => update('watermark_text', e.target.value)}
                disabled={isReadOnly}
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-amber-500"
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Position">
                <select
                  value={form.watermark_position}
                  onChange={(e) => update('watermark_position', e.target.value)}
                  disabled={isReadOnly}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-amber-500"
                >
                  {POSITIONS.map((p) => (
                    <option key={p} value={p}>{p.replace('-', ' ')}</option>
                  ))}
                </select>
              </Field>
              <Field label="Font Size">
                <input
                  type="range"
                  min={12}
                  max={32}
                  value={form.watermark_font_size}
                  onChange={(e) => update('watermark_font_size', Number(e.target.value))}
                  disabled={isReadOnly}
                  className="w-full"
                />
                <span className="text-xs text-zinc-500">{form.watermark_font_size}px</span>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Color">
                <input
                  type="color"
                  value={form.watermark_color}
                  onChange={(e) => update('watermark_color', e.target.value)}
                  disabled={isReadOnly}
                  className="w-full h-9 rounded-lg bg-zinc-800 border border-zinc-700 cursor-pointer"
                />
              </Field>
              <Field label="Opacity">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={form.watermark_opacity}
                  onChange={(e) => update('watermark_opacity', Number(e.target.value))}
                  disabled={isReadOnly}
                  className="w-full"
                />
                <span className="text-xs text-zinc-500">{Math.round(form.watermark_opacity * 100)}%</span>
              </Field>
            </div>
            <Field label="Show Logo Icon">
              <ToggleSwitch
                enabled={form.logo_enabled}
                onChange={(v) => update('logo_enabled', v)}
                disabled={isReadOnly}
              />
            </Field>
          </Section>

          <Section title="Captions" icon={<Crosshair className="w-4 h-4" />}>
            <Field label="Episode Prefix Format">
              <input
                type="text"
                value={form.episode_prefix_format}
                onChange={(e) => update('episode_prefix_format', e.target.value)}
                disabled={isReadOnly}
                placeholder="Episode {number}:"
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-amber-500"
              />
            </Field>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Font">
                <select
                  value={form.caption_font}
                  onChange={(e) => update('caption_font', e.target.value)}
                  disabled={isReadOnly}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-amber-500"
                >
                  <option value="Inter">Inter</option>
                  <option value="Roboto">Roboto</option>
                  <option value="Montserrat">Montserrat</option>
                  <option value="Oswald">Oswald</option>
                </select>
              </Field>
              <Field label="Size">
                <input
                  type="range"
                  min={20}
                  max={60}
                  value={form.caption_font_size}
                  onChange={(e) => update('caption_font_size', Number(e.target.value))}
                  disabled={isReadOnly}
                  className="w-full"
                />
                <span className="text-xs text-zinc-500">{form.caption_font_size}px</span>
              </Field>
              <Field label="Position">
                <select
                  value={form.caption_position}
                  onChange={(e) => update('caption_position', e.target.value)}
                  disabled={isReadOnly}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-amber-500"
                >
                  {CAPTION_POSITIONS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Text Color">
                <input
                  type="color"
                  value={form.caption_color}
                  onChange={(e) => update('caption_color', e.target.value)}
                  disabled={isReadOnly}
                  className="w-full h-9 rounded-lg bg-zinc-800 border border-zinc-700 cursor-pointer"
                />
              </Field>
              <Field label="Background Opacity">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={form.caption_bg_opacity}
                  onChange={(e) => update('caption_bg_opacity', Number(e.target.value))}
                  disabled={isReadOnly}
                  className="w-full"
                />
                <span className="text-xs text-zinc-500">{Math.round(form.caption_bg_opacity * 100)}%</span>
              </Field>
            </div>
            <Field label="Reaction Text">
              <ToggleSwitch
                enabled={form.reaction_text_enabled}
                onChange={(v) => update('reaction_text_enabled', v)}
                disabled={isReadOnly}
              />
            </Field>
            {form.reaction_text_enabled && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Reaction Position">
                  <select
                    value={form.reaction_text_position}
                    onChange={(e) => update('reaction_text_position', e.target.value)}
                    disabled={isReadOnly}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-amber-500"
                  >
                    <option value="bottom-right">Bottom Right</option>
                    <option value="bottom-left">Bottom Left</option>
                    <option value="bottom-center">Bottom Center</option>
                  </select>
                </Field>
                <Field label="Reaction Font Size">
                  <input
                    type="range"
                    min={16}
                    max={48}
                    value={form.reaction_text_font_size}
                    onChange={(e) => update('reaction_text_font_size', Number(e.target.value))}
                    disabled={isReadOnly}
                    className="w-full"
                  />
                  <span className="text-xs text-zinc-500">{form.reaction_text_font_size}px</span>
                </Field>
              </div>
            )}
          </Section>

          <Section title="Color Grade" icon={<Thermometer className="w-4 h-4" />}>
            <Field label="Color Temperature">
              <div className="flex gap-2">
                {COLOR_TEMPS.map((ct) => (
                  <button
                    key={ct.value}
                    onClick={() => update('color_temperature', ct.value as typeof form.color_temperature)}
                    disabled={isReadOnly}
                    className={clsx(
                      'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
                      form.color_temperature === ct.value
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                        : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-600'
                    )}
                  >
                    {ct.label}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Vignette">
              <ToggleSwitch
                enabled={form.vignette_enabled}
                onChange={(v) => update('vignette_enabled', v)}
                disabled={isReadOnly}
              />
            </Field>
          </Section>

          <Section title="Progress Bar" icon={<BarChart3 className="w-4 h-4" />}>
            <Field label="Enabled">
              <ToggleSwitch
                enabled={form.progress_bar_enabled}
                onChange={(v) => update('progress_bar_enabled', v)}
                disabled={isReadOnly}
              />
            </Field>
            {form.progress_bar_enabled && (
              <Field label="Color">
                <input
                  type="color"
                  value={form.progress_bar_color}
                  onChange={(e) => update('progress_bar_color', e.target.value)}
                  disabled={isReadOnly}
                  className="w-full h-9 rounded-lg bg-zinc-800 border border-zinc-700 cursor-pointer"
                />
              </Field>
            )}
          </Section>
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-8">
            <h3 className="text-sm font-medium text-zinc-400 mb-3 flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Live Preview
            </h3>
            <div className="rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900">
              <TemplatePreviewCard template={previewTemplate} />
            </div>
            <p className="text-xs text-zinc-600 mt-3 text-center">
              Preview is a visual approximation of the final overlay
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
      <h2 className="text-sm font-semibold text-zinc-300 flex items-center gap-2 uppercase tracking-wider">
        {icon}
        {title}
      </h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-zinc-500">{label}</label>
      {children}
    </div>
  );
}

function ToggleSwitch({
  enabled,
  onChange,
  disabled,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={() => !disabled && onChange(!enabled)}
      className={clsx(
        'relative w-11 h-6 rounded-full transition-colors',
        enabled ? 'bg-amber-500' : 'bg-zinc-700',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <div
        className={clsx(
          'absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform',
          enabled ? 'translate-x-5.5 left-[1px]' : 'translate-x-0.5 left-[1px]'
        )}
        style={{ transform: `translateX(${enabled ? 22 : 2}px)` }}
      />
    </button>
  );
}

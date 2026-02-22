import { useState, useMemo } from 'react';
import {
  Puzzle,
  Search,
  ChevronDown,
  ChevronUp,
  Save,
  Loader2,
  ToggleLeft,
  ToggleRight,
  Filter,
} from 'lucide-react';
import { clsx, prettyType } from '../../lib/format';
import type { PromptFragment } from '../../lib/promptAdmin';
import { updatePromptFragment, VIDEO_TYPE_LABELS } from '../../lib/promptAdmin';

interface Props {
  fragments: PromptFragment[];
  onRefresh: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  scene: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  camera: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  lighting: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  speaker_style: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  interview_style: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  energy: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  time_of_day: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  city: 'bg-teal-500/15 text-teal-400 border-teal-500/30',
  interviewer_type: 'bg-pink-500/15 text-pink-400 border-pink-500/30',
  subject_demographic: 'bg-lime-500/15 text-lime-400 border-lime-500/30',
  wisdom_tone: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  wisdom_format: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  wisdom_demographic: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
};

export function PromptFragmentsTab({ fragments, onRefresh }: Props) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const categories = useMemo(() => {
    const cats = new Set(fragments.map(f => f.category));
    return ['all', ...Array.from(cats).sort()];
  }, [fragments]);

  const filtered = useMemo(() => {
    return fragments.filter(f => {
      if (categoryFilter !== 'all' && f.category !== categoryFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return f.key.toLowerCase().includes(q) || f.value.toLowerCase().includes(q) || f.category.toLowerCase().includes(q);
      }
      return true;
    });
  }, [fragments, categoryFilter, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, PromptFragment[]>();
    for (const f of filtered) {
      const existing = map.get(f.category) || [];
      existing.push(f);
      map.set(f.category, existing);
    }
    return map;
  }, [filtered]);

  function handleEdit(fragment: PromptFragment) {
    setEditingId(fragment.id);
    setEditValue(fragment.value);
    setExpandedId(fragment.id);
  }

  async function handleSave(id: string) {
    setSaving(true);
    setError('');
    try {
      await updatePromptFragment(id, { value: editValue });
      setEditingId(null);
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(fragment: PromptFragment) {
    try {
      await updatePromptFragment(fragment.id, { is_active: !fragment.is_active });
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle');
    }
  }

  if (fragments.length === 0) {
    return (
      <div className="text-center py-16">
        <Puzzle className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
        <p className="text-zinc-400">No prompt fragments found</p>
        <p className="text-sm text-zinc-600 mt-1">Fragments will appear after seeding the database</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search fragments..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 transition"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <Filter className="w-4 h-4 text-zinc-500 flex-shrink-0" />
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium border whitespace-nowrap transition',
                categoryFilter === cat
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
              )}
            >
              {cat === 'all' ? 'All' : prettyType(cat)}
            </button>
          ))}
        </div>
      </div>

      <div className="text-xs text-zinc-600">{filtered.length} fragments</div>

      <div className="space-y-4">
        {Array.from(grouped.entries()).map(([category, frags]) => (
          <div key={category}>
            <div className="flex items-center gap-2 mb-2">
              <span className={clsx(
                'px-2.5 py-1 rounded-lg text-xs font-semibold border',
                CATEGORY_COLORS[category] || 'bg-zinc-700/50 text-zinc-400 border-zinc-600'
              )}>
                {prettyType(category)}
              </span>
              <span className="text-xs text-zinc-600">{frags.length}</span>
            </div>

            <div className="space-y-1.5">
              {frags.map((fragment) => {
                const isExpanded = expandedId === fragment.id;
                const isEditing = editingId === fragment.id;

                return (
                  <div
                    key={fragment.id}
                    className={clsx(
                      'rounded-lg border bg-zinc-900/50 transition',
                      isExpanded ? 'border-zinc-700' : 'border-zinc-800'
                    )}
                  >
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : fragment.id)}
                      className="w-full flex items-center justify-between px-4 py-3 text-left"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <code className="text-xs font-mono text-amber-400/80 flex-shrink-0">{fragment.key}</code>
                        {!fragment.is_active && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-700/50 text-zinc-500">off</span>
                        )}
                        {!isExpanded && (
                          <span className="text-xs text-zinc-500 truncate">
                            {fragment.value.slice(0, 80)}{fragment.value.length > 80 ? '...' : ''}
                          </span>
                        )}
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-3 border-t border-zinc-800 pt-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => handleToggleActive(fragment)}
                              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition"
                            >
                              {fragment.is_active ? (
                                <><ToggleRight className="w-4 h-4 text-emerald-400" /> Active</>
                              ) : (
                                <><ToggleLeft className="w-4 h-4 text-zinc-600" /> Inactive</>
                              )}
                            </button>
                            {fragment.video_types && fragment.video_types.length > 0 && (
                              <div className="flex gap-1">
                                {fragment.video_types.map(vt => (
                                  <span key={vt} className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500">
                                    {VIDEO_TYPE_LABELS[vt] || vt}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          {!isEditing && (
                            <button
                              onClick={() => handleEdit(fragment)}
                              className="text-xs px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition"
                            >
                              Edit
                            </button>
                          )}
                        </div>

                        {isEditing ? (
                          <div className="space-y-2">
                            <textarea
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              rows={4}
                              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2.5 text-xs text-zinc-200 font-mono leading-relaxed focus:border-amber-500/50 focus:outline-none resize-y"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => setEditingId(null)}
                                className="text-xs px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 transition"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleSave(fragment.id)}
                                disabled={saving}
                                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-amber-500 text-black font-semibold hover:bg-amber-400 disabled:opacity-50 transition"
                              >
                                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <pre className="rounded-lg bg-zinc-800/40 border border-zinc-800 px-3 py-2.5 text-xs text-zinc-300 font-mono leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                            {fragment.value}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

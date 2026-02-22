import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  FileText,
  Puzzle,
  Brain,
  RefreshCw,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { clsx } from '../../lib/format';
import {
  fetchPromptTemplates,
  fetchPromptFragments,
  fetchSystemPrompts,
} from '../../lib/promptAdmin';
import type { PromptTemplate, PromptFragment, SystemPrompt } from '../../lib/promptAdmin';
import { PromptTemplatesTab } from './PromptTemplatesTab';
import { PromptFragmentsTab } from './PromptFragmentsTab';
import { SystemPromptsTab } from './SystemPromptsTab';

type Tab = 'templates' | 'fragments' | 'system';

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'templates', label: 'Templates', icon: FileText },
  { id: 'fragments', label: 'Fragments', icon: Puzzle },
  { id: 'system', label: 'System Prompts', icon: Brain },
];

export function PromptsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('templates');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [fragments, setFragments] = useState<PromptFragment[]>([]);
  const [systemPrompts, setSystemPrompts] = useState<SystemPrompt[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [t, f, s] = await Promise.all([
        fetchPromptTemplates(),
        fetchPromptFragments(),
        fetchSystemPrompts(),
      ]);
      setTemplates(t);
      setFragments(f);
      setSystemPrompts(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load prompt data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">Prompt Manager</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Edit templates, fragments, and system prompts that power video generation
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-sm text-zinc-300 hover:bg-zinc-700 disabled:opacity-50 transition"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Refresh
        </button>
      </div>

      <div className="flex gap-1 mb-6 p-1 rounded-xl bg-zinc-800/50 border border-zinc-800">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const count = tab.id === 'templates' ? templates.length
            : tab.id === 'fragments' ? fragments.length
            : systemPrompts.length;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition',
                activeTab === tab.id
                  ? 'bg-zinc-900 text-white shadow-sm border border-zinc-700'
                  : 'text-zinc-400 hover:text-zinc-200'
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {count > 0 && (
                <span className={clsx(
                  'text-[10px] px-1.5 py-0.5 rounded-full',
                  activeTab === tab.id ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-700 text-zinc-500'
                )}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="flex items-center gap-3 px-5 py-4 rounded-xl bg-red-500/10 border border-red-500/20 mb-6">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <div>
            <p className="text-sm text-red-400">{error}</p>
            <p className="text-xs text-red-400/60 mt-0.5">Check that the database has been seeded with prompt data</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
        </div>
      ) : (
        <>
          {activeTab === 'templates' && (
            <PromptTemplatesTab templates={templates} onRefresh={loadData} />
          )}
          {activeTab === 'fragments' && (
            <PromptFragmentsTab fragments={fragments} onRefresh={loadData} />
          )}
          {activeTab === 'system' && (
            <SystemPromptsTab prompts={systemPrompts} onRefresh={loadData} />
          )}
        </>
      )}
    </div>
  );
}

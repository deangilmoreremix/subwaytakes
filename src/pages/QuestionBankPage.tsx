import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  Flame,
  Edit3,
  Trash2,
  X,
  Check,
  ChevronLeft,
  TrendingUp,
  BarChart3,
} from 'lucide-react';
import {
  listQuestions,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  toggleTrending,
  searchQuestions,
  getQuestionCategories,
  HOOK_TYPES,
  ENERGY_LEVELS,
  type QuestionBankItem,
} from '../lib/questionBank';

export function QuestionBankPage() {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<QuestionBankItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showTrendingOnly, setShowTrendingOnly] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newQuestion, setNewQuestion] = useState({
    question: '',
    category: 'hottakes',
    hook_type: '',
    energy_level: '',
    notes: '',
  });
  const [error, setError] = useState<string | null>(null);

  const categories = getQuestionCategories();

  useEffect(() => {
    loadQuestions();
  }, [selectedCategory, showTrendingOnly]);

  async function loadQuestions() {
    setIsLoading(true);
    try {
      const data = await listQuestions({
        category: selectedCategory || undefined,
        trendingOnly: showTrendingOnly,
        includeCustom: true,
      });
      setQuestions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load questions');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSearch() {
    if (!searchQuery.trim()) {
      loadQuestions();
      return;
    }

    setIsLoading(true);
    try {
      const data = await searchQuestions(searchQuery);
      setQuestions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAddQuestion() {
    if (!newQuestion.question.trim()) return;

    try {
      await createQuestion({
        question: newQuestion.question,
        category: newQuestion.category,
        hook_type: newQuestion.hook_type || undefined,
        energy_level: newQuestion.energy_level || undefined,
        notes: newQuestion.notes || undefined,
      });

      setNewQuestion({
        question: '',
        category: 'hottakes',
        hook_type: '',
        energy_level: '',
        notes: '',
      });
      setShowAddForm(false);
      loadQuestions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add question');
    }
  }

  async function handleUpdateQuestion(id: string) {
    if (!editValue.trim()) return;

    try {
      await updateQuestion(id, { question: editValue });
      setEditingId(null);
      loadQuestions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update question');
    }
  }

  async function handleDeleteQuestion(id: string) {
    try {
      await deleteQuestion(id);
      loadQuestions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete question');
    }
  }

  async function handleToggleTrending(id: string, currentValue: boolean) {
    try {
      await toggleTrending(id, !currentValue);
      loadQuestions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update trending status');
    }
  }

  function startEdit(question: QuestionBankItem) {
    setEditingId(question.id);
    setEditValue(question.question);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditValue('');
  }

  const trendingCount = questions.filter((q) => q.is_trending).length;
  const customCount = questions.filter((q) => q.is_custom).length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8">
        <button
          onClick={() => navigate('/create')}
          className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition mb-4"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <Flame className="h-6 w-6 text-amber-500" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
                Question Bank
              </h1>
              <p className="text-sm text-zinc-400">
                Manage your interview questions
              </p>
            </div>
          </div>

          {(
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-amber-400"
            >
              <Plus className="h-4 w-4" />
              Add Question
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border border-zinc-700 bg-zinc-800/30 p-4 text-center">
          <div className="text-2xl font-semibold text-zinc-100">{questions.length}</div>
          <div className="text-xs text-zinc-500">Total Questions</div>
        </div>
        <div className="rounded-xl border border-zinc-700 bg-zinc-800/30 p-4 text-center">
          <div className="text-2xl font-semibold text-amber-400">{trendingCount}</div>
          <div className="text-xs text-zinc-500">Trending</div>
        </div>
        <div className="rounded-xl border border-zinc-700 bg-zinc-800/30 p-4 text-center">
          <div className="text-2xl font-semibold text-emerald-400">{customCount}</div>
          <div className="text-xs text-zinc-500">Custom</div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search questions..."
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 pl-10 pr-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={selectedCategory || ''}
            onChange={(e) => setSelectedCategory(e.target.value || null)}
            className="rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2.5 text-sm text-zinc-100 focus:border-amber-500/50 focus:outline-none"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </option>
            ))}
          </select>

          <button
            onClick={() => setShowTrendingOnly(!showTrendingOnly)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition ${
              showTrendingOnly
                ? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
                : 'border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <TrendingUp className="h-4 w-4" />
            Trending
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400 flex items-center justify-between">
          {error}
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {showAddForm && (
        <div className="mb-6 rounded-xl border border-zinc-700 bg-zinc-800/30 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-zinc-100">Add New Question</h3>
            <button
              onClick={() => setShowAddForm(false)}
              className="text-zinc-400 hover:text-zinc-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">Question</label>
              <textarea
                value={newQuestion.question}
                onChange={(e) => setNewQuestion({ ...newQuestion, question: e.target.value })}
                placeholder="What's your hot take on..."
                rows={2}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">Category</label>
                <select
                  value={newQuestion.category}
                  onChange={(e) => setNewQuestion({ ...newQuestion, category: e.target.value })}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100 focus:border-amber-500/50 focus:outline-none"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">Hook Type</label>
                <select
                  value={newQuestion.hook_type}
                  onChange={(e) => setNewQuestion({ ...newQuestion, hook_type: e.target.value })}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100 focus:border-amber-500/50 focus:outline-none"
                >
                  <option value="">Select type...</option>
                  {HOOK_TYPES.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">Energy Level</label>
                <select
                  value={newQuestion.energy_level}
                  onChange={(e) => setNewQuestion({ ...newQuestion, energy_level: e.target.value })}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100 focus:border-amber-500/50 focus:outline-none"
                >
                  <option value="">Select level...</option>
                  {ENERGY_LEVELS.map((level) => (
                    <option key={level.id} value={level.id}>
                      {level.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">Notes (optional)</label>
                <input
                  type="text"
                  value={newQuestion.notes}
                  onChange={(e) => setNewQuestion({ ...newQuestion, notes: e.target.value })}
                  placeholder="Additional context..."
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </button>
              <button
                onClick={handleAddQuestion}
                disabled={!newQuestion.question.trim()}
                className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-amber-400 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Add Question
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-flex items-center gap-2 text-zinc-400">
            <div className="h-4 w-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
            Loading questions...
          </div>
        </div>
      ) : questions.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">
          No questions found. Add your first question to get started.
        </div>
      ) : (
        <div className="space-y-2">
          {questions.map((question) => (
            <div
              key={question.id}
              className={`rounded-xl border bg-zinc-800/30 p-4 transition border-zinc-700 ${question.is_trending ? 'ring-1 ring-amber-500/20' : ''}`}
            >
              {editingId === question.id ? (
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="flex-1 rounded-lg border border-zinc-600 bg-zinc-700/50 px-3 py-2 text-sm text-zinc-100 focus:border-amber-500/50 focus:outline-none"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleUpdateQuestion(question.id);
                      if (e.key === 'Escape') cancelEdit();
                    }}
                  />
                  <button
                    onClick={() => handleUpdateQuestion(question.id)}
                    className="p-2 text-emerald-400 hover:text-emerald-300"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="p-2 text-zinc-400 hover:text-zinc-200"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {question.is_trending && (
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-400">
                          <Flame className="h-3 w-3" />
                          Trending
                        </span>
                      )}
                      {question.is_custom && (
                        <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                          Custom
                        </span>
                      )}
                      <span className="text-xs px-2 py-0.5 rounded bg-zinc-700 text-zinc-400">
                        {question.category}
                      </span>
                      {question.hook_type && (
                        <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">
                          {question.hook_type}
                        </span>
                      )}
                    </div>

                    <p className="text-zinc-100">{question.question}</p>

                    {question.usage_count > 0 && (
                      <div className="flex items-center gap-1 mt-2 text-xs text-zinc-500">
                        <BarChart3 className="h-3 w-3" />
                        Used {question.usage_count} times
                      </div>
                    )}
                  </div>

                  {(
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleTrending(question.id, question.is_trending);
                        }}
                        className={`p-2 rounded-lg transition ${
                          question.is_trending
                            ? 'text-amber-400 hover:text-amber-300 bg-amber-500/10'
                            : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/50'
                        }`}
                        title={question.is_trending ? 'Remove from trending' : 'Mark as trending'}
                      >
                        <Flame className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startEdit(question);
                        }}
                        className="p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/50 transition"
                        title="Edit"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      {question.is_custom && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Delete this question?')) {
                              handleDeleteQuestion(question.id);
                            }
                          }}
                          className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

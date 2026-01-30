import { useState, useEffect } from 'react';
import { Search, Flame, X, ChevronDown, BarChart3 } from 'lucide-react';
import { listQuestions, getQuestionCategories, type QuestionBankItem } from '../lib/questionBank';

interface QuestionPickerProps {
  value: string;
  onChange: (question: string, questionId?: string) => void;
  onOpenBank?: () => void;
}

export function QuestionPicker({ value, onChange, onOpenBank }: QuestionPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [questions, setQuestions] = useState<QuestionBankItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = getQuestionCategories();

  useEffect(() => {
    if (isOpen) {
      loadQuestions();
    }
  }, [isOpen, selectedCategory]);

  async function loadQuestions() {
    setIsLoading(true);
    try {
      const data = await listQuestions({
        category: selectedCategory || undefined,
        limit: 50,
      });
      setQuestions(data);
    } catch (err) {
      console.error('Failed to load questions:', err);
    } finally {
      setIsLoading(false);
    }
  }

  function handleSelectQuestion(question: QuestionBankItem) {
    onChange(question.question, question.id);
    setIsOpen(false);
    setSearchQuery('');
  }

  const filteredQuestions = searchQuery
    ? questions.filter((q) =>
        q.question.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : questions;

  const trendingQuestions = filteredQuestions.filter((q) => q.is_trending);
  const regularQuestions = filteredQuestions.filter((q) => !q.is_trending);

  return (
    <div className="relative">
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter or select a hook question..."
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
        />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition ${
            isOpen
              ? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
              : 'border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'
          }`}
        >
          <Flame className="h-4 w-4" />
          <span className="hidden sm:inline">Pick</span>
          <ChevronDown className={`h-4 w-4 transition ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 z-50 rounded-xl border border-zinc-700 bg-zinc-900 shadow-xl max-h-96 overflow-hidden flex flex-col">
          <div className="p-3 border-b border-zinc-800 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search questions..."
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 pl-9 pr-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none"
                autoFocus
              />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`shrink-0 px-2.5 py-1 rounded-lg text-xs transition ${
                  !selectedCategory
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                All
              </button>
              {categories.slice(0, 8).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`shrink-0 px-2.5 py-1 rounded-lg text-xs transition ${
                    selectedCategory === cat
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8 text-zinc-500 text-sm">
                Loading...
              </div>
            ) : filteredQuestions.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-zinc-500 text-sm">
                No questions found
              </div>
            ) : (
              <div className="p-2">
                {trendingQuestions.length > 0 && (
                  <div className="mb-3">
                    <div className="flex items-center gap-2 px-2 py-1 text-xs text-amber-400">
                      <Flame className="h-3 w-3" />
                      Trending
                    </div>
                    {trendingQuestions.map((q) => (
                      <QuestionOption
                        key={q.id}
                        question={q}
                        onSelect={handleSelectQuestion}
                        isTrending
                      />
                    ))}
                  </div>
                )}

                {regularQuestions.length > 0 && (
                  <div>
                    {trendingQuestions.length > 0 && (
                      <div className="px-2 py-1 text-xs text-zinc-500">All Questions</div>
                    )}
                    {regularQuestions.map((q) => (
                      <QuestionOption
                        key={q.id}
                        question={q}
                        onSelect={handleSelectQuestion}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {onOpenBank && (
            <div className="p-2 border-t border-zinc-800">
              <button
                onClick={() => {
                  setIsOpen(false);
                  onOpenBank();
                }}
                className="w-full px-3 py-2 text-sm text-amber-400 hover:text-amber-300 hover:bg-zinc-800/50 rounded-lg transition text-center"
              >
                Open Full Question Bank
              </button>
            </div>
          )}
        </div>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}

function QuestionOption({
  question,
  onSelect,
  isTrending = false,
}: {
  question: QuestionBankItem;
  onSelect: (question: QuestionBankItem) => void;
  isTrending?: boolean;
}) {
  return (
    <button
      onClick={() => onSelect(question)}
      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
        isTrending
          ? 'hover:bg-amber-500/10 text-zinc-100'
          : 'hover:bg-zinc-800 text-zinc-300'
      }`}
    >
      <div className="line-clamp-2">{question.question}</div>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500">
          {question.category}
        </span>
        {question.usage_count > 0 && (
          <span className="flex items-center gap-1 text-xs text-zinc-600">
            <BarChart3 className="h-3 w-3" />
            {question.usage_count}
          </span>
        )}
      </div>
    </button>
  );
}

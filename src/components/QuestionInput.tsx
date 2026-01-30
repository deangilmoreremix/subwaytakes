import { useState, useEffect } from 'react';
import { Shuffle, TrendingUp, ChevronDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Question, QuestionCategory } from '../lib/types';
import { QUESTION_CATEGORIES } from '../lib/constants';

interface QuestionInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function QuestionInput({ value, onChange }: QuestionInputProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<QuestionCategory | 'all'>('all');
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadQuestions();
  }, []);

  async function loadQuestions() {
    setLoading(true);
    const { data } = await supabase
      .from('question_bank')
      .select('*')
      .order('is_trending', { ascending: false })
      .order('usage_count', { ascending: false });

    if (data) {
      setQuestions(data as Question[]);
    }
    setLoading(false);
  }

  function getFilteredQuestions() {
    if (selectedCategory === 'all') return questions;
    return questions.filter(q => q.category === selectedCategory);
  }

  function getTrendingQuestions() {
    return questions.filter(q => q.is_trending).slice(0, 5);
  }

  function selectRandomQuestion() {
    const filtered = getFilteredQuestions();
    if (filtered.length === 0) return;
    const random = filtered[Math.floor(Math.random() * filtered.length)];
    onChange(random.question);
  }

  function selectQuestion(question: string) {
    onChange(question);
    setShowDropdown(false);
  }

  const trendingQuestions = getTrendingQuestions();

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-zinc-300">
        Interview Question
      </label>

      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="What's your toxic trait?"
          className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 pr-24"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
          <button
            type="button"
            onClick={selectRandomQuestion}
            disabled={loading || questions.length === 0}
            className="p-2 text-zinc-400 hover:text-amber-400 hover:bg-zinc-700/50 rounded-md transition-colors disabled:opacity-50"
            title="Random question"
          >
            <Shuffle className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setShowDropdown(!showDropdown)}
            className="p-2 text-zinc-400 hover:text-amber-400 hover:bg-zinc-700/50 rounded-md transition-colors"
            title="Browse questions"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {trendingQuestions.length > 0 && !showDropdown && (
        <div className="flex flex-wrap gap-2">
          {trendingQuestions.map((q) => (
            <button
              key={q.id}
              type="button"
              onClick={() => selectQuestion(q.question)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-full hover:bg-amber-500/20 transition-colors"
            >
              <TrendingUp className="w-3 h-3" />
              {q.question}
            </button>
          ))}
        </div>
      )}

      {showDropdown && (
        <div className="absolute z-50 mt-1 w-full max-h-80 overflow-y-auto bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl">
          <div className="sticky top-0 bg-zinc-800 border-b border-zinc-700 p-2">
            <div className="flex gap-1 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1.5 text-xs rounded-md whitespace-nowrap transition-colors ${
                  selectedCategory === 'all'
                    ? 'bg-amber-500 text-black font-medium'
                    : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                }`}
              >
                All
              </button>
              {QUESTION_CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setSelectedCategory(cat.value)}
                  className={`px-3 py-1.5 text-xs rounded-md whitespace-nowrap transition-colors ${
                    selectedCategory === cat.value
                      ? 'bg-amber-500 text-black font-medium'
                      : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
          <div className="p-2 space-y-1">
            {getFilteredQuestions().map((q) => (
              <button
                key={q.id}
                type="button"
                onClick={() => selectQuestion(q.question)}
                className="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700/50 rounded-md flex items-center gap-2 transition-colors"
              >
                {q.is_trending && <TrendingUp className="w-3 h-3 text-amber-400 flex-shrink-0" />}
                <span>{q.question}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

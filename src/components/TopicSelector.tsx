import { useState, useMemo } from 'react';
import { Search, Shuffle, ChevronDown, ChevronUp } from 'lucide-react';
import {
  TOPICS,
  TOPIC_CATEGORIES,
  getTopicsByCategory,
  searchTopics,
  type TopicCategory,
  type TopicItem,
} from '../lib/topicData';

interface TopicSelectorProps {
  value: string;
  onChange: (topicId: string) => void;
}

export function TopicSelector({ value, onChange }: TopicSelectorProps) {
  const [activeCategory, setActiveCategory] = useState<TopicCategory>('popular');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);

  const filteredTopics = useMemo(() => {
    if (searchQuery.trim()) {
      return searchTopics(searchQuery);
    }
    return getTopicsByCategory(activeCategory);
  }, [activeCategory, searchQuery]);

  function handleRandomTopic() {
    const randomIndex = Math.floor(Math.random() * TOPICS.length);
    const randomTopic = TOPICS[randomIndex];
    onChange(randomTopic.id);
    setExpandedTopic(randomTopic.id);
  }

  function handleTopicClick(topic: TopicItem) {
    if (value === topic.id) {
      setExpandedTopic(expandedTopic === topic.id ? null : topic.id);
    } else {
      onChange(topic.id);
      setExpandedTopic(topic.id);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search topics..."
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 pl-10 pr-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
          />
        </div>
        <button
          onClick={handleRandomTopic}
          className="flex items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-2.5 text-sm text-zinc-300 transition hover:border-zinc-600 hover:text-zinc-100"
        >
          <Shuffle className="h-4 w-4" />
          <span className="sm:inline">Surprise Me</span>
        </button>
      </div>

      {!searchQuery && (
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
          {TOPIC_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
                activeCategory === cat.id
                  ? 'bg-amber-500 text-black'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      )}

      {searchQuery && filteredTopics.length === 0 && (
        <div className="text-center py-8 text-zinc-500">
          No topics found for "{searchQuery}"
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {filteredTopics.map((topic) => {
          const Icon = topic.icon;
          const isSelected = value === topic.id;
          const isExpanded = expandedTopic === topic.id;

          return (
            <div key={topic.id} className="relative">
              <button
                onClick={() => handleTopicClick(topic)}
                className={`w-full text-left rounded-xl border p-4 transition-all ${
                  isSelected
                    ? 'border-amber-500/50 bg-amber-500/10 ring-1 ring-amber-500/30'
                    : 'border-zinc-700 bg-zinc-800/30 hover:border-zinc-600 hover:bg-zinc-800/50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`shrink-0 rounded-lg p-2 ${
                      isSelected
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-zinc-700/50 text-zinc-400'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-zinc-100 truncate">
                        {topic.label}
                      </span>
                      {isSelected && (
                        isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-amber-400 shrink-0" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-amber-400 shrink-0" />
                        )
                      )}
                    </div>
                    <p className="text-sm text-zinc-500 mt-0.5 line-clamp-1">
                      {topic.description}
                    </p>
                  </div>
                </div>

                {isSelected && isExpanded && (
                  <div className="mt-4 pt-3 border-t border-zinc-700/50">
                    <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
                      Sample Questions
                    </p>
                    <ul className="space-y-1.5">
                      {topic.sampleQuestions.map((q, i) => (
                        <li
                          key={i}
                          className="text-sm text-zinc-400 flex items-start gap-2"
                        >
                          <span className="text-amber-500/60 shrink-0">"</span>
                          <span className="line-clamp-2">{q}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

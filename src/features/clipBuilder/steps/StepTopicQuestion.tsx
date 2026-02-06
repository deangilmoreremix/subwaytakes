import { useState } from "react";
import type { TopicOption } from "../data/topics";
import { TOPICS, SPICE_OPTIONS } from "../data/topics";

export interface StepTopicQuestionProps {
  topic?: string;
  question?: string;
  spiceTags?: string[];
  onChange: (data: { topic: string; question: string; spiceTags: string[] }) => void;
}

export function StepTopicQuestion({
  topic,
  question,
  spiceTags = [],
  onChange,
}: StepTopicQuestionProps) {
  const [showQuestions, setShowQuestions] = useState(false);

  const selectedTopic = TOPICS.find((t) => t.id === topic);

  const handleTopicSelect = (topicId: string) => {
    onChange({ topic: topicId, question: "", spiceTags });
    setShowQuestions(true);
  };

  const handleQuestionSelect = (q: string) => {
    onChange({ topic: topic || "", question: q, spiceTags });
  };

  const handleSpiceToggle = (spiceId: string) => {
    const newSpiceTags = spiceTags.includes(spiceId)
      ? spiceTags.filter((s) => s !== spiceId)
      : [...spiceTags, spiceId];
    onChange({ topic: topic || "", question: question || "", spiceTags: newSpiceTags });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white">What should they talk about?</h2>
        <p className="text-sm text-zinc-400">
          Pick a topic, then choose (or edit) a question.
        </p>
      </div>

      {/* Topic Selection */}
      {!showQuestions && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-zinc-200">Choose a topic</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {TOPICS.map((t) => (
              <TopicCard
                key={t.id}
                topic={t}
                selected={topic === t.id}
                onClick={() => handleTopicSelect(t.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Question Selection */}
      {showQuestions && selectedTopic && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <button
            type="button"
            onClick={() => setShowQuestions(false)}
            className="text-sm text-zinc-400 hover:text-white flex items-center gap-1"
          >
            ← Change topic
          </button>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-zinc-200">
              Pick a question about {selectedTopic.emoji} {selectedTopic.label}
            </h3>

            <div className="grid grid-cols-1 gap-2">
              {selectedTopic.questions.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleQuestionSelect(q)}
                  className={[
                    "rounded-xl border p-4 text-left transition-all",
                    "bg-zinc-900/30 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/50",
                    question === q ? "ring-1 ring-white/15 border-white/20 bg-zinc-900/60" : "",
                  ].join(" ")}
                >
                  <span className="text-sm text-zinc-200">{q}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Custom Question Input */}
      {question && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <h3 className="text-sm font-semibold text-zinc-200">Or write your own</h3>
          <textarea
            value={question}
            onChange={(e) => onChange({ topic: topic || "", question: e.target.value, spiceTags })}
            placeholder="Type your own question..."
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:border-white/20 focus:outline-none"
            rows={2}
          />
        </div>
      )}

      {/* Spice Modifiers */}
      {question && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <h3 className="text-sm font-semibold text-zinc-200">Make it more... (optional)</h3>
          <div className="flex flex-wrap gap-2">
            {SPICE_OPTIONS.map((spice) => (
              <button
                key={spice.id}
                type="button"
                onClick={() => handleSpiceToggle(spice.id)}
                className={[
                  "rounded-full border px-3 py-1.5 text-sm transition-all",
                  "border-zinc-800 hover:border-zinc-700",
                  spiceTags.includes(spice.id)
                    ? "bg-white text-zinc-900"
                    : "bg-zinc-900/40 text-zinc-300",
                ].join(" ")}
              >
                {spice.emoji} {spice.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Helper Text */}
      {topic && question && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-3 text-sm text-zinc-300">
          <span className="font-semibold text-white">Next:</span> Review and customize your clip settings.
        </div>
      )}
    </div>
  );
}

function TopicCard({
  topic,
  selected,
  onClick,
}: {
  topic: TopicOption;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "group relative rounded-xl border p-4 text-center transition-all",
        "bg-zinc-900/30 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/50",
        selected ? "ring-1 ring-white/15 border-white/20 bg-zinc-900/60" : "",
      ].join(" ")}
    >
      <div className="text-3xl">{topic.emoji}</div>
      <div className="mt-2 text-sm font-semibold text-white">{topic.label}</div>
      <div className="mt-1 text-xs text-zinc-400">{topic.questions.length} questions</div>
    </button>
  );
}

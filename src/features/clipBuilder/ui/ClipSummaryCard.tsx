import type { ClipBuilderState } from "../clipBuilder.types";
import { PERSONAS } from "../data/personas";
import { VIBES } from "../data/vibes";
import { TOPICS } from "../data/topics";

export interface ClipSummaryCardProps {
  state: ClipBuilderState;
  className?: string;
}

export function ClipSummaryCard({ state, className = "" }: ClipSummaryCardProps) {
  const persona = state.personaId ? PERSONAS.find((p) => p.id === state.personaId) : null;
  const vibe = state.vibeId ? VIBES.find((v) => v.id === state.vibeId) : null;
  const topic = state.topic ? TOPICS.find((t) => t.id === state.topic || t.label === state.topic) : null;

  const isComplete = !!(state.videoType && state.personaId && state.vibeId && state.topic && state.question);

  return (
    <div className={`rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-4 ${className}`}>
      <div className="flex items-center gap-2">
        <span className="text-lg">📋</span>
        <h3 className="font-semibold text-white">Clip Summary</h3>
      </div>

      <div className="space-y-3 text-sm">
        {/* Video Type */}
        <div className="flex items-center justify-between">
          <span className="text-zinc-400">Type</span>
          <span className="text-white font-medium">
            {state.videoType?.replace(/_/g, " ") || "—"}
          </span>
        </div>

        {/* Audience Persona */}
        {persona && (
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">Audience</span>
            <span className="text-white font-medium">
              {persona.emoji} {persona.label}
            </span>
          </div>
        )}

        {/* Vibe */}
        {vibe && (
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">Vibe</span>
            <span className="text-white font-medium">
              {vibe.emoji} {vibe.label}
            </span>
          </div>
        )}

        {/* Topic */}
        {topic && (
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">Topic</span>
            <span className="text-white font-medium">
              {topic.emoji} {topic.label}
            </span>
          </div>
        )}

        {/* Question */}
        {state.question && (
          <div className="pt-2 border-t border-zinc-800">
            <span className="text-zinc-400 block mb-1">Question</span>
            <span className="text-zinc-200 text-xs line-clamp-2">
              "{state.question}"
            </span>
          </div>
        )}

        {/* Duration */}
        {state.durationSeconds && (
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">Duration</span>
            <span className="text-white font-medium">{state.durationSeconds}s</span>
          </div>
        )}

        {/* Interview Style */}
        {state.interviewStyle && (
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">Style</span>
            <span className="text-white font-medium">
              {state.interviewStyle.replace(/_/g, " ")}
            </span>
          </div>
        )}
      </div>

      {/* Confidence Checks */}
      <div className="pt-3 border-t border-zinc-800 space-y-2">
        <div className="text-xs font-semibold text-zinc-300">Confidence Checks</div>
        <div className="space-y-1">
          {state.videoType === "subway_interview" ? (
            <CheckItem checked={true} label="Subway card mic enforced" />
          ) : (
            <CheckItem checked={true} label="Card mic not required" />
          )}
          {persona && (
            <CheckItem
              checked={true}
              label={`Age-appropriate: ${persona.ageGroup}`}
            />
          )}
          {state.question && (
            <CheckItem checked={true} label="Question configured" />
          )}
          {isComplete ? (
            <CheckItem checked={true} label="Ready to generate" />
          ) : (
            <CheckItem checked={false} label="Complete all steps" />
          )}
        </div>
      </div>
    </div>
  );
}

function CheckItem({ checked, label }: { checked: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span
        className={[
          "w-4 h-4 rounded-full flex items-center justify-center text-[10px]",
          checked
            ? "bg-emerald-400/20 text-emerald-400"
            : "bg-zinc-800 text-zinc-500",
        ].join(" ")}
      >
        {checked ? "✓" : "—"}
      </span>
      <span className={checked ? "text-zinc-300" : "text-zinc-500"}>{label}</span>
    </div>
  );
}

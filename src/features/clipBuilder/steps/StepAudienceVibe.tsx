import type { Persona } from "../data/personas";
import type { VibePreset } from "../data/vibes";
import { PERSONAS } from "../data/personas";
import { VIBES } from "../data/vibes";

export interface StepAudienceVibeProps {
  personaId?: string;
  vibeId?: string;
  onChange: (data: { personaId: string; vibeId: string }) => void;
}

export function StepAudienceVibe({ personaId, vibeId, onChange }: StepAudienceVibeProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white">Who is this for?</h2>
        <p className="text-sm text-zinc-400">
          Choose your audience. We'll auto-set the best vibe and guardrails.
        </p>
      </div>

      {/* Persona Selection */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-zinc-200">Audience Persona</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {PERSONAS.map((persona) => (
            <PersonaCard
              key={persona.id}
              persona={persona}
              selected={personaId === persona.id}
              onClick={() => {
                onChange({ personaId: persona.id, vibeId: vibeId || VIBES[0].id });
              }}
            />
          ))}
        </div>
      </div>

      {/* Vibe Selection */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-zinc-200">Vibe Preset</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {VIBES.map((vibe) => (
            <VibeCard
              key={vibe.id}
              vibe={vibe}
              selected={vibeId === vibe.id}
              onClick={() => {
                onChange({ personaId: personaId || PERSONAS[0].id, vibeId: vibe.id });
              }}
            />
          ))}
        </div>
      </div>

      {/* Helper Text */}
      {personaId && vibeId && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-3 text-sm text-zinc-300">
          <span className="font-semibold text-white">Tip:</span> You can override these settings later in Advanced.
        </div>
      )}
    </div>
  );
}

function PersonaCard({
  persona,
  selected,
  onClick,
}: {
  persona: Persona;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "group relative rounded-xl border p-4 text-left transition-all",
        "bg-zinc-900/30 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/50",
        selected ? "ring-1 ring-white/15 border-white/20 bg-zinc-900/60" : "",
      ].join(" ")}
    >
      <div className="flex items-center gap-2">
        <span className="text-2xl">{persona.emoji}</span>
        <div>
          <div className="text-sm font-semibold text-white">{persona.label}</div>
          <div className="text-xs text-zinc-400">{persona.bestFor === "shares" ? "📢 Great for shares" : persona.bestFor === "comments" ? "💬 Sparks comments" : "💾 Saves"}</div>
        </div>
      </div>
      <div className="mt-2 text-xs text-zinc-400">{persona.description}</div>
    </button>
  );
}

function VibeCard({
  vibe,
  selected,
  onClick,
}: {
  vibe: VibePreset;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "group relative rounded-xl border p-3 text-left transition-all",
        "bg-zinc-900/30 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/50",
        selected ? "ring-1 ring-white/15 border-white/20 bg-zinc-900/60" : "",
      ].join(" ")}
    >
      <div className="flex items-center gap-2">
        <span className="text-xl">{vibe.emoji}</span>
        <div>
          <div className="text-sm font-semibold text-white">{vibe.label}</div>
          <div className="text-xs text-zinc-400">{vibe.durationRange[0]}-{vibe.durationRange[1]}s</div>
        </div>
      </div>
      <div className="mt-1 text-xs text-zinc-400">{vibe.description}</div>
    </button>
  );
}

import type { ClipType } from "../../../lib/types";

type VideoTypeOption = {
  value: ClipType;
  label: string;
  description: string;
  badge?: string;
  vibe: string[];
};

const VIDEO_TYPES: VideoTypeOption[] = [
  {
    value: "subway_interview",
    label: "Subway",
    badge: "Viral",
    description: "SubwayTakes-style interviews. Raw, urban, candid reactions.",
    vibe: ["Card-as-mic", "Handheld", "Commuters", "Platform / Train"],
  },
  {
    value: "street_interview",
    label: "Street",
    badge: "Classic",
    description: "Sidewalk documentary style. Great for local business angles.",
    vibe: ["Sidewalk", "Natural light", "Passersby", "Authentic"],
  },
  {
    value: "studio_interview",
    label: "Studio",
    badge: "Pro",
    description: "Clean studio/podcast vibe. Controlled lighting and framing.",
    vibe: ["Controlled", "Clean audio vibe", "Two-shot", "Pro look"],
  },
  {
    value: "motivational",
    label: "Motivational",
    badge: "Energy",
    description: "Cinematic b-roll / kinetic motivation moments.",
    vibe: ["Cinematic push-in", "Intensity", "Power lines", "Short hooks"],
  },
  {
    value: "wisdom_interview",
    label: "Wisdom",
    badge: "55+",
    description: "Warm, reflective advice. Calm delivery. Life lessons.",
    vibe: ["Thoughtful", "Warm", "Slow pacing", "Legacy / lessons"],
  },
];

export function StepVideoType({
  value,
  onChange,
}: {
  value?: ClipType;
  onChange: (v: ClipType) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-white">Choose the interview type</h2>
        <p className="text-sm text-zinc-400">
          Pick the format first. We'll tailor the style options and prompt structure automatically.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {VIDEO_TYPES.map((t) => {
          const selected = value === t.value;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => onChange(t.value)}
              className={[
                "group relative rounded-2xl border p-4 text-left transition-all",
                "bg-zinc-900/40 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/60",
                selected ? "ring-1 ring-white/15 border-white/20 bg-zinc-900/70" : "",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="text-base font-semibold text-white">{t.label}</div>
                    {t.badge ? (
                      <span className="rounded-full border border-zinc-800 bg-zinc-950 px-2 py-0.5 text-[11px] text-zinc-300">
                        {t.badge}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-sm text-zinc-400">{t.description}</div>
                </div>

                <div
                  className={[
                    "h-10 w-10 rounded-xl border bg-zinc-950/60 flex items-center justify-center",
                    selected ? "border-white/20" : "border-zinc-800",
                  ].join(" ")}
                  aria-hidden
                >
                  {/* simple glyph */}
                  <span className="text-zinc-200 text-lg">▶</span>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {t.vibe.map((v) => (
                  <span
                    key={v}
                    className="rounded-full border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-300"
                  >
                    {v}
                  </span>
                ))}
              </div>

              {/* subtle bottom glow */}
              <div className="pointer-events-none absolute inset-x-4 bottom-3 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          );
        })}
      </div>

      {/* Helpful "what happens next" */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-3 text-sm text-zinc-300">
        <span className="font-semibold text-white">Next:</span> pick the interview style (we'll filter styles that match your chosen type).
      </div>
    </div>
  );
}

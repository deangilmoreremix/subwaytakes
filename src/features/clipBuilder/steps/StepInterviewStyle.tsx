import type { ClipType, InterviewStyle } from "../../../lib/types";
import { INTERVIEW_STYLES, INTERVIEW_STYLE_META } from "../../../lib/interviewStyles";

const STYLE_ALLOWLIST_BY_TYPE: Partial<Record<ClipType, InterviewStyle[]>> = {
  subway_interview: [
    "man_on_street",
    "quick_fire",
    "reaction_test",
    "hot_take",
    "unpopular_opinion",
    "confessional",
    "confessions",
  ],
  street_interview: [
    "man_on_street",
    "quick_fire",
    "friendly_chat",
    "reaction_test",
    "street_quiz",
    "would_you_rather",
    "finish_sentence",
    "hot_take",
    "unpopular_opinion",
    "debate_challenge",
  ],
  studio_interview: [
    "deep_conversation",
    "serious_probe",
    "storytelling",
    "before_after_story",
    "one_piece_advice",
  ],
  motivational: [
    "hot_take",
    "one_piece_advice",
    "before_after_story",
  ],
  wisdom_interview: [
    "deep_conversation",
    "storytelling",
    "one_piece_advice",
    "before_after_story",
    "confessional",
  ],
};

export function StepInterviewStyle({
  videoType,
  value,
  onChange,
}: {
  videoType: ClipType;
  value?: InterviewStyle;
  onChange: (v: InterviewStyle) => void;
}) {
  const allow = STYLE_ALLOWLIST_BY_TYPE[videoType];
  const styles = allow
    ? allow.map((v) => INTERVIEW_STYLE_META[v])
    : INTERVIEW_STYLES;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-white">Pick the vibe</h2>
        <p className="text-sm text-zinc-400">
          Choose how the interview should feel. We'll handle the rest.
        </p>
      </div>

      {/* Category rows */}
      <div className="space-y-6">
        {groupByCategory(styles).map(([category, items]) => (
          <div key={category} className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-200">{category}</h3>
              <span className="text-xs text-zinc-500">{items.length} styles</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {items.map((meta) => (
                <StyleCard
                  key={meta.value}
                  meta={meta}
                  selected={value === meta.value}
                  onClick={() => onChange(meta.value)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Preview line */}
      {value && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
          <div className="text-sm text-zinc-200">
            <span className="font-semibold">{INTERVIEW_STYLE_META[value].label}:</span>{" "}
            <span className="text-zinc-400">{INTERVIEW_STYLE_META[value].description}</span>
          </div>
          {INTERVIEW_STYLE_META[value].bestFor?.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {INTERVIEW_STYLE_META[value].bestFor!.map((k) => (
                <span
                  key={k}
                  className="rounded-full border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-300"
                >
                  Best for: {k}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function StyleCard({
  meta,
  selected,
  onClick,
}: {
  meta: (typeof INTERVIEW_STYLES)[number];
  selected: boolean;
  onClick: () => void;
}) {
  const c = meta.colors;

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "group relative rounded-xl border p-3 text-left transition-all",
        "bg-zinc-900/30 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/50",
        selected ? `${c.bg} ${c.border} ring-1 ring-white/10` : "",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className={["text-sm font-semibold", selected ? c.text : "text-white"].join(" ")}>
            {meta.label}
          </div>
          <div className="mt-1 line-clamp-2 text-xs text-zinc-400">
            {meta.description}
          </div>
        </div>

        {/* recommended seconds badge */}
        {meta.recommendedSeconds?.length ? (
          <span className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-[11px] text-zinc-300">
            ~{Math.max(...meta.recommendedSeconds)}s
          </span>
        ) : null}
      </div>

      {/* subtle bottom glow */}
      <div className="pointer-events-none absolute inset-x-3 bottom-2 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}

function groupByCategory(styles: typeof INTERVIEW_STYLES) {
  const map = new Map<string, typeof INTERVIEW_STYLES>();
  for (const s of styles) {
    map.set(s.category, [...(map.get(s.category) ?? []), s]);
  }
  const order = ["Classic", "Opinion", "Story", "Interactive", "Investigative"];
  return Array.from(map.entries()).sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
}

import { useMemo } from "react";
import type { InterviewerPosition, InterviewerType } from "../../../lib/types";
import type { SubwayCardMicConfig } from "../clipBuilder.types";

const CARD_TYPE_LABELS: Record<NonNullable<SubwayCardMicConfig["cardType"]>, string> = {
  metro_card: "Metro Card",
  subway_ticket: "Subway Ticket",
  transit_pass: "Transit Pass",
};

const CARD_DESIGN_LABELS: Record<NonNullable<SubwayCardMicConfig["cardDesign"]>, string> = {
  plain: "Plain",
  minimal: "Minimal",
  blank: "Blank / No logos",
};

const FRAMING_OPTIONS: { value: InterviewerPosition; label: string; desc: string }[] = [
  { value: "holding_mic", label: "Two-shot (Card visible)", desc: "Card in hand between interviewer and subject." },
  { value: "handheld_pov", label: "POV (Hand + card visible)", desc: "Interviewer POV with card extended like a mic." },
  { value: "over_shoulder", label: "Over-shoulder", desc: "Subject face focus + card still visible in frame." },
  { value: "two_shot_visible", label: "Wide two-shot", desc: "Both people visible + card is obvious in center." },
];

const INTERVIEWER_TYPE_OPTIONS: { value: InterviewerType; label: string; note: string }[] = [
  { value: "hidden_voice_only", label: "Off-camera (best)", note: "Only hand + card visible." },
  { value: "casual_creator", label: "Casual creator", note: "Documentary vibe, no mic gear." },
  { value: "documentary_journalist", label: "Documentary", note: "Journalist energy, but no mic." },
];

export { FRAMING_OPTIONS, INTERVIEWER_TYPE_OPTIONS, CARD_TYPE_LABELS, CARD_DESIGN_LABELS };

export function SubwayCardMicPanel({
  value,
  onChange,
}: {
  value: SubwayCardMicConfig;
  onChange: (patch: Partial<SubwayCardMicConfig>) => void;
}) {
  const canProceed = useMemo(() => value.enabled && value.mustBeVisible, [value.enabled, value.mustBeVisible]);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-white">Subway Card Mic Rule</h3>
            <span className="rounded-full border border-zinc-800 bg-zinc-950 px-2 py-0.5 text-[11px] text-zinc-300">Mandatory</span>
          </div>
          <p className="mt-1 text-sm text-zinc-400">Signature SubwayTakes visual. Card must be obvious.</p>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
        <div>
          <div className="text-sm font-semibold text-white">Use a card as the microphone</div>
          <div className="text-xs text-zinc-400">No real microphones. Card must be visible.</div>
        </div>
        <button
          type="button"
          onClick={() => onChange({ enabled: true })}
          className={`rounded-lg px-3 py-2 text-sm font-semibold ${value.enabled ? "bg-emerald-400 text-zinc-900" : "bg-white text-zinc-900"}`}
        >
          {value.enabled ? "Enabled" : "Enable"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-3">
          <div className="text-xs text-zinc-400">Card type</div>
          <select
            className="mt-2 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200"
            value={value.cardType}
            onChange={(e) => onChange({ cardType: e.target.value as SubwayCardMicConfig["cardType"] })}
          >
            {Object.entries(CARD_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-3">
          <div className="text-xs text-zinc-400">Card design</div>
          <select
            className="mt-2 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200"
            value={value.cardDesign}
            onChange={(e) => onChange({ cardDesign: e.target.value as SubwayCardMicConfig["cardDesign"] })}
          >
            {Object.entries(CARD_DESIGN_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-3">
          <div className="text-xs text-zinc-400">Must be visible</div>
          <label className="mt-2 flex items-center gap-2 text-sm text-zinc-200">
            <input type="checkbox" checked={value.mustBeVisible} onChange={(e) => onChange({ mustBeVisible: e.target.checked })} />
            Card is clearly visible
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-3">
          <div className="text-sm font-semibold text-white">Shot framing</div>
          <div className="mt-2 grid grid-cols-1 gap-2">
            {FRAMING_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => onChange({ framingHint: o.value })}
                className={`rounded-xl border p-3 text-left transition-all bg-zinc-950/40 border-zinc-800 hover:border-zinc-700 ${value.framingHint === o.value ? "ring-1 ring-white/10 border-white/15" : ""}`}
              >
                <div className="text-sm font-semibold text-white">{o.label}</div>
                <div className="text-xs text-zinc-400">{o.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-3">
          <div className="text-sm font-semibold text-white">Interviewer type</div>
          <div className="mt-2 grid grid-cols-1 gap-2">
            {INTERVIEWER_TYPE_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => onChange({ interviewerTypeHint: o.value })}
                className={`rounded-xl border p-3 text-left transition-all bg-zinc-950/40 border-zinc-800 hover:border-zinc-700 ${value.interviewerTypeHint === o.value ? "ring-1 ring-white/10 border-white/15" : ""}`}
              >
                <div className="text-sm font-semibold text-white">{o.label}</div>
                <div className="text-xs text-zinc-400">{o.note}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {!canProceed && (
        <div className="text-xs text-rose-300">Enable card mic and keep visible checked for Subway clips.</div>
      )}
    </div>
  );
}

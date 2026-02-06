import { useMemo, useState } from "react";
import type { ClipBuilderState } from "./clipBuilder.types";
import { StepVideoType } from "./steps/StepVideoType";
import { StepInterviewStyle } from "./steps/StepInterviewStyle";
import { SubwayCardMicPanel, DEFAULT_SUBWAY_CARD_MIC } from "./ui/SubwayCardMicPanel";

type StepId = "type" | "style" | "prompt" | "summary";

export function ClipBuilderWizard() {
  const [state, setState] = useState<ClipBuilderState>({
    durationSeconds: 6,
  });
  const [step, setStep] = useState<StepId>("type");

  const canGoStyle = !!state.videoType;
  const canGoPrompt = !!state.videoType && !!state.interviewStyle;
  const canGoSummary = canGoPrompt && !!state.topic?.trim();

  const nextEnabled = useMemo(() => {
    if (step === "type") return canGoStyle;
    if (step === "style") return canGoPrompt;
    if (step === "prompt") return canGoSummary;
    return false;
  }, [step, canGoStyle, canGoPrompt, canGoSummary]);

  const goNext = () => {
    if (!nextEnabled) return;
    setStep((s) => {
      if (s === "type") return "style";
      if (s === "style") return "prompt";
      if (s === "prompt") return "summary";
      return s;
    });
  };

  const goBack = () => {
    setStep((s) => {
      if (s === "summary") return "prompt";
      if (s === "prompt") return "style";
      if (s === "style") return "type";
      return s;
    });
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      {/* Top stepper */}
      <div className="mb-6 flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3">
        <div className="flex items-center gap-2 text-sm">
          <StepDot label="Type" active={step === "type"} done={!!state.videoType} />
          <StepDot label="Style" active={step === "style"} done={!!state.interviewStyle} />
          <StepDot label="Prompt" active={step === "prompt"} done={!!state.topic?.trim()} />
          <StepDot label="Summary" active={step === "summary"} done={step === "summary"} />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goBack}
            disabled={step === "type"}
            className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 disabled:opacity-40"
          >
            Back
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={!nextEnabled}
            className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-zinc-900 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      {/* Step: Video Type */}
      {step === "type" && (
        <StepVideoType
          value={state.videoType}
          onChange={(videoType) => {
            setState((prev) => ({
              ...prev,
              videoType,
              interviewStyle: undefined,
              topic: prev.topic,
            }));
          }}
        />
      )}

      {/* Step: Interview Style */}
      {step === "style" && state.videoType && (
        <StepInterviewStyle
          videoType={state.videoType}
          value={state.interviewStyle}
          onChange={(interviewStyle) => setState((prev) => ({ ...prev, interviewStyle }))}
        />
      )}

      {/* Step: Prompt */}
      {step === "prompt" && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-white">What should we ask about?</h2>
            <p className="text-sm text-zinc-400">
              Give us a topic, and optionally some direction.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Topic or Question
              </label>
              <textarea
                value={state.topic ?? ""}
                onChange={(e) => setState((prev) => ({ ...prev, topic: e.target.value }))}
                placeholder="e.g., What's the best advice you've ever received?"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:border-white/20 focus:outline-none"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Direction (optional)
              </label>
              <textarea
                value={state.direction ?? ""}
                onChange={(e) => setState((prev) => ({ ...prev, direction: e.target.value }))}
                placeholder="e.g., Push for a controversial answer"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:border-white/20 focus:outline-none"
                rows={2}
              />
            </div>
          </div>

          {/* Subway Card Mic Panel (only for subway) */}
          {state.videoType === "subway_interview" && (
            <SubwayCardMicPanel
              value={state.subwayCardMic ?? DEFAULT_SUBWAY_CARD_MIC}
              onChange={(patch) =>
                setState((prev) => ({
                  ...prev,
                  subwayCardMic: { ...(prev.subwayCardMic ?? DEFAULT_SUBWAY_CARD_MIC), ...patch },
                }))
              }
            />
          )}

          {/* Next step hint */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-3 text-sm text-zinc-300">
            <span className="font-semibold text-white">Next:</span> review your settings and generate.
          </div>
        </div>
      )}

      {/* Step: Summary */}
      {step === "summary" && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Ready to generate</h2>
            <p className="text-sm text-zinc-400">
              Review your settings before creating the clip.
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
            <div className="flex justify-between">
              <span className="text-zinc-400">Type</span>
              <span className="text-white font-medium">{state.videoType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Style</span>
              <span className="text-white font-medium">{state.interviewStyle}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Topic</span>
              <span className="text-white font-medium">{state.topic}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Duration</span>
              <span className="text-white font-medium">{state.durationSeconds}s</span>
            </div>
          </div>

          <button
            type="button"
            className="w-full rounded-xl bg-white py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-100"
            onClick={() => {
              // TODO: Implement generation
              alert("Generation not implemented yet");
            }}
          >
            Generate Clip
          </button>
        </div>
      )}
    </div>
  );
}

function StepDot({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={[
          "h-2.5 w-2.5 rounded-full",
          done ? "bg-emerald-400" : active ? "bg-white" : "bg-zinc-700",
        ].join(" ")}
      />
      <span className={active ? "text-white" : "text-zinc-400"}>{label}</span>
    </div>
  );
}

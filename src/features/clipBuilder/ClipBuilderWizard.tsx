import { useMemo, useState } from "react";
import type { WizardState, WizardStepId } from "./clipBuilder.types";
import { StepVideoType } from "./steps/StepVideoType";
import { StepAudienceVibe } from "./steps/StepAudienceVibe";
import { StepTopicQuestion } from "./steps/StepTopicQuestion";
import { StepInterviewStyle } from "./steps/StepInterviewStyle";
import { ClipSummaryCard } from "./ui/ClipSummaryCard";
import { SubwayCardMicPanel } from "./ui/SubwayCardMicPanel";
import { PERSONAS } from "./data/personas";
import { VIBES } from "./data/vibes";
import { DEFAULT_SUBWAY_CARD_MIC } from "./clipBuilder.types";

export function ClipBuilderWizard() {
  const [state, setState] = useState<WizardState>({
    durationSeconds: 6,
  });
  const [step, setStep] = useState<WizardStepId>("type");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Step navigation logic
  const canGoAudience = !!state.videoType;
  const canGoTopic = !!(state.personaId && state.vibeId);
  const canGoStyle = !!(state.topic && state.question);
  const canGoSummary = canGoStyle;

  const nextEnabled = useMemo(() => {
    if (step === "type") return canGoAudience;
    if (step === "audience") return canGoTopic;
    if (step === "topic") return canGoStyle;
    return false;
  }, [step, canGoAudience, canGoTopic, canGoStyle]);

  const goNext = () => {
    if (!nextEnabled) return;
    setStep((s) => {
      if (s === "type") return "audience";
      if (s === "audience") return "topic";
      if (s === "topic") return "style";
      if (s === "style") return "summary";
      return s;
    });
  };

  const goBack = () => {
    setStep((s) => {
      if (s === "summary") return "style";
      if (s === "style") return "topic";
      if (s === "topic") return "audience";
      if (s === "audience") return "type";
      return s;
    });
  };

  // Handle persona/vibe changes with auto-derivation
  const handleAudienceVibeChange = (data: { personaId: string; vibeId: string }) => {
    const persona = PERSONAS.find((p) => p.id === data.personaId);
    const vibe = VIBES.find((v) => v.id === data.vibeId);

    setState((prev) => ({
      ...prev,
      ...data,
      ageGroup: persona?.ageGroup,
      energyLevel: persona?.energyLevel || vibe?.energyLevel,
      tone: persona?.tone,
      durationSeconds: vibe?.durationRange[0] || prev.durationSeconds,
    }));
  };

  // Handle topic/question changes
  const handleTopicQuestionChange = (data: { topic: string; question: string; spiceTags: string[] }) => {
    setState((prev) => ({
      ...prev,
      ...data,
    }));
  };

  // Summary state check
  const isComplete = !!(state.videoType && state.personaId && state.vibeId && state.topic && state.question);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      {/* Two-column layout for larger screens */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content area */}
        <div className="lg:col-span-2 space-y-6">
          {/* Top stepper */}
          <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3">
            <div className="flex items-center gap-2 text-sm overflow-x-auto">
              <StepDot label="Type" active={step === "type"} done={!!state.videoType} />
              <StepDot label="Audience" active={step === "audience"} done={!!state.personaId} />
              <StepDot label="Topic" active={step === "topic"} done={!!state.question} />
              <StepDot label="Style" active={step === "style"} done={!!state.interviewStyle} />
              <StepDot label="Generate" active={step === "summary"} done={isComplete} />
            </div>

            <div className="flex items-center gap-2 shrink-0">
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
                {step === "style" ? "Review" : step === "summary" ? "✓" : "Next"}
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
                  // Reset dependent fields
                  personaId: undefined,
                  vibeId: undefined,
                  topic: undefined,
                  question: undefined,
                }));
              }}
            />
          )}

          {/* Step: Audience & Vibe */}
          {step === "audience" && (
            <StepAudienceVibe
              personaId={state.personaId}
              vibeId={state.vibeId}
              onChange={handleAudienceVibeChange}
            />
          )}

          {/* Step: Topic & Question */}
          {step === "topic" && (
            <StepTopicQuestion
              topic={state.topic}
              question={state.question}
              spiceTags={state.spiceTags}
              onChange={handleTopicQuestionChange}
            />
          )}

          {/* Step: Interview Style */}
          {step === "style" && (
            <div className="space-y-6">
              <StepInterviewStyle
                videoType={state.videoType!}
                value={state.interviewStyle}
                onChange={(interviewStyle) => setState((prev) => ({ ...prev, interviewStyle }))}
              />

              {/* Advanced Settings Toggle */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white"
                >
                  <span>{showAdvanced ? "▼" : "▶"}</span>
                  Advanced Settings (Optional)
                </button>

                {showAdvanced && (
                  <div className="mt-4 space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
                    {/* Model Tier */}
                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-2">
                        Model Quality
                      </label>
                      <select
                        value={state.modelTier || "standard"}
                        onChange={(e) => setState((prev) => ({ ...prev, modelTier: e.target.value as WizardState["modelTier"] }))}
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200"
                      >
                        <option value="standard">Standard</option>
                        <option value="premium">Premium</option>
                      </select>
                    </div>

                    {/* Duration */}
                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-2">
                        Duration: {state.durationSeconds}s
                      </label>
                      <input
                        type="range"
                        min="3"
                        max="15"
                        value={state.durationSeconds || 6}
                        onChange={(e) => setState((prev) => ({ ...prev, durationSeconds: parseInt(e.target.value) }))}
                        className="w-full"
                      />
                    </div>

                    {/* Subway Card Mic Panel */}
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
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step: Summary */}
          {step === "summary" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold text-white">Ready to generate</h2>
                <p className="text-sm text-zinc-400">
                  Review your settings and click generate to create your clip.
                </p>
              </div>

              <button
                type="button"
                className="w-full rounded-xl bg-white py-4 text-base font-semibold text-zinc-900 hover:bg-zinc-100 flex items-center justify-center gap-2"
                onClick={() => {
                  // TODO: Implement generation with prompt hardening
                  alert("Generation would start here with the following state:\n\n" + JSON.stringify(state, null, 2));
                }}
              >
                <span className="text-lg">⚡</span>
                Generate My Clip
              </button>

              <div className="text-center text-xs text-zinc-500">
                ~{state.durationSeconds || 6} seconds • 1 vertical clip • Captions included
              </div>
            </div>
          )}
        </div>

        {/* Sidebar - Summary Card (sticky) */}
        <div className="hidden lg:block">
          <div className="sticky top-4">
            <ClipSummaryCard state={state} />
          </div>
        </div>
      </div>
    </div>
  );
}

function StepDot({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={[
          "h-2.5 w-2.5 rounded-full shrink-0",
          done ? "bg-emerald-400" : active ? "bg-white" : "bg-zinc-700",
        ].join(" ")}
      />
      <span className={active ? "text-white" : "text-zinc-400 whitespace-nowrap"}>{label}</span>
    </div>
  );
}

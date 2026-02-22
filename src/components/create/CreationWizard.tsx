import { ReactNode } from 'react';
import { Check, ChevronLeft, ChevronRight, Settings, Zap } from 'lucide-react';
import type { ClipCreationHook } from '../../hooks/useClipCreation';
import type { WizardStepDef } from '../../hooks/useClipCreation';

interface CreationWizardProps {
  clip: ClipCreationHook;
  steps: WizardStepDef[];
  children: ReactNode[];
  accentColor?: string;
  onGenerate: () => void;
}

const ACCENT_MAP: Record<string, { ring: string; bg: string; text: string; dot: string; btnBg: string; btnHover: string }> = {
  amber: { ring: 'ring-amber-500', bg: 'bg-amber-500', text: 'text-amber-400', dot: 'bg-amber-500', btnBg: 'bg-amber-500', btnHover: 'hover:bg-amber-400' },
  emerald: { ring: 'ring-emerald-500', bg: 'bg-emerald-500', text: 'text-emerald-400', dot: 'bg-emerald-500', btnBg: 'bg-emerald-500', btnHover: 'hover:bg-emerald-400' },
  red: { ring: 'ring-red-500', bg: 'bg-red-500', text: 'text-red-400', dot: 'bg-red-500', btnBg: 'bg-red-500', btnHover: 'hover:bg-red-400' },
  sky: { ring: 'ring-sky-500', bg: 'bg-sky-500', text: 'text-sky-400', dot: 'bg-sky-500', btnBg: 'bg-sky-500', btnHover: 'hover:bg-sky-400' },
};

export function CreationWizard({ clip, steps, children, accentColor = 'amber', onGenerate }: CreationWizardProps) {
  const accent = ACCENT_MAP[accentColor] || ACCENT_MAP.amber;
  const isLastStep = clip.currentStep === clip.totalSteps - 1;

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-1 flex-1 min-w-0">
          {steps.map((step, i) => {
            const isCompleted = i < clip.currentStep;
            const isActive = i === clip.currentStep;
            const isUpcoming = i > clip.currentStep;

            return (
              <div key={i} className="flex items-center flex-1 last:flex-none">
                <button
                  type="button"
                  onClick={() => clip.goToStep(i)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all whitespace-nowrap ${
                    isActive
                      ? `bg-zinc-800 ${accent.text} ring-1 ${accent.ring}/30`
                      : isCompleted
                        ? 'text-zinc-300 hover:bg-zinc-800/50'
                        : 'text-zinc-600 hover:text-zinc-500'
                  }`}
                >
                  <span
                    className={`flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold transition-all ${
                      isCompleted
                        ? `${accent.bg} text-black`
                        : isActive
                          ? `ring-2 ${accent.ring} bg-zinc-900 ${accent.text}`
                          : 'bg-zinc-800 text-zinc-500'
                    }`}
                  >
                    {isCompleted ? <Check className="w-3.5 h-3.5" /> : i + 1}
                  </span>
                  <span className="text-sm font-medium hidden sm:inline">
                    {step.label}
                    {step.optional && <span className="text-zinc-600 ml-1 text-xs">(opt)</span>}
                  </span>
                </button>

                {i < steps.length - 1 && (
                  <div
                    className={`flex-1 h-px mx-1 transition-colors ${
                      isCompleted ? accent.bg : 'bg-zinc-800'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => clip.setShowAdvanced(true)}
          className="ml-4 flex-shrink-0 p-2.5 rounded-xl border border-zinc-700 bg-zinc-800/60 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-all"
          title="Advanced Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      <div className="relative overflow-hidden">
        {children.map((child, i) => (
          <div
            key={i}
            className={`transition-all duration-300 ease-in-out ${
              i === clip.currentStep
                ? 'opacity-100 translate-x-0'
                : i < clip.currentStep
                  ? 'opacity-0 -translate-x-8 absolute inset-0 pointer-events-none'
                  : 'opacity-0 translate-x-8 absolute inset-0 pointer-events-none'
            }`}
            style={{ display: i === clip.currentStep ? 'block' : 'none' }}
          >
            {child}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mt-8 pt-6 border-t border-zinc-800">
        <button
          type="button"
          onClick={clip.prevStep}
          disabled={clip.currentStep === 0}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-zinc-400 hover:text-zinc-200 rounded-xl border border-zinc-700 hover:border-zinc-600 transition-all disabled:opacity-30 disabled:pointer-events-none"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>

        <div className="flex items-center gap-3">
          {isLastStep ? (
            <button
              type="button"
              onClick={onGenerate}
              className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-black rounded-xl ${accent.btnBg} ${accent.btnHover} transition-all`}
            >
              Generate
              <Zap className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={clip.nextStep}
              className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-black rounded-xl ${accent.btnBg} ${accent.btnHover} transition-all`}
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

import { AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react';
import type { PreGenerationValidationResult } from '../lib/validation';
import { buildValidationSummary } from '../lib/validation';

interface VideoValidationStatusProps {
  result: PreGenerationValidationResult;
  compact?: boolean;
}

export function VideoValidationStatus({ result, compact = false }: VideoValidationStatusProps) {
  const hasErrors = !result.valid;
  const hasWarnings = result.warnings.length > 0;

  if (result.valid && !hasWarnings) return null;

  if (compact) {
    return (
      <div className={`flex items-center gap-1.5 text-xs ${hasErrors ? 'text-red-400' : 'text-amber-400'}`}>
        {hasErrors ? <XCircle className="w-3.5 h-3.5 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
        <span>{buildValidationSummary(result)}</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {hasErrors && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 space-y-1.5">
          <div className="flex items-center gap-2 text-red-400 text-xs font-medium">
            <XCircle className="w-4 h-4 shrink-0" />
            <span>{result.issues.length} validation error{result.issues.length !== 1 ? 's' : ''}</span>
          </div>
          <ul className="space-y-1">
            {result.issues.map((issue, i) => (
              <li key={i} className="text-xs text-red-300 pl-6">
                {issue.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasWarnings && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 space-y-1.5">
          <div className="flex items-center gap-2 text-amber-400 text-xs font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{result.warnings.length} warning{result.warnings.length !== 1 ? 's' : ''}</span>
          </div>
          <ul className="space-y-1">
            {result.warnings.map((w, i) => (
              <li key={i} className="text-xs text-amber-300 pl-6">
                {w.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.valid && hasWarnings && (
        <div className="flex items-center gap-2 text-emerald-400 text-xs">
          <CheckCircle className="w-3.5 h-3.5 shrink-0" />
          <span>Ready to generate</span>
        </div>
      )}
    </div>
  );
}

interface DurationCapNoticeProps {
  requestedSeconds: number;
  effectiveSeconds: number;
  modelTier: 'standard' | 'premium';
}

export function DurationCapNotice({ requestedSeconds, effectiveSeconds, modelTier }: DurationCapNoticeProps) {
  if (requestedSeconds <= effectiveSeconds) return null;

  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
      <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
      <p className="text-xs text-amber-300">
        The <span className="font-medium">{modelTier === 'premium' ? 'Veo (Premium)' : 'Hailuo (Standard)'}</span> model
        caps duration at <span className="font-medium">{effectiveSeconds}s</span>.
        Your requested {requestedSeconds}s will be trimmed automatically.
      </p>
    </div>
  );
}

import type { StudioBranding, StudioProject } from '../../studio/types';
import type { StudioAction } from '../../lib/studioReducer';

export interface BrandingPanelProps {
  project: StudioProject;
  dispatch(action: StudioAction): void;
}

const POSITIONS: Array<[StudioBranding['watermarkPosition'], string]> = [
  ['top-left', 'Top left'],
  ['top-right', 'Top right'],
  ['bottom-left', 'Bottom left'],
  ['bottom-right', 'Bottom right'],
];

export function BrandingPanel({ project, dispatch }: BrandingPanelProps) {
  const branding = project.branding;

  const update = (patch: Partial<StudioBranding>) =>
    dispatch({ type: 'SET_BRANDING', branding: patch });

  return (
    <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
      <div>
        <h3 className="text-sm font-semibold text-zinc-300">Branding</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Watermark, handle and progress bar render on top of every beat in the preview and in the
          server render.
        </p>
      </div>

      <label className="block">
        <span className="mb-1 block text-[11px] font-medium text-zinc-400">Handle</span>
        <input
          value={branding.handle}
          onChange={(event) => {
            const handle = event.target.value;
            update({
              handle,
              watermarkText: branding.watermarkText === branding.handle ? handle : undefined,
            });
          }}
          placeholder="@subwaytakes"
          className="w-full rounded-xl border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-[11px] font-medium text-zinc-400">Watermark text</span>
        <input
          value={branding.watermarkText}
          onChange={(event) => update({ watermarkText: event.target.value })}
          className="w-full rounded-xl border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-[11px] font-medium text-zinc-400">Watermark position</span>
        <select
          value={branding.watermarkPosition}
          onChange={(event) =>
            update({ watermarkPosition: event.target.value as StudioBranding['watermarkPosition'] })
          }
          className="w-full rounded-xl border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
        >
          {POSITIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <div className="flex items-center gap-3">
        <label className="block flex-1">
          <span className="mb-1 block text-[11px] font-medium text-zinc-400">Accent colour</span>
          <input
            value={branding.accentColor}
            onChange={(event) => update({ accentColor: event.target.value })}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-800/50 px-3 py-2 font-mono text-sm text-zinc-100 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-zinc-400">Picker</span>
          <input
            type="color"
            value={branding.accentColor}
            onChange={(event) => update({ accentColor: event.target.value })}
            className="h-9 w-14 cursor-pointer rounded-lg border border-zinc-700 bg-zinc-800/50 p-1"
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-[11px] font-medium text-zinc-400">Logo URL (optional)</span>
        <input
          value={branding.logoUrl ?? ''}
          onChange={(event) => update({ logoUrl: event.target.value })}
          placeholder="https://…"
          className="w-full rounded-xl border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
        />
      </label>

      <label className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2">
        <input
          type="checkbox"
          checked={branding.showProgressBar}
          onChange={(event) => update({ showProgressBar: event.target.checked })}
          className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 accent-amber-500"
        />
        <span className="text-xs text-zinc-300">Show progress bar</span>
      </label>

      <div
        className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3"
        style={{ borderColor: `${branding.accentColor}55` }}
      >
        <p className="text-[10px] uppercase tracking-wide text-zinc-500">Preview</p>
        <p className="mt-1 text-sm font-semibold" style={{ color: branding.accentColor }}>
          {branding.watermarkText}
        </p>
        <p className="text-[11px] text-zinc-500">{branding.watermarkPosition.replace('-', ' ')}</p>
      </div>
    </div>
  );
}

import { Download, Film } from 'lucide-react';
import type { Clip } from '../../../lib/timeline/types';
import type { CaptionStyle } from '../../../lib/captions/model';
import { EXPORT_FORMATS, exportCaptions, type ExportFormat } from '../../../lib/captions/exports';

// eslint-disable-next-line react-refresh/only-export-components
export function downloadText(name: string, mime: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function ExportPanel({ caps, fps, style, onBurn, disabled }: { caps: Clip[]; fps: number; style: CaptionStyle; onBurn: () => void; disabled?: boolean }) {
  const empty = caps.length === 0;
  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-500">Caption files</div>
        <div className="grid grid-cols-1 gap-2">
          {EXPORT_FORMATS.map(f => (
            <button key={f.id} disabled={empty} data-export={f.id} onClick={() => downloadText(`captions.${f.ext}`, f.mime, exportCaptions(f.id as ExportFormat, caps, fps, style))}
              className="flex items-center justify-between rounded-xl border border-line bg-ink-950 px-3 py-2 text-left hover:border-zinc-600 disabled:opacity-40">
              <span><span className="text-[13px] font-medium text-white">{f.label}</span><span className="ml-2 text-[11px] text-zinc-500">{f.note}</span></span><Download className="h-4 w-4 text-zinc-500" />
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-zinc-600">Times match your timeline, so the files line up with the exported video. ASS keeps the karaoke word timing and your colours; fonts depend on the player.</p>
      </div>
      <div>
        <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-500">Video</div>
        <button disabled={disabled} onClick={onBurn} data-testid="burn-in" className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-accent to-accent-hot text-[13px] font-semibold text-black disabled:opacity-40"><Film className="h-4 w-4" />Burn captions into video (MP4)</button>
        <p className="mt-1.5 text-[11px] text-zinc-600">Applies your changes first, then opens the export dialog. Rendering happens in your browser.</p>
      </div>
    </div>
  );
}

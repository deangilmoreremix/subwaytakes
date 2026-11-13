/** Choosing clean background frames for the environment plates. */

export interface FramePlan { summary: string; timestamps: number[] }

/** Evenly spread fallback moments when the model's answer can't be used (15% / 50% / 85%). */
export function fallbackTimestamps(durationSec: number): number[] {
  return [0.15, 0.5, 0.85].map(f => Math.round(durationSec * f * 100) / 100);
}

/** Pull the first JSON object out of model text, tolerating ```json fences and chatter around it. */
function extractJsonObject(text: string): unknown {
  const t = text.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(t);
  const candidates = [fenced?.[1], t];
  for (const c of candidates) {
    if (!c) continue;
    const start = c.indexOf('{'), end = c.lastIndexOf('}');
    if (start === -1 || end <= start) continue;
    try { return JSON.parse(c.slice(start, end + 1)); } catch { /* try next */ }
  }
  return undefined;
}

/** Parse the vision model's `{summary, timestamps}` answer. Never throws; returns empty fields when unusable. */
export function parsePlanJson(text: string): FramePlan {
  const j = extractJsonObject(text) as { summary?: unknown; timestamps?: unknown } | undefined;
  const summary = typeof j?.summary === 'string' ? j.summary.trim() : '';
  const raw = Array.isArray(j?.timestamps) ? j!.timestamps : [];
  const timestamps = raw.map(v => (typeof v === 'string' ? Number(v) : v)).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  return { summary, timestamps };
}

/**
 * Keep timestamps inside (0.1s .. duration-0.1s), unique to 0.25s, sorted, at most `max`.
 * If nothing usable remains, fall back to 15/50/85% of the duration.
 */
export function selectTimestamps(candidates: number[], durationSec: number, max = 4): number[] {
  const lo = 0.1, hi = durationSec - 0.1;
  const ok = candidates.filter(t => t >= lo && t <= hi).sort((a, b) => a - b);
  const out: number[] = [];
  for (const t of ok) if (!out.some(o => Math.abs(o - t) < 0.25)) out.push(Math.round(t * 100) / 100);
  const picked = out.slice(0, max);
  return picked.length ? picked : fallbackTimestamps(durationSec).slice(0, max);
}

import { supabase } from '../supabase';

export type Feature = 'video' | 'lipsync' | 'voice' | 'recast' | 'image' | 'text' | 'other';
export const FEATURE_LABEL: Record<Feature, string> = { video: 'Video shots', lipsync: 'Lip-sync', voice: 'Voices', recast: 'Recast', image: 'Images', text: 'Captions and text', other: 'Other' };

/** Which kind of work a muapi model slug is (the ledger's spend rows store the slug as their reason). */
export function featureOf(slug: string): Feature {
  const s = slug.toLowerCase();
  if (s.startsWith('elevenlabs-tts') || s.startsWith('minimax-speech') || s.startsWith('minimax-voice')) return 'voice';
  if (s === 'omnihuman-2-0' || s.startsWith('kling-v2-avatar') || s.includes('lipsync') || s.includes('lip-sync')) return 'lipsync';
  if (['depth-anything', 'gemini-video-vision', 'seedance-2.5-omni-reference', 'wan3.0-reference-to-video'].includes(s)) return 'recast';
  if (s.includes('image') && !s.includes('video') || s.startsWith('flux') || s.startsWith('nano-banana') || s.startsWith('gpt-image')) return 'image';
  if (s.includes('video') || s.startsWith('veo') || s.startsWith('kling') || s.startsWith('seedance') || s.startsWith('openai-sora') || s.startsWith('sora')) return 'video';
  if (s.startsWith('gemini') || s.includes('whisper') || s.includes('caption')) return 'text';
  return 'other';
}

export interface LedgerRow { delta: number; kind: string; reason: string | null; ref: string | null; created_at: string }
export interface Usage {
  weeks: Array<{ start: string; credits: number }>;     // oldest first, 8 entries
  byFeature: Array<{ feature: Feature; credits: number }>;
  total: number;
  refunded: number;
}

const WEEKS = 8;
/** Monday 00:00 (local) of the week containing d. */
export function weekStart(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

/**
 * Net credits spent: each spend row counts, and a refund row cancels the spend that shares its ref (so a failed generation costs nothing).
 * Grants, adjustments and opening balances are not usage.
 */
export function groupUsage(rows: LedgerRow[], now = new Date()): Usage {
  const thisWeek = weekStart(now);
  const starts = Array.from({ length: WEEKS }, (_, i) => { const d = new Date(thisWeek); d.setDate(d.getDate() - 7 * (WEEKS - 1 - i)); return d; });
  const weeks = starts.map(d => ({ start: d.toISOString().slice(0, 10), credits: 0 }));
  const byFeature = new Map<Feature, number>();
  const refundOf = new Map<string, number>();
  let refunded = 0;
  for (const r of rows) if (r.kind === 'refund' && r.ref) { refundOf.set(r.ref, (refundOf.get(r.ref) ?? 0) + r.delta); refunded += r.delta; }
  let total = 0;
  for (const r of rows) {
    if (r.kind !== 'spend' || r.delta >= 0) continue;
    const net = Math.max(0, -r.delta - (r.ref ? (refundOf.get(r.ref) ?? 0) : 0));
    if (net === 0) continue;
    const when = new Date(r.created_at);
    const idx = starts.findIndex((s, i) => when >= s && (i === starts.length - 1 || when < starts[i + 1]));
    if (idx < 0) continue;      // older than the window
    weeks[idx].credits += net; total += net;
    const f = featureOf(r.reason ?? '');
    byFeature.set(f, (byFeature.get(f) ?? 0) + net);
  }
  return { weeks, byFeature: [...byFeature].map(([feature, credits]) => ({ feature, credits })).sort((a, b) => b.credits - a.credits), total, refunded };
}

export const USAGE_ROW_LIMIT = 1000;
export async function loadUsage(now = new Date()): Promise<{ usage: Usage; truncated: boolean }> {
  const since = weekStart(now); since.setDate(since.getDate() - 7 * (WEEKS - 1));
  const { data, error } = await supabase.from('credit_ledger').select('delta, kind, reason, ref, created_at').in('kind', ['spend', 'refund']).gte('created_at', since.toISOString()).order('id', { ascending: false }).limit(USAGE_ROW_LIMIT);
  if (error) throw new Error('Could not load your usage.');
  const rows = (data ?? []) as LedgerRow[];
  return { usage: groupUsage(rows, now), truncated: rows.length >= USAGE_ROW_LIMIT };
}

// Pure price maths shared by the gateway and its tests. No Deno or network APIs here.

/** Credits charged for one call: ceil(muapi USD x 100 x margin), never below minCredits. 1 credit = $0.01. */
export function creditsFor(usd: number, margin: number, minCredits = 1): number {
  if (!Number.isFinite(usd) || usd < 0) throw new Error('bad_estimate');
  if (!Number.isFinite(margin) || margin < 1) throw new Error('bad_margin');
  // round to 4 decimals first so 0.6 x 100 x 2.5 is exactly 150, not 150.00000000000003 (which would round up to 151)
  const raw = Math.round(usd * 100 * margin * 1e4) / 1e4;
  return Math.max(minCredits, Math.ceil(raw));
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
};

/** muapi's estimate-cost answer in USD, whatever shape it came in ({cost}, {cost:{amount_usd}}, {estimated_cost}, ...). null if absent. */
export function readEstimateUsd(json: unknown): number | null {
  if (!isObj(json)) return null;
  for (const k of ['cost', 'estimated_cost', 'estimate', 'price', 'amount_usd', 'usd']) {
    const v = json[k];
    const n = num(v);
    if (n !== null && n >= 0) return n;
    if (isObj(v)) { const inner = readEstimateUsd(v); if (inner !== null) return inner; }
  }
  return null;
}

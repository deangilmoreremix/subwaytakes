import { IS_BYOK } from '../mode';
/**
 * Paid features, as the app shows them. The gateway enforces the same keys on the server for anything that spends muapi money
 * (supabase/functions/_shared/entitlements.ts). Cities and shows are prompt text, so for those this is a display lock only.
 */
export type Feature = 'cuts' | 'voices' | 'recast' | 'extra_cities' | 'happiness' | 'bible' | 'motivation' | 'brand' | 'dubbing';

export const PACK_NAMES: Record<string, string> = {
  pro_pack: 'Pro Pack',
  recast: 'Recast',
  happiness: 'Happiness show',
  bible: 'Bible Pack',
  motivation: 'Motivation Pack',
  commercial: 'Commercial licence',
};

interface FeatureInfo { label: string; needs: string[]; product: string }
export const FEATURES: Record<Feature, FeatureInfo> = {
  cuts: { label: 'Cuts format', needs: ['pro_pack'], product: 'pro_pack' },
  voices: { label: 'Cast voices', needs: ['pro_pack', 'recast'], product: 'pro_pack' },
  recast: { label: 'Recast', needs: ['recast'], product: 'recast_happiness' },
  extra_cities: { label: 'All 25 cities', needs: ['pro_pack'], product: 'pro_pack' },
  happiness: { label: 'Happiness show', needs: ['happiness'], product: 'recast_happiness' },
  bible: { label: 'Bible Pack (Scripture show)', needs: ['bible'], product: 'bible_pack' },
  motivation: { label: 'Motivation Pack', needs: ['motivation'], product: 'motivation_pack' },
  dubbing: { label: 'Dubbing', needs: ['pro_pack', 'recast'], product: 'pro_pack' },
  brand: { label: 'Brand kit and watermark-free exports', needs: ['commercial'], product: 'commercial' },
};

/** Cities everyone can use. The rest come with the Pro Pack. */
export const FREE_CITIES: readonly string[] = ['nyc', 'london', 'tokyo', 'paris', 'generic', 'custom'];

// Bringing your own muapi key there is nothing to buy: every show, city and feature is open.
export const hasFeature = (f: Feature, owned: readonly string[]): boolean => IS_BYOK || FEATURES[f].needs.some(k => owned.includes(k));
export const cityLocked = (cityId: string, owned: readonly string[]): boolean => !FREE_CITIES.includes(cityId) && !hasFeature('extra_cities', owned);
/** Shows that come with a paid pack. Like cities these are prompt text (they cost us nothing to run), so the lock is a display lock only. */
export const SHOW_FEATURE: Readonly<Record<string, Feature>> = { happiness: 'happiness', bible: 'bible', motivation: 'motivation' };
export const showFeature = (showId: string): Feature | null => SHOW_FEATURE[showId] ?? null;
export const showLocked = (showId: string, owned: readonly string[]): boolean => { const f = showFeature(showId); return f !== null && !hasFeature(f, owned); };

export function formatPrice(cents: number, currency = 'usd'): string {
  const v = cents / 100;
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase(), minimumFractionDigits: Number.isInteger(v) ? 0 : 2 }).format(v); }
  catch { return `${v} ${currency.toUpperCase()}`; }
}

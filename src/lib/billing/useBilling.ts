import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth';
import { loadEntitlements, loadProducts, type Product } from './index';
import { hasFeature, type Feature } from './features';
import { IS_BYOK } from '../mode';

// One shared copy of the signed-in user's unlocks and the price list, so every panel agrees and we ask the server once.
interface State { userId: string | null; owned: string[]; products: Product[]; loaded: boolean }
let state: State = { userId: null, owned: [], products: [], loaded: false };
let inflight: Promise<void> | null = null;
let fetchedAt = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

async function refreshFor(userId: string, force: boolean): Promise<void> {
  // bringing your own key there is nothing to load: no unlocks, no price list
  if (IS_BYOK) { if (state.userId !== userId || !state.loaded) { state = { userId, owned: [], products: [], loaded: true }; fetchedAt = Date.now(); emit(); } return; }
  if (state.userId !== userId) { state = { userId, owned: [], products: [], loaded: false }; fetchedAt = 0; emit(); }
  if (!force && state.loaded && Date.now() - fetchedAt < 30_000) return;
  if (inflight) return inflight;
  inflight = (async () => {
    const [owned, products] = await Promise.all([loadEntitlements().catch(() => state.owned), loadProducts().catch(() => state.products)]);
    if (state.userId === userId) { state = { userId, owned, products, loaded: true }; fetchedAt = Date.now(); emit(); }
  })().finally(() => { inflight = null; });
  return inflight;
}

/** Test hook: forget everything (used when signing out). */
export function resetBilling(): void { state = { userId: null, owned: [], products: [], loaded: false }; fetchedAt = 0; emit(); }

export function useBilling() {
  const { user, isGuest } = useAuth();
  const [, force] = useState(0);
  useEffect(() => { const l = () => force(n => n + 1); listeners.add(l); return () => { listeners.delete(l); }; }, []);
  const uid = user && !isGuest ? user.id : null;
  useEffect(() => { if (uid) void refreshFor(uid, false); else if (state.userId) resetBilling(); }, [uid]);
  const refresh = useCallback(() => (uid ? refreshFor(uid, true) : Promise.resolve()), [uid]);
  const owned = uid && state.userId === uid ? state.owned : [];
  return {
    owned,
    products: uid && state.userId === uid ? state.products : [],
    loaded: !!uid && state.userId === uid && state.loaded,
    has: (f: Feature) => hasFeature(f, owned),
    refresh,
  };
}

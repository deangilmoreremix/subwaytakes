import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth';
import { loadBrandKit, saveBrandKit, type BrandKit } from './index';

// One shared copy of the signed-in customer's kit, so Settings and the editor agree.
interface State { userId: string | null; kit: BrandKit | null; loaded: boolean }
let state: State = { userId: null, kit: null, loaded: false };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());
let inflight: Promise<void> | null = null;

async function refreshFor(userId: string): Promise<void> {
  if (state.userId !== userId) { state = { userId, kit: null, loaded: false }; emit(); }
  if (state.loaded) return;
  if (inflight) return inflight;
  inflight = (async () => {
    const kit = await loadBrandKit().catch(() => null);
    if (state.userId === userId) { state = { userId, kit, loaded: true }; emit(); }
  })().finally(() => { inflight = null; });
  return inflight;
}

export function useBrandKit() {
  const { user, isGuest } = useAuth();
  const uid = user && !isGuest ? user.id : null;
  const [, force] = useState(0);
  useEffect(() => { const l = () => force(n => n + 1); listeners.add(l); return () => { listeners.delete(l); }; }, []);
  useEffect(() => { if (uid) void refreshFor(uid); else if (state.userId) { state = { userId: null, kit: null, loaded: false }; emit(); } }, [uid]);
  const save = useCallback(async (kit: BrandKit) => { await saveBrandKit(kit); if (uid) { state = { userId: uid, kit, loaded: true }; emit(); } }, [uid]);
  return { kit: uid && state.userId === uid ? state.kit : null, loaded: !!uid && state.userId === uid && state.loaded, save };
}

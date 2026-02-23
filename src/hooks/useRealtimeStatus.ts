import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UseRealtimeStatusOptions {
  table: 'clips' | 'episodes' | 'episode_shots' | 'video_exports' | 'compilations';
  id: string;
  enabled?: boolean;
  onUpdate: (payload: Record<string, unknown>) => void;
}

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;

export function useRealtimeStatus({ table, id, enabled = true, onUpdate }: UseRealtimeStatusOptions) {
  const callbackRef = useRef(onUpdate);
  callbackRef.current = onUpdate;

  const retryCountRef = useRef(0);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const subscribe = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`${table}-${id}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table,
          filter: `id=eq.${id}`,
        },
        (payload) => {
          callbackRef.current(payload.new as Record<string, unknown>);
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          retryCountRef.current = 0;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error(`Realtime ${table}-${id} ${status}:`, err);
          if (retryCountRef.current < MAX_RETRIES) {
            const delay = BASE_DELAY_MS * Math.pow(2, retryCountRef.current);
            retryCountRef.current += 1;
            setTimeout(() => subscribe(), delay);
          }
        }
      });

    channelRef.current = channel;
  }, [table, id]);

  useEffect(() => {
    if (!enabled || !id) return;

    retryCountRef.current = 0;
    subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [table, id, enabled, subscribe]);
}

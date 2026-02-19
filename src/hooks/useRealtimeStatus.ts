import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

interface UseRealtimeStatusOptions {
  table: 'clips' | 'episodes' | 'episode_shots' | 'video_exports';
  id: string;
  enabled?: boolean;
  onUpdate: (payload: Record<string, unknown>) => void;
}

export function useRealtimeStatus({ table, id, enabled = true, onUpdate }: UseRealtimeStatusOptions) {
  const callbackRef = useRef(onUpdate);
  callbackRef.current = onUpdate;

  useEffect(() => {
    if (!enabled || !id) return;

    const channel = supabase
      .channel(`${table}-${id}`)
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, id, enabled]);
}

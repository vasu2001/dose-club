import { useQueryClient } from '@tanstack/react-query';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useEffect } from 'react';

import { supabase } from '@/lib/supabase';

/**
 * Subscribe to the user's private inbox topic; any new notification
 * broadcast invalidates the inbox + unread-count queries, replacing polling.
 */
export function useInboxRealtime(userId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    (async () => {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken || cancelled) return;

      // Private channels authorize against the JWT, not the anon key.
      await supabase.realtime.setAuth(accessToken);
      channel = supabase
        .channel(`user:${userId}:inbox`, { config: { private: true } })
        .on('broadcast', { event: 'new_notification' }, () => {
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
        })
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}

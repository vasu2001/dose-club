import { supabase } from '@/lib/supabase';

export type NotificationType =
  | 'proposal_received'
  | 'proposal_accepted'
  | 'proposal_declined'
  | 'proposal_withdrawn'
  | 'listing_closed'
  | 'trade_confirmed'
  | 'trade_completed';

export type AppNotification = {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: NotificationType;
  title: string;
  proposal_id: string | null;
  listing_id: string | null;
  read_at: string | null;
  created_at: string;
  actor: { username: string | null; display_name: string | null } | null;
  listing: { id: string; coffee: { name: string } } | null;
};

const NOTIFICATION_SELECT = `id, user_id, actor_id, type, title, proposal_id, listing_id, read_at, created_at,
  actor:profiles!notifications_actor_id_fkey(username, display_name),
  listing:listings!notifications_listing_id_fkey(id, coffee:coffees!listings_coffee_id_fkey(name))`;

/** Current user's inbox, newest first (RLS scopes the rows). */
export async function fetchNotifications(): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select(NOTIFICATION_SELECT)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data as unknown as AppNotification[]) ?? [];
}

export async function fetchUnreadCount(): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null);
  if (error) throw error;
  return count ?? 0;
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .is('read_at', null);
  if (error) throw error;
}

export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null);
  if (error) throw error;
}

/** "just now", "12m", "3h", "2d", or a short date beyond a week. */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const minutes = Math.floor((Date.now() - then) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

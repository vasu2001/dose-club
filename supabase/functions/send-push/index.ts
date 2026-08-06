// Fans a new notifications row out to the recipient's Expo push tokens.
// Called by the notifications_deliver DB trigger with { record: <row> }.
import { createClient } from 'npm:@supabase/supabase-js@2';

type NotificationRecord = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  proposal_id: string | null;
  listing_id: string | null;
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (req) => {
  const { record } = (await req.json()) as { record: NotificationRecord };
  if (!record?.user_id || !record?.title) {
    return new Response('bad payload', { status: 400 });
  }

  const { data: tokens, error } = await supabase
    .from('push_tokens')
    .select('token')
    .eq('user_id', record.user_id);
  if (error) return new Response(error.message, { status: 500 });
  if (!tokens || tokens.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), {
      headers: { 'content-type': 'application/json' },
    });
  }

  const messages = tokens.map(({ token }) => ({
    to: token,
    sound: 'default',
    title: 'Dose Club',
    body: record.title,
    data: {
      notification_id: record.id,
      proposal_id: record.proposal_id,
      listing_id: record.listing_id,
      type: record.type,
    },
  }));

  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(messages),
  });
  const result = await res.json();

  // Prune tokens Expo reports as dead so we stop pushing to them.
  const dead: string[] = [];
  const tickets = Array.isArray(result?.data) ? result.data : [];
  tickets.forEach(
    (ticket: { status: string; details?: { error?: string } }, i: number) => {
      if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
        dead.push(messages[i].to);
      }
    },
  );
  if (dead.length > 0) {
    await supabase.from('push_tokens').delete().in('token', dead);
  }

  return new Response(
    JSON.stringify({ sent: messages.length, pruned: dead.length }),
    { headers: { 'content-type': 'application/json' } },
  );
});

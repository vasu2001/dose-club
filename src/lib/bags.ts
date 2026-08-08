import { COFFEE_SELECT, type Coffee } from '@/lib/coffees';
import { supabase } from '@/lib/supabase';

export type BagStatus = 'shelf' | 'frozen' | 'finished';

export type BagEventType = 'added' | 'frozen' | 'thawed' | 'opened' | 'finished';

export type BagEvent = {
  id: string;
  type: BagEventType;
  happened_at: string;
  note: string | null;
};

export type Bag = {
  id: string;
  owner_id: string;
  coffee_id: string;
  roast_date: string | null;
  size_grams: number | null;
  status: BagStatus;
  created_at: string;
  coffee: Coffee;
  events: BagEvent[];
};

const BAG_SELECT = `id, owner_id, coffee_id, roast_date, size_grams, status, created_at,
  coffee:coffees!bags_coffee_id_fkey(${COFFEE_SELECT}),
  events:bag_events!bag_events_bag_id_fkey(id, type, happened_at, note)`;

function sortEvents(bag: Bag): Bag {
  bag.events.sort((a, b) => a.happened_at.localeCompare(b.happened_at));
  return bag;
}

export async function fetchMyBags(userId: string): Promise<Bag[]> {
  const { data, error } = await supabase
    .from('bags')
    .select(BAG_SELECT)
    .eq('owner_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data as unknown as Bag[]) ?? []).map(sortEvents);
}

export async function fetchBag(id: string): Promise<Bag | null> {
  const { data, error } = await supabase
    .from('bags')
    .select(BAG_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? sortEvents(data as unknown as Bag) : null;
}

export type BagInput = {
  coffee_id: string;
  roast_date: string | null;
  size_grams: number | null;
  /** Bag is in the freezer right now (e.g. dose tubes frozen on arrival). */
  frozen: boolean;
  /** When the current freeze started; backdatable, defaults to now. */
  frozen_since?: Date | null;
};

export async function createBag(ownerId: string, input: BagInput): Promise<Bag> {
  const { frozen, frozen_since, ...fields } = input;
  const { data, error } = await supabase
    .from('bags')
    .insert({ owner_id: ownerId, status: frozen ? 'frozen' : 'shelf', ...fields })
    .select(BAG_SELECT)
    .single();
  if (error) throw error;
  const bag = data as unknown as Bag;

  // Timeline seed; a failure here shouldn't lose the bag itself. The 'added'
  // event predates a backdated freeze so the timeline reads in order.
  const frozenAt = frozen ? (frozen_since ?? new Date()) : null;
  const seed: { bag_id: string; type: BagEventType; happened_at: string }[] = [
    {
      bag_id: bag.id,
      type: 'added',
      happened_at: (frozenAt && frozenAt < new Date() ? frozenAt : new Date()).toISOString(),
    },
  ];
  if (frozenAt) {
    seed.push({ bag_id: bag.id, type: 'frozen', happened_at: frozenAt.toISOString() });
  }
  const { data: events } = await supabase
    .from('bag_events')
    .insert(seed)
    .select('id, type, happened_at, note');
  bag.events = (events as BagEvent[]) ?? [];
  return sortEvents(bag);
}

/** Log a lifecycle event (freeze/thaw/open/finish); the RPC moves bag status atomically. */
export async function logBagEvent(
  bagId: string,
  type: Exclude<BagEventType, 'added'>,
  happenedAt?: Date,
  note?: string,
): Promise<void> {
  const { error } = await supabase.rpc('log_bag_event', {
    p_bag_id: bagId,
    p_type: type,
    p_happened_at: (happenedAt ?? new Date()).toISOString(),
    p_note: note ?? null,
  });
  if (error) throw error;
}

export async function deleteBag(id: string): Promise<void> {
  const { error } = await supabase.from('bags').delete().eq('id', id);
  if (error) throw error;
}

const DAY_MS = 86_400_000;

/** Total milliseconds this bag has spent frozen, across all freeze/thaw cycles. */
function frozenMs(bag: Pick<Bag, 'events'>, now = Date.now()): number {
  let total = 0;
  let frozenAt: number | null = null;
  for (const event of bag.events) {
    const at = new Date(event.happened_at).getTime();
    if (event.type === 'frozen' && frozenAt == null) frozenAt = at;
    if (event.type === 'thawed' && frozenAt != null) {
      total += Math.max(0, at - frozenAt);
      frozenAt = null;
    }
  }
  if (frozenAt != null) total += Math.max(0, now - frozenAt);
  return total;
}

export function frozenDays(bag: Pick<Bag, 'events'>): number {
  return Math.floor(frozenMs(bag) / DAY_MS);
}

/**
 * Days of rest since roast, with time in the freezer paused:
 * (days since roast) − (days frozen). Null when the roast date is unknown.
 */
export function restedDays(bag: Pick<Bag, 'roast_date' | 'events'>): number | null {
  if (!bag.roast_date) return null;
  const roasted = new Date(`${bag.roast_date}T00:00:00`).getTime();
  if (!Number.isFinite(roasted)) return null;
  const rested = Math.floor((Date.now() - roasted - frozenMs(bag)) / DAY_MS);
  return Math.max(0, rested);
}

/** When the current freeze started, or null if the bag isn't frozen. */
export function frozenSince(bag: Pick<Bag, 'status' | 'events'>): Date | null {
  if (bag.status !== 'frozen') return null;
  for (let i = bag.events.length - 1; i >= 0; i--) {
    if (bag.events[i].type === 'thawed') return null;
    if (bag.events[i].type === 'frozen') return new Date(bag.events[i].happened_at);
  }
  return null;
}

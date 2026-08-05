import { supabase } from '@/lib/supabase';

export type Roaster = {
  id: string;
  name: string;
};

export type Coffee = {
  id: string;
  created_by: string | null;
  roaster_id: string;
  name: string;
  origin: string | null;
  varietal: string | null;
  process: string | null;
  roast_level: string | null;
  roaster_notes: string | null;
  roaster: Roaster;
};

export const COFFEE_SELECT = `id, created_by, roaster_id, name, origin, varietal, process, roast_level, roaster_notes,
  roaster:roasters!coffees_roaster_id_fkey(id, name)`;

export async function fetchMyCoffees(userId: string): Promise<Coffee[]> {
  const { data, error } = await supabase
    .from('coffees')
    .select(COFFEE_SELECT)
    .eq('created_by', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as Coffee[]) ?? [];
}

/**
 * Search the shared catalog by coffee name or roaster name, so users pick
 * existing entries instead of creating near-duplicates.
 */
export async function searchCoffees(query: string, limit = 12): Promise<Coffee[]> {
  const q = query.trim();
  if (!q) return [];
  const [byName, byRoaster] = await Promise.all([
    supabase
      .from('coffees')
      .select(COFFEE_SELECT)
      .ilike('name', `%${q}%`)
      .limit(limit),
    supabase
      .from('coffees')
      .select(`${COFFEE_SELECT.replace('roasters!coffees_roaster_id_fkey', 'roasters!inner')}`)
      .ilike('roaster.name', `%${q}%`)
      .limit(limit),
  ]);
  if (byName.error) throw byName.error;
  if (byRoaster.error) throw byRoaster.error;
  const seen = new Set<string>();
  const merged: Coffee[] = [];
  for (const row of [
    ...((byName.data as unknown as Coffee[]) ?? []),
    ...((byRoaster.data as unknown as Coffee[]) ?? []),
  ]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    merged.push(row);
  }
  return merged.slice(0, limit);
}

export async function searchRoasters(query: string, limit = 6): Promise<Roaster[]> {
  const q = query.trim();
  if (!q) return [];
  const { data, error } = await supabase
    .from('roasters')
    .select('id, name')
    .ilike('name', `%${q}%`)
    .order('name')
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export type CoffeeInput = {
  roaster_name: string;
  name: string;
  origin: string | null;
  varietal: string | null;
  process: string | null;
  roast_level: string | null;
  roaster_notes: string | null;
};

/** Creates a coffee (reusing the roaster by name) and returns it. */
export async function createCoffee(ownerId: string, input: CoffeeInput): Promise<Coffee> {
  const { roaster_name, ...fields } = input;
  const { data: roasterId, error: roasterError } = await supabase.rpc(
    'get_or_create_roaster',
    { p_name: roaster_name },
  );
  if (roasterError) throw roasterError;

  const { data, error } = await supabase
    .from('coffees')
    .insert({ created_by: ownerId, roaster_id: roasterId as string, ...fields })
    .select(COFFEE_SELECT)
    .single();
  if (error) throw error;
  return data as unknown as Coffee;
}

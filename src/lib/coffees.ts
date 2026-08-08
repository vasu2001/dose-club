import { supabase } from '@/lib/supabase';

/** Canonical roast scale, lightest to darkest. Stored in coffees.roast_level. */
export const ROAST_LEVELS = [
  'ultralight',
  'light',
  'medium',
  'medium-dark',
  'dark',
  'coal',
] as const;

export type RoastLevel = (typeof ROAST_LEVELS)[number];

export const ROAST_LABEL: Record<RoastLevel, string> = {
  ultralight: 'Ultralight',
  light: 'Light',
  medium: 'Medium',
  'medium-dark': 'Med-dark',
  dark: 'Dark',
  coal: 'Coal',
};

/** Index on the roast scale, or null when unset. */
export function roastIndex(level: string | null): number | null {
  if (!level) return null;
  const i = ROAST_LEVELS.indexOf(level as RoastLevel);
  return i === -1 ? null : i;
}

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

/** Latest additions to the shared catalog — discovery fodder for the stash. */
export async function fetchRecentCoffees(limit = 8): Promise<Coffee[]> {
  const { data, error } = await supabase
    .from('coffees')
    .select(COFFEE_SELECT)
    .order('created_at', { ascending: false })
    .limit(limit);
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

/**
 * Get-or-create against the shared catalog: (roaster, name) is unique
 * case-insensitively, so retyping an existing coffee returns the existing
 * row instead of a duplicate.
 */
export async function createCoffee(_ownerId: string, input: CoffeeInput): Promise<Coffee> {
  const { data: coffeeId, error: rpcError } = await supabase.rpc('get_or_create_coffee', {
    p_roaster_name: input.roaster_name,
    p_name: input.name,
    p_origin: input.origin,
    p_varietal: input.varietal,
    p_process: input.process,
    p_roast_level: input.roast_level,
    p_roaster_notes: input.roaster_notes,
  });
  if (rpcError) throw rpcError;

  const { data, error } = await supabase
    .from('coffees')
    .select(COFFEE_SELECT)
    .eq('id', coffeeId as string)
    .single();
  if (error) throw error;
  return data as unknown as Coffee;
}

import { supabase } from '@/lib/supabase';

export type Coffee = {
  id: string;
  owner_id: string;
  roaster: string;
  name: string;
  origin: string | null;
  process: string | null;
  roast_level: string | null;
  tasting_notes: string | null;
};

export const COFFEE_SELECT =
  'id, owner_id, roaster, name, origin, process, roast_level, tasting_notes';

export async function fetchMyCoffees(userId: string): Promise<Coffee[]> {
  const { data, error } = await supabase
    .from('coffees')
    .select(COFFEE_SELECT)
    .eq('owner_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export type CoffeeInput = {
  roaster: string;
  name: string;
  origin: string | null;
  process: string | null;
  roast_level: string | null;
  tasting_notes: string | null;
};

/** Creates a coffee and returns it, or throws on failure. */
export async function createCoffee(ownerId: string, input: CoffeeInput): Promise<Coffee> {
  const { data, error } = await supabase
    .from('coffees')
    .insert({ owner_id: ownerId, ...input })
    .select(COFFEE_SELECT)
    .single();
  if (error) throw error;
  return data;
}

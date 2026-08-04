import { supabase } from '@/lib/supabase';

export type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  city: string | null;
  bio: string | null;
};

/** A profile counts as set up once it has a username and display name. */
export function isProfileComplete(profile: Profile | null): boolean {
  return !!profile?.username && !!profile?.display_name;
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, city, bio')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type ProfileInput = {
  username: string;
  display_name: string;
  city: string | null;
  bio: string | null;
};

/** Returns an error message, or null on success. */
export async function saveProfile(userId: string, input: ProfileInput): Promise<string | null> {
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, ...input });
  if (!error) return null;
  if (error.code === '23505') return 'That username is taken — try another.';
  if (error.code === '23514') {
    return 'Username must be 3–24 characters: lowercase letters, numbers, underscores.';
  }
  return error.message;
}

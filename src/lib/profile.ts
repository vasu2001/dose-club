import { supabase } from '@/lib/supabase';

export type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  city: string | null;
  phone: string | null;
  bio: string | null;
  created_at: string;
};

/**
 * Normalize an Indian mobile number to `+91XXXXXXXXXX`.
 * Accepts spaces/dashes, an optional `+91`/`91`/`0` prefix; the 10-digit
 * number must start with 6–9. Returns null when it isn't a valid number.
 */
export function normalizeIndianPhone(input: string): string | null {
  let digits = input.replace(/[\s-]/g, '');
  if (digits.startsWith('+91')) digits = digits.slice(3);
  else if (/^91[6-9]/.test(digits) && digits.length === 12) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = digits.slice(1);
  if (!/^[6-9][0-9]{9}$/.test(digits)) return null;
  return `+91${digits}`;
}

/** A profile counts as set up once it has username, display name, city and phone. */
export function isProfileComplete(profile: Profile | null): boolean {
  return (
    !!profile?.username && !!profile?.display_name && !!profile?.city && !!profile?.phone
  );
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, city, phone, bio, created_at')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type ProfileStats = {
  completed_trades: number;
  active_listings: number;
};

export async function fetchProfileStats(userId: string): Promise<ProfileStats> {
  const { data, error } = await supabase
    .rpc('profile_stats', { p_user_id: userId })
    .single();
  if (error) throw error;
  const row = data as { completed_trades: number; active_listings: number };
  return {
    completed_trades: Number(row.completed_trades),
    active_listings: Number(row.active_listings),
  };
}

export type ProfileInput = {
  username: string;
  display_name: string;
  city: string;
  phone: string;
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
    if (error.message.includes('phone')) {
      return 'Phone number looks off — enter a 10-digit Indian mobile number.';
    }
    return 'Username must be 3–24 characters: lowercase letters, numbers, underscores.';
  }
  return error.message;
}

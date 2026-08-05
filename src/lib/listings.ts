import { COFFEE_SELECT, type Coffee } from '@/lib/coffees';
import { supabase } from '@/lib/supabase';

export type ListingOwner = {
  username: string | null;
  display_name: string | null;
};

export type Listing = {
  id: string;
  owner_id: string;
  roast_date: string | null;
  dose_grams: number;
  status: 'active' | 'closed';
  created_at: string;
  coffee: Coffee;
  owner: ListingOwner | null;
};

const LISTING_SELECT = `id, owner_id, roast_date, dose_grams, status, created_at,
  coffee:coffees!listings_coffee_id_fkey(${COFFEE_SELECT}),
  owner:profiles!listings_owner_id_fkey(username, display_name)`;

export async function fetchActiveListings(): Promise<Listing[]> {
  const { data, error } = await supabase
    .from('listings')
    .select(LISTING_SELECT)
    .eq('status', 'active')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as Listing[]) ?? [];
}

export async function fetchMyListings(userId: string): Promise<Listing[]> {
  const { data, error } = await supabase
    .from('listings')
    .select(LISTING_SELECT)
    .eq('owner_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as Listing[]) ?? [];
}

export async function fetchListing(id: string): Promise<Listing | null> {
  const { data, error } = await supabase
    .from('listings')
    .select(LISTING_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as Listing | null;
}

export type ListingInput = {
  coffee_id: string;
  roast_date: string | null;
  dose_grams: number;
};

/** Returns an error message, or null on success. */
export async function createListing(
  ownerId: string,
  input: ListingInput,
): Promise<string | null> {
  const { error } = await supabase
    .from('listings')
    .insert({ owner_id: ownerId, ...input });
  if (!error) return null;
  if (error.code === '23514') return 'Check the listing details — a value is out of range.';
  return error.message;
}

export async function closeListing(id: string): Promise<void> {
  const { error } = await supabase
    .from('listings')
    .update({ status: 'closed' })
    .eq('id', id);
  if (error) throw error;
}

export type ProposalStatus = 'pending' | 'accepted' | 'declined' | 'withdrawn' | 'completed';

export type Proposal = {
  id: string;
  listing_id: string;
  proposer_id: string;
  offered_dose_grams: number;
  message: string | null;
  status: ProposalStatus;
  proposer_confirmed_at: string | null;
  owner_confirmed_at: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  withdrawn_at: string | null;
  completed_at: string | null;
  created_at: string;
  listing: Listing | null;
  offered_coffee: Coffee | null;
  proposer: ListingOwner | null;
};

const PROPOSAL_SELECT = `id, listing_id, proposer_id, offered_dose_grams, message, status,
  proposer_confirmed_at, owner_confirmed_at, accepted_at, declined_at, withdrawn_at, completed_at, created_at,
  listing:listings!proposals_listing_id_fkey(${LISTING_SELECT}),
  offered_coffee:coffees!proposals_offered_coffee_id_fkey(${COFFEE_SELECT}),
  proposer:profiles!proposals_proposer_id_fkey(username, display_name)`;

/** All proposals the current user is involved in (RLS scopes the rows). */
export async function fetchProposals(): Promise<Proposal[]> {
  const { data, error } = await supabase
    .from('proposals')
    .select(PROPOSAL_SELECT)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as Proposal[]) ?? [];
}

export async function fetchProposal(id: string): Promise<Proposal | null> {
  const { data, error } = await supabase
    .from('proposals')
    .select(PROPOSAL_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as Proposal | null;
}

/** Returns an error message, or null on success. */
export async function createProposal(input: {
  listing_id: string;
  proposer_id: string;
  offered_coffee_id: string;
  offered_dose_grams: number;
  message: string | null;
}): Promise<string | null> {
  const { error } = await supabase.from('proposals').insert(input);
  if (!error) return null;
  if (error.code === '42501') {
    return 'That trade is not allowed — the listing may no longer be active.';
  }
  return error.message;
}

export async function acceptProposal(id: string): Promise<void> {
  const { error } = await supabase.rpc('accept_proposal', { p_proposal_id: id });
  if (error) throw error;
}

export async function declineProposal(id: string): Promise<void> {
  const { error } = await supabase.rpc('decline_proposal', { p_proposal_id: id });
  if (error) throw error;
}

export async function confirmTrade(id: string): Promise<void> {
  const { error } = await supabase.rpc('confirm_trade', { p_proposal_id: id });
  if (error) throw error;
}

export async function withdrawProposal(id: string): Promise<void> {
  const { error } = await supabase
    .from('proposals')
    .update({ status: 'withdrawn' })
    .eq('id', id)
    .eq('status', 'pending');
  if (error) throw error;
}

/** Days since roast, or null if no roast date. */
export function daysOffRoast(listing: Pick<Listing, 'roast_date'>): number | null {
  if (!listing.roast_date) return null;
  const roasted = new Date(`${listing.roast_date}T00:00:00`);
  const days = Math.floor((Date.now() - roasted.getTime()) / 86_400_000);
  return Number.isFinite(days) && days >= 0 ? days : null;
}

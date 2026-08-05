import { supabase } from '@/lib/supabase';

export type ReviewContext = 'listing' | 'proposal' | 'received';

export type CoffeeReview = {
  id: string;
  coffee_id: string;
  author_id: string;
  proposal_id: string | null;
  context: ReviewContext;
  body: string;
  created_at: string;
  author: { username: string | null; display_name: string | null } | null;
};

const REVIEW_SELECT = `id, coffee_id, author_id, proposal_id, context, body, created_at,
  author:profiles!coffee_reviews_author_id_fkey(username, display_name)`;

export async function fetchCoffeeReviews(coffeeId: string): Promise<CoffeeReview[]> {
  const { data, error } = await supabase
    .from('coffee_reviews')
    .select(REVIEW_SELECT)
    .eq('coffee_id', coffeeId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as CoffeeReview[]) ?? [];
}

/** The current user's 'received' review for a trade, if written. */
export async function fetchMyReceivedReview(
  proposalId: string,
  authorId: string,
): Promise<CoffeeReview | null> {
  const { data, error } = await supabase
    .from('coffee_reviews')
    .select(REVIEW_SELECT)
    .eq('proposal_id', proposalId)
    .eq('author_id', authorId)
    .eq('context', 'received')
    .maybeSingle();
  if (error) throw error;
  return data as unknown as CoffeeReview | null;
}

export async function createReview(input: {
  coffee_id: string;
  author_id: string;
  proposal_id?: string | null;
  context: ReviewContext;
  body: string;
}): Promise<void> {
  const { error } = await supabase.from('coffee_reviews').insert({
    proposal_id: null,
    ...input,
  });
  if (error) throw error;
}

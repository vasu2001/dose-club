import { Button, Host } from '@expo/ui';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  useWindowDimensions,
} from 'react-native';

import { ListingCard } from '@/components/listing-card';
import { ScreenShell } from '@/components/screen-shell';
import { Colors, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { closeListing, fetchListing, type Listing } from '@/lib/listings';
import { fetchCoffeeReviews, type CoffeeReview } from '@/lib/reviews';

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const { width } = useWindowDimensions();
  const buttonWidth = Math.min(width, MaxContentWidth) - 2 * Spacing.four;

  const [listing, setListing] = useState<Listing | null>(null);
  const [reviews, setReviews] = useState<CoffeeReview[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwner = !!listing && listing.owner_id === session?.user.id;

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const row = await fetchListing(id);
      setListing(row);
      if (row) setReviews(await fetchCoffeeReviews(row.coffee.id));
    } finally {
      setLoaded(true);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const removeListing = async () => {
    if (busy || !listing) return;
    setBusy(true);
    try {
      await closeListing(listing.id);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setBusy(false);
    }
  };

  if (!listing) {
    return (
      <ScreenShell title={loaded ? 'Not found' : 'Loading…'} edges={['bottom']}>
        {loaded && (
          <Text style={[styles.muted, { color: colors.textSecondary }]}>
            This listing doesn't exist anymore.
          </Text>
        )}
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      eyebrow={isOwner ? 'YOUR LISTING' : 'TRADING FOR'}
      title={listing.coffee.name}
      subtitle={`${listing.coffee.roaster.name}${listing.coffee.origin ? ` · ${listing.coffee.origin}` : ''}`}
      edges={['bottom']}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
        <ListingCard listing={listing} hideOwner={isOwner} />

        {listing.coffee.roaster_notes != null && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.accent }]}>
              ROASTER'S NOTES
            </Text>
            <Text style={[styles.notes, { color: colors.textSecondary }]}>
              “{listing.coffee.roaster_notes}”
            </Text>
          </>
        )}

        {reviews.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.accent }]}>
              WHAT MEMBERS SAY
            </Text>
            {reviews.map((review) => (
              <View
                key={review.id}
                style={[styles.review, { backgroundColor: colors.backgroundElement }]}>
                <Text style={[styles.reviewBody, { color: colors.text }]}>
                  “{review.body}”
                </Text>
                <Text style={[styles.reviewMeta, { color: colors.textSecondary }]}>
                  @{review.author?.username ?? 'someone'}
                  {review.context === 'received' ? ' · after a trade' : ''}
                </Text>
              </View>
            ))}
          </>
        )}

        {!isOwner && listing.owner != null && (
          <Link href={{ pathname: '/user/[id]', params: { id: listing.owner_id } }}>
            <Text style={[styles.profileLink, { color: colors.tint }]}>
              View @{listing.owner.username ?? 'someone'}'s profile →
            </Text>
          </Link>
        )}

        {error != null && (
          <Text style={[styles.message, { color: colors.danger }]}>{error}</Text>
        )}

        {isOwner ? (
          listing.status === 'active' && (
            <Host matchContents seedColor={colors.tint} style={styles.actions}>
              <Button
                variant="outlined"
                label={busy ? 'Removing…' : 'Remove from shelf'}
                disabled={busy}
                style={{ width: buttonWidth, height: 44 }}
                onPress={removeListing}
              />
            </Host>
          )
        ) : listing.status !== 'active' ? (
          <Text style={[styles.muted, { color: colors.textSecondary }]}>
            This dose is no longer available.
          </Text>
        ) : (
          <Host matchContents seedColor={colors.tint} style={styles.actions}>
            <Button
              variant="filled"
              label="Propose a trade"
              style={{ width: buttonWidth, height: 50 }}
              onPress={() =>
                router.push({ pathname: '/propose/[listingId]', params: { listingId: listing.id } })
              }
            />
          </Host>
        )}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    gap: Spacing.three,
    paddingBottom: Spacing.five,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 3,
  },
  review: {
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  reviewBody: {
    fontFamily: Fonts.serif,
    fontSize: 15,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  reviewMeta: {
    fontSize: 12,
  },
  notes: {
    fontFamily: Fonts.serif,
    fontSize: 17,
    lineHeight: 26,
    fontStyle: 'italic',
  },
  profileLink: {
    fontSize: 15,
    fontWeight: '600',
  },
  muted: {
    fontSize: 15,
    lineHeight: 22,
  },
  message: {
    fontSize: 15,
    lineHeight: 21,
  },
  actions: {
    width: '100%',
  },
});

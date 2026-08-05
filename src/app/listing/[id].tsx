import { Button, Host } from '@expo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  useWindowDimensions,
} from 'react-native';

import { RoastDots } from '@/components/roast-slider';
import { ScreenShell } from '@/components/screen-shell';
import { ListingDetailSkeleton } from '@/components/skeleton';
import { Colors, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { ROAST_LABEL, roastIndex, ROAST_LEVELS } from '@/lib/coffees';
import { closeListing, daysOffRoast, fetchListing } from '@/lib/listings';
import { queryKeys } from '@/lib/query';
import { fetchCoffeeReviews } from '@/lib/reviews';

function SpecRow({
  label,
  value,
  colors,
  children,
}: {
  label: string;
  value?: string;
  colors: (typeof Colors)['light' | 'dark'];
  children?: React.ReactNode;
}) {
  return (
    <View style={[styles.specRow, { borderBottomColor: colors.backgroundSelected }]}>
      <Text style={[styles.specLabel, { color: colors.textSecondary }]}>{label}</Text>
      {children ?? (
        <Text style={[styles.specValue, { color: colors.text }]}>{value}</Text>
      )}
    </View>
  );
}

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const { width } = useWindowDimensions();
  const buttonWidth = Math.min(width, MaxContentWidth) - 2 * Spacing.four;

  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: listing = null, isLoading } = useQuery({
    queryKey: queryKeys.listing(id ?? ''),
    queryFn: () => fetchListing(id as string),
    enabled: id != null,
  });
  const { data: reviews = [] } = useQuery({
    queryKey: queryKeys.coffeeReviews(listing?.coffee.id ?? ''),
    queryFn: () => fetchCoffeeReviews(listing!.coffee.id),
    enabled: listing != null,
  });
  const loaded = !isLoading;

  const isOwner = !!listing && listing.owner_id === session?.user.id;

  const removeListing = async () => {
    if (busy || !listing) return;
    setBusy(true);
    try {
      await closeListing(listing.id);
      queryClient.invalidateQueries({ queryKey: ['listings'] });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setBusy(false);
    }
  };

  if (!listing) {
    return (
      <ScreenShell title={loaded ? 'Not found' : ' '} edges={['bottom']}>
        {loaded ? (
          <Text style={[styles.muted, { color: colors.textSecondary }]}>
            This listing doesn't exist anymore.
          </Text>
        ) : (
          <ListingDetailSkeleton />
        )}
      </ScreenShell>
    );
  }

  const days = daysOffRoast(listing);
  const roastIdx = roastIndex(listing.coffee.roast_level);
  const owner = listing.owner;
  const ownerInitial = (owner?.display_name ?? owner?.username ?? '?')
    .charAt(0)
    .toUpperCase();

  return (
    <ScreenShell
      eyebrow={isOwner ? 'ON YOUR SHELF' : `TRADING FOR · ${listing.dose_grams}G`}
      title={listing.coffee.name}
      subtitle={`${listing.coffee.roaster.name}${listing.coffee.origin ? ` · ${listing.coffee.origin}` : ''}`}
      edges={['bottom']}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroRow}>
          <View style={[styles.heroTile, { backgroundColor: colors.backgroundElement }]}>
            <Text style={[styles.heroValue, { color: colors.text }]}>
              {listing.dose_grams}g
            </Text>
            <Text style={[styles.heroLabel, { color: colors.textSecondary }]}>DOSE</Text>
          </View>
          <View style={[styles.heroTile, { backgroundColor: colors.backgroundElement }]}>
            <Text style={[styles.heroValue, { color: colors.text }]}>
              {days == null ? '—' : days === 0 ? 'Today' : `${days}d`}
            </Text>
            <Text style={[styles.heroLabel, { color: colors.textSecondary }]}>OFF ROAST</Text>
          </View>
          <View style={[styles.heroTile, { backgroundColor: colors.backgroundElement }]}>
            {roastIdx != null ? (
              <RoastDots level={listing.coffee.roast_level} size={7} />
            ) : (
              <Text style={[styles.heroValue, { color: colors.text }]}>—</Text>
            )}
            <Text style={[styles.heroLabel, { color: colors.textSecondary }]}>
              {roastIdx != null
                ? ROAST_LABEL[ROAST_LEVELS[roastIdx]].toUpperCase()
                : 'ROAST'}
            </Text>
          </View>
        </View>

        <View style={[styles.specCard, { backgroundColor: colors.backgroundElement }]}>
          {listing.coffee.process != null && (
            <SpecRow label="PROCESS" value={listing.coffee.process} colors={colors} />
          )}
          {listing.coffee.varietal != null && (
            <SpecRow label="VARIETAL" value={listing.coffee.varietal} colors={colors} />
          )}
          {listing.coffee.origin != null && (
            <SpecRow label="ORIGIN" value={listing.coffee.origin} colors={colors} />
          )}
          {listing.roast_date != null && (
            <SpecRow label="ROASTED ON" value={listing.roast_date} colors={colors} />
          )}
        </View>

        {listing.coffee.roaster_notes != null && (
          <Text style={[styles.notes, { color: colors.textSecondary }]}>
            “{listing.coffee.roaster_notes}”
            <Text style={[styles.notesBy, { color: colors.textSecondary }]}>
              {'  —'} {listing.coffee.roaster.name}
            </Text>
          </Text>
        )}

        {!isOwner && owner != null && (
          <Pressable
            onPress={() =>
              router.push({ pathname: '/user/[id]', params: { id: listing.owner_id } })
            }
            style={({ pressed }) => [
              styles.ownerCard,
              { backgroundColor: colors.backgroundElement, opacity: pressed ? 0.85 : 1 },
            ]}>
            <View style={[styles.ownerAvatar, { backgroundColor: colors.backgroundSelected }]}>
              <Text style={[styles.ownerInitial, { color: colors.tint }]}>{ownerInitial}</Text>
            </View>
            <View style={styles.ownerText}>
              <Text style={[styles.ownerName, { color: colors.text }]}>
                {owner.display_name ?? `@${owner.username ?? 'someone'}`}
              </Text>
              <Text style={[styles.ownerMeta, { color: colors.textSecondary }]}>
                @{owner.username ?? 'someone'}
                {owner.city ? `  ·  ${owner.city}` : ''}
              </Text>
            </View>
            <Text style={[styles.ownerChevron, { color: colors.textSecondary }]}>›</Text>
          </Pressable>
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

        {error != null && (
          <Text style={[styles.message, { color: colors.danger }]}>{error}</Text>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {isOwner ? (
          listing.status === 'active' && (
            <Host matchContents seedColor={colors.tint}>
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
          <Host matchContents seedColor={colors.tint}>
            <Button
              variant="filled"
              label={`Offer a trade for this ${listing.dose_grams}g`}
              style={{ width: buttonWidth, height: 50 }}
              onPress={() =>
                router.push({ pathname: '/propose/[listingId]', params: { listingId: listing.id } })
              }
            />
          </Host>
        )}
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    gap: Spacing.three,
    paddingBottom: Spacing.four,
  },
  heroRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  heroTile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    borderRadius: 16,
    paddingVertical: Spacing.three,
  },
  heroValue: {
    fontFamily: Fonts.serif,
    fontSize: 22,
    fontWeight: '700',
  },
  heroLabel: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
  },
  specCard: {
    borderRadius: 16,
    paddingHorizontal: Spacing.three,
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.two + 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  specLabel: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
  },
  specValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  notes: {
    fontFamily: Fonts.serif,
    fontSize: 17,
    lineHeight: 26,
    fontStyle: 'italic',
  },
  notesBy: {
    fontSize: 13,
    fontStyle: 'normal',
  },
  ownerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
    borderRadius: 16,
    padding: Spacing.two + 2,
  },
  ownerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownerInitial: {
    fontFamily: Fonts.serif,
    fontSize: 20,
    fontWeight: '700',
  },
  ownerText: {
    flex: 1,
    gap: 1,
  },
  ownerName: {
    fontSize: 16,
    fontWeight: '600',
  },
  ownerMeta: {
    fontSize: 13,
  },
  ownerChevron: {
    fontSize: 24,
    lineHeight: 26,
  },
  sectionLabel: {
    fontFamily: Fonts.mono,
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
  muted: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    lineHeight: 21,
  },
  footer: {
    paddingTop: Spacing.two,
  },
});

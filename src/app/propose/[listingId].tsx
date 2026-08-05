import { Button, Host, TextInput } from '@expo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  useWindowDimensions,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { CoffeePicker } from '@/components/coffee-picker';
import { DoseChips } from '@/components/dose-chips';
import { Field } from '@/components/form-field';
import { ScreenShell } from '@/components/screen-shell';
import { ListingCardSkeleton } from '@/components/skeleton';
import { Colors, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { type Coffee } from '@/lib/coffees';
import {
  createProposal,
  fetchListing,
  fetchMyListings,
  type Listing,
} from '@/lib/listings';
import { queryKeys } from '@/lib/query';
import { createReview } from '@/lib/reviews';

/** One coffee going into the offer jar. */
type OfferItem = {
  key: string;
  coffee: Coffee;
  /** Set when the item is one of the proposer's own shelf listings. */
  listingId: string | null;
  dose: number | null;
};

function StepLabel({
  step,
  title,
  colors,
}: {
  step: string;
  title: string;
  colors: (typeof Colors)['light' | 'dark'];
}) {
  return (
    <View style={styles.stepRow}>
      <Text style={[styles.stepNumber, { color: colors.tint }]}>{step}</Text>
      <Text style={[styles.stepTitle, { color: colors.accent }]}>{title}</Text>
      <View style={[styles.stepRule, { backgroundColor: colors.backgroundSelected }]} />
    </View>
  );
}

/** Tap-to-toggle row for one of the proposer's own shelf listings. */
function ShelfRow({
  listing,
  selected,
  onToggle,
  colors,
}: {
  listing: Listing;
  selected: boolean;
  onToggle: () => void;
  colors: (typeof Colors)['light' | 'dark'];
}) {
  return (
    <Pressable
      onPress={onToggle}
      style={[
        styles.shelfRow,
        {
          backgroundColor: selected ? colors.backgroundSelected : colors.backgroundElement,
          borderColor: selected ? colors.tint : 'transparent',
        },
      ]}>
      <View
        style={[
          styles.checkDot,
          {
            borderColor: selected ? colors.tint : colors.textSecondary,
            backgroundColor: selected ? colors.tint : 'transparent',
          },
        ]}>
        {selected && <Text style={[styles.checkMark, { color: colors.background }]}>✓</Text>}
      </View>
      <View style={styles.shelfText}>
        <Text style={[styles.shelfName, { color: colors.text }]} numberOfLines={1}>
          {listing.coffee.name}
        </Text>
        <Text style={[styles.shelfMeta, { color: colors.textSecondary }]} numberOfLines={1}>
          {listing.coffee.roaster.name}
        </Text>
      </View>
      <Text style={[styles.shelfDose, { color: selected ? colors.tint : colors.textSecondary }]}>
        {listing.dose_grams}g
      </Text>
    </Pressable>
  );
}

export default function ProposeScreen() {
  const { listingId } = useLocalSearchParams<{ listingId: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const { width } = useWindowDimensions();
  const buttonWidth = Math.min(width, MaxContentWidth) - 2 * Spacing.four;

  const queryClient = useQueryClient();
  const [items, setItems] = useState<OfferItem[]>([]);
  const [picking, setPicking] = useState(false);
  const message = useRef('');
  const note = useRef('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const userId = session?.user.id;
  const { data: listing = null, isLoading } = useQuery({
    queryKey: queryKeys.listing(listingId ?? ''),
    queryFn: () => fetchListing(listingId as string),
    enabled: listingId != null,
  });
  const { data: myListings = [] } = useQuery({
    queryKey: queryKeys.myListings(userId ?? ''),
    queryFn: () => fetchMyListings(userId as string),
    enabled: userId != null,
  });
  const loaded = !isLoading;

  const shelf = myListings.filter((l) => l.status === 'active');
  const selectedListingIds = new Set(
    items.filter((i) => i.listingId != null).map((i) => i.listingId),
  );
  const libraryItems = items.filter((i) => i.listingId == null);
  const hasOffer = items.length > 0;

  const toggleShelf = (l: Listing) => {
    setError(null);
    setItems((prev) =>
      prev.some((i) => i.listingId === l.id)
        ? prev.filter((i) => i.listingId !== l.id)
        : [
            ...prev,
            { key: `shelf-${l.id}`, coffee: l.coffee, listingId: l.id, dose: l.dose_grams },
          ],
    );
  };

  const addLibraryCoffee = (coffee: Coffee | null) => {
    if (!coffee) return;
    setError(null);
    setPicking(false);
    setItems((prev) => [
      ...prev,
      { key: `lib-${coffee.id}-${prev.length}`, coffee, listingId: null, dose: 18 },
    ]);
  };

  const setDose = (key: string, dose: number | null) => {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, dose } : i)));
  };

  const removeItem = (key: string) => {
    setItems((prev) => prev.filter((i) => i.key !== key));
  };

  const totalGrams = items.reduce((sum, i) => sum + (i.dose ?? 0), 0);

  const sendProposal = async () => {
    if (busy || !session || !listing || !hasOffer) return;
    const badDose = items.find((i) => i.dose == null || i.dose < 5 || i.dose > 100);
    if (badDose) {
      setError(`Set a dose between 5g and 100g for ${badDose.coffee.name}.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await createProposal({
        listing_id: listing.id,
        message: message.current.trim() || null,
        items: items.map((i) => ({
          coffee_id: i.coffee.id,
          listing_id: i.listingId,
          dose_grams: i.dose as number,
        })),
      });
      if (result) {
        setError(result);
      } else {
        const body = note.current.trim();
        if (body && items.length === 1) {
          // Proposal already sent — a failed note shouldn't block it.
          await createReview({
            coffee_id: items[0].coffee.id,
            author_id: session.user.id,
            context: 'proposal',
            body,
          }).catch(() => {});
        }
        queryClient.invalidateQueries({ queryKey: ['proposals'] });
        queryClient.invalidateQueries({ queryKey: ['reviews'] });
        router.dismissTo('/(tabs)');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  if (!listing || listing.status !== 'active') {
    return (
      <ScreenShell title={loaded ? 'Unavailable' : ' '} edges={['bottom']}>
        {loaded ? (
          <Text style={[styles.muted, { color: colors.textSecondary }]}>
            This listing is no longer available for proposals.
          </Text>
        ) : (
          <ListingCardSkeleton />
        )}
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      eyebrow="PROPOSE A TRADE"
      title={`For ${listing.coffee.name}`}
      subtitle={`${listing.dose_grams}g dose from @${listing.owner?.username ?? 'someone'}`}
      edges={['bottom']}>
      <KeyboardAwareScrollView
        showsVerticalScrollIndicator={false}
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        bottomOffset={24}>
        <StepLabel step="01" title="YOUR OFFER" colors={colors} />
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          Put one or more coffees in the jar — off your shelf, from your library, or both.
        </Text>

        {shelf.length > 0 && (
          <>
            <Text style={[styles.groupLabel, { color: colors.textSecondary }]}>
              FROM YOUR SHELF
            </Text>
            {shelf.map((l) => (
              <ShelfRow
                key={l.id}
                listing={l}
                selected={selectedListingIds.has(l.id)}
                onToggle={() => toggleShelf(l)}
                colors={colors}
              />
            ))}
          </>
        )}

        {(libraryItems.length > 0 || picking) && (
          <Text style={[styles.groupLabel, { color: colors.textSecondary }]}>
            FROM YOUR LIBRARY
          </Text>
        )}
        {libraryItems.map((item) => (
          <View
            key={item.key}
            style={[
              styles.libraryCard,
              { backgroundColor: colors.backgroundElement, borderColor: colors.tint },
            ]}>
            <View style={styles.libraryHeader}>
              <View style={styles.libraryText}>
                <Text style={[styles.shelfName, { color: colors.text }]} numberOfLines={1}>
                  {item.coffee.name}
                </Text>
                <Text style={[styles.shelfMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                  {item.coffee.roaster.name}
                </Text>
              </View>
              <Pressable onPress={() => removeItem(item.key)} hitSlop={8}>
                <Text style={[styles.removeLink, { color: colors.textSecondary }]}>Remove</Text>
              </Pressable>
            </View>
            <DoseChips value={item.dose} onChange={(d) => setDose(item.key, d)} />
          </View>
        ))}

        {picking ? (
          <>
            <CoffeePicker selected={null} onSelect={addLibraryCoffee} />
            <Pressable onPress={() => setPicking(false)} hitSlop={8}>
              <Text style={[styles.cancelLink, { color: colors.textSecondary }]}>Cancel</Text>
            </Pressable>
          </>
        ) : (
          <Pressable onPress={() => setPicking(true)} hitSlop={8}>
            <Text style={[styles.addLink, { color: colors.tint }]}>
              + Add a coffee from your library
            </Text>
          </Pressable>
        )}

        {hasOffer && (
          <>
            <StepLabel step="02" title="THE DEAL" colors={colors} />
            <View style={[styles.summary, { backgroundColor: colors.backgroundElement }]}>
              {items.map((item) => (
                <Text
                  key={item.key}
                  style={[styles.summaryText, { color: colors.textSecondary }]}>
                  {item.dose ?? '—'}g of {item.coffee.name}
                  {item.listingId != null ? '  · shelf' : ''}
                </Text>
              ))}
              <Text style={[styles.summaryTotal, { color: colors.text }]}>
                {totalGrams}g total{'  ⇄  '}
                {listing.dose_grams}g of {listing.coffee.name}
              </Text>
            </View>

            <Field
              label={`MESSAGE TO @${listing.owner?.username?.toUpperCase() ?? 'THEM'} (OPTIONAL)`}
              colors={colors}
              inputHeight={72}>
              <TextInput
                placeholder="Would love to swap a dose of this for your bag."
                multiline
                numberOfLines={3}
                onChangeText={(t) => {
                  message.current = t;
                }}
              />
            </Field>

            {items.length === 1 && (
              <Field label="A WORD ON YOUR COFFEE" colors={colors} inputHeight={72}>
                <TextInput
                  placeholder="How it brews for you — recipe, impressions…"
                  multiline
                  numberOfLines={3}
                  onChangeText={(t) => {
                    note.current = t;
                  }}
                />
              </Field>
            )}

            {error != null && (
              <Text style={[styles.message, { color: colors.danger }]}>{error}</Text>
            )}

            <Host matchContents seedColor={colors.tint} style={styles.actions}>
              <Button
                variant="filled"
                label={busy ? 'Sending…' : 'Send proposal'}
                disabled={busy}
                style={{ width: buttonWidth, height: 50 }}
                onPress={sendProposal}
              />
            </Host>
          </>
        )}
      </KeyboardAwareScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    gap: Spacing.two,
    paddingBottom: Spacing.five,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  stepNumber: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    fontWeight: '700',
  },
  stepTitle: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 3,
  },
  stepRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth * 2,
  },
  hint: {
    fontSize: 14,
    lineHeight: 20,
  },
  groupLabel: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 1.5,
    marginTop: Spacing.one,
  },
  shelfRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
  },
  checkDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 16,
  },
  shelfText: {
    flex: 1,
    gap: 1,
  },
  shelfName: {
    fontSize: 16,
    fontWeight: '600',
  },
  shelfMeta: {
    fontSize: 13,
  },
  shelfDose: {
    fontFamily: Fonts.mono,
    fontSize: 14,
    fontWeight: '600',
  },
  libraryCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  libraryHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  libraryText: {
    flex: 1,
    gap: 1,
  },
  removeLink: {
    fontSize: 14,
    fontWeight: '600',
  },
  addLink: {
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: Spacing.one,
  },
  cancelLink: {
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: Spacing.one,
  },
  summary: {
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  summaryText: {
    fontFamily: Fonts.mono,
    fontSize: 14,
    lineHeight: 22,
  },
  summaryTotal: {
    fontFamily: Fonts.mono,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '700',
    marginTop: Spacing.one,
  },
  message: {
    fontSize: 15,
    lineHeight: 21,
  },
  muted: {
    fontSize: 15,
    lineHeight: 22,
  },
  actions: {
    width: '100%',
    marginTop: Spacing.two,
  },
});

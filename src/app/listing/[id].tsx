import { Button, Host, TextInput } from '@expo/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  useWindowDimensions,
} from 'react-native';

import { Field } from '@/components/form-field';
import { ListingCard } from '@/components/listing-card';
import { ScreenShell } from '@/components/screen-shell';
import { Colors, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import {
  closeListing,
  createProposal,
  fetchListing,
  fetchMyListings,
  type Listing,
} from '@/lib/listings';

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const { width } = useWindowDimensions();
  const buttonWidth = Math.min(width, MaxContentWidth) - 2 * Spacing.four;

  const [listing, setListing] = useState<Listing | null>(null);
  const [myListings, setMyListings] = useState<Listing[]>([]);
  const [offerId, setOfferId] = useState<string | null>(null);
  const message = useRef('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const isOwner = !!listing && listing.owner_id === session?.user.id;

  const load = useCallback(async () => {
    if (!id || !session) return;
    try {
      const [target, mine] = await Promise.all([
        fetchListing(id),
        fetchMyListings(session.user.id),
      ]);
      setListing(target);
      setMyListings(mine.filter((l) => l.status === 'active' && l.id !== id));
    } finally {
      setLoaded(true);
    }
  }, [id, session]);

  useEffect(() => {
    load();
  }, [load]);

  const sendProposal = async () => {
    if (busy || !session || !listing) return;
    if (!offerId) {
      setError('Pick one of your coffees to offer.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await createProposal({
        listing_id: listing.id,
        proposer_id: session.user.id,
        offered_listing_id: offerId,
        message: message.current.trim() || null,
      });
      if (result) {
        setError(result);
      } else {
        router.back();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

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
      title={listing.coffee_name}
      subtitle={`${listing.roaster}${listing.origin ? ` · ${listing.origin}` : ''}`}
      edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          <ListingCard listing={listing} hideOwner={isOwner} />

          {listing.notes != null && (
            <Text style={[styles.notes, { color: colors.textSecondary }]}>
              “{listing.notes}”
            </Text>
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
            <>
              <Text style={[styles.sectionLabel, { color: colors.accent }]}>
                YOUR OFFER
              </Text>
              {myListings.length === 0 ? (
                <Text style={[styles.muted, { color: colors.textSecondary }]}>
                  You need an active listing to trade. Share a dose first, then come
                  back with something to offer.
                </Text>
              ) : (
                <View style={styles.offers}>
                  {myListings.map((mine) => {
                    const selected = offerId === mine.id;
                    return (
                      <Pressable
                        key={mine.id}
                        onPress={() => setOfferId(selected ? null : mine.id)}
                        style={[
                          styles.offer,
                          {
                            backgroundColor: selected
                              ? colors.backgroundSelected
                              : colors.backgroundElement,
                            borderColor: selected ? colors.tint : 'transparent',
                          },
                        ]}>
                        <View style={styles.offerText}>
                          <Text
                            style={[styles.offerName, { color: colors.text }]}
                            numberOfLines={1}>
                            {mine.coffee_name}
                          </Text>
                          <Text
                            style={[styles.offerMeta, { color: colors.textSecondary }]}
                            numberOfLines={1}>
                            {mine.roaster} · {mine.dose_grams}g dose
                          </Text>
                        </View>
                        <Text style={[styles.offerMark, { color: colors.tint }]}>
                          {selected ? '●' : '○'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              <Field label="MESSAGE (OPTIONAL)" colors={colors}>
                <TextInput
                  placeholder="Would love to swap a dose of this for your bag."
                  multiline
                  onChangeText={(t) => {
                    message.current = t;
                  }}
                />
              </Field>

              {error != null && (
                <Text style={[styles.message, { color: colors.danger }]}>{error}</Text>
              )}

              <Host matchContents seedColor={colors.tint} style={styles.actions}>
                <Button
                  variant="filled"
                  label={busy ? 'Sending…' : 'Send proposal'}
                  disabled={busy || myListings.length === 0}
                  style={{ width: buttonWidth, height: 50 }}
                  onPress={sendProposal}
                />
              </Host>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
  notes: {
    fontFamily: Fonts.serif,
    fontSize: 17,
    lineHeight: 26,
    fontStyle: 'italic',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 3,
  },
  offers: {
    gap: Spacing.two,
  },
  offer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
  },
  offerText: {
    flex: 1,
    gap: 2,
  },
  offerName: {
    fontSize: 16,
    fontWeight: '600',
  },
  offerMeta: {
    fontSize: 13,
  },
  offerMark: {
    fontSize: 18,
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

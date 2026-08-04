import { Button, Host, TextInput } from '@expo/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  useWindowDimensions,
} from 'react-native';

import { CoffeePicker } from '@/components/coffee-picker';
import { Field } from '@/components/form-field';
import { ListingCard } from '@/components/listing-card';
import { ScreenShell } from '@/components/screen-shell';
import { Colors, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { closeListing, createProposal, fetchListing, type Listing } from '@/lib/listings';

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const { width } = useWindowDimensions();
  const buttonWidth = Math.min(width, MaxContentWidth) - 2 * Spacing.four;

  const [listing, setListing] = useState<Listing | null>(null);
  const [offeredCoffeeId, setOfferedCoffeeId] = useState<string | null>(null);
  const doseGrams = useRef('18');
  const message = useRef('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const isOwner = !!listing && listing.owner_id === session?.user.id;

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setListing(await fetchListing(id));
    } finally {
      setLoaded(true);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const sendProposal = async () => {
    if (busy || !session || !listing) return;
    if (!offeredCoffeeId) {
      setError('Pick a coffee to offer.');
      return;
    }
    const dose = Number.parseInt(doseGrams.current, 10);
    if (!Number.isFinite(dose) || dose < 5 || dose > 100) {
      setError('Offered dose should be between 5g and 100g.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await createProposal({
        listing_id: listing.id,
        proposer_id: session.user.id,
        offered_coffee_id: offeredCoffeeId,
        offered_dose_grams: dose,
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
      title={listing.coffee.name}
      subtitle={`${listing.coffee.roaster}${listing.coffee.origin ? ` · ${listing.coffee.origin}` : ''}`}
      edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          <ListingCard listing={listing} hideOwner={isOwner} />

          {listing.coffee.tasting_notes != null && (
            <Text style={[styles.notes, { color: colors.textSecondary }]}>
              “{listing.coffee.tasting_notes}”
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
              <CoffeePicker
                selectedId={offeredCoffeeId}
                onSelect={(c) => setOfferedCoffeeId(c.id)}
              />

              <Field label="DOSE YOU'LL GIVE (GRAMS)" colors={colors}>
                <TextInput
                  placeholder="18"
                  defaultValue="18"
                  keyboardType="number-pad"
                  onChangeText={(t) => {
                    doseGrams.current = t;
                  }}
                />
              </Field>

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
                  disabled={busy}
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

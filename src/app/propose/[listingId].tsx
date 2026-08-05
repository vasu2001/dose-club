import { Button, Host, TextInput } from '@expo/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  useWindowDimensions,
} from 'react-native';

import { CoffeePicker } from '@/components/coffee-picker';
import { Field } from '@/components/form-field';
import { ScreenShell } from '@/components/screen-shell';
import { Colors, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { createProposal, fetchListing, type Listing } from '@/lib/listings';
import { createReview } from '@/lib/reviews';

export default function ProposeScreen() {
  const { listingId } = useLocalSearchParams<{ listingId: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const { width } = useWindowDimensions();
  const buttonWidth = Math.min(width, MaxContentWidth) - 2 * Spacing.four;

  const [listing, setListing] = useState<Listing | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [offeredCoffeeId, setOfferedCoffeeId] = useState<string | null>(null);
  const doseGrams = useRef('18');
  const message = useRef('');
  const note = useRef('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!listingId) return;
    try {
      setListing(await fetchListing(listingId));
    } finally {
      setLoaded(true);
    }
  }, [listingId]);

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
        const body = note.current.trim();
        if (body) {
          // Proposal already sent — a failed note shouldn't block it.
          await createReview({
            coffee_id: offeredCoffeeId,
            author_id: session.user.id,
            context: 'proposal',
            body,
          }).catch(() => {});
        }
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
      <ScreenShell title={loaded ? 'Unavailable' : 'Loading…'} edges={['bottom']}>
        {loaded && (
          <Text style={[styles.muted, { color: colors.textSecondary }]}>
            This listing is no longer available for proposals.
          </Text>
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
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          <Text style={[styles.sectionLabel, { color: colors.accent }]}>YOUR OFFER</Text>
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

          <Field label="YOUR NOTE ON THIS COFFEE (OPTIONAL, PUBLIC)" colors={colors}>
            <TextInput
              placeholder="How it brews for you — recipes, impressions…"
              multiline
              onChangeText={(t) => {
                note.current = t;
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

          <View style={[styles.summary, { backgroundColor: colors.backgroundElement }]}>
            <Text style={[styles.summaryText, { color: colors.textSecondary }]}>
              You give a dose of your coffee · you get {listing.dose_grams}g of{' '}
              {listing.coffee.name}.
            </Text>
          </View>

          <Host matchContents seedColor={colors.tint} style={styles.actions}>
            <Button
              variant="filled"
              label={busy ? 'Sending…' : 'Send proposal'}
              disabled={busy}
              style={{ width: buttonWidth, height: 50 }}
              onPress={sendProposal}
            />
          </Host>
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
    gap: Spacing.two,
    paddingBottom: Spacing.five,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 3,
    marginTop: Spacing.two,
  },
  summary: {
    borderRadius: 16,
    padding: Spacing.three,
  },
  summaryText: {
    fontFamily: Fonts.serif,
    fontSize: 15,
    lineHeight: 22,
    fontStyle: 'italic',
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

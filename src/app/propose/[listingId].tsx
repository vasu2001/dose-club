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
import { DoseChips } from '@/components/dose-chips';
import { Field } from '@/components/form-field';
import { ScreenShell } from '@/components/screen-shell';
import { Colors, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { type Coffee } from '@/lib/coffees';
import { createProposal, fetchListing, type Listing } from '@/lib/listings';
import { createReview } from '@/lib/reviews';

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
  const [coffee, setCoffee] = useState<Coffee | null>(null);
  const [dose, setDose] = useState<number | null>(18);
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
    if (busy || !session || !listing || !coffee) return;
    if (dose == null || dose < 5 || dose > 100) {
      setError('Offered dose should be between 5g and 100g.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await createProposal({
        listing_id: listing.id,
        proposer_id: session.user.id,
        offered_coffee_id: coffee.id,
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
            coffee_id: coffee.id,
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
        behavior={Platform.OS === 'ios' ? undefined : 'height'}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets>
          <StepLabel step="01" title="YOUR OFFER" colors={colors} />
          <CoffeePicker selected={coffee} onSelect={setCoffee} />

          {coffee != null && (
            <>
              <StepLabel step="02" title="THE DEAL" colors={colors} />
              <Text style={[styles.hint, { color: colors.textSecondary }]}>
                How much of yours goes in the jar?
              </Text>
              <DoseChips value={dose} onChange={setDose} />

              <View style={[styles.summary, { backgroundColor: colors.backgroundElement }]}>
                <Text style={[styles.summaryText, { color: colors.textSecondary }]}>
                  {dose ?? '—'}g of {coffee.name}{'  ⇄  '}
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

              {error != null && (
                <Text style={[styles.message, { color: colors.danger }]}>{error}</Text>
              )}

              <Host matchContents seedColor={colors.tint} style={styles.actions}>
                <Button
                  variant="filled"
                  label={busy ? 'Sending…' : 'Send proposal'}
                  disabled={busy || dose == null}
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
  summary: {
    borderRadius: 16,
    padding: Spacing.three,
  },
  summaryText: {
    fontFamily: Fonts.mono,
    fontSize: 14,
    lineHeight: 22,
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

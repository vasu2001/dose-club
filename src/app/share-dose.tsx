import { Button, Host, TextInput } from '@expo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
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
import { Colors, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { fetchBag } from '@/lib/bags';
import { type Coffee } from '@/lib/coffees';
import { createListing } from '@/lib/listings';
import { queryKeys } from '@/lib/query';
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

export default function ShareDoseScreen() {
  const { session } = useAuth();
  const { bagId } = useLocalSearchParams<{ bagId?: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const { width } = useWindowDimensions();
  const buttonWidth = Math.min(width, MaxContentWidth) - 2 * Spacing.four;

  const [coffee, setCoffee] = useState<Coffee | null>(null);
  const [dose, setDose] = useState<number | null>(18);
  const note = useRef('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Sharing from a stash bag: the coffee comes from the bag, and the roast
  // date is the bag's — never entered here.
  const { data: bag } = useQuery({
    queryKey: queryKeys.bag(bagId ?? ''),
    queryFn: () => fetchBag(bagId as string),
    enabled: !!bagId,
  });
  useEffect(() => {
    if (bag) setCoffee(bag.coffee);
  }, [bag]);

  const submit = async () => {
    if (busy || !session || !coffee) return;
    if (dose == null || dose < 5 || dose > 100) {
      setError('Dose should be between 5g and 100g.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Only link the bag if the user kept its coffee (they can swap in the
      // picker) and the bag still exists.
      const fromBag = bag != null && coffee.id === bag.coffee.id;
      const message = await createListing(session.user.id, {
        coffee_id: coffee.id,
        bag_id: fromBag ? bag.id : null,
        roast_date: fromBag ? bag.roast_date : null,
        dose_grams: dose,
      });
      if (message) {
        setError(message);
      } else {
        const body = note.current.trim();
        if (body) {
          // The listing is up either way — a failed note shouldn't block it.
          await createReview({
            coffee_id: coffee.id,
            author_id: session.user.id,
            context: 'listing',
            body,
          }).catch(() => {});
        }
        queryClient.invalidateQueries({ queryKey: ['listings'] });
        queryClient.invalidateQueries({ queryKey: ['reviews'] });
        router.back();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenShell
      eyebrow="SHARE A DOSE"
      title="Put a coffee up"
      subtitle="What are you brewing? Someone out there wants a taste."
      edges={['bottom']}>
      <KeyboardAwareScrollView
        showsVerticalScrollIndicator={false}
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        bottomOffset={24}>
          <StepLabel step="01" title="THE COFFEE" colors={colors} />
          <CoffeePicker selected={coffee} onSelect={setCoffee} />

          {coffee != null && (
            <>
              <StepLabel step="02" title="THE DOSE" colors={colors} />
              <Text style={[styles.hint, { color: colors.textSecondary }]}>
                How big a dose are you sharing?
              </Text>
              <DoseChips value={dose} onChange={setDose} />

              <Field label="A WORD FROM YOU" colors={colors} inputHeight={72}>
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
                  label={busy ? 'Listing…' : `Share ${dose ?? '—'}g of ${coffee.name}`}
                  disabled={busy || dose == null}
                  style={{ width: buttonWidth, height: 50 }}
                  onPress={submit}
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
  message: {
    fontSize: 15,
    lineHeight: 21,
  },
  actions: {
    width: '100%',
    marginTop: Spacing.two,
  },
});

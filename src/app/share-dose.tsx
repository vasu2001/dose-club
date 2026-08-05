import { Button, Host, TextInput } from '@expo/ui';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
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
import { createListing } from '@/lib/listings';
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
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const { width } = useWindowDimensions();
  const buttonWidth = Math.min(width, MaxContentWidth) - 2 * Spacing.four;

  const [coffee, setCoffee] = useState<Coffee | null>(null);
  const [dose, setDose] = useState<number | null>(18);
  const roastDate = useRef('');
  const note = useRef('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy || !session || !coffee) return;
    if (dose == null || dose < 5 || dose > 100) {
      setError('Dose should be between 5g and 100g.');
      return;
    }
    const date = roastDate.current.trim();
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError('Roast date should look like 2026-07-28.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const message = await createListing(session.user.id, {
        coffee_id: coffee.id,
        roast_date: date || null,
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
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          <StepLabel step="01" title="THE COFFEE" colors={colors} />
          <CoffeePicker selected={coffee} onSelect={setCoffee} />

          {coffee != null && (
            <>
              <StepLabel step="02" title="THE BAG" colors={colors} />
              <Text style={[styles.hint, { color: colors.textSecondary }]}>
                How big a dose are you sharing?
              </Text>
              <DoseChips value={dose} onChange={setDose} />

              <Field label="ROASTED ON (OPTIONAL, YYYY-MM-DD)" colors={colors}>
                <TextInput
                  placeholder="2026-07-28"
                  keyboardType="numbers-and-punctuation"
                  autoCorrect={false}
                  onChangeText={(t) => {
                    roastDate.current = t;
                  }}
                />
              </Field>

              <Field label="A WORD FROM YOU (OPTIONAL, PUBLIC)" colors={colors}>
                <TextInput
                  placeholder="How it brews for you — recipe, impressions…"
                  multiline
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

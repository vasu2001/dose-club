import { Button, Host, TextInput } from '@expo/ui';
import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
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

import { CoffeePicker } from '@/components/coffee-picker';
import { DoseChips } from '@/components/dose-chips';
import { Field } from '@/components/form-field';
import { ScreenShell } from '@/components/screen-shell';
import { Colors, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { type Coffee } from '@/lib/coffees';
import { createListing } from '@/lib/listings';
import { createReview } from '@/lib/reviews';

/** Local YYYY-MM-DD (toISOString would shift the day across timezones). */
function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

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
  const [roastDate, setRoastDate] = useState<Date | null>(null);
  // "+ Add date" opens an inline calendar; nothing is picked until a tap.
  const [pickingDate, setPickingDate] = useState(false);
  const note = useRef('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy || !session || !coffee) return;
    if (dose == null || dose < 5 || dose > 100) {
      setError('Dose should be between 5g and 100g.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const message = await createListing(session.user.id, {
        coffee_id: coffee.id,
        roast_date: roastDate ? toIsoDate(roastDate) : null,
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

              <View style={[styles.dateCard, { backgroundColor: colors.backgroundElement }]}>
                <View style={styles.dateRow}>
                  <View style={styles.dateText}>
                    <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>
                      ROASTED ON
                    </Text>
                    {roastDate == null && !pickingDate && (
                      <Text style={[styles.dateHint, { color: colors.textSecondary }]}>
                        Fresher reads better on the shelf.
                      </Text>
                    )}
                  </View>
                  {roastDate != null ? (
                    <View style={styles.dateControls}>
                      <Pressable
                        onPress={() => {
                          setRoastDate(null);
                          setPickingDate(false);
                        }}
                        hitSlop={8}>
                        <Text style={[styles.dateClear, { color: colors.textSecondary }]}>
                          ✕
                        </Text>
                      </Pressable>
                      <DateTimePicker
                        value={roastDate}
                        mode="date"
                        display="compact"
                        maximumDate={new Date()}
                        accentColor={colors.tint}
                        style={styles.datePicker}
                        onValueChange={(_, date) => setRoastDate(date)}
                      />
                    </View>
                  ) : (
                    <Pressable onPress={() => setPickingDate((v) => !v)} hitSlop={8}>
                      <Text style={[styles.dateAdd, { color: colors.tint }]}>
                        {pickingDate ? 'Cancel' : '+ Add date'}
                      </Text>
                    </Pressable>
                  )}
                </View>
                {pickingDate && roastDate == null && (
                  <DateTimePicker
                    value={new Date()}
                    mode="date"
                    display="inline"
                    maximumDate={new Date()}
                    accentColor={colors.tint}
                    style={styles.dateCalendar}
                    onValueChange={(_, date) => {
                      setRoastDate(date);
                      setPickingDate(false);
                    }}
                  />
                )}
              </View>

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
  dateCard: {
    gap: Spacing.two,
    borderRadius: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    minHeight: 56,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 36,
  },
  dateText: {
    flex: 1,
    gap: 2,
  },
  dateCalendar: {
    width: '100%',
    height: 330,
  },
  dateLabel: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  dateHint: {
    fontSize: 13,
  },
  dateControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  datePicker: {
    width: 118,
    height: 36,
  },
  dateClear: {
    fontSize: 15,
    paddingHorizontal: Spacing.one,
  },
  dateAdd: {
    fontSize: 15,
    fontWeight: '600',
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

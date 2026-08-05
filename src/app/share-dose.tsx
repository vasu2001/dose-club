import { Button, Host, TextInput } from '@expo/ui';
import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Modal,
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
  const queryClient = useQueryClient();
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
              <StepLabel step="02" title="THE BAG" colors={colors} />
              <Text style={[styles.hint, { color: colors.textSecondary }]}>
                How big a dose are you sharing?
              </Text>
              <DoseChips value={dose} onChange={setDose} />

              <View style={[styles.dateCard, { backgroundColor: colors.backgroundElement }]}>
                <View style={styles.dateText}>
                  <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>
                    ROASTED ON
                  </Text>
                  {roastDate == null && (
                    <Text style={[styles.dateHint, { color: colors.textSecondary }]}>
                      Fresher reads better on the shelf.
                    </Text>
                  )}
                </View>
                {roastDate != null ? (
                  <View style={styles.dateControls}>
                    <Pressable
                      onPress={() => setPickingDate(true)}
                      style={[styles.datePill, { backgroundColor: colors.backgroundSelected }]}>
                      <Text style={[styles.datePillText, { color: colors.text }]}>
                        {roastDate.toLocaleDateString(undefined, {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </Text>
                    </Pressable>
                    <Pressable onPress={() => setRoastDate(null)} hitSlop={8}>
                      <Text style={[styles.dateClear, { color: colors.textSecondary }]}>✕</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable onPress={() => setPickingDate(true)} hitSlop={8}>
                    <Text style={[styles.dateAdd, { color: colors.tint }]}>+ Add date</Text>
                  </Pressable>
                )}
              </View>

              <Modal
                visible={pickingDate}
                transparent
                animationType="slide"
                onRequestClose={() => setPickingDate(false)}>
                <Pressable style={styles.backdrop} onPress={() => setPickingDate(false)} />
                <View style={[styles.dateSheet, { backgroundColor: colors.background }]}>
                  <View
                    style={[styles.grabber, { backgroundColor: colors.backgroundSelected }]}
                  />
                  <Text style={[styles.dateSheetTitle, { color: colors.text }]}>
                    Roasted on
                  </Text>
                  <DateTimePicker
                    value={roastDate ?? new Date()}
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
                </View>
              </Modal>

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
  dateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    minHeight: 56,
  },
  dateText: {
    flex: 1,
    gap: 2,
  },
  datePill: {
    borderRadius: 10,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.one + 2,
  },
  datePillText: {
    fontSize: 15,
    fontWeight: '600',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  dateSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.two,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    marginBottom: Spacing.one,
  },
  dateSheetTitle: {
    fontFamily: Fonts.serif,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
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
    gap: Spacing.one,
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

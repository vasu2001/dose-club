import { Button, Host, TextInput } from '@expo/ui';
import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
  useColorScheme,
  useWindowDimensions,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { CoffeePicker } from '@/components/coffee-picker';
import { Field } from '@/components/form-field';
import { ScreenShell } from '@/components/screen-shell';
import { Colors, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { createBag } from '@/lib/bags';
import { type Coffee } from '@/lib/coffees';
import { queryKeys } from '@/lib/query';

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

export default function AddBagScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const { width } = useWindowDimensions();
  const buttonWidth = Math.min(width, MaxContentWidth) - 2 * Spacing.four;

  const [coffee, setCoffee] = useState<Coffee | null>(null);
  const [size, setSize] = useState('250');
  const [roastDate, setRoastDate] = useState<Date | null>(null);
  const [pickingDate, setPickingDate] = useState(false);
  const [frozen, setFrozen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy || !session || !coffee) return;
    const grams = size.trim() === '' ? null : Number(size);
    if (grams != null && (!Number.isInteger(grams) || grams < 5 || grams > 2000)) {
      setError('Bag size should be between 5g and 2000g (or leave it empty).');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createBag(session.user.id, {
        coffee_id: coffee.id,
        roast_date: roastDate ? toIsoDate(roastDate) : null,
        size_grams: grams,
        frozen,
      });
      queryClient.invalidateQueries({ queryKey: ['bags'] });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenShell
      eyebrow="ADD TO STASH"
      title="A new bag"
      subtitle="Track what you own — freshness, freezer time, all of it."
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

            <View style={[styles.dateCard, { backgroundColor: colors.backgroundElement }]}>
              <View style={styles.dateText}>
                <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>
                  ROASTED ON
                </Text>
                {roastDate == null && (
                  <Text style={[styles.dateHint, { color: colors.textSecondary }]}>
                    Needed for rested-days tracking.
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

            <Field label="BAG SIZE (GRAMS)" colors={colors}>
              <TextInput
                placeholder="250"
                keyboardType="number-pad"
                defaultValue={size}
                onChangeText={setSize}
              />
            </Field>

            <View style={[styles.dateCard, { backgroundColor: colors.backgroundElement }]}>
              <View style={styles.dateText}>
                <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>
                  STRAIGHT TO THE FREEZER
                </Text>
                <Text style={[styles.dateHint, { color: colors.textSecondary }]}>
                  Freezing pauses the rest clock.
                </Text>
              </View>
              <Switch
                value={frozen}
                onValueChange={setFrozen}
                trackColor={{ true: colors.tint }}
              />
            </View>

            {error != null && (
              <Text style={[styles.message, { color: colors.danger }]}>{error}</Text>
            )}

            <Host matchContents seedColor={colors.tint} style={styles.actions}>
              <Button
                variant="filled"
                label={busy ? 'Adding…' : `Add ${coffee.name} to stash`}
                disabled={busy}
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
  datePill: {
    borderRadius: 10,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.one + 2,
  },
  datePillText: {
    fontSize: 15,
    fontWeight: '600',
  },
  dateClear: {
    fontSize: 15,
    paddingHorizontal: Spacing.one,
  },
  dateAdd: {
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
  message: {
    fontSize: 15,
    lineHeight: 21,
  },
  actions: {
    width: '100%',
    marginTop: Spacing.two,
  },
});

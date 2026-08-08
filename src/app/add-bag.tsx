import { Button, Host, TextInput } from '@expo/ui';
import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { createBag, fetchMyBags } from '@/lib/bags';
import { type Coffee } from '@/lib/coffees';
import { queryKeys } from '@/lib/query';

/** Local YYYY-MM-DD (toISOString would shift the day across timezones). */
function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const STEPS = [
  { eyebrow: 'ADD TO STASH · 1 OF 3', title: 'The coffee', subtitle: 'What did you get?' },
  {
    eyebrow: 'ADD TO STASH · 2 OF 3',
    title: 'The bag',
    subtitle: 'Roast date drives rest tracking — dig out the label.',
  },
  {
    eyebrow: 'ADD TO STASH · 3 OF 3',
    title: 'Storage',
    subtitle: 'Freezing pauses the rest clock.',
  },
] as const;

/** Tappable row that opens a calendar sheet; used for both dates. */
function DateRow({
  label,
  hint,
  value,
  onPress,
  onClear,
  colors,
}: {
  label: string;
  hint: string;
  value: Date | null;
  onPress: () => void;
  onClear?: () => void;
  colors: (typeof Colors)['light' | 'dark'];
}) {
  return (
    <View style={[styles.rowCard, { backgroundColor: colors.backgroundElement }]}>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>{label}</Text>
        {value == null && (
          <Text style={[styles.rowHint, { color: colors.textSecondary }]}>{hint}</Text>
        )}
      </View>
      {value != null ? (
        <View style={styles.rowControls}>
          <Pressable
            onPress={onPress}
            style={[styles.datePill, { backgroundColor: colors.backgroundSelected }]}>
            <Text style={[styles.datePillText, { color: colors.text }]}>
              {formatDate(value)}
            </Text>
          </Pressable>
          {onClear != null && (
            <Pressable onPress={onClear} hitSlop={8}>
              <Text style={[styles.rowClear, { color: colors.textSecondary }]}>✕</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <Pressable onPress={onPress} hitSlop={8}>
          <Text style={[styles.rowAdd, { color: colors.tint }]}>+ Add date</Text>
        </Pressable>
      )}
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

  const [step, setStep] = useState(0);
  const [coffee, setCoffee] = useState<Coffee | null>(null);
  const [roastDate, setRoastDate] = useState<Date | null>(null);
  const [size, setSize] = useState('250');
  const [frozen, setFrozen] = useState(false);
  const [frozenSince, setFrozenSince] = useState<Date | null>(null);
  const [picking, setPicking] = useState<'roast' | 'frozen' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Suggest club discoveries rather than what's already on the shelf.
  const userId = session?.user.id;
  const { data: myBags = [] } = useQuery({
    queryKey: queryKeys.myBags(userId ?? ''),
    queryFn: () => fetchMyBags(userId as string),
    enabled: userId != null,
  });
  const stashCoffeeIds = myBags.map((b) => b.coffee_id);

  const grams = size.trim() === '' ? null : Number(size);
  const gramsValid = grams == null || (Number.isInteger(grams) && grams >= 5 && grams <= 2000);

  const next = () => {
    if (step === 1 && !gramsValid) {
      setError('Bag size should be between 5g and 2000g (or leave it empty).');
      return;
    }
    setError(null);
    setStep((s) => s + 1);
  };

  const back = () => {
    setError(null);
    if (step === 0) router.back();
    else setStep((s) => s - 1);
  };

  const submit = async () => {
    if (busy || !session || !coffee) return;
    setBusy(true);
    setError(null);
    try {
      await createBag(session.user.id, {
        coffee_id: coffee.id,
        roast_date: roastDate ? toIsoDate(roastDate) : null,
        size_grams: grams,
        frozen,
        frozen_since: frozen ? frozenSince : null,
      });
      queryClient.invalidateQueries({ queryKey: ['bags'] });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const { eyebrow, title, subtitle } = STEPS[step];

  return (
    <ScreenShell eyebrow={eyebrow} title={title} subtitle={subtitle} edges={['bottom']}>
      <KeyboardAwareScrollView
        showsVerticalScrollIndicator={false}
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        bottomOffset={24}>
        <View style={styles.dots}>
          {STEPS.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: i <= step ? colors.tint : colors.backgroundSelected },
              ]}
            />
          ))}
        </View>

        {step === 0 && (
          <>
            <CoffeePicker
              selected={coffee}
              onSelect={setCoffee}
              stashCoffeeIds={stashCoffeeIds}
            />
            {coffee != null && (
              <Host matchContents seedColor={colors.tint} style={styles.actions}>
                <Button
                  variant="filled"
                  label="Continue"
                  style={{ width: buttonWidth, height: 50 }}
                  onPress={next}
                />
              </Host>
            )}
          </>
        )}

        {step === 1 && (
          <>
            <DateRow
              label="ROASTED ON"
              hint="Needed for rested-days tracking."
              value={roastDate}
              onPress={() => setPicking('roast')}
              onClear={() => setRoastDate(null)}
              colors={colors}
            />

            <Field label="BAG SIZE (GRAMS)" colors={colors}>
              <TextInput
                placeholder="250"
                keyboardType="number-pad"
                defaultValue={size}
                onChangeText={setSize}
              />
            </Field>

            {error != null && (
              <Text style={[styles.message, { color: colors.danger }]}>{error}</Text>
            )}

            <Host matchContents seedColor={colors.tint} style={styles.actions}>
              <Button
                variant="filled"
                label="Continue"
                style={{ width: buttonWidth, height: 50 }}
                onPress={next}
              />
            </Host>
          </>
        )}

        {step === 2 && coffee != null && (
          <>
            <View style={[styles.rowCard, { backgroundColor: colors.backgroundElement }]}>
              <View style={styles.rowText}>
                <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>
                  CURRENTLY IN THE FREEZER
                </Text>
                <Text style={[styles.rowHint, { color: colors.textSecondary }]}>
                  {frozen ? 'Rest clock is paused.' : 'Sitting on the shelf.'}
                </Text>
              </View>
              <Switch value={frozen} onValueChange={setFrozen} trackColor={{ true: colors.tint }} />
            </View>

            {frozen && (
              <DateRow
                label="FROZEN SINCE"
                hint="Defaults to today."
                value={frozenSince}
                onPress={() => setPicking('frozen')}
                onClear={() => setFrozenSince(null)}
                colors={colors}
              />
            )}

            <View style={[styles.summary, { backgroundColor: colors.backgroundElement }]}>
              <Text style={[styles.summaryText, { color: colors.textSecondary }]}>
                {coffee.name} · {coffee.roaster.name}
              </Text>
              <Text style={[styles.summaryText, { color: colors.textSecondary }]}>
                {roastDate ? `Roasted ${formatDate(roastDate)}` : 'No roast date'}
                {grams != null ? ` · ${grams}g bag` : ''}
              </Text>
              <Text style={[styles.summaryText, { color: colors.textSecondary }]}>
                {frozen
                  ? `Frozen since ${formatDate(frozenSince ?? new Date())}`
                  : 'On the shelf'}
              </Text>
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

        {step > 0 && (
          <Pressable onPress={back} hitSlop={8} style={styles.backLink}>
            <Text style={[styles.backText, { color: colors.textSecondary }]}>‹ Back</Text>
          </Pressable>
        )}
      </KeyboardAwareScrollView>

      <Modal
        visible={picking != null}
        transparent
        animationType="slide"
        onRequestClose={() => setPicking(null)}>
        <Pressable style={styles.backdrop} onPress={() => setPicking(null)} />
        <View style={[styles.dateSheet, { backgroundColor: colors.background }]}>
          <View style={[styles.grabber, { backgroundColor: colors.backgroundSelected }]} />
          <Text style={[styles.dateSheetTitle, { color: colors.text }]}>
            {picking === 'roast' ? 'Roasted on' : 'Frozen since'}
          </Text>
          <DateTimePicker
            value={(picking === 'roast' ? roastDate : frozenSince) ?? new Date()}
            mode="date"
            display="inline"
            maximumDate={new Date()}
            accentColor={colors.tint}
            style={styles.dateCalendar}
            onValueChange={(_, date) => {
              if (picking === 'roast') setRoastDate(date);
              else setFrozenSince(date);
              setPicking(null);
            }}
          />
        </View>
      </Modal>
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
  dots: {
    flexDirection: 'row',
    gap: Spacing.one,
    marginBottom: Spacing.one,
  },
  dot: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    minHeight: 56,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  rowHint: {
    fontSize: 13,
  },
  rowControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  rowClear: {
    fontSize: 15,
    paddingHorizontal: Spacing.one,
  },
  rowAdd: {
    fontSize: 15,
    fontWeight: '600',
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
  summary: {
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  summaryText: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    lineHeight: 20,
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
  backLink: {
    alignSelf: 'center',
    paddingVertical: Spacing.two,
  },
  backText: {
    fontSize: 15,
    fontWeight: '600',
  },
  actions: {
    width: '100%',
    marginTop: Spacing.two,
  },
});

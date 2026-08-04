import { Button, Host, TextInput } from '@expo/ui';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  useWindowDimensions,
} from 'react-native';

import { Field } from '@/components/form-field';
import { ScreenShell } from '@/components/screen-shell';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { createListing } from '@/lib/listings';

export default function ShareDoseScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const { width } = useWindowDimensions();
  const buttonWidth = Math.min(width, MaxContentWidth) - 2 * Spacing.four;

  const roaster = useRef('');
  const coffeeName = useRef('');
  const origin = useRef('');
  const process = useRef('');
  const roastLevel = useRef('');
  const roastDate = useRef('');
  const doseGrams = useRef('18');
  const notes = useRef('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy || !session) return;
    const name = coffeeName.current.trim();
    const roasterName = roaster.current.trim();
    if (!name || !roasterName) {
      setError('Roaster and coffee name are required.');
      return;
    }
    const dose = Number.parseInt(doseGrams.current, 10);
    if (!Number.isFinite(dose) || dose < 5 || dose > 100) {
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
        roaster: roasterName,
        coffee_name: name,
        origin: origin.current.trim() || null,
        process: process.current.trim() || null,
        roast_level: roastLevel.current.trim() || null,
        roast_date: date || null,
        dose_grams: dose,
        notes: notes.current.trim() || null,
      });
      if (message) {
        setError(message);
      } else {
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
      subtitle="Log the bag so other members can offer a trade."
      edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          <Field label="ROASTER" colors={colors}>
            <TextInput
              placeholder="Sey, Passenger, Blue Tokai…"
              onChangeText={(t) => {
                roaster.current = t;
              }}
            />
          </Field>
          <Field label="COFFEE NAME" colors={colors}>
            <TextInput
              placeholder="Finca El Paraiso"
              onChangeText={(t) => {
                coffeeName.current = t;
              }}
            />
          </Field>
          <Field label="ORIGIN (OPTIONAL)" colors={colors}>
            <TextInput
              placeholder="Huila, Colombia"
              onChangeText={(t) => {
                origin.current = t;
              }}
            />
          </Field>
          <Field label="PROCESS (OPTIONAL)" colors={colors}>
            <TextInput
              placeholder="Washed, natural, anaerobic…"
              onChangeText={(t) => {
                process.current = t;
              }}
            />
          </Field>
          <Field label="ROAST LEVEL (OPTIONAL)" colors={colors}>
            <TextInput
              placeholder="Light, medium…"
              onChangeText={(t) => {
                roastLevel.current = t;
              }}
            />
          </Field>
          <Field label="ROAST DATE (OPTIONAL, YYYY-MM-DD)" colors={colors}>
            <TextInput
              placeholder="2026-07-28"
              keyboardType="numbers-and-punctuation"
              autoCorrect={false}
              onChangeText={(t) => {
                roastDate.current = t;
              }}
            />
          </Field>
          <Field label="DOSE SIZE (GRAMS)" colors={colors}>
            <TextInput
              placeholder="18"
              defaultValue="18"
              keyboardType="number-pad"
              onChangeText={(t) => {
                doseGrams.current = t;
              }}
            />
          </Field>
          <Field label="TASTING NOTES (OPTIONAL)" colors={colors}>
            <TextInput
              placeholder="Stone fruit, florals, long finish."
              multiline
              onChangeText={(t) => {
                notes.current = t;
              }}
            />
          </Field>

          {error != null && (
            <Text style={[styles.message, { color: colors.danger }]}>{error}</Text>
          )}

          <Host matchContents seedColor={colors.tint} style={styles.actions}>
            <Button
              variant="filled"
              label={busy ? 'Listing…' : 'List this dose'}
              disabled={busy}
              style={{ width: buttonWidth, height: 50 }}
              onPress={submit}
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
  message: {
    fontSize: 15,
    lineHeight: 21,
  },
  actions: {
    width: '100%',
    marginTop: Spacing.two,
  },
});

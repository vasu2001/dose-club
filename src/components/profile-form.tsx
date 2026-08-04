import { Button, Host, TextInput } from '@expo/ui';
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
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { saveProfile, type Profile } from '@/lib/profile';

type ProfileFormProps = {
  profile: Profile | null;
  submitLabel: string;
  /** Called after a successful save. */
  onSaved?: () => void;
};

export function ProfileForm({ profile, submitLabel, onSaved }: ProfileFormProps) {
  const { session, refreshProfile } = useAuth();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const { width } = useWindowDimensions();
  const buttonWidth = Math.min(width, MaxContentWidth) - 2 * Spacing.five;

  const displayName = useRef(profile?.display_name ?? '');
  const username = useRef(profile?.username ?? '');
  const city = useRef(profile?.city ?? '');
  const bio = useRef(profile?.bio ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy || !session) return;
    const name = displayName.current.trim();
    const handle = username.current.trim().toLowerCase();
    if (!name || !handle) {
      setError('Display name and username are required.');
      return;
    }
    if (!/^[a-z0-9_]{3,24}$/.test(handle)) {
      setError('Username must be 3–24 characters: lowercase letters, numbers, underscores.');
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const message = await saveProfile(session.user.id, {
        display_name: name,
        username: handle,
        city: city.current.trim() || null,
        bio: bio.current.trim() || null,
      });
      setError(message);
      if (!message) {
        await refreshProfile();
        setSaved(true);
        onSaved?.();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        <Field label="DISPLAY NAME" colors={colors}>
          <TextInput
            placeholder="June Kim"
            defaultValue={profile?.display_name ?? undefined}
            autoCorrect={false}
            onChangeText={(text) => {
              displayName.current = text;
            }}
          />
        </Field>
        <Field label="USERNAME" colors={colors}>
          <TextInput
            placeholder="june_brews"
            defaultValue={profile?.username ?? undefined}
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={(text) => {
              username.current = text;
            }}
          />
        </Field>
        <Field label="CITY (OPTIONAL)" colors={colors}>
          <TextInput
            placeholder="Bengaluru"
            defaultValue={profile?.city ?? undefined}
            onChangeText={(text) => {
              city.current = text;
            }}
          />
        </Field>
        <Field label="ABOUT YOUR COFFEE (OPTIONAL)" colors={colors}>
          <TextInput
            placeholder="Light roasts, V60, always chasing washed Ethiopians."
            defaultValue={profile?.bio ?? undefined}
            multiline
            onChangeText={(text) => {
              bio.current = text;
            }}
          />
        </Field>

        {error != null && (
          <Text style={[styles.message, { color: colors.danger }]}>{error}</Text>
        )}
        {saved && error == null && (
          <Text style={[styles.message, { color: colors.accent }]}>Profile saved.</Text>
        )}

        <Host matchContents seedColor={colors.tint} style={styles.actions}>
          <Button
            variant="filled"
            label={busy ? 'Saving…' : submitLabel}
            disabled={busy}
            style={{ width: buttonWidth, height: 50 }}
            onPress={submit}
          />
        </Host>
      </ScrollView>
    </KeyboardAvoidingView>
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
  field: {
    borderRadius: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    gap: Spacing.one,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  message: {
    fontSize: 15,
    lineHeight: 21,
    marginTop: Spacing.one,
  },
  actions: {
    width: '100%',
    marginTop: Spacing.two,
  },
});

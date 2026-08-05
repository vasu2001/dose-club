import { Button, Host, TextInput } from '@expo/ui';
import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';

type AuthFormProps = {
  heading: string;
  subheading: string;
  submitLabel: string;
  /** Return an error message to show it, or null on success. */
  onSubmit: (email: string, password: string) => Promise<string | null>;
  /** Info message shown in place of an error (e.g. "check your email"). */
  notice?: string | null;
  footerLabel: string;
  onFooterPress: () => void;
};

export function AuthForm({
  heading,
  subheading,
  submitLabel,
  onSubmit,
  notice,
  footerLabel,
  onFooterPress,
}: AuthFormProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const { width } = useWindowDimensions();
  const buttonWidth = Math.min(width, MaxContentWidth) - 2 * Spacing.five;

  const email = useRef('');
  const password = useRef('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    if (!email.current.trim() || !password.current) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setError(await onSubmit(email.current.trim(), password.current));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.content}>
            <Text style={[styles.heading, { color: colors.text }]}>{heading}</Text>
            <Text style={[styles.subheading, { color: colors.textSecondary }]}>
              {subheading}
            </Text>

            <View style={styles.fields}>
              <View style={[styles.field, { backgroundColor: colors.backgroundElement }]}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>EMAIL</Text>
                <Host matchContents>
                  <TextInput
                    placeholder="you@example.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    onChangeText={(text) => {
                      email.current = text;
                    }}
                  />
                </Host>
              </View>
              <View style={[styles.field, { backgroundColor: colors.backgroundElement }]}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                  PASSWORD
                </Text>
                <Host matchContents>
                  <TextInput
                    placeholder="••••••••"
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    onChangeText={(text) => {
                      password.current = text;
                    }}
                    onSubmitEditing={() => submit()}
                  />
                </Host>
              </View>
            </View>

            {error != null && (
              <Text style={[styles.message, { color: colors.danger }]}>{error}</Text>
            )}
            {notice != null && (
              <Text style={[styles.message, { color: colors.accent }]}>{notice}</Text>
            )}

            <Host matchContents seedColor={colors.tint} style={styles.actions}>
              <Button
                variant="filled"
                label={busy ? 'Please wait…' : submitLabel}
                disabled={busy}
                style={{ width: buttonWidth, height: 50 }}
                onPress={submit}
              />
            </Host>

            <Text
              style={[styles.footerLink, { color: colors.tint }]}
              onPress={onFooterPress}
              suppressHighlighting>
              {footerLabel}
            </Text>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.five,
  },
  content: {
    flex: 1,
    paddingTop: Spacing.five,
    gap: Spacing.three,
  },
  heading: {
    fontFamily: Fonts.serif,
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '700',
  },
  subheading: {
    fontSize: 16,
    lineHeight: 24,
    marginTop: -Spacing.two,
  },
  fields: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  field: {
    borderRadius: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    gap: Spacing.one,
  },
  fieldLabel: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  message: {
    fontSize: 15,
    lineHeight: 21,
  },
  actions: {
    width: '100%',
    marginTop: Spacing.two,
  },
  footerLink: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: Spacing.two,
  },
});

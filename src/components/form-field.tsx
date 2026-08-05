import { Host } from '@expo/ui';
import { StyleSheet, Text, View } from 'react-native';

import { Fonts, Colors, Spacing } from '@/constants/theme';

type FieldProps = {
  label: string;
  colors: (typeof Colors)['light' | 'dark'];
  /** Inline validation error — paints the card border red and shows the message. */
  error?: string | null;
  children: React.ReactNode;
};

export function Field({ label, colors, error, children }: FieldProps) {
  return (
    <View style={styles.container}>
      <View
        style={[
          styles.field,
          { backgroundColor: colors.backgroundElement },
          error != null && [styles.fieldError, { borderColor: colors.danger }],
        ]}>
        <Text
          style={[
            styles.fieldLabel,
            { color: error != null ? colors.danger : colors.textSecondary },
          ]}>
          {label}
        </Text>
        <Host matchContents>{children}</Host>
      </View>
      {error != null && (
        <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.one,
  },
  field: {
    borderRadius: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    gap: Spacing.one,
  },
  fieldError: {
    borderWidth: 1.5,
  },
  fieldLabel: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: Spacing.one,
  },
});

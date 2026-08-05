import { Host } from '@expo/ui';
import { cloneElement, isValidElement, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts, Colors, Spacing } from '@/constants/theme';

type Focusable = { focus?: () => void | Promise<void> };

type FieldProps = {
  label: string;
  colors: (typeof Colors)['light' | 'dark'];
  /** Inline validation error — paints the card border red and shows the message. */
  error?: string | null;
  /**
   * Fixed height for the native input host. Required for multiline inputs —
   * SwiftUI's growing TextField measures as zero height under matchContents.
   */
  inputHeight?: number;
  children: React.ReactNode;
};

export function Field({ label, colors, error, inputHeight, children }: FieldProps) {
  const inputRef = useRef<Focusable | null>(null);
  // Attach a ref to the (single) input child so tapping anywhere on the
  // card — label, padding, far right — focuses it.
  const child = isValidElement(children)
    ? cloneElement(children as React.ReactElement<{ ref?: unknown }>, { ref: inputRef })
    : children;
  return (
    <View style={styles.container}>
      <Pressable
        onPress={() => inputRef.current?.focus?.()}
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
        {inputHeight != null ? (
          <Host style={{ height: inputHeight }}>{child}</Host>
        ) : (
          <Host matchContents>{child}</Host>
        )}
      </Pressable>
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

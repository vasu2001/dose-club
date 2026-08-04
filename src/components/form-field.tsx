import { Host } from '@expo/ui';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';

type FieldProps = {
  label: string;
  colors: (typeof Colors)['light' | 'dark'];
  children: React.ReactNode;
};

export function Field({ label, colors, children }: FieldProps) {
  return (
    <View style={[styles.field, { backgroundColor: colors.backgroundElement }]}>
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Host matchContents>{children}</Host>
    </View>
  );
}

const styles = StyleSheet.create({
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
});

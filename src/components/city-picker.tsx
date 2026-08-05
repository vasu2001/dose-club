import { Host, TextInput } from '@expo/ui';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';

import { Colors, Fonts, Spacing } from '@/constants/theme';
import { INDIAN_CITIES } from '@/constants/cities';

type CityPickerProps = {
  value: string | null;
  onChange: (city: string | null) => void;
  /** Inline validation error — paints the card border red and shows the message. */
  error?: string | null;
};

/** Pick a city from the supported list — no free text. */
export function CityPicker({ value, onChange, error }: CityPickerProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const [query, setQuery] = useState('');
  // Remounts the search input when a pick clears it.
  const [pickCount, setPickCount] = useState(0);

  if (value) {
    return (
      <View style={[styles.card, { backgroundColor: colors.backgroundElement }]}>
        <View style={styles.cardText}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>CITY</Text>
          <Text style={[styles.value, { color: colors.text }]}>{value}</Text>
        </View>
        <Pressable onPress={() => onChange(null)} hitSlop={8}>
          <Text style={[styles.change, { color: colors.tint }]}>Change</Text>
        </Pressable>
      </View>
    );
  }

  const q = query.trim().toLowerCase();
  const matches = q
    ? INDIAN_CITIES.filter((c) => c.toLowerCase().includes(q)).slice(0, 6)
    : [];

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.card,
          { backgroundColor: colors.backgroundElement },
          error != null && [styles.cardError, { borderColor: colors.danger }],
        ]}>
        <View style={styles.cardText}>
          <Text
            style={[
              styles.label,
              { color: error != null ? colors.danger : colors.textSecondary },
            ]}>
            CITY
          </Text>
          <Host matchContents>
            <TextInput
              key={pickCount}
              placeholder="Start typing — Bengaluru, Mumbai…"
              autoCorrect={false}
              onChangeText={setQuery}
            />
          </Host>
        </View>
      </View>
      {matches.length > 0 && (
        <View style={styles.chips}>
          {matches.map((c) => (
            <Pressable
              key={c}
              onPress={() => {
                onChange(c);
                setQuery('');
                setPickCount((n) => n + 1);
              }}
              style={[styles.chip, { backgroundColor: colors.backgroundSelected }]}>
              <Text style={[styles.chipText, { color: colors.tint }]}>{c}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {q !== '' && matches.length === 0 && (
        <Text style={[styles.noMatch, { color: colors.textSecondary }]}>
          Not on our city list yet — pick the nearest big city.
        </Text>
      )}
      {error != null && (
        <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
  },
  cardText: {
    flex: 1,
    gap: Spacing.one,
  },
  label: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
  },
  change: {
    fontSize: 14,
    fontWeight: '600',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.one + 2,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  noMatch: {
    fontSize: 13,
    lineHeight: 18,
  },
  cardError: {
    borderWidth: 1.5,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: Spacing.one,
  },
});

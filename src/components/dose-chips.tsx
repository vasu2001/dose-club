import { Host, TextInput } from '@expo/ui';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';

import { Colors, Fonts, Spacing } from '@/constants/theme';

const PRESETS = [12, 15, 18, 20, 25];

type DoseChipsProps = {
  value: number | null;
  onChange: (grams: number | null) => void;
};

/** Tap-to-pick dose sizes, with a custom escape hatch. */
export function DoseChips({ value, onChange }: DoseChipsProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const [custom, setCustom] = useState(value != null && !PRESETS.includes(value));

  return (
    <View style={styles.container}>
      <View style={styles.chips}>
        {PRESETS.map((grams) => {
          const selected = !custom && value === grams;
          return (
            <Pressable
              key={grams}
              onPress={() => {
                setCustom(false);
                onChange(grams);
              }}
              style={[
                styles.chip,
                {
                  backgroundColor: selected ? colors.tint : colors.backgroundElement,
                  borderColor: selected ? colors.tint : 'transparent',
                },
              ]}>
              <Text
                style={[
                  styles.chipText,
                  { color: selected ? colors.background : colors.text },
                ]}>
                {grams}g
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => {
            setCustom(true);
            onChange(null);
          }}
          style={[
            styles.chip,
            {
              backgroundColor: custom ? colors.backgroundSelected : colors.backgroundElement,
              borderColor: custom ? colors.tint : 'transparent',
            },
          ]}>
          <Text style={[styles.chipText, { color: custom ? colors.tint : colors.text }]}>
            Custom
          </Text>
        </Pressable>
      </View>
      {custom && (
        <View style={[styles.customBox, { backgroundColor: colors.backgroundElement }]}>
          <Host matchContents>
            <TextInput
              placeholder="Grams, 5–100"
              keyboardType="number-pad"
              onChangeText={(t) => {
                const grams = Number.parseInt(t, 10);
                onChange(Number.isFinite(grams) ? grams : null);
              }}
            />
          </Host>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one + 2,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 3,
  },
  chipText: {
    fontFamily: Fonts.mono,
    fontSize: 14,
    fontWeight: '600',
  },
  customBox: {
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
  },
});

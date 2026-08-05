import { useState } from 'react';
import {
  LayoutChangeEvent,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';

import { Colors, Fonts, Spacing } from '@/constants/theme';
import { ROAST_LABEL, ROAST_LEVELS, roastIndex, type RoastLevel } from '@/lib/coffees';

// Bean colors along the scale, lightest to darkest.
const BEAN_COLORS = ['#D9B98C', '#C69A63', '#A97843', '#7D5330', '#4E301D', '#241814'];

type RoastSliderProps = {
  value: RoastLevel | null;
  onChange: (level: RoastLevel) => void;
};

/**
 * Six-stop roast slider: drag or tap along the track, ultralight → coal.
 */
export function RoastSlider({ value, onChange }: RoastSliderProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const [width, setWidth] = useState(0);
  const index = value ? ROAST_LEVELS.indexOf(value) : null;

  const pick = (x: number) => {
    if (width <= 0) return;
    const i = Math.min(
      ROAST_LEVELS.length - 1,
      Math.max(0, Math.round((x / width) * (ROAST_LEVELS.length - 1))),
    );
    onChange(ROAST_LEVELS[i]);
  };

  return (
    <View style={styles.container}>
      <View
        style={styles.track}
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(e) => pick(e.nativeEvent.locationX)}
        onResponderMove={(e) => pick(e.nativeEvent.locationX)}>
        <View style={[styles.rail, { backgroundColor: colors.backgroundSelected }]} />
        {ROAST_LEVELS.map((level, i) => {
          const selected = index === i;
          return (
            <View key={level} pointerEvents="none" style={styles.stopWrap}>
              <View
                style={[
                  styles.stop,
                  { backgroundColor: BEAN_COLORS[i] },
                  selected && [styles.stopSelected, { borderColor: colors.tint }],
                ]}
              />
            </View>
          );
        })}
      </View>
      <Text
        style={[
          styles.label,
          { color: index != null ? colors.text : colors.textSecondary },
        ]}>
        {index != null ? ROAST_LABEL[ROAST_LEVELS[index]].toUpperCase() : 'SLIDE TO SET ROAST'}
      </Text>
    </View>
  );
}

/** Read-only mini version: six dots with the selected one ringed. */
export function RoastDots({ level, size = 8 }: { level: string | null; size?: number }) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const index = roastIndex(level);
  if (index == null) return null;
  return (
    <View style={styles.dots}>
      {ROAST_LEVELS.map((l, i) => (
        <View
          key={l}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: BEAN_COLORS[i],
            opacity: i === index ? 1 : 0.35,
            borderWidth: i === index ? 1.5 : 0,
            borderColor: colors.tint,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  track: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 44,
    paddingHorizontal: 2,
  },
  rail: {
    position: 'absolute',
    left: 10,
    right: 10,
    height: 3,
    borderRadius: 2,
  },
  stopWrap: {
    width: 24,
    alignItems: 'center',
  },
  stop: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  stopSelected: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2.5,
  },
  label: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});

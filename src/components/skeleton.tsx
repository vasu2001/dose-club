import { useEffect } from 'react';
import {
  StyleSheet,
  View,
  useColorScheme,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Colors, Spacing } from '@/constants/theme';

type SkeletonProps = {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

/** A single pulsing placeholder bar. */
export function Skeleton({ width = '100%', height = 14, radius = 7, style }: SkeletonProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
  }, [opacity]);

  const pulse = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius, backgroundColor: colors.backgroundSelected },
        pulse,
        style,
      ]}
    />
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  return (
    <View style={[styles.card, { backgroundColor: colors.backgroundElement }, style]}>
      {children}
    </View>
  );
}

/** Mirrors ListingCard: title + chip, subtitle, stats row, owner line. */
export function ListingCardSkeleton({ hideOwner }: { hideOwner?: boolean }) {
  return (
    <Card>
      <View style={styles.spaceBetween}>
        <Skeleton width="55%" height={22} />
        <Skeleton width={90} height={20} radius={8} />
      </View>
      <Skeleton width="75%" />
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Skeleton width={52} height={9} />
          <Skeleton width={64} height={13} />
        </View>
        <View style={styles.stat}>
          <Skeleton width={42} height={9} />
          <Skeleton width={56} height={13} />
        </View>
        <View style={styles.stat}>
          <Skeleton width={36} height={9} />
          <Skeleton width={40} height={13} />
        </View>
      </View>
      {!hideOwner && <Skeleton width="45%" height={12} />}
    </Card>
  );
}

export function ListingListSkeleton({
  count = 4,
  hideOwner,
}: {
  count?: number;
  hideOwner?: boolean;
}) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }, (_, i) => (
        <ListingCardSkeleton key={i} hideOwner={hideOwner} />
      ))}
    </View>
  );
}

/** Mirrors a proposal card on the trades screen. */
export function TradeCardSkeleton() {
  return (
    <Card>
      <View style={styles.spaceBetween}>
        <View style={styles.flexTitle}>
          <Skeleton width="90%" height={17} />
          <Skeleton width="55%" height={13} />
        </View>
        <Skeleton width={72} height={22} radius={8} />
      </View>
      <Skeleton width="70%" height={13} />
    </Card>
  );
}

/** Mirrors listing detail: hero tiles, spec card, notes, owner card. */
export function ListingDetailSkeleton() {
  return (
    <View style={styles.detail}>
      <View style={styles.heroRow}>
        <Skeleton height={82} radius={16} style={styles.heroTile} />
        <Skeleton height={82} radius={16} style={styles.heroTile} />
        <Skeleton height={82} radius={16} style={styles.heroTile} />
      </View>
      <Card style={styles.specCard}>
        {Array.from({ length: 4 }, (_, i) => (
          <View key={i} style={styles.spaceBetween}>
            <Skeleton width={72} height={11} />
            <Skeleton width={110} height={13} />
          </View>
        ))}
      </Card>
      <Skeleton width="100%" />
      <Skeleton width="85%" />
      <Card style={styles.ownerCard}>
        <Skeleton width={44} height={44} radius={22} />
        <View style={styles.flexTitle}>
          <Skeleton width="55%" height={15} />
          <Skeleton width="40%" height={12} />
        </View>
      </Card>
    </View>
  );
}

/** Mirrors trade detail: two coffee sides + timeline. */
export function TradeDetailSkeleton() {
  return (
    <View style={styles.detail}>
      {[0, 1].map((i) => (
        <Card key={i}>
          <Skeleton width={80} height={11} />
          <Skeleton width="65%" height={20} />
          <Skeleton width="50%" height={13} />
          <Skeleton width={72} height={12} />
        </Card>
      ))}
      <Skeleton width={90} height={12} style={styles.sectionGap} />
      {Array.from({ length: 3 }, (_, i) => (
        <View key={i} style={styles.timelineRow}>
          <Skeleton width={10} height={10} radius={5} />
          <View style={styles.flexTitle}>
            <Skeleton width="60%" height={14} />
            <Skeleton width="35%" height={11} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Mirrors a profile: stat tiles + bio lines. */
export function ProfileSkeleton() {
  return (
    <View style={styles.detail}>
      <View style={styles.heroRow}>
        <Skeleton height={96} radius={20} style={styles.heroTile} />
        <Skeleton height={96} radius={20} style={styles.heroTile} />
      </View>
      <Skeleton width="100%" style={styles.sectionGap} />
      <Skeleton width="70%" />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  list: {
    gap: Spacing.two,
  },
  spaceBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  flexTitle: {
    flex: 1,
    gap: Spacing.one + 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    paddingTop: Spacing.two,
  },
  stat: {
    flex: 1,
    gap: Spacing.one,
  },
  detail: {
    gap: Spacing.three,
  },
  heroRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  heroTile: {
    flex: 1,
  },
  specCard: {
    borderRadius: 16,
    gap: Spacing.three,
  },
  ownerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
    borderRadius: 16,
    padding: Spacing.two + 2,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  sectionGap: {
    marginTop: Spacing.one,
  },
});

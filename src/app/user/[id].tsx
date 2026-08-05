import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View, useColorScheme } from 'react-native';

import { ScreenShell } from '@/components/screen-shell';
import { ProfileSkeleton, Skeleton } from '@/components/skeleton';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { fetchProfile, fetchProfileStats } from '@/lib/profile';
import { queryKeys } from '@/lib/query';

function StatTile({
  value,
  label,
  colors,
}: {
  value: string | null;
  label: string;
  colors: (typeof Colors)['light' | 'dark'];
}) {
  return (
    <View style={[styles.stat, { backgroundColor: colors.backgroundElement }]}>
      {value == null ? (
        <Skeleton width={48} height={36} radius={10} style={{ marginVertical: 3 }} />
      ) : (
        <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      )}
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

export default function PublicProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const { data: profile = null, isLoading } = useQuery({
    queryKey: queryKeys.profile(id ?? ''),
    queryFn: () => fetchProfile(id as string),
    enabled: id != null,
  });
  const { data: stats = null } = useQuery({
    queryKey: queryKeys.profileStats(id ?? ''),
    queryFn: () => fetchProfileStats(id as string),
    enabled: id != null,
  });
  const loaded = !isLoading;

  if (!profile) {
    return (
      <ScreenShell title={loaded ? 'Not found' : ' '} edges={['bottom']}>
        {loaded ? (
          <Text style={[styles.muted, { color: colors.textSecondary }]}>
            This member doesn't exist.
          </Text>
        ) : (
          <ProfileSkeleton />
        )}
      </ScreenShell>
    );
  }

  const memberSince = new Date(profile.created_at).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  return (
    <ScreenShell
      eyebrow="MEMBER"
      title={profile.display_name ?? `@${profile.username ?? 'someone'}`}
      subtitle={[
        `@${profile.username ?? '—'}`,
        profile.city,
        `since ${memberSince}`,
      ]
        .filter(Boolean)
        .join(' · ')}
      edges={['bottom']}>
      <View style={styles.stats}>
        <StatTile
          value={stats ? String(stats.completed_trades) : null}
          label="COMPLETED TRADES"
          colors={colors}
        />
        <StatTile
          value={stats ? String(stats.active_listings) : null}
          label="DOSES ON SHELF"
          colors={colors}
        />
      </View>

      {profile.bio != null && (
        <Text style={[styles.bio, { color: colors.textSecondary }]}>“{profile.bio}”</Text>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  stats: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  stat: {
    flex: 1,
    borderRadius: 20,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  statValue: {
    fontFamily: Fonts.serif,
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '700',
  },
  statLabel: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
  },
  bio: {
    fontFamily: Fonts.serif,
    fontSize: 17,
    lineHeight: 26,
    fontStyle: 'italic',
    marginTop: Spacing.three,
  },
  muted: {
    fontSize: 15,
    lineHeight: 22,
  },
});

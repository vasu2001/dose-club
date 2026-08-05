import { Button, Host } from '@expo/ui';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  useWindowDimensions,
} from 'react-native';

import { ScreenShell } from '@/components/screen-shell';
import { Colors, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { fetchProfileStats, type ProfileStats } from '@/lib/profile';

function StatTile({
  value,
  label,
  colors,
}: {
  value: string;
  label: string;
  colors: (typeof Colors)['light' | 'dark'];
}) {
  return (
    <View style={[styles.stat, { backgroundColor: colors.backgroundElement }]}>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

function InfoRow({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: (typeof Colors)['light' | 'dark'];
}) {
  return (
    <View style={[styles.infoRow, { borderBottomColor: colors.backgroundSelected }]}>
      <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const { session, profile, signOut } = useAuth();
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const { width } = useWindowDimensions();
  const buttonWidth = Math.min(width, MaxContentWidth) - 2 * Spacing.four;

  const [stats, setStats] = useState<ProfileStats | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      let cancelled = false;
      fetchProfileStats(session.user.id)
        .then((s) => {
          if (!cancelled) setStats(s);
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, [session]),
  );

  const initial = (profile?.display_name ?? profile?.username ?? '?')
    .charAt(0)
    .toUpperCase();
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <ScreenShell
      eyebrow="YOUR CORNER"
      title={profile?.display_name ?? 'Your profile'}
      subtitle={`@${profile?.username ?? '—'}`}
      insetForTabs>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={[styles.avatar, { backgroundColor: colors.backgroundSelected }]}>
            <Text style={[styles.avatarInitial, { color: colors.tint }]}>{initial}</Text>
          </View>
          <View style={styles.heroText} />
          <Pressable
            onPress={() => router.push('/edit-profile')}
            hitSlop={8}
            style={[styles.editPill, { borderColor: colors.tint }]}>
            <Text style={[styles.editLink, { color: colors.tint }]}>Edit profile</Text>
          </Pressable>
        </View>

        <View style={styles.stats}>
          <StatTile
            value={String(stats?.completed_trades ?? '—')}
            label="COMPLETED TRADES"
            colors={colors}
          />
          <StatTile
            value={String(stats?.active_listings ?? '—')}
            label="DOSES ON SHELF"
            colors={colors}
          />
        </View>

        {profile?.bio != null && (
          <Text style={[styles.bio, { color: colors.textSecondary }]}>“{profile.bio}”</Text>
        )}

        <View style={[styles.infoCard, { backgroundColor: colors.backgroundElement }]}>
          {profile?.city != null && <InfoRow label="CITY" value={profile.city} colors={colors} />}
          {profile?.phone != null && (
            <InfoRow label="PHONE" value={profile.phone} colors={colors} />
          )}
          {session?.user.email != null && (
            <InfoRow label="EMAIL" value={session.user.email} colors={colors} />
          )}
          {memberSince != null && (
            <InfoRow label="MEMBER SINCE" value={memberSince} colors={colors} />
          )}
        </View>

        <Host matchContents seedColor={colors.tint} style={styles.actions}>
          <Button
            variant="outlined"
            label="Sign out"
            style={{ width: buttonWidth, height: 44 }}
            onPress={() => signOut()}
          />
        </Host>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    gap: Spacing.three,
    paddingBottom: Spacing.five,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: Fonts.serif,
    fontSize: 30,
    fontWeight: '700',
  },
  heroText: {
    flex: 1,
  },
  editPill: {
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 3,
  },
  editLink: {
    fontSize: 15,
    fontWeight: '600',
  },
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
  },
  infoCard: {
    borderRadius: 16,
    paddingHorizontal: Spacing.three,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two + 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  infoLabel: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  actions: {
    width: '100%',
    marginTop: Spacing.two,
  },
});

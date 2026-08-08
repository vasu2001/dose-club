import { Button, Host } from '@expo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  useWindowDimensions,
} from 'react-native';

import { BagStatusChip } from '@/components/bag-card';
import { ScreenShell } from '@/components/screen-shell';
import { Colors, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import {
  deleteBag,
  fetchBag,
  frozenDays,
  logBagEvent,
  restedDays,
  type BagEventType,
} from '@/lib/bags';
import { closeListing, fetchMyListings } from '@/lib/listings';
import { queryKeys } from '@/lib/query';

const EVENT_LABEL: Record<BagEventType, string> = {
  added: 'Added to stash',
  frozen: 'Into the freezer',
  thawed: 'Out of the freezer',
  opened: 'Opened',
  finished: 'Finished',
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function BagScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const { width } = useWindowDimensions();
  const buttonWidth = Math.min(width, MaxContentWidth) - 2 * Spacing.four;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: bag, isLoading } = useQuery({
    queryKey: queryKeys.bag(id),
    queryFn: () => fetchBag(id),
    enabled: !!id,
  });
  const userId = session?.user.id;
  const { data: myListings = [] } = useQuery({
    queryKey: queryKeys.myListings(userId ?? ''),
    queryFn: () => fetchMyListings(userId as string),
    enabled: userId != null,
  });
  const activeListings = myListings.filter(
    (l) => l.status === 'active' && l.bag_id === id,
  );

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['bags'] });
    queryClient.invalidateQueries({ queryKey: ['listings'] });
  };

  const unlist = async () => {
    if (busy || activeListings.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await Promise.all(activeListings.map((l) => closeListing(l.id)));
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const act = async (type: Exclude<BagEventType, 'added'>) => {
    if (busy || !bag) return;
    setBusy(true);
    setError(null);
    try {
      await logBagEvent(bag.id, type);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = () => {
    if (!bag) return;
    Alert.alert('Delete this bag?', 'Its timeline goes with it. Listings stay up.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteBag(bag.id);
            refresh();
            router.back();
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Something went wrong.');
          }
        },
      },
    ]);
  };

  if (isLoading || !bag) {
    return (
      <ScreenShell eyebrow="YOUR BAG" title={isLoading ? 'Loading…' : 'Bag not found'} edges={['bottom']}>
        <View />
      </ScreenShell>
    );
  }

  const rested = restedDays(bag);
  const frozen = frozenDays(bag);
  const events = [...bag.events].reverse();

  return (
    <ScreenShell
      eyebrow="YOUR BAG"
      title={bag.coffee.name}
      subtitle={`${bag.coffee.roaster.name}${bag.coffee.origin ? ` · ${bag.coffee.origin}` : ''}`}
      edges={['bottom']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}>
        <View style={styles.chipRow}>
          {activeListings.length > 0 && (
            <View style={[styles.listedChip, { backgroundColor: colors.tint }]}>
              <Text style={[styles.listedChipText, { color: colors.background }]}>
                LISTED
              </Text>
            </View>
          )}
          <BagStatusChip status={bag.status} />
        </View>

        <View style={[styles.statsCard, { backgroundColor: colors.backgroundElement }]}>
          <View style={styles.stat}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>RESTED</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {rested != null ? `${rested}d` : '—'}
            </Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>FROZEN</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {frozen > 0 ? `${frozen}d` : '—'}
            </Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>ROASTED</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {bag.roast_date ? formatWhen(`${bag.roast_date}T00:00:00`) : '—'}
            </Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>BAG</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {bag.size_grams != null ? `${bag.size_grams}g` : '—'}
            </Text>
          </View>
        </View>

        {bag.status !== 'finished' && (
          <View style={styles.actionRow}>
            {bag.status === 'frozen' ? (
              <ActionPill label="Take out of freezer" onPress={() => act('thawed')} colors={colors} disabled={busy} />
            ) : (
              <ActionPill label="Freeze" onPress={() => act('frozen')} colors={colors} disabled={busy} />
            )}
            <ActionPill label="Finish bag" onPress={() => act('finished')} colors={colors} disabled={busy} />
          </View>
        )}

        {error != null && (
          <Text style={[styles.message, { color: colors.danger }]}>{error}</Text>
        )}

        {activeListings.length > 0 ? (
          <Host matchContents seedColor={colors.tint} style={styles.share}>
            <Button
              variant="outlined"
              label={busy ? 'Removing…' : 'Remove from trade'}
              disabled={busy}
              style={{ width: buttonWidth, height: 44 }}
              onPress={unlist}
            />
          </Host>
        ) : (
          bag.status !== 'finished' && (
            <Host matchContents seedColor={colors.tint} style={styles.share}>
              <Button
                variant="filled"
                label="Share a dose of this"
                style={{ width: buttonWidth, height: 50 }}
                onPress={() =>
                  router.push({ pathname: '/share-dose', params: { bagId: bag.id } })
                }
              />
            </Host>
          )
        )}

        <Text style={[styles.timelineTitle, { color: colors.accent }]}>TIMELINE</Text>
        <View style={[styles.timeline, { backgroundColor: colors.backgroundElement }]}>
          {events.map((event, i) => (
            <View
              key={event.id}
              style={[
                styles.eventRow,
                i > 0 && { borderTopColor: colors.backgroundSelected, borderTopWidth: StyleSheet.hairlineWidth },
              ]}>
              <View style={styles.eventText}>
                <Text style={[styles.eventLabel, { color: colors.text }]}>
                  {EVENT_LABEL[event.type]}
                </Text>
                {event.note != null && (
                  <Text style={[styles.eventNote, { color: colors.textSecondary }]}>
                    {event.note}
                  </Text>
                )}
              </View>
              <Text style={[styles.eventWhen, { color: colors.textSecondary }]}>
                {formatWhen(event.happened_at)}
              </Text>
            </View>
          ))}
        </View>

        <Pressable onPress={confirmDelete} hitSlop={8} style={styles.delete}>
          <Text style={[styles.deleteText, { color: colors.danger }]}>Delete bag</Text>
        </Pressable>
      </ScrollView>
    </ScreenShell>
  );
}

function ActionPill({
  label,
  onPress,
  colors,
  disabled,
}: {
  label: string;
  onPress: () => void;
  colors: (typeof Colors)['light' | 'dark'];
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.pill,
        {
          backgroundColor: colors.backgroundSelected,
          opacity: pressed || disabled ? 0.6 : 1,
        },
      ]}>
      <Text style={[styles.pillText, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.three,
    paddingBottom: Spacing.six,
  },
  chipRow: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  listedChip: {
    borderRadius: 8,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  listedChipText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  statsCard: {
    flexDirection: 'row',
    borderRadius: 20,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  stat: {
    flex: 1,
    gap: 2,
  },
  statLabel: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  pill: {
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  pillText: {
    fontSize: 15,
    fontWeight: '600',
  },
  share: {
    width: '100%',
  },
  timelineTitle: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 3,
    marginTop: Spacing.two,
  },
  timeline: {
    borderRadius: 20,
    paddingHorizontal: Spacing.three,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two + 2,
  },
  eventText: {
    flex: 1,
    gap: 2,
  },
  eventLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  eventNote: {
    fontSize: 13,
  },
  eventWhen: {
    fontFamily: Fonts.mono,
    fontSize: 12,
  },
  message: {
    fontSize: 15,
    lineHeight: 21,
  },
  delete: {
    alignSelf: 'center',
    marginTop: Spacing.two,
  },
  deleteText: {
    fontSize: 15,
    fontWeight: '600',
  },
});

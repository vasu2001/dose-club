import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';

import { ScreenShell } from '@/components/screen-shell';
import { TradeCardSkeleton } from '@/components/skeleton';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  timeAgo,
  type AppNotification,
  type NotificationType,
} from '@/lib/notifications';
import { queryKeys } from '@/lib/query';
import { useRefetchOnFocus } from '@/lib/use-refetch-on-focus';

const TYPE_META: Record<
  NotificationType,
  { icon: SFSymbol; headline: string; tone: 'accent' | 'muted' | 'danger' }
> = {
  proposal_received: { icon: 'cup.and.saucer.fill', headline: 'New trade offer', tone: 'accent' },
  proposal_accepted: { icon: 'checkmark.seal.fill', headline: 'Offer accepted', tone: 'accent' },
  proposal_declined: { icon: 'xmark.circle.fill', headline: 'Offer declined', tone: 'danger' },
  proposal_withdrawn: { icon: 'arrow.uturn.backward', headline: 'Offer withdrawn', tone: 'muted' },
  listing_closed: { icon: 'archivebox.fill', headline: 'Listing closed', tone: 'muted' },
  trade_confirmed: { icon: 'checkmark.circle.fill', headline: 'Exchange confirmed', tone: 'accent' },
  trade_completed: { icon: 'sparkles', headline: 'Trade complete', tone: 'accent' },
};

/** One human sentence of context under the headline. */
function contextLine(n: AppNotification): string {
  const who = n.actor?.username ? `@${n.actor.username}` : 'Someone';
  const coffee = n.listing?.coffee.name;
  if (!coffee) return n.title;
  switch (n.type) {
    case 'proposal_received':
      return `${who} wants a dose of your ${coffee}`;
    case 'proposal_accepted':
      return `${who} said yes to your offer on ${coffee}`;
    case 'proposal_declined':
      return `${who} passed on your offer on ${coffee}`;
    case 'proposal_withdrawn':
      return `${who} pulled their offer on your ${coffee}`;
    case 'listing_closed':
      return `${who} closed ${coffee} — your offer was archived`;
    case 'trade_confirmed':
      return `${who} confirmed the ${coffee} exchange — your turn`;
    case 'trade_completed':
      return `You and ${who} swapped for ${coffee}`;
  }
}

function NotificationRow({
  n,
  onPress,
  colors,
  last,
}: {
  n: AppNotification;
  onPress: () => void;
  colors: (typeof Colors)['light'] | (typeof Colors)['dark'];
  last: boolean;
}) {
  const meta = TYPE_META[n.type];
  const isUnread = n.read_at == null;
  const iconColor =
    meta.tone === 'danger'
      ? colors.danger
      : meta.tone === 'muted'
        ? colors.textSecondary
        : colors.accent;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        isUnread
          ? { backgroundColor: colors.backgroundElement, borderRadius: 18 }
          : [
              styles.rowRead,
              { borderBottomColor: last ? 'transparent' : colors.backgroundElement },
            ],
        pressed && { opacity: 0.8 },
      ]}>
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: isUnread ? colors.backgroundSelected : colors.backgroundElement },
        ]}>
        <SymbolView name={meta.icon} size={17} tintColor={iconColor} />
      </View>

      <View style={styles.rowBody}>
        <View style={styles.headlineRow}>
          <Text
            style={[
              styles.headline,
              { color: colors.text, fontWeight: isUnread ? '700' : '600' },
            ]}
            numberOfLines={1}>
            {meta.headline}
          </Text>
          <Text style={[styles.time, { color: colors.textSecondary }]}>
            {timeAgo(n.created_at)}
          </Text>
        </View>
        <Text
          style={[
            styles.context,
            { color: isUnread ? colors.text : colors.textSecondary },
          ]}
          numberOfLines={2}>
          {contextLine(n)}
        </Text>
      </View>

      {isUnread && <View style={[styles.dot, { backgroundColor: colors.accent }]} />}
    </Pressable>
  );
}

export default function InboxScreen() {
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const queryClient = useQueryClient();

  const [refreshing, setRefreshing] = useState(false);
  const {
    data: notifications = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: queryKeys.notifications,
    queryFn: fetchNotifications,
  });
  useRefetchOnFocus(queryKeys.notifications);

  const fresh = notifications.filter((n) => n.read_at == null);
  const earlier = notifications.filter((n) => n.read_at != null);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['notifications'] });

  const open = (n: AppNotification) => {
    if (n.read_at == null) {
      markNotificationRead(n.id).then(invalidate).catch(invalidate);
    }
    if (n.proposal_id != null) {
      router.push({ pathname: '/trade/[id]', params: { id: n.proposal_id } });
    } else if (n.listing_id != null) {
      router.push({ pathname: '/listing/[id]', params: { id: n.listing_id } });
    }
  };

  const markAll = async () => {
    try {
      await markAllNotificationsRead();
    } finally {
      invalidate();
    }
  };

  return (
    <ScreenShell
      eyebrow="INBOX"
      title="What needs you"
      subtitle={
        fresh.length > 0
          ? `${fresh.length} unread ${fresh.length === 1 ? 'update' : 'updates'}.`
          : 'You’re all caught up.'
      }
      insetForTabs>
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.flex}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              refetch().finally(() => setRefreshing(false));
            }}
            tintColor={colors.tint}
          />
        }>
        {isLoading ? (
          <>
            <TradeCardSkeleton />
            <TradeCardSkeleton />
            <TradeCardSkeleton />
          </>
        ) : notifications.length === 0 ? (
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.backgroundElement }]}>
              <SymbolView name="cup.and.saucer" size={26} tintColor={colors.accent} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>All quiet</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Offers on your doses and updates on your trades land here.
            </Text>
          </View>
        ) : (
          <>
            {fresh.length > 0 && (
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionLabel, { color: colors.accent }]}>NEW</Text>
                <Pressable onPress={markAll} hitSlop={8}>
                  <Text style={[styles.markAllText, { color: colors.tint }]}>
                    Mark all as read
                  </Text>
                </Pressable>
              </View>
            )}
            {fresh.map((n) => (
              <NotificationRow
                key={n.id}
                n={n}
                colors={colors}
                last={false}
                onPress={() => open(n)}
              />
            ))}

            {earlier.length > 0 && (
              <Text
                style={[
                  styles.sectionLabel,
                  { color: colors.textSecondary },
                  fresh.length > 0 && { marginTop: Spacing.three },
                ]}>
                EARLIER
              </Text>
            )}
            {earlier.map((n, i) => (
              <NotificationRow
                key={n.id}
                n={n}
                colors={colors}
                last={i === earlier.length - 1}
                onPress={() => open(n)}
              />
            ))}
          </>
        )}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    gap: Spacing.two,
    paddingBottom: Spacing.five,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionLabel: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 3,
  },
  markAllText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  rowRead: {
    paddingHorizontal: Spacing.one,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
    gap: 3,
  },
  headlineRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
  },
  headline: {
    flex: 1,
    fontFamily: Fonts.serif,
    fontSize: 17,
    lineHeight: 22,
  },
  time: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  context: {
    fontSize: 14,
    lineHeight: 19,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  empty: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.six,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  emptyTitle: {
    fontFamily: Fonts.serif,
    fontSize: 20,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 260,
  },
});

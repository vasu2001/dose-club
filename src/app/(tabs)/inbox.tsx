import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
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

const TYPE_GLYPH: Record<NotificationType, string> = {
  proposal_received: '☕️',
  proposal_accepted: '🤝',
  proposal_declined: '✕',
  proposal_withdrawn: '↩',
  listing_closed: '🗄',
  trade_confirmed: '✓',
  trade_completed: '🎉',
};

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

  const unread = notifications.filter((n) => n.read_at == null).length;

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['notifications'] });

  const open = async (n: AppNotification) => {
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
        unread > 0
          ? `${unread} unread ${unread === 1 ? 'update' : 'updates'}.`
          : 'You’re all caught up.'
      }
      insetForTabs>
      {unread > 0 && (
        <Pressable onPress={markAll} style={styles.markAll} hitSlop={8}>
          <Text style={[styles.markAllText, { color: colors.tint }]}>
            Mark all as read
          </Text>
        </Pressable>
      )}

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
          <Text style={[styles.muted, { color: colors.textSecondary }]}>
            Nothing here yet. Activity on your listings and offers lands in this
            inbox.
          </Text>
        ) : (
          notifications.map((n) => {
            const isUnread = n.read_at == null;
            return (
              <Pressable
                key={n.id}
                onPress={() => open(n)}
                style={({ pressed }) => [
                  styles.row,
                  {
                    backgroundColor: isUnread
                      ? colors.backgroundSelected
                      : colors.backgroundElement,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}>
                <View style={[styles.glyphWrap, { backgroundColor: colors.background }]}>
                  <Text style={styles.glyph}>{TYPE_GLYPH[n.type]}</Text>
                </View>
                <View style={styles.rowBody}>
                  <Text
                    style={[
                      styles.rowTitle,
                      { color: colors.text, fontWeight: isUnread ? '700' : '400' },
                    ]}>
                    {n.title}
                  </Text>
                  <Text style={[styles.rowTime, { color: colors.textSecondary }]}>
                    {timeAgo(n.created_at)}
                  </Text>
                </View>
                {isUnread && <View style={[styles.dot, { backgroundColor: colors.tint }]} />}
              </Pressable>
            );
          })
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
  markAll: {
    alignSelf: 'flex-end',
    paddingBottom: Spacing.two,
  },
  markAllText: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: 16,
    padding: Spacing.two,
    paddingRight: Spacing.three,
  },
  glyphWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {
    fontSize: 18,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 15,
    lineHeight: 21,
  },
  rowTime: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  muted: {
    fontSize: 14,
    lineHeight: 20,
  },
});

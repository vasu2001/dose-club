import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';

import { BagCard } from '@/components/bag-card';
import { ListingCard } from '@/components/listing-card';
import { ListingListSkeleton } from '@/components/skeleton';
import { ScreenShell } from '@/components/screen-shell';
import { BottomTabInset, Colors, Fonts, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { fetchMyBags } from '@/lib/bags';
import { fetchMyListings } from '@/lib/listings';
import { queryKeys } from '@/lib/query';
import { useRefetchOnFocus } from '@/lib/use-refetch-on-focus';

type Segment = 'stash' | 'listed';

export default function ShelfScreen() {
  const { session, profile } = useAuth();
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const userId = session?.user.id;
  const [segment, setSegment] = useState<Segment>('stash');
  // Spinner only for a manual pull — background revalidation stays invisible,
  // otherwise the list jumps every time focus returns from a sub screen.
  const [refreshing, setRefreshing] = useState(false);

  const bagsQuery = useQuery({
    queryKey: queryKeys.myBags(userId ?? ''),
    queryFn: () => fetchMyBags(userId as string),
    enabled: userId != null,
  });
  const listingsQuery = useQuery({
    queryKey: queryKeys.myListings(userId ?? ''),
    queryFn: () => fetchMyListings(userId as string),
    enabled: userId != null,
  });
  useRefetchOnFocus(queryKeys.myBags(userId ?? ''));
  useRefetchOnFocus(queryKeys.myListings(userId ?? ''));

  const active = segment === 'stash' ? bagsQuery : listingsQuery;
  const loaded = !active.isLoading;

  return (
    <ScreenShell
      eyebrow="YOUR STASH"
      title={profile?.display_name ? `${profile.display_name}'s coffees` : 'Your coffees'}
      subtitle="What you own, and what you've put up for trade."
      edges={['top']}
      headerAction={
        <Pressable
          onPress={() => router.push(segment === 'stash' ? '/add-bag' : '/share-dose')}
          hitSlop={8}
          style={({ pressed }) => [
            styles.addButton,
            { backgroundColor: colors.tint, opacity: pressed ? 0.85 : 1 },
          ]}>
          <Text style={[styles.addIcon, { color: colors.background }]}>+</Text>
        </Pressable>
      }>
      <View style={[styles.segments, { backgroundColor: colors.backgroundElement }]}>
        {(['stash', 'listed'] as const).map((key) => (
          <Pressable
            key={key}
            onPress={() => setSegment(key)}
            style={[
              styles.segment,
              segment === key && { backgroundColor: colors.backgroundSelected },
            ]}>
            <Text
              style={[
                styles.segmentText,
                { color: segment === key ? colors.text : colors.textSecondary },
              ]}>
              {key === 'stash' ? 'STASH' : 'LISTED'}
            </Text>
          </Pressable>
        ))}
      </View>

      {segment === 'stash' ? (
        <FlatList
          data={bagsQuery.data ?? []}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                bagsQuery.refetch().finally(() => setRefreshing(false));
              }}
              tintColor={colors.tint}
            />
          }
          renderItem={({ item }) => (
            <BagCard
              bag={item}
              onPress={() => router.push({ pathname: '/bag/[id]', params: { id: item.id } })}
            />
          )}
          ListEmptyComponent={
            loaded ? (
              <View style={styles.empty}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  Nothing in your stash yet. Tap + to add a bag you own and
                  start tracking rest and freezer time.
                </Text>
              </View>
            ) : (
              <ListingListSkeleton count={3} hideOwner />
            )
          }
        />
      ) : (
        <FlatList
          data={listingsQuery.data ?? []}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                listingsQuery.refetch().finally(() => setRefreshing(false));
              }}
              tintColor={colors.tint}
            />
          }
          renderItem={({ item }) => (
            <ListingCard
              listing={item}
              hideOwner
              onPress={() => router.push({ pathname: '/listing/[id]', params: { id: item.id } })}
            />
          )}
          ListEmptyComponent={
            loaded ? (
              <View style={styles.empty}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  Nothing listed yet. Tap + to share a dose of whatever you're
                  brewing and start trading.
                </Text>
              </View>
            ) : (
              <ListingListSkeleton count={3} hideOwner />
            )
          }
        />
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  addButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  addIcon: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '400',
    marginTop: -2,
  },
  segments: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 3,
    marginBottom: Spacing.two,
  },
  segment: {
    flex: 1,
    borderRadius: 9,
    paddingVertical: Spacing.one + 2,
    alignItems: 'center',
  },
  segmentText: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
  },
  list: {
    gap: Spacing.two,
    // Scroll under the floating tab bar; keep the last card reachable.
    paddingBottom: BottomTabInset + Spacing.six,
  },
  empty: {
    paddingVertical: Spacing.four,
  },
  emptyText: {
    fontSize: 15,
    lineHeight: 22,
  },
});

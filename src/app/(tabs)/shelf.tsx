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

import { ListingCard } from '@/components/listing-card';
import { ListingListSkeleton } from '@/components/skeleton';
import { ScreenShell } from '@/components/screen-shell';
import { BottomTabInset, Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { fetchMyListings } from '@/lib/listings';
import { queryKeys } from '@/lib/query';
import { useRefetchOnFocus } from '@/lib/use-refetch-on-focus';

export default function ShelfScreen() {
  const { session, profile } = useAuth();
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const userId = session?.user.id;
  // Spinner only for a manual pull — background revalidation stays invisible,
  // otherwise the list jumps every time focus returns from a sub screen.
  const [refreshing, setRefreshing] = useState(false);
  const {
    data: listings = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: queryKeys.myListings(userId ?? ''),
    queryFn: () => fetchMyListings(userId as string),
    enabled: userId != null,
  });
  const loaded = !isLoading;
  useRefetchOnFocus(queryKeys.myListings(userId ?? ''));

  return (
    <ScreenShell
      eyebrow="YOUR SHELF"
      title={profile?.display_name ? `${profile.display_name}'s doses` : 'Your doses'}
      subtitle="Coffees you've put up for trade."
      edges={['top']}
      headerAction={
        <Pressable
          onPress={() => router.push('/share-dose')}
          hitSlop={8}
          style={({ pressed }) => [
            styles.addButton,
            { backgroundColor: colors.tint, opacity: pressed ? 0.85 : 1 },
          ]}>
          <Text style={[styles.addIcon, { color: colors.background }]}>+</Text>
        </Pressable>
      }>
      <FlatList
        data={listings}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              refetch().finally(() => setRefreshing(false));
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
                Your shelf is empty. Tap + to share a dose of whatever you're
                brewing and start trading.
              </Text>
            </View>
          ) : (
            <ListingListSkeleton count={3} hideOwner />
          )
        }
      />
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

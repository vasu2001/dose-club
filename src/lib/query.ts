import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';

import { storage } from '@/lib/storage';

const DAY = 24 * 60 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cached data renders instantly; anything older than this refetches in
      // the background when a screen mounts or refocuses.
      staleTime: 60 * 1000,
      gcTime: DAY,
      retry: 1,
    },
  },
});

export const queryPersister = createAsyncStoragePersister({
  storage,
  key: 'dose-club.query-cache',
  throttleTime: 1000,
});

/** Bump to drop everyone's persisted cache after breaking shape changes. */
export const CACHE_BUSTER = 'v1';
export const CACHE_MAX_AGE = DAY;

export const queryKeys = {
  activeListings: ['listings', 'active'] as const,
  myListings: (userId: string) => ['listings', 'mine', userId] as const,
  listing: (id: string) => ['listings', 'detail', id] as const,
  proposals: ['proposals'] as const,
  proposal: (id: string) => ['proposals', 'detail', id] as const,
  profile: (userId: string) => ['profiles', userId] as const,
  profileStats: (userId: string) => ['profile-stats', userId] as const,
  coffeeReviews: (coffeeId: string) => ['reviews', 'coffee', coffeeId] as const,
  myReceivedReview: (proposalId: string, userId: string) =>
    ['reviews', 'received', proposalId, userId] as const,
  myCoffees: (userId: string) => ['coffees', 'mine', userId] as const,
  recentCoffees: ['coffees', 'recent'] as const,
  myBags: (userId: string) => ['bags', 'mine', userId] as const,
  bag: (id: string) => ['bags', 'detail', id] as const,
  notifications: ['notifications'] as const,
  unreadCount: ['notifications', 'unread-count'] as const,
};

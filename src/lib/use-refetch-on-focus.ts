import { useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';

/**
 * Revalidate a query when its screen regains focus (expo-router keeps tab
 * screens mounted, so `refetchOnMount` alone never refires). Skips the first
 * focus (the mount fetch covers it) and anything still fresh — popping back
 * from a sub screen shouldn't trigger churn.
 */
export function useRefetchOnFocus(queryKey: readonly unknown[]) {
  const queryClient = useQueryClient();
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      queryClient.refetchQueries({ queryKey, stale: true });
      // queryKey is a fresh array literal each render; its serialized form is stable.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [queryClient, JSON.stringify(queryKey)]),
  );
}

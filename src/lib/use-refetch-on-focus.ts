import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';

/**
 * Revalidate a query when its screen regains focus (expo-router keeps tab
 * screens mounted, so `refetchOnMount` alone never refires). Skips the first
 * focus — the mount fetch already covers it.
 */
export function useRefetchOnFocus(refetch: () => unknown) {
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      refetch();
    }, [refetch]),
  );
}

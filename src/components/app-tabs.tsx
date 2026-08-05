import { useQuery } from '@tanstack/react-query';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';
import { fetchUnreadCount } from '@/lib/notifications';
import { queryKeys } from '@/lib/query';

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  // Light poll keeps the badge honest while the app is open.
  const { data: unread = 0 } = useQuery({
    queryKey: queryKeys.unreadCount,
    queryFn: fetchUnreadCount,
    refetchInterval: 30_000,
  });

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Browse</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/explore.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="shelf">
        <NativeTabs.Trigger.Label>Shelf</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/home.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="trades">
        <NativeTabs.Trigger.Label>Trades</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="arrow.left.arrow.right" md="swap_horiz" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="inbox">
        <NativeTabs.Trigger.Label>Inbox</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="tray" md="inbox" />
        {unread > 0 && (
          <NativeTabs.Trigger.Badge>{String(unread)}</NativeTabs.Trigger.Badge>
        )}
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.crop.circle" md="person" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

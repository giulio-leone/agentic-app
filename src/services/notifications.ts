/**
 * Local notification service — handles permissions, channels, and scheduling.
 * Uses expo-notifications for local-only notifications (no push server needed).
 */

import * as Notifications from 'expo-notifications';
import { Platform, AppState } from 'react-native';

const CHANNEL_ID = 'chat-responses';

/** Configure notification handler (call once at app startup) */
export function configureNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    }),
  });

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Chat Responses',
      description: 'Notifications when AI responses complete',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 100, 50, 100],
      lightColor: '#10A37F',
      sound: 'default',
    });
  }
}

/** Request notification permissions (returns true if granted) */
export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/** Check if app is in background */
export function isAppInBackground(): boolean {
  return AppState.currentState !== 'active';
}

/** Schedule an immediate local notification for a completed response */
export async function notifyResponseComplete(preview: string, sessionName?: string) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: sessionName ?? 'Agentic',
      body: preview.length > 100 ? preview.slice(0, 100) + '…' : preview,
      sound: 'default',
      ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
    },
    trigger: null, // immediate
  });
}

/** Update app badge count */
export async function setBadgeCount(count: number) {
  await Notifications.setBadgeCountAsync(count);
}

/** Clear all notifications and badge */
export async function clearAll() {
  await Notifications.dismissAllNotificationsAsync();
  await Notifications.setBadgeCountAsync(0);
}

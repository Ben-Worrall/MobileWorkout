import { Platform, AppState } from 'react-native';
import * as Notifications from 'expo-notifications';

const CHANNEL_ID = 'rest-timer';
let configured = false;

// Safe to call repeatedly. Creates the channel and decides how to present a notification that fires while the app is open.
export async function configureNotifications() {
  if (configured || Platform.OS !== 'android') return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      // In the foreground the rest chip + haptics already tell the user, so skip the banner but still play the sound.
      shouldShowAlert: AppState.currentState !== 'active',
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Rest timer',
    description: 'Tells you when your rest between sets is over',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 400, 200, 400],
    sound: 'default',
    enableVibrate: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

export async function ensureNotificationPermission() {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (current.canAskAgain === false) return false;
    const asked = await Notifications.requestPermissionsAsync();
    return !!asked.granted;
  } catch {
    return false;
  }
}

// Only one rest notification ever exists, so cancelling everything is both simple and correct.
export async function cancelRestNotification() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {}
}

export async function scheduleRestEnd(endAtMs, exerciseName) {
  if (Platform.OS !== 'android') return;
  try {
    await configureNotifications();
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (endAtMs - Date.now() < 1000) return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Rest over',
        body: exerciseName ? `Time for your next set of ${exerciseName}` : 'Time for your next set',
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: { date: new Date(endAtMs), channelId: CHANNEL_ID },
    });
  } catch (e) {
    console.warn('[notifications] schedule failed:', e && e.message);
  }
}

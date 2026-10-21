import { Application } from '@nativescript/core';

/**
 * Notifications.
 *
 * When the app is in the background and an answer arrives, the reader is not
 * looking at it. A notification carries the first lines of the reply and
 * brings the app back to the foreground when it is tapped - the same thing
 * the chat apps do when a message lands while you are elsewhere.
 *
 * NativeScript has no notification helper in core, so the platform's
 * `NotificationManager` is driven directly. A channel is created once (it is
 * required from Android 8 / API 26 on), and from Android 13 / API 33 the
 * POST_NOTIFICATIONS permission is asked for as well - see
 * `src/services/permissions.ts`.
 */

/** The channel every reply notification is posted on. */
const CHANNEL_ID = 'omniai-replies';

/** The name of the channel, as it appears in the system settings. */
const CHANNEL_NAME = 'AI replies';

/** Counts up so every notification gets its own request code. */
let nextRequestCode = 7000;

function context(): android.content.Context {
  return Application.android.context;
}

/** The notification manager of the app. */
function manager(): android.app.NotificationManager | undefined {
  try {
    return context().getSystemService(android.content.Context.NOTIFICATION_SERVICE) as
      android.app.NotificationManager;
  } catch {
    return undefined;
  }
}

/** The running Android level (0 when unknown). */
function sdkInt(): number {
  try {
    return android.os.Build.VERSION.SDK_INT ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Creates the notification channel.
 *
 * Required once from Android 8. Calling it again is harmless - the platform
 * keeps the channel the user has already configured.
 */
export function ensureChannel(): void {
  if (sdkInt() < 26) {
    return;
  }
  try {
    const m = manager();
    if (!m) {
      return;
    }
    const channel = new android.app.NotificationChannel(
      CHANNEL_ID,
      CHANNEL_NAME,
      android.app.NotificationManager.IMPORTANCE_HIGH,
    );
    channel.setDescription('Told when the assistant finishes an answer while the app is closed.');
    channel.enableVibration(true);
    m.createNotificationChannel(channel);
  } catch (err) {
    console.error('Could not create the notification channel:', err);
  }
}

/** An intent that brings the app back to the foreground. */
function openIntent(): android.app.PendingIntent {
  const intent = new android.content.Intent(context(), (globalThis as any).com?.tns?.NativeScriptActivity);
  intent.setAction('android.intent.action.MAIN');
  intent.addCategory('android.intent.category.LAUNCHER');
  intent.setFlags(
    android.content.Intent.FLAG_ACTIVITY_NEW_TASK | android.content.Intent.FLAG_ACTIVITY_CLEAR_TOP,
  );

  const flags = android.app.PendingIntent.FLAG_UPDATE_CURRENT | android.app.PendingIntent.FLAG_IMMUTABLE;
  return android.app.PendingIntent.getActivity(context(), nextRequestCode++, intent, flags);
}

export interface ReplyNotification {
  /** Who is answering - the title line of the notification. */
  title: string;
  /** The first lines of the reply. */
  text: string;
}

/**
 * Shows a notification that an answer is waiting.
 *
 * The caller is expected to have checked that the app is in the background
 * (`Application.inBackground`) - a reply that arrives while the app is open
 * needs no notification, and showing one anyway would be noise.
 */
export function notifyReply(notification: ReplyNotification): void {
  if (!Application.android) {
    return;
  }
  try {
    ensureChannel();
    const m = manager();
    if (!m) {
      return;
    }
    // On Android 13+ a notification is silent unless the permission is held.
    if (sdkInt() >= 33 && !hasNotificationPermission()) {
      return;
    }

    const builder =
      sdkInt() >= 26
        ? new android.app.Notification.Builder(context(), CHANNEL_ID)
        : (new android.app.Notification.Builder(context()) as any);

    builder
      .setSmallIcon(android.R.drawable.stat_notify_chat)
      .setContentTitle(notification.title)
      .setContentText(notification.text)
      .setStyle(new android.app.Notification.BigTextStyle().bigText(notification.text))
      .setAutoCancel(true)
      .setContentIntent(openIntent())
      .setPriority(android.app.Notification.PRIORITY_HIGH);

    // A stable id keeps a burst of replies from stacking up forever.
    m.notify(20128, builder.build());
  } catch (err) {
    console.error('Could not post the reply notification:', err);
  }
}

/** True when notifications are allowed (always true below Android 13). */
function hasNotificationPermission(): boolean {
  try {
    return (
      context().checkSelfPermission('android.permission.POST_NOTIFICATIONS') ===
      android.content.pm.PackageManager.PERMISSION_GRANTED
    );
  } catch {
    return false;
  }
}

/** Removes every notification the app posted. */
export function cancelAll(): void {
  try {
    manager()?.cancelAll();
  } catch {
    /* ignore */
  }
}

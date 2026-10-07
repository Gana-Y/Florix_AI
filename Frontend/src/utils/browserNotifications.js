/**
 * Browser Web Notifications utility for Florix AI.
 * Handles permission requests, graceful fallbacks, and safe notification dispatching.
 */

export const isNotificationSupported = () => {
  return typeof window !== 'undefined' && 'Notification' in window;
};

export const getNotificationPermission = () => {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
};

export const requestNotificationPermission = async () => {
  if (!isNotificationSupported()) return 'unsupported';
  try {
    const perm = await Notification.requestPermission();
    return perm;
  } catch (err) {
    console.warn('[Notifications] Error requesting notification permission:', err);
    return Notification.permission || 'denied';
  }
};

export const showBrowserNotification = ({
  title,
  body,
  icon = '/favicon.ico',
  tag,
  data,
  onClick,
}) => {
  if (!isNotificationSupported()) return false;
  if (Notification.permission !== 'granted') return false;

  try {
    const notif = new Notification(title, {
      body,
      icon,
      tag: tag || `florix-${Date.now()}`,
      data,
    });

    notif.onclick = (event) => {
      try {
        window.focus();
      } catch (_) {}
      if (typeof onClick === 'function') {
        onClick(event, data);
      }
      notif.close();
    };

    return true;
  } catch (err) {
    console.warn('[Notifications] Failed to display browser notification:', err);
    return false;
  }
};

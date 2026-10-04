import { useEffect, useState, useRef } from 'react';
import { getToken, onMessage } from 'firebase/messaging';
import { getFirebaseMessaging, firebaseConfig } from '../lib/firebase';
import { toast } from 'sonner';
import { pushService } from '../services';

// ─── Module-level guard ──────────────────────────────────────────────────────
// The hook is mounted by multiple components simultaneously (Dashboard, 
// NotificationBell, Notification). Without a shared flag each instance would
// independently call requestPermissionAndSubscribe() on mount and show the
// "subscribed" toast 3× in a row. This flag ensures the subscribe + toast only
// runs ONCE per page session regardless of how many components mount the hook.
let _subscribeInProgress = false;
let _subscribed = false;
// ─────────────────────────────────────────────────────────────────────────────

export const usePushNotifications = (scrollThreshold = 0.7) => {
  const [token, setToken] = useState(null);
  const [permission, setPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );
  const scrolledRef = useRef(false);

  // Set up Firebase foreground message listener (safe to call in every instance)
  useEffect(() => {
    let unsubscribe = null;

    const setupForegroundMessaging = async () => {
      const messaging = await getFirebaseMessaging();
      if (!messaging) return;

      unsubscribe = onMessage(messaging, (payload) => {
        console.log("Foreground message received:", payload);
        // OS notification and toast are handled by NotificationBell SSE stream
        // to avoid double-popups.
      });
    };

    setupForegroundMessaging();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const requestPermissionAndSubscribe = async () => {
    // Deduplicate: if already subscribed or a subscribe is in progress, skip.
    if (_subscribed || _subscribeInProgress) return;
    _subscribeInProgress = true;

    try {
      const currentPermission = await Notification.requestPermission();
      setPermission(currentPermission);

      if (currentPermission === 'granted') {
        const messaging = await getFirebaseMessaging();
        if (!messaging) {
          _subscribeInProgress = false;
          return;
        }

        const swUrl = `/firebase-messaging-sw.js?apiKey=${firebaseConfig.apiKey}&projectId=${firebaseConfig.projectId}&messagingSenderId=${firebaseConfig.messagingSenderId}&appId=${firebaseConfig.appId}&authDomain=${firebaseConfig.authDomain}&storageBucket=${firebaseConfig.storageBucket}`;

        const registration = await navigator.serviceWorker.register(swUrl);

        const currentToken = await getToken(messaging, {
          vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
          serviceWorkerRegistration: registration,
        });

        if (currentToken) {
          setToken(currentToken);
          await pushService.subscribe(currentToken);
          console.log("Push token sent to backend successfully.");
          // ✅ Toast fires exactly once — module-level flag prevents re-entry
          toast.success("Push notifications enabled.");
          _subscribed = true;
        }
      } else {
        toast.error("Permission denied for push notifications.");
      }
    } catch (error) {
      console.error("Error subscribing to push notifications:", error);
    } finally {
      _subscribeInProgress = false;
    }
  };

  // Auto-subscribe on mount if permission is already granted.
  // The module-level flag ensures only the first mounting component does work.
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "granted") {
      requestPermissionAndSubscribe();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Trigger subscribe when user scrolls past threshold (first time only).
  useEffect(() => {
    const handleScroll = () => {
      if (scrolledRef.current) return;

      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = document.documentElement.clientHeight;
      const scrolledPercentage = scrollTop / (scrollHeight - clientHeight);

      if (scrolledPercentage >= scrollThreshold) {
        scrolledRef.current = true;
        if (Notification.permission === 'default' || Notification.permission === 'granted') {
          requestPermissionAndSubscribe();
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollThreshold]);

  return { requestPermissionAndSubscribe, token, permission };
};

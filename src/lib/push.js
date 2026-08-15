import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';

// Public by design: this key is handed to the browser's push service and is
// embedded in every subscription. The matching private key lives in Supabase
// Vault and never leaves the server.
const VAPID_PUBLIC_KEY = 'BFOjEcPuLY8ke7ySX2SE9j6TwHrM3uvGfX52Knm3dLBPRcF2IIIrkn_lRD_o3LDr-0-hA9hxLYzsI-MZhSDekmQ';

/** The push API wants a Uint8Array, but VAPID keys travel as base64url. */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

/**
 * What to offer someone about reminders: 'install', 'enable', or nothing.
 *
 * A function rather than a chain of early returns in each component, because
 * the ordering is subtle enough to have already been got wrong twice — and
 * ordering is exactly the sort of thing a test can pin down.
 *
 * The trap: in an iOS browser tab Apple exposes neither PushManager nor
 * Notification, so feature detection reports "unsupported". That's true of the
 * tab and false of the device — installing the app is precisely what fixes it.
 * Checking `supported` first therefore hid the install prompt from the only
 * platform where installing is mandatory. `needsInstallFirst` has to win.
 */
export function reminderOffer({ ready, dismissed, subscribed, supported, permission, needsInstallFirst }) {
  // Nothing to say until we know the real subscription state.
  if (!ready || dismissed || subscribed) return null;
  if (needsInstallFirst) return 'install';
  if (!supported) return null;
  // Blocked at the browser level; no prompt can undo that from here.
  if (permission === 'denied') return null;
  return 'enable';
}

export function pushSupported() {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

/**
 * iOS only delivers web push to an installed app, and gives no way to prompt
 * for it from a Safari tab — so on iPhone, "add to home screen" isn't polish,
 * it's a prerequisite. Detecting this lets the UI explain that rather than
 * offering a toggle that silently cannot work.
 */
export function isIos() {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
    // iPadOS reports as a Mac, distinguishable only by touch support.
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isStandalone() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

function subscriptionRow(sub, userId) {
  const json = sub.toJSON();
  return {
    user_id: userId,
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
    user_agent: navigator.userAgent.slice(0, 300),
  };
}

export function usePushNotifications(userId) {
  const [supported] = useState(pushSupported);
  const [permission, setPermission] = useState(
    () => (typeof Notification !== 'undefined' ? Notification.permission : 'default')
  );
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  // Whether the check below has actually run. Without it a caller can't tell
  // "not subscribed" from "haven't looked yet", and anything that renders on
  // that distinction flashes up before correcting itself.
  const [ready, setReady] = useState(false);

  // Reflect the real subscription rather than what we last did: the user can
  // revoke notifications in browser settings without telling the app.
  const refresh = useCallback(async () => {
    if (!supported) { setReady(true); return; }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setSubscribed(!!sub);
      setPermission(Notification.permission);
    } catch {
      setSubscribed(false);
    } finally {
      setReady(true);
    }
  }, [supported]);

  useEffect(() => { refresh(); }, [refresh]);

  const subscribe = useCallback(async () => {
    if (!supported || !userId) return { ok: false, reason: 'unsupported' };
    setBusy(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== 'granted') return { ok: false, reason: result };

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      // onConflict on endpoint: re-subscribing on the same device should move
      // the existing row rather than accumulate duplicates.
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert(subscriptionRow(sub, userId), { onConflict: 'endpoint' });
      if (error) throw error;

      setSubscribed(true);
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: err.message };
    } finally {
      setBusy(false);
    }
  }, [supported, userId]);

  const unsubscribe = useCallback(async () => {
    if (!supported) return;
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        // Delete our record first: a row we can no longer reach would keep
        // getting sent to until the push service expired it.
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } finally {
      setBusy(false);
    }
  }, [supported]);

  return {
    supported,
    ready,
    permission,
    subscribed,
    busy,
    subscribe,
    unsubscribe,
    // iOS can't subscribe from a browser tab at all.
    needsInstallFirst: isIos() && !isStandalone(),
  };
}

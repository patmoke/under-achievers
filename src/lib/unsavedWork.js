import { useEffect } from 'react';

/**
 * Tracks whether anything on screen would be lost by a reload.
 *
 * This exists so service-worker updates can apply themselves silently on the
 * screens where a reload costs nothing, and only interrupt on the screens
 * where it costs something. Almost everything here is read-only — standings,
 * leaderboards, league pages — and reloading those is free. The picks screen
 * is the exception: a week of spreads and star allocations lives in component
 * state until it's submitted.
 */

const dirtyKeys = new Set();
const listeners = new Set();

function notify() {
  listeners.forEach(fn => fn(dirtyKeys.size > 0));
}

export function markUnsaved(key) {
  if (dirtyKeys.has(key)) return;
  dirtyKeys.add(key);
  notify();
}

export function clearUnsaved(key) {
  if (!dirtyKeys.delete(key)) return;
  notify();
}

export function hasUnsavedWork() {
  return dirtyKeys.size > 0;
}

export function subscribeUnsaved(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Registers a screen's unsaved state for as long as it's mounted. */
export function useUnsavedWork(key, isDirty) {
  useEffect(() => {
    if (isDirty) markUnsaved(key);
    else clearUnsaved(key);
  }, [key, isDirty]);

  // Unmounting means the state is gone anyway, so it can't be lost to a reload.
  useEffect(() => () => clearUnsaved(key), [key]);
}

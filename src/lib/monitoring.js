import { supabase } from './supabase';

// Injected at build time from the deployed commit; see vite.config.js. Knowing
// which build an error came from is most of the work of reproducing it.
const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';

/**
 * Errors that repeat forever and mean nothing.
 *
 * Left in, these would drown the real ones — which is the failure mode of
 * every error tracker nobody looks at any more.
 */
const IGNORED = [
  // A deploy replaced the bundle mid-session and an old chunk 404s. The
  // service worker already resolves this by reloading.
  /Loading chunk \d+ failed/i,
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  // A benign layout loop that Safari and several in-app browsers report.
  /ResizeObserver loop/i,
  // Someone's train went into a tunnel. Not a defect.
  /NetworkError when attempting to fetch/i,
  /^Load failed$/i,
  /Failed to fetch$/i,
];

function isIgnorable(message, stack) {
  if (!message) return true;
  if (IGNORED.some(re => re.test(message))) return true;
  // Browser extensions throw inside our page and arrive looking like our bugs.
  return /(?:chrome|moz|safari-web)-extension:\/\//.test(stack || '');
}

// djb2. Not security, just a stable short key for grouping.
function hash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = (((h << 5) + h + str.charCodeAt(i)) | 0);
  return (h >>> 0).toString(16);
}

/**
 * Groups occurrences of the same bug onto one row.
 *
 * Digits are stripped before hashing so that "week 3" and "week 5" versions of
 * one fault land together rather than filling the table with near-duplicates.
 */
function fingerprintOf(message, stack) {
  const topFrame = (stack || '').split('\n')[1]?.trim() || '';
  return hash(`${message}|${topFrame}`.replace(/\d+/g, '#'));
}

// One report per fingerprint per page load. The stored count therefore reads
// as "sessions affected", which is more useful than "times thrown" — a render
// loop firing ten thousand times is still one broken session.
const reportedThisSession = new Set();

export async function reportError(error, kind = 'error') {
  try {
    const message = String(error?.message ?? error ?? '').slice(0, 500);
    const stack = error?.stack ? String(error.stack).slice(0, 4000) : null;
    if (isIgnorable(message, stack)) return;

    const fingerprint = fingerprintOf(message, stack);
    if (reportedThisSession.has(fingerprint)) return;
    reportedThisSession.add(fingerprint);

    await supabase.rpc('report_client_error', {
      p_fingerprint: fingerprint,
      p_message: message,
      p_stack: stack,
      p_kind: kind,
      p_url: window.location.pathname + window.location.search,
      p_app_version: APP_VERSION,
    });
  } catch {
    // Swallowed deliberately. This runs inside an error handler, so throwing
    // here would either loop or replace a useful error with a useless one.
  }
}

export function initMonitoring() {
  window.addEventListener('error', event => {
    // Failed <img>/<script> loads also fire this, without an error object.
    if (!event.error) return;
    reportError(event.error, 'error');
  });

  window.addEventListener('unhandledrejection', event => {
    reportError(event.reason, 'unhandledrejection');
  });
}

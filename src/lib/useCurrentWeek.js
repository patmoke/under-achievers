import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import { getCurrentNFLWeek, deriveCurrentWeek } from './scoring';

// The week turns over at the kickoff of a week's last game, so checking four
// times an hour is plenty to catch it. The cost of a stale week is real —
// picking into a week that has already closed — and the cost of the query is a
// single row.
const RECHECK_INTERVAL_MS = 15 * 60 * 1000;

/**
 * The current NFL week, read from the synced schedule.
 *
 * This used to be a module-level constant computed once at import from a
 * hardcoded, estimated kickoff date. Two problems: a tab left open across the
 * rollover kept a stale week for ever, and if the estimate was off, every week
 * number shifted with it — which decides when picks lock.
 *
 * Reading the real schedule fixed the second problem but only half of the
 * first, because it still ran once per mount. An installed app can stay open
 * for days, so it now re-derives on a timer and whenever the app comes back to
 * the foreground — the same two triggers ReloadPrompt uses to notice new
 * builds, and for the same reason.
 *
 * Returns the date-based estimate immediately so callers never render with a
 * null week, then swaps to the schedule-derived value once it loads.
 */
export function useCurrentWeek(season = 2026) {
  const [week, setWeek] = useState(() => getCurrentNFLWeek(season));

  const derive = useCallback(async () => {
    // Only the next upcoming game is needed to identify the current week.
    const { data, error } = await supabase
      .from('games')
      .select('week, game_time')
      .eq('season', season)
      .lte('week', 18)
      .gt('game_time', new Date().toISOString())
      .order('game_time')
      .limit(1);

    if (error) return;

    const derived = deriveCurrentWeek(data, new Date());
    // No upcoming games means the season is over; keep the estimate rather
    // than snapping backwards to a stale week.
    if (derived != null) setWeek(derived);
  }, [season]);

  useEffect(() => {
    derive();

    const timer = setInterval(derive, RECHECK_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') derive();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [derive]);

  return week;
}

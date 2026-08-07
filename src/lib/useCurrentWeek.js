import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { getCurrentNFLWeek, deriveCurrentWeek } from './scoring';

/**
 * The current NFL week, read from the synced schedule.
 *
 * Previously this was a module-level constant computed once at import time
 * from a hardcoded, estimated kickoff date. That had two problems: a tab left
 * open across the Tuesday rollover kept a stale week forever, and if the
 * estimated date was off, every week number shifted with it — which decides
 * when picks lock. Now that the real schedule is synced, we read it.
 *
 * Returns the date-based estimate immediately so callers never render with a
 * null week, then swaps to the schedule-derived value once it loads.
 */
export function useCurrentWeek(season = 2026) {
  const [week, setWeek] = useState(() => getCurrentNFLWeek(season));

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Only the next upcoming game is needed to identify the current week.
      const { data, error } = await supabase
        .from('games')
        .select('week, game_time')
        .eq('season', season)
        .lte('week', 18)
        .gt('game_time', new Date().toISOString())
        .order('game_time')
        .limit(1);

      if (cancelled || error) return;

      const derived = deriveCurrentWeek(data, new Date());
      // No upcoming games means the season is over; keep the estimate rather
      // than snapping backwards to a stale week.
      if (derived != null) setWeek(derived);
    })();

    return () => { cancelled = true; };
  }, [season]);

  return week;
}

// A full-season simulation, run against the real 2026 schedule.
//
// The unit tests beside this one check each rule in isolation against small
// hand-built fixtures. This one plays all eighteen weeks through the actual
// synced schedule — bye weeks, Thanksgiving, the Christmas games, the week 18
// all-at-once slate, the November clock change — and asserts the whole thing
// stays coherent at every step.
//
// It exists because the failures worth catching here aren't logic errors in
// any one function. They're interactions: a week rolling over at the wrong
// moment, an entry being eliminated by a week it had already bought back out
// of, a freeze point landing on the wrong side of a kickoff. None of those
// show up against a three-game fixture.

import { describe, it, expect } from 'vitest';
import { SEASON_2026, WEEKS, gamesForWeek, kickoff } from './__fixtures__/season2026';
import { deriveCurrentWeek } from './scoring';
import {
  CONFIDENCE_MIN, CONFIDENCE_MAX,
  confidenceBudget, confidenceSpent, starsAvailable, buildStandings,
} from './scoring';
import { computeEntryStatus, usedTeams, isGameLocked, pickOutcome } from './survivor';
import { lineFreezeSchedule, easternParts } from './lines';

const SECOND = 1000;
const sorted = [...SEASON_2026].sort((a, b) => kickoff(a) - kickoff(b));
const firstKick = w => Math.min(...gamesForWeek(w).map(kickoff));
const lastKick = w => Math.max(...gamesForWeek(w).map(kickoff));

// ─── The fixture itself ─────────────────────────────────────────────────────
//
// Every assertion below rests on this data being a real season. If a resync
// ever writes something malformed, these fail first and name the problem,
// rather than the simulation failing somewhere downstream for no clear reason.

describe('the 2026 schedule', () => {
  it('is a complete regular season', () => {
    expect(SEASON_2026).toHaveLength(272);
    expect(WEEKS).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
  });

  it('gives all 32 teams 17 games each', () => {
    const played = {};
    for (const g of SEASON_2026) {
      played[g.home_team_abbr] = (played[g.home_team_abbr] || 0) + 1;
      played[g.away_team_abbr] = (played[g.away_team_abbr] || 0) + 1;
    }
    expect(Object.keys(played)).toHaveLength(32);
    expect(Object.values(played).every(n => n === 17)).toBe(true);
  });

  it('never has a team playing twice in one week', () => {
    for (const w of WEEKS) {
      const teams = gamesForWeek(w).flatMap(g => [g.home_team_abbr, g.away_team_abbr]);
      expect(new Set(teams).size).toBe(teams.length);
    }
  });

  it('keeps the weeks in strict time order, with no overlap', () => {
    for (let w = 1; w < 18; w++) {
      expect(lastKick(w)).toBeLessThan(firstKick(w + 1));
    }
  });
});

// ─── Which week is it ───────────────────────────────────────────────────────

describe('deriving the current week, all season', () => {
  it('reads week 1 before a ball is thrown', () => {
    expect(deriveCurrentWeek(SEASON_2026, new Date('2026-07-04T12:00:00Z'))).toBe(1);
    expect(deriveCurrentWeek(SEASON_2026, new Date(firstKick(1) - SECOND))).toBe(1);
  });

  it('holds the week through its own slate, at every kickoff in the season', () => {
    // A moment before each game starts, that game's week is the current one —
    // the games already played that week don't advance it.
    for (const game of sorted) {
      const justBefore = new Date(kickoff(game) - SECOND);
      expect(
        deriveCurrentWeek(SEASON_2026, justBefore),
        `${game.id} at ${justBefore.toISOString()}`,
      ).toBe(game.week);
    }
  });

  it('rolls over exactly when the week\'s last game kicks off', () => {
    for (let w = 1; w < 18; w++) {
      expect(deriveCurrentWeek(SEASON_2026, new Date(lastKick(w) - SECOND))).toBe(w);
      expect(deriveCurrentWeek(SEASON_2026, new Date(lastKick(w)))).toBe(w + 1);
    }
  });

  it('stays on week 18 once the season is over rather than falling back to 1', () => {
    expect(deriveCurrentWeek(SEASON_2026, new Date(lastKick(18)))).toBe(18);
    expect(deriveCurrentWeek(SEASON_2026, new Date('2027-06-01T00:00:00Z'))).toBe(18);
  });

  it('ignores playoff and scratch rows carrying out-of-range weeks', () => {
    const withJunk = [
      ...SEASON_2026,
      { week: 19, game_time: '2027-01-17T18:00:00Z' },
      { week: 0, game_time: '2026-08-01T18:00:00Z' },
    ];
    expect(deriveCurrentWeek(withJunk, new Date(firstKick(1) - SECOND))).toBe(1);
    expect(deriveCurrentWeek(withJunk, new Date(lastKick(18)))).toBe(18);
  });
});

// ─── When the lines settle ──────────────────────────────────────────────────

describe('the line freeze schedule', () => {
  const schedule = lineFreezeSchedule(SEASON_2026);

  // Recorded from a live sync-games run against this same schedule. The Edge
  // Function carries its own copy of the freeze rule, so this is what keeps
  // the two implementations honest: if either drifts, this fails.
  const PRODUCTION = {
    1: '2026-09-07T04:20:00.000Z', 2: '2026-09-14T04:20:00.000Z', 3: '2026-09-21T04:20:00.000Z',
    4: '2026-09-28T04:20:00.000Z', 5: '2026-10-05T04:20:00.000Z', 6: '2026-10-12T04:20:00.000Z',
    7: '2026-10-19T04:20:00.000Z', 8: '2026-10-26T04:20:00.000Z', 9: '2026-11-02T05:20:00.000Z',
    10: '2026-11-09T05:20:00.000Z', 11: '2026-11-16T05:20:00.000Z', 12: '2026-11-23T05:20:00.000Z',
    13: '2026-11-30T05:20:00.000Z', 14: '2026-12-07T05:20:00.000Z', 15: '2026-12-14T05:20:00.000Z',
    16: '2026-12-21T05:20:00.000Z', 17: '2026-12-28T05:20:00.000Z', 18: '2027-01-04T05:20:00.000Z',
  };

  it('agrees with what the deployed sync actually computed', () => {
    const mine = Object.fromEntries(
      Object.entries(schedule).map(([w, at]) => [w, new Date(at).toISOString()]),
    );
    expect(mine).toEqual(PRODUCTION);
  });

  it('lands every week just after midnight Eastern on a Monday', () => {
    for (const w of WEEKS) {
      const p = easternParts(schedule[w]);
      expect({ week: w, weekday: p.weekday, hour: p.hour, minute: p.minute })
        .toEqual({ week: w, weekday: 1, hour: 0, minute: 20 });
    }
  });

  it('settles a week before any of that week\'s games kick off', () => {
    // The point of the rule. A freeze landing after a kickoff would mean the
    // line for an already-played game was still moving.
    for (const w of WEEKS) {
      expect(schedule[w], `week ${w}`).toBeLessThan(firstKick(w));
    }
  });

  it('leaves a clear run between the freeze and the first kickoff', () => {
    // Most weeks get the full Monday-to-Thursday gap. The two that don't are
    // the ones opening on a Wednesday — week 1 and Thanksgiving week — and
    // they still get more than two days of nobody's lines moving, which is
    // the property that matters.
    for (const w of WEEKS) {
      const days = (firstKick(w) - schedule[w]) / (24 * 60 * 60 * 1000);
      expect(days, `week ${w}`).toBeGreaterThan(2.5);
    }
    const short = WEEKS.filter(w => (firstKick(w) - schedule[w]) / (24 * 60 * 60 * 1000) < 3);
    expect(short).toEqual([1, 12]);
  });

  it('moves forward one week at a time and never backwards', () => {
    for (let w = 1; w < 18; w++) {
      expect(schedule[w + 1]).toBeGreaterThan(schedule[w]);
    }
  });

  it('handles the Thanksgiving and Christmas weeks like any other', () => {
    // Week 12 opens on a Wednesday and week 16 on a Thursday before Christmas;
    // both still freeze on the ordinary Monday, from the prior week's Sunday.
    expect(easternParts(firstKick(12)).weekday).toBe(3);
    expect(easternParts(schedule[12]).weekday).toBe(1);
    expect(easternParts(schedule[16]).weekday).toBe(1);
  });

  it('crosses the November clock change without shifting the local hour', () => {
    // Week 8 freezes under daylight time, week 9 under standard time. The UTC
    // instants differ by an hour; the Eastern wall clock does not.
    expect(new Date(schedule[9]).getUTCHours()).toBe(5);
    expect(new Date(schedule[8]).getUTCHours()).toBe(4);
    expect(easternParts(schedule[9]).hour).toBe(easternParts(schedule[8]).hour);
  });
});

// ─── A survivor pool, played out ────────────────────────────────────────────

/**
 * Plays out the whole season once, deciding every game.
 *
 * The result belongs to the game, not to whoever picked it. That distinction
 * is the reason this exists: two entries in a pool routinely take opposite
 * sides of the same game, and exactly one of them can be right. Scoring games
 * per-pick would quietly let both survive.
 *
 * Which team wins is arbitrary but fixed, so a failure here is reproducible.
 */
function playOutSeason() {
  const tieId = SEASON_2026.find(g => g.week === 3).id;
  return SEASON_2026.map((g, i) => {
    const result = g.id === tieId ? 'tie' : (i % 3 === 0 ? 'away' : 'home');
    const level = result === 'tie';
    return {
      ...g,
      status: 'final',
      home_score: level ? 20 : result === 'home' ? 24 : 17,
      away_score: level ? 20 : result === 'home' ? 17 : 24,
      result,
    };
  });
}

const RESULTS = playOutSeason();
const resultsForWeek = w => RESULTS.filter(g => g.week === w);
const winnerOf = g => (g.result === 'home' ? g.home_team_abbr : g.result === 'away' ? g.away_team_abbr : null);
const loserOf = g => (g.result === 'home' ? g.away_team_abbr : g.result === 'away' ? g.home_team_abbr : null);

/**
 * Walks a legal path through the season: one team a week, never reused,
 * always a team that actually plays that week.
 *
 * Generated rather than hardcoded because bye weeks make a hand-written list
 * wrong in a way that looks like a bug in the pool rather than a bug in the
 * fixture. `skew` starts different entries on different teams so the pool
 * isn't several copies of one path. `lose` and `tie` name the weeks where the
 * entry takes the wrong side.
 */
function pickPath({ from = 1, to = 18, skew = 0, lose = [], tie = [] }) {
  const used = new Set();
  const path = {};
  for (let w = from; w <= to; w++) {
    if (tie.includes(w)) {
      const g = resultsForWeek(w).find(x => x.result === 'tie');
      const team = [g.home_team_abbr, g.away_team_abbr].find(t => !used.has(t));
      used.add(team);
      path[w] = { team, expect: 'tie' };
      continue;
    }
    const losing = lose.includes(w);
    const side = losing ? loserOf : winnerOf;
    const options = resultsForWeek(w).filter(g => g.result !== 'tie' && !used.has(side(g)));
    const g = options[(skew + w) % options.length];
    used.add(side(g));
    path[w] = { team: side(g), expect: losing ? 'loss' : 'win' };
  }
  return path;
}

/** The picks an entry has actually filed by `throughWeek`. */
function picksFor(entries, throughWeek) {
  const picks = [];
  let n = 0;
  for (const entry of entries) {
    for (const [weekStr, step] of Object.entries(entry.script)) {
      const week = Number(weekStr);
      if (week > throughWeek || step === null) continue;
      const game = resultsForWeek(week).find(
        g => g.home_team_abbr === step.team || g.away_team_abbr === step.team,
      );
      picks.push({ id: `p${n++}`, entry_id: entry.id, week, team_abbr: step.team, games: game });
    }
  }
  return picks;
}

describe('a survivor pool over a full season', () => {
  const ENTRIES = [
    { id: 'perfect', start_week: 1, script: pickPath({ skew: 0 }) },

    // Goes out on a week 5 loss, then keeps picking — which the UI shouldn't
    // allow but a stale tab or a direct write could. Must not resurrect them.
    { id: 'loses-w5', start_week: 1, script: pickPath({ to: 7, skew: 3, lose: [5] }) },

    { id: 'ties-w3', start_week: 1, script: pickPath({ to: 3, skew: 5, tie: [3] }) },

    // Forgets week 7 entirely, then carries on as if nothing happened.
    { id: 'misses-w7', start_week: 1,
      script: { ...pickPath({ to: 8, skew: 7 }), 7: null } },

    // Lost week 2, paid the buyback, which advanced start_week to 3.
    { id: 'bought-back', start_week: 3, script: pickPath({ to: 5, skew: 9, lose: [2] }) },

    { id: 'late-entry', start_week: 4, script: pickPath({ from: 4, to: 6, skew: 11 }) },
  ];

  const seasonOver = new Date(lastKick(18) + 4 * 60 * 60 * 1000);
  const allPicks = picksFor(ENTRIES, 18);
  const status = (id, currentWeek, now, picks = allPicks) =>
    computeEntryStatus({ entry: ENTRIES.find(e => e.id === id), picks, games: RESULTS, currentWeek, now });

  it('picks a legal path: a team that plays, and never the same one twice', () => {
    for (const entry of ENTRIES) {
      const steps = Object.entries(entry.script).filter(([, v]) => v !== null);
      const teams = steps.map(([, v]) => v.team);
      expect(new Set(teams).size, `${entry.id} reused a team`).toBe(teams.length);
      for (const [w, v] of steps) {
        const playing = gamesForWeek(Number(w)).flatMap(g => [g.home_team_abbr, g.away_team_abbr]);
        expect(playing, `${entry.id} week ${w}: ${v.team} is on bye`).toContain(v.team);
      }
    }
  });

  it('grades every pick against the game, not against the picker', () => {
    for (const entry of ENTRIES) {
      for (const [weekStr, step] of Object.entries(entry.script)) {
        if (step === null) continue;
        const pick = allPicks.find(p => p.entry_id === entry.id && p.week === Number(weekStr));
        expect(pickOutcome(pick), `${entry.id} week ${weekStr}`).toBe(step.expect);
      }
    }
  });

  it('carries a perfect entry to the end of week 18', () => {
    expect(status('perfect', 18, seasonOver)).toEqual({ status: 'alive', week: null, reason: null });
  });

  it('keeps the perfect entry alive at every week along the way', () => {
    for (const w of WEEKS) {
      const now = new Date(lastKick(w) + 4 * 60 * 60 * 1000);
      expect(status('perfect', w, now, picksFor(ENTRIES, w)).status, `week ${w}`).toBe('alive');
    }
  });

  it('eliminates on a loss, in the week the loss happened', () => {
    expect(status('loses-w5', 18, seasonOver)).toEqual({ status: 'eliminated', week: 5, reason: 'loss' });
  });

  it('does not resurrect an eliminated entry that keeps picking', () => {
    // Weeks 6 and 7 were wins. The week 5 loss still governs.
    expect(status('loses-w5', 7, seasonOver).week).toBe(5);
  });

  it('treats a tie as an elimination', () => {
    expect(status('ties-w3', 18, seasonOver)).toEqual({ status: 'eliminated', week: 3, reason: 'loss' });
  });

  it('holds a missed week open until every game in it has kicked off', () => {
    const picks = picksFor(ENTRIES, 8);
    const w7 = gamesForWeek(7).map(kickoff).sort((a, b) => a - b);
    // Mid-slate: some games gone, the late ones still to come. Not out yet.
    expect(status('misses-w7', 7, new Date(w7[0] + SECOND), picks).status).toBe('alive');
    expect(status('misses-w7', 7, new Date(w7.at(-1) - SECOND), picks).status).toBe('alive');
    // The last kickoff passes and the week is unpickable.
    expect(status('misses-w7', 7, new Date(w7.at(-1)), picks))
      .toEqual({ status: 'eliminated', week: 7, reason: 'missed' });
  });

  it('forgives everything before a buyback', () => {
    // The week 2 loss is real and still in the picks table; start_week 3 is
    // what makes it stop counting. Read at week 5, the last week this entry
    // filed a pick for — past that it goes out for missing weeks, correctly.
    const bought = ENTRIES.find(e => e.id === 'bought-back');
    const picks = picksFor(ENTRIES, 5);
    const now = new Date(lastKick(5) + SECOND);
    expect(picks.some(p => p.entry_id === 'bought-back' && p.week === 2)).toBe(true);
    expect(status('bought-back', 5, now, picks).status).toBe('alive');
    // Without the buyback it would be out on the week 2 loss.
    expect(computeEntryStatus({
      entry: { ...bought, start_week: 1 }, picks, games: RESULTS, currentWeek: 5, now,
    })).toEqual({ status: 'eliminated', week: 2, reason: 'loss' });
  });

  it('does not count weeks before a late entry joined as missed', () => {
    const picks = picksFor(ENTRIES, 6);
    expect(status('late-entry', 6, new Date(lastKick(6) + SECOND), picks).status).toBe('alive');
  });

  it('still eliminates an entry that simply stops picking', () => {
    // The flip side of the two above: a buyback forgives what came before it,
    // not what comes after. Week 6 goes by unpicked and the entry is out.
    expect(status('bought-back', 6, new Date(lastKick(6) + SECOND), picksFor(ENTRIES, 6)))
      .toEqual({ status: 'eliminated', week: 6, reason: 'missed' });
  });

  it('burns a team only once its game has locked', () => {
    const entry = ENTRIES.find(e => e.id === 'perfect');
    const picks = picksFor(ENTRIES, 6);
    const team = entry.script[6].team;
    const game = resultsForWeek(6).find(g => g.home_team_abbr === team || g.away_team_abbr === team);

    const before = new Date(kickoff(game) - SECOND);
    const used = usedTeams({ entry, picks, currentWeek: 6, now: before });
    expect(used.has(team)).toBe(false);                 // this week's pick is still changeable
    expect(used.has(entry.script[1].team)).toBe(true);  // week 1 is long gone

    const after = new Date(kickoff(game) + SECOND);
    expect(usedTeams({ entry, picks, currentWeek: 6, now: after }).has(team)).toBe(true);
  });

  it('accumulates burned teams one per week, never skipping or double-counting', () => {
    const entry = ENTRIES.find(e => e.id === 'perfect');
    for (const w of WEEKS) {
      const picks = picksFor(ENTRIES, w);
      const now = new Date(lastKick(w) + SECOND);
      // Every week up to and including w has locked, so w teams are burned.
      expect(usedTeams({ entry, picks, currentWeek: w, now }).size, `week ${w}`).toBe(w);
    }
  });

  it('leaves a perfect entry with 14 teams it has never touched', () => {
    const entry = ENTRIES.find(e => e.id === 'perfect');
    const used = usedTeams({ entry, picks: allPicks, currentWeek: 18, now: seasonOver });
    expect(used.size).toBe(18);
    expect(32 - used.size).toBe(14);
  });

  it('locks every game the moment its kickoff passes, and not before', () => {
    for (const g of sorted) {
      expect(isGameLocked(g, new Date(kickoff(g) - SECOND)), g.id).toBe(false);
      expect(isGameLocked(g, new Date(kickoff(g))), g.id).toBe(true);
    }
  });
});

// ─── The Monday night window ────────────────────────────────────────────────
//
// The week turns over when its last game kicks off, but that game isn't final
// for another three hours. So for the length of Monday Night Football the app
// reads as next week while a pick on the game in progress is still ungraded.
//
// The question that matters: can someone whose Monday night pick is losing get
// a pick in for next week before their elimination lands? These pin the answer
// so it can't drift, whichever way it's decided.

describe('the window while Monday night football is being played', () => {
  const WEEK = 6;
  const mnf = [...gamesForWeek(WEEK)].sort((a, b) => kickoff(a) - kickoff(b)).at(-1);
  const kickedOff = new Date(kickoff(mnf) + 60 * 1000);
  const finished = new Date(kickoff(mnf) + 4 * 60 * 60 * 1000);

  const entry = { id: 'mnf', start_week: 1 };
  // Every week up to WEEK picked and won, except the Monday nighter, which is
  // about to lose. Teams are taken from the front of each slate, and the loser
  // of the Monday game is excluded so the path stays legal.
  const losingTeam = mnf.away_team_abbr;
  const priorPicks = [];
  const burned = new Set([losingTeam]);
  for (let w = 1; w < WEEK; w++) {
    const g = gamesForWeek(w).find(x => !burned.has(x.home_team_abbr));
    burned.add(g.home_team_abbr);
    priorPicks.push({
      entry_id: 'mnf', week: w, team_abbr: g.home_team_abbr,
      games: { ...g, status: 'final', home_score: 24, away_score: 17 },
    });
  }

  const inProgress = { ...mnf, status: 'scheduled', home_score: null, away_score: null };
  const lost = { ...mnf, status: 'final', home_score: 30, away_score: 10 }; // away pick loses
  const mnfPick = at => ({ entry_id: 'mnf', week: WEEK, team_abbr: losingTeam, games: at });

  const gamesWith = mnfGame => SEASON_2026.map(g => (g.id === mnf.id ? mnfGame : g));

  it('has already turned the page to next week', () => {
    expect(deriveCurrentWeek(SEASON_2026, kickedOff)).toBe(WEEK + 1);
  });

  it('still reads the entry as alive, because the game has no result yet', () => {
    const picks = [...priorPicks, mnfPick(inProgress)];
    expect(computeEntryStatus({
      entry, picks, games: gamesWith(inProgress), currentWeek: WEEK + 1, now: kickedOff,
    })).toEqual({ status: 'alive', week: null, reason: null });
  });

  it('so yes — a losing entry can file next week\'s pick before going out', () => {
    // This is the answer to the question. Nothing in the rules stops it: the
    // entry is alive, the week is WEEK + 1, and that week's games are open.
    const nextGame = gamesForWeek(WEEK + 1)[0];
    expect(isGameLocked(nextGame, kickedOff)).toBe(false);
    const picks = [...priorPicks, mnfPick(inProgress)];
    const used = usedTeams({ entry, picks, currentWeek: WEEK + 1, now: kickedOff });
    expect(used.has(nextGame.home_team_abbr) && used.has(nextGame.away_team_abbr)).toBe(false);
  });

  it('but cannot reuse the team that is losing on the field right now', () => {
    // The Monday pick belongs to a past week as far as usedTeams is concerned,
    // and its game has kicked off, so the team is burned either way.
    const picks = [...priorPicks, mnfPick(inProgress)];
    expect(usedTeams({ entry, picks, currentWeek: WEEK + 1, now: kickedOff }).has(losingTeam)).toBe(true);
  });

  it('and the early pick buys nothing: the loss still eliminates them', () => {
    const jumped = gamesForWeek(WEEK + 1).find(
      g => ![...burned].includes(g.home_team_abbr),
    );
    const picks = [
      ...priorPicks,
      mnfPick(lost),
      { entry_id: 'mnf', week: WEEK + 1, team_abbr: jumped.home_team_abbr, games: jumped },
    ];
    expect(computeEntryStatus({
      entry, picks, games: gamesWith(lost), currentWeek: WEEK + 1, now: finished,
    })).toEqual({ status: 'eliminated', week: WEEK, reason: 'loss' });
  });

  it('eliminates a missed week on time, which is the other half of the trade', () => {
    // The same early rollover is what catches someone who never picked at all:
    // once the Monday game kicks off the week is unpickable, and they are out.
    const missed = { id: 'missed', start_week: 1 };
    expect(computeEntryStatus({
      entry: missed, picks: priorPicks.map(p => ({ ...p, entry_id: 'missed' })),
      games: gamesWith(inProgress), currentWeek: WEEK + 1, now: kickedOff,
    })).toEqual({ status: 'eliminated', week: WEEK, reason: 'missed' });
  });
});

// ─── The weekly confidence budget ───────────────────────────────────────────

describe('the confidence budget, week by week', () => {
  it('gives two stars a game, every week of the season', () => {
    for (const w of WEEKS) {
      const n = gamesForWeek(w).length;
      expect(confidenceBudget(n)).toBe(n * 2);
    }
  });

  it('lets a full slate be picked at the average, exactly spending the budget', () => {
    for (const w of WEEKS) {
      const ids = gamesForWeek(w).map(g => g.id);
      const allTwos = Object.fromEntries(ids.map(id => [id, 2]));
      expect(confidenceSpent(allTwos, ids)).toBe(confidenceBudget(ids.length));
      expect(starsAvailable({
        budget: confidenceBudget(ids.length),
        spent: confidenceSpent(allTwos, ids),
        unpickedCount: 0,
      })).toBe(0);
    }
  });

  it('holds back a star for every game still unpicked', () => {
    for (const w of WEEKS) {
      const ids = gamesForWeek(w).map(g => g.id);
      const budget = confidenceBudget(ids.length);
      // One game picked at the cap, the rest untouched.
      const spent = confidenceSpent({ [ids[0]]: CONFIDENCE_MAX }, [ids[0]]);
      const free = starsAvailable({ budget, spent, unpickedCount: ids.length - 1 });
      // Spending everything free plus the reserved minimums lands exactly on
      // the budget — the reserve is what makes the remaining games affordable.
      expect(spent + free + (ids.length - 1) * CONFIDENCE_MIN).toBe(budget);
      expect(free).toBeGreaterThanOrEqual(0);
    }
  });

  it('cannot be gamed by pouring the budget into the early games', () => {
    // Maxing half a slate costs more than the whole week is worth. The guard
    // is starsAvailable going negative, which is what the UI reads to stop
    // you — confidenceSpent is just arithmetic and doesn't refuse anything.
    for (const w of WEEKS) {
      const ids = gamesForWeek(w).map(g => g.id);
      const half = ids.slice(0, Math.ceil(ids.length / 2));
      const maxed = Object.fromEntries(half.map(id => [id, CONFIDENCE_MAX]));
      const free = starsAvailable({
        budget: confidenceBudget(ids.length),
        spent: confidenceSpent(maxed, half),
        unpickedCount: ids.length - half.length,
      });
      expect(free, `week ${w}`).toBeLessThan(0);
    }
  });

  it('always leaves a legal way to finish the week', () => {
    // Whatever you have spent, if the tracker says you have stars free then
    // picking every remaining game at the minimum stays inside the budget.
    for (const w of WEEKS) {
      const ids = gamesForWeek(w).map(g => g.id);
      const budget = confidenceBudget(ids.length);
      for (let picked = 0; picked <= ids.length; picked++) {
        const chosen = ids.slice(0, picked);
        const spread = Object.fromEntries(chosen.map((id, i) => [id, (i % CONFIDENCE_MAX) + 1]));
        const spent = confidenceSpent(spread, chosen);
        const unpicked = ids.length - picked;
        if (starsAvailable({ budget, spent, unpickedCount: unpicked }) < 0) continue;
        expect(spent + unpicked * CONFIDENCE_MIN, `week ${w}, ${picked} picked`)
          .toBeLessThanOrEqual(budget);
      }
    }
  });
});

// ─── Scoring a field ────────────────────────────────────────────────────────

describe('standings over a scored week', () => {
  const week = 5;
  const slate = gamesForWeek(week).slice(0, 4).map((g, i) => ({
    ...g, actual_spread: [-3, 7, -1.5, 0][i],
  }));

  const field = [
    { user_id: 'a', username: 'ana', offsets: [0, 0, 0, 0], stars: [5, 4, 3, 2] },     // nails everything
    { user_id: 'b', username: 'bo', offsets: [0, 3, 1, 2], stars: [5, 1, 1, 1] },      // ties game 1
    { user_id: 'c', username: 'cy', offsets: [6, 1, 4, 9], stars: [1, 5, 1, 1] },      // wins nothing
    { user_id: 'd', username: 'di', offsets: null, stars: null },                       // never picked
  ];

  const picks = field.flatMap(p => p.offsets === null ? [] : slate.map((g, i) => ({
    user_id: p.user_id,
    game_id: g.id,
    predicted_spread: g.actual_spread + p.offsets[i],
    confidence_points: p.stars[i],
    profiles: { username: p.username },
    games: g,
  })));

  const table = buildStandings(picks, field.map(({ user_id, username }) => ({ user_id, username })));
  const row = id => table.find(r => r.user_id === id);

  it('seats everyone in the league, including whoever never picked', () => {
    expect(table).toHaveLength(4);
    expect(row('d')).toMatchObject({ picks: 0, points: 0, graded: 0, avgDiff: null });
  });

  it('pays the closest pick, and pays every tie for closest', () => {
    // Ana and Bo are both exact on game 1, so both bank their stars on it.
    expect(row('a').points).toBe(5 + 4 + 3 + 2);
    expect(row('b').points).toBe(5);
    expect(row('c').points).toBe(0);
  });

  it('ranks by points, then by accuracy', () => {
    expect(table.map(r => r.user_id)).toEqual(['a', 'b', 'c', 'd']);
    expect(table.map(r => r.rank)).toEqual([1, 2, 3, 4]);
    expect(row('c').avgDiff).toBeGreaterThan(row('b').avgDiff);
  });

  it('grades a pick only where the game has a line', () => {
    const ungraded = picks.map(p => ({ ...p, games: { ...p.games, actual_spread: null } }));
    const none = buildStandings(ungraded, []);
    expect(none.every(r => r.points === 0 && r.graded === 0)).toBe(true);
  });
});

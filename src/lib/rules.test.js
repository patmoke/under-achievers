import { describe, it, expect } from 'vitest';
import { MODES, UNIVERSAL, modeByKey } from './rules';
import { CONFIDENCE_MAX, confidenceBudget } from './scoring';
import { MAX_LEGS, PLAYOFF_WEEKS, PLAYOFF_ROUNDS } from './odds';

/** Every sentence in a mode, as one searchable string. */
const proseOf = mode =>
  [mode.blurb, ...mode.summary, ...mode.sections.flatMap(s => [s.heading, ...s.points])].join(' ');

const allProse = MODES.map(proseOf).join(' ');

describe('rules content', () => {
  it('covers every game mode the app can create', () => {
    // If a fourth mode is ever added, this fails until it has rules — which is
    // the whole point of the file.
    expect(MODES.map(m => m.key)).toEqual(['weekly', 'survivor', 'bankroll']);
  });

  it('gives every mode a blurb, a summary and sections', () => {
    for (const mode of MODES) {
      expect(mode.title).toBeTruthy();
      expect(mode.blurb.length).toBeGreaterThan(20);
      expect(mode.summary.length).toBeGreaterThanOrEqual(3);
      expect(mode.sections.length).toBeGreaterThanOrEqual(3);
      for (const section of mode.sections) {
        expect(section.heading).toBeTruthy();
        expect(section.points.length).toBeGreaterThan(0);
        for (const point of section.points) expect(point.length).toBeGreaterThan(20);
      }
    }
  });

  it('looks up a mode by key, and returns null for one that does not exist', () => {
    expect(modeByKey('bankroll').title).toBe('Bankroll');
    expect(modeByKey('offseason')).toBeNull();
  });
});

// ─── The numbers have to match the code that enforces them ──────────────────
//
// These are the tests that earn the file. Prose drifts from behaviour silently;
// a rule that says five when the code says six is worse than no rule at all,
// because someone will plan around it.

describe('the stated numbers match the constants', () => {
  it('states the real star budget and the real per-game cap', () => {
    const weekly = proseOf(modeByKey('weekly'));
    expect(weekly).toContain(`${confidenceBudget(1)} stars`);
    expect(weekly).toContain(`${CONFIDENCE_MAX} stars on a single game`);
  });

  it('states the real parlay limit', () => {
    expect(proseOf(modeByKey('bankroll'))).toContain(`up to ${MAX_LEGS} picks`);
  });

  it('states every playoff stake floor, in round order', () => {
    const expected = PLAYOFF_WEEKS
      .map(w => `${Math.round(PLAYOFF_ROUNDS[w].floor * 100)}%`)
      .join(' / ');
    expect(proseOf(modeByKey('bankroll'))).toContain(expected);
    // And not by accident — the four rounds are 10/20/35/60.
    expect(expected).toBe('10% / 20% / 35% / 60%');
  });
});

describe('the rules that cost people something are actually stated', () => {
  // Each of these is a rule that takes a life, a week, or units from someone
  // who did not know about it. Silence about any of them is the bug this whole
  // page exists to fix.

  it('warns that a tie eliminates in survivor', () => {
    expect(proseOf(modeByKey('survivor'))).toMatch(/tie counts as a loss/i);
  });

  it('warns that missing a week eliminates in survivor', () => {
    expect(proseOf(modeByKey('survivor'))).toMatch(/miss a week/i);
  });

  it('warns that unspent stars are lost on a game you did not win', () => {
    expect(proseOf(modeByKey('weekly'))).toMatch(/scores nothing, and those stars are gone/i);
  });

  it('warns that moneyline and spread cannot be parlayed together', () => {
    expect(proseOf(modeByKey('bankroll'))).toMatch(/moneyline and spread cannot go together/i);
  });

  it('warns that not betting in the playoffs forfeits units', () => {
    expect(proseOf(modeByKey('bankroll'))).toMatch(/forfeited/i);
  });

  it('says bets are final', () => {
    expect(proseOf(modeByKey('bankroll'))).toMatch(/final once placed/i);
  });
});

describe('universal rules', () => {
  it('says no real money, somewhere a player will see it', () => {
    const everywhere = UNIVERSAL.points.join(' ') + allProse;
    expect(everywhere).toMatch(/no real money/i);
  });

  it('says everything locks at kickoff', () => {
    expect(UNIVERSAL.points.join(' ')).toMatch(/kickoff/i);
  });
});

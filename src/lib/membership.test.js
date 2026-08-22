import { describe, it, expect } from 'vitest';
import { playsWeekly, landingPath, visibleNavPaths, NAV_PATHS } from './membership';

const survivor = id => ({ id, name: 'Pool', compete_on: 'survivor', season: 2026 });
const weekly = id => ({ id, name: 'Spreads', compete_on: 'weekly', season: 2026 });

describe('playsWeekly', () => {
  it('is false for a survivor-only player, which is most of the league', () => {
    expect(playsWeekly([survivor('a')])).toBe(false);
    expect(playsWeekly([survivor('a'), survivor('b')])).toBe(false);
  });

  it('is true as soon as one weekly league is in the list', () => {
    expect(playsWeekly([weekly('a')])).toBe(true);
    expect(playsWeekly([survivor('a'), weekly('b')])).toBe(true);
  });

  it('is false for someone in nothing, and survives bad input', () => {
    expect(playsWeekly([])).toBe(false);
    expect(playsWeekly(null)).toBe(false);
    expect(playsWeekly(undefined)).toBe(false);
    expect(playsWeekly([null, {}])).toBe(false);
  });
});

describe('landingPath', () => {
  it('drops someone with one league straight into it', () => {
    expect(landingPath([survivor('abc')])).toBe('/leagues/abc');
    expect(landingPath([weekly('xyz')])).toBe('/leagues/xyz');
  });

  it('sends someone with several to the list to choose', () => {
    expect(landingPath([survivor('a'), survivor('b')])).toBe('/leagues');
  });

  it('sends someone with none to the list, where joining lives', () => {
    expect(landingPath([])).toBe('/leagues');
  });

  it('falls back to the list rather than throwing on missing data', () => {
    expect(landingPath(null)).toBe('/leagues');
    expect(landingPath(undefined)).toBe('/leagues');
    expect(landingPath([{ compete_on: 'survivor' }])).toBe('/leagues'); // no id
  });

  it('never lands anyone on the weekly picks page', () => {
    const cases = [[], [survivor('a')], [weekly('a')], [survivor('a'), weekly('b')], null];
    for (const c of cases) expect(landingPath(c)).not.toBe('/games');
  });
});

describe('visibleNavPaths', () => {
  it('shows a weekly player everything', () => {
    expect(visibleNavPaths({ leagues: [weekly('a')] })).toEqual(NAV_PATHS);
    expect(visibleNavPaths({ leagues: [survivor('a'), weekly('b')] })).toEqual(NAV_PATHS);
  });

  it('shows a survivor-only player just their leagues', () => {
    expect(visibleNavPaths({ leagues: [survivor('a')] })).toEqual(['/leagues']);
  });

  it('hides the three pages that read from the weekly game', () => {
    const shown = visibleNavPaths({ leagues: [survivor('a')] });
    for (const p of ['/games', '/leaderboard', '/history']) expect(shown).not.toContain(p);
  });

  it('shows someone in no league the way to join one', () => {
    expect(visibleNavPaths({ leagues: [] })).toEqual(['/leagues']);
  });

  it('keeps the whole app in front of an admin, whatever they play', () => {
    expect(visibleNavPaths({ leagues: [survivor('a')], isAdmin: true })).toEqual(NAV_PATHS);
    expect(visibleNavPaths({ leagues: [], isAdmin: true })).toEqual(NAV_PATHS);
  });

  it('always keeps Leagues, so the nav is never empty', () => {
    const cases = [[], [survivor('a')], [weekly('a')], null, undefined];
    for (const c of cases) expect(visibleNavPaths({ leagues: c })).toContain('/leagues');
    expect(visibleNavPaths()).toContain('/leagues');
  });

  it('keeps the display order it was given', () => {
    expect(visibleNavPaths({ leagues: [weekly('a')] })).toEqual(
      ['/games', '/leagues', '/leaderboard', '/history'],
    );
  });
});

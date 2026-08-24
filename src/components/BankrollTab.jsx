import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Clock, X, Trophy, Info, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  MARKETS, SIDES, oddsFor, otherSideOdds, lineFor, isPriced,
  payout, slipProblem,
} from '../lib/odds';

/** −110 rather than -110: a real minus sign, so prices line up in a column. */
const formatOdds = n =>
  n === null || n === undefined ? '—' : n > 0 ? `+${n}` : `−${Math.abs(n)}`;

const formatUnits = n =>
  n === null || n === undefined ? '—' : Number(n).toLocaleString(undefined, {
    minimumFractionDigits: Number.isInteger(Number(n)) ? 0 : 2,
    maximumFractionDigits: 2,
  });

const kickoffLabel = iso =>
  new Date(iso).toLocaleString(undefined, {
    weekday: 'short', hour: 'numeric', minute: '2-digit',
  });

/**
 * What a side is called on the board.
 *
 * The spread is shown from the side you'd be backing, so a home team favoured
 * by 3 reads "-3" on its own button and "+3" on the opponent's — which is how
 * anyone who has seen a betting board expects to read it, and avoids making
 * people do the sign flip in their head.
 */
function sideLabel(game, market, side) {
  if (market === 'moneyline') {
    return side === 'home' ? game.home_team_abbr : game.away_team_abbr;
  }
  if (market === 'total') {
    return `${side === 'over' ? 'O' : 'U'} ${game.total_line}`;
  }
  const forHome = side === 'home';
  const n = forHome ? game.spread_line : -game.spread_line;
  const abbr = forHome ? game.home_team_abbr : game.away_team_abbr;
  return `${abbr} ${n > 0 ? `−${n}` : `+${Math.abs(n)}`}`;
}

const MARKET_LABEL = { spread: 'Spread', total: 'Total', moneyline: 'Moneyline' };

function PriceButton({ label, odds, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      style={{
        flex: 1, minWidth: 0,
        padding: '9px 8px',
        borderRadius: 'var(--radius-sm)',
        background: selected ? 'var(--accent)' : 'var(--surface)',
        border: `1px solid ${selected ? 'var(--accent)' : 'var(--border-strong)'}`,
        color: selected ? 'var(--accent-ink)' : 'var(--ink)',
        cursor: 'pointer',
        display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center',
        transition: 'all .12s',
      }}
    >
      <span style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <span style={{
        fontFamily: 'Barlow Condensed', fontWeight: 600, fontSize: 13,
        fontVariantNumeric: 'tabular-nums',
        color: selected ? 'var(--accent-ink)' : 'var(--ink-soft)',
      }}>
        {formatOdds(odds)}
      </span>
    </button>
  );
}

export default function BankrollTab({ leagueId, currentUserId, season, currentWeek }) {
  const [games, setGames] = useState([]);
  const [bets, setBets] = useState([]);
  const [balance, setBalance] = useState(null);
  const [round, setRound] = useState(null);
  const [slip, setSlip] = useState([]);      // [{ game_id, market, side }]
  const [stake, setStake] = useState('');
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);

  const gamesById = useMemo(
    () => Object.fromEntries(games.map(g => [g.id, g])), [games]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    // Top up before reading, so week one doesn't show a balance of nothing to
    // someone who has never placed a bet. Idempotent, so calling it on every
    // load is free.
    await supabase.rpc('bankroll_credit_allowances', { p_league_id: leagueId });

    // This game runs to week 22. The weekly game and the survivor pool stop at
    // 18, so their week — the `currentWeek` prop — cannot be borrowed once the
    // playoffs start; it would pin the board to week 18 all January. The same
    // call also carries what this round demands you put at risk.
    const { data: roundData } = await supabase.rpc('bankroll_round_status', {
      p_league_id: leagueId, p_user_id: currentUserId,
    });
    const wk = roundData?.week ?? currentWeek;
    setRound(roundData || null);

    const [gamesRes, betsRes, balanceRes] = await Promise.all([
      supabase.from('games').select('*')
        .eq('season', season).eq('week', wk).order('game_time'),
      supabase.from('bets')
        .select('*, bet_legs(*, games(home_team_abbr, away_team_abbr, game_time))')
        .eq('league_id', leagueId).eq('user_id', currentUserId)
        .order('placed_at', { ascending: false }).limit(50),
      supabase.rpc('bankroll_balance', { p_league_id: leagueId, p_user_id: currentUserId }),
    ]);

    setGames(gamesRes.data || []);
    setBets(betsRes.data || []);
    setBalance(balanceRes.data === null ? 0 : Number(balanceRes.data));
    setLoading(false);
  }, [leagueId, currentUserId, season, currentWeek]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Only games that are both open and fully priced can be bet. A week the books
  // have not posted yet is a real state, not an error — see the empty case.
  const board = games.filter(g => isPriced(g) && new Date(g.game_time) > new Date());

  function toggle(game, market, side) {
    setSlip(prev => {
      const at = prev.findIndex(l => l.game_id === game.id && l.market === market);
      // Tapping the same price again clears it; tapping the other side of the
      // same market swaps rather than stacking, since you cannot back both.
      if (at >= 0) {
        const existing = prev[at];
        const without = prev.filter((_, i) => i !== at);
        return existing.side === side ? without : [...without, { game_id: game.id, market, side }];
      }
      return [...prev, { game_id: game.id, market, side }];
    });
  }

  const isSelected = (gameId, market, side) =>
    slip.some(l => l.game_id === gameId && l.market === market && l.side === side);

  // The slip, priced from the games already loaded. Every number shown here is
  // recomputed server-side at placement, so this is a preview and never the
  // authority.
  const pricedSlip = slip.map(l => {
    const g = gamesById[l.game_id];
    return g ? {
      ...l, game: g,
      odds: oddsFor(g, l.market, l.side),
      otherSideOdds: otherSideOdds(g, l.market, l.side),
      line: lineFor(g, l.market),
    } : null;
  }).filter(Boolean);

  const problem = slip.length ? slipProblem(slip) : null;
  const stakeNum = Number(stake);
  const stakeValid = stake !== '' && Number.isFinite(stakeNum) && stakeNum > 0;
  const overBalance = stakeValid && balance !== null && stakeNum > balance;
  const toReturn = stakeValid && pricedSlip.length ? payout(stakeNum, pricedSlip) : null;
  const canPlace = !problem && stakeValid && !overBalance && pricedSlip.length > 0 && !placing;

  async function place() {
    setPlacing(true);
    try {
      // Only the picks are sent. Prices are read from the games row by
      // place_bet — a slip that could name its own odds would name good ones.
      const { error } = await supabase.rpc('place_bet', {
        p_league_id: leagueId,
        p_stake: stakeNum,
        p_legs: slip.map(({ game_id, market, side }) => ({ game_id, market, side })),
      });
      if (error) throw error;
      toast.success(slip.length === 1 ? 'Bet placed' : `${slip.length}-leg parlay placed`);
      setSlip([]);
      setStake('');
      fetchAll();
    } catch (err) {
      toast.error(err.message || 'Could not place that bet');
    } finally {
      setPlacing(false);
    }
  }

  if (loading) {
    return <p style={{ color: 'var(--ink-soft)', fontSize: 14 }}>Loading the board…</p>;
  }

  const week = round?.week ?? currentWeek;
  const label = round?.round_name || `Week ${week}`;
  const openBets = bets.filter(b => b.status === 'open');
  const settled = bets.filter(b => b.status !== 'open');
  const stakedThisWeek = openBets
    .filter(b => b.week === week)
    .reduce((sum, b) => sum + Number(b.stake), 0);

  return (
    <div>
      {/* Balance */}
      <div className="card" style={{ padding: '18px 20px', marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'baseline' }}>
        <div>
          <div className="label-muted" style={{ marginBottom: 2 }}>Balance</div>
          <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 34, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            {formatUnits(balance)}
            <span style={{ fontSize: 15, color: 'var(--ink-soft)', marginLeft: 6 }}>units</span>
          </div>
        </div>
        <div>
          <div className="label-muted" style={{ marginBottom: 2 }}>{label}</div>
          <div style={{ fontSize: 14, color: 'var(--ink-soft)' }}>
            {openBets.filter(b => b.week === week).length} open
            {stakedThisWeek > 0 && ` · ${formatUnits(stakedThisWeek)} at risk`}
          </div>
        </div>
      </div>

      {round?.is_playoff && <PlayoffRound round={round} />}

      {/* The board */}
      <h3 style={{ fontSize: 20, textTransform: 'none', marginBottom: 4 }}>{label} board</h3>
      {board.length === 0 ? (
        <div className="card" style={{ padding: 20, marginBottom: 24 }}>
          <p style={{ margin: 0, color: 'var(--ink-soft)', fontSize: 14, lineHeight: 1.6 }}>
            <Info size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
            {round?.is_playoff
              ? `No prices for the ${label} yet. The bracket is not set until the
                 round before it finishes, so these appear once the matchups exist.`
              : `No prices for week ${week} yet. Books post a few weeks ahead rather
                 than a whole season, so this fills in closer to kickoff.`}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12, marginBottom: 28 }}>
          {board.map(game => (
            <div key={game.id} className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                <strong style={{ fontFamily: 'Barlow Condensed', fontSize: 19, letterSpacing: '.01em' }}>
                  {game.away_team_abbr} @ {game.home_team_abbr}
                </strong>
                <span className="label-muted" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Clock size={11} /> {kickoffLabel(game.game_time)}
                </span>
              </div>

              <div style={{ display: 'grid', gap: 10 }}>
                {MARKETS.map(market => (
                  <div key={market} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="label-muted" style={{ width: 68, flexShrink: 0 }}>
                      {MARKET_LABEL[market]}
                    </span>
                    <div style={{ display: 'flex', gap: 8, flex: 1, minWidth: 0 }}>
                      {SIDES[market].map(side => (
                        <PriceButton
                          key={side}
                          label={sideLabel(game, market, side)}
                          odds={oddsFor(game, market, side)}
                          selected={isSelected(game.id, market, side)}
                          onClick={() => toggle(game, market, side)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* The slip floats over the board, so the board needs room to scroll clear
          of it — without this the last game's bottom row sits underneath the
          slip and cannot be tapped. Grows with the slip, since a six-leg one is
          twice the height of a single. */}
      {slip.length > 0 && <div style={{ height: 200 + slip.length * 48 }} aria-hidden="true" />}

      {/* The slip */}
      {slip.length > 0 && (
        <div className="card" style={{ padding: 0, marginBottom: 28, overflow: 'hidden', position: 'sticky', bottom: 16, boxShadow: 'var(--shadow-card-hover)' }}>
          <div style={{ padding: '10px 18px', background: 'var(--surface-alt)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
            <span className="label-muted">{slip.length === 1 ? 'Bet slip' : `${slip.length}-leg parlay`}</span>
            <button onClick={() => setSlip([])} style={{ background: 'none', border: 'none', color: 'var(--ink-soft)', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
              <X size={12} /> Clear
            </button>
          </div>

          <div style={{ padding: '4px 18px 14px' }}>
            {pricedSlip.map(leg => (
              <div key={`${leg.game_id}-${leg.market}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, padding: '10px 0', borderBottom: '1px dashed var(--border)' }}>
                <span>
                  <strong style={{ fontSize: 14.5 }}>{sideLabel(leg.game, leg.market, leg.side)}</strong>
                  <span style={{ display: 'block', fontSize: 13, color: 'var(--ink-soft)' }}>
                    {MARKET_LABEL[leg.market]} · {leg.game.away_team_abbr} @ {leg.game.home_team_abbr}
                  </span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 17, fontVariantNumeric: 'tabular-nums' }}>
                    {formatOdds(leg.odds)}
                  </span>
                  <button
                    onClick={() => toggle(leg.game, leg.market, leg.side)}
                    aria-label="Remove pick"
                    style={{ background: 'none', border: 'none', color: 'var(--ink-faint)', cursor: 'pointer', padding: 2 }}
                  >
                    <X size={14} />
                  </button>
                </span>
              </div>
            ))}

            {problem && (
              <p style={{ margin: '12px 0 0', fontSize: 13.5, color: 'var(--danger)' }}>{problem}</p>
            )}

            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginTop: 14, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 130px' }}>
                <label className="label-muted" style={{ display: 'block', marginBottom: 5 }}>Stake</label>
                <input
                  type="number" min="1" step="1" inputMode="decimal"
                  value={stake}
                  onChange={e => setStake(e.target.value)}
                  placeholder="units"
                />
              </div>
              <div style={{ flex: '1 1 120px' }}>
                <div className="label-muted" style={{ marginBottom: 5 }}>To return</div>
                <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 26, lineHeight: 1.1, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
                  {toReturn === null ? '—' : formatUnits(toReturn)}
                </div>
              </div>
            </div>

            {overBalance && (
              <p style={{ margin: '10px 0 0', fontSize: 13.5, color: 'var(--danger)' }}>
                That is more than your {formatUnits(balance)} units.
              </p>
            )}

            <button
              className="btn btn-primary"
              disabled={!canPlace}
              onClick={place}
              style={{ width: '100%', justifyContent: 'center', marginTop: 14, padding: 13, fontSize: 15, opacity: canPlace ? 1 : 0.5 }}
            >
              {placing ? 'Placing…' : `Place bet${stakeValid ? ` — ${formatUnits(stakeNum)} units` : ''}`}
            </button>
            <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--ink-faint)', textAlign: 'center' }}>
              Bets are final once placed. You keep the price you see here.
            </p>
          </div>
        </div>
      )}

      {/* My bets */}
      <h3 style={{ fontSize: 20, textTransform: 'none', marginBottom: 10 }}>Your bets</h3>
      {bets.length === 0 ? (
        <p style={{ color: 'var(--ink-soft)', fontSize: 14 }}>
          Nothing placed yet. Tap a price above to start a slip.
        </p>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {[...openBets, ...settled].map(bet => <BetRow key={bet.id} bet={bet} />)}
        </div>
      )}
    </div>
  );
}

/**
 * The playoff round's terms, stated before anyone bets rather than after.
 *
 * The season's one weakness is that unused units bank, so a leader can protect
 * a lead by sitting still. The floor closes it: a round costs you a share of
 * what you brought into it whether or not you use it, and the share climbs to
 * 60% by the Super Bowl. Sitting out is the most expensive thing you can do.
 *
 * Every figure here comes from bankroll_round_status, which is the same
 * arithmetic bankroll_apply_forfeits runs when the round is over — so what this
 * warns about is exactly what gets taken.
 */
function PlayoffRound({ round }) {
  const short = Number(round.shortfall);
  const met = short <= 0;
  return (
    <div className="card" style={{
      padding: 18, marginBottom: 20,
      borderColor: met ? 'var(--border-strong)' : 'var(--danger)',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <strong style={{ fontFamily: 'Barlow Condensed', fontSize: 21, letterSpacing: '.01em' }}>
          {round.round_name}
        </strong>
        <span className="label-muted">
          No new allowance · {Math.round(Number(round.stake_floor) * 100)}% minimum stake
        </span>
      </div>

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))' }}>
        <RoundFigure label="Carried in" value={formatUnits(round.balance_at_open)} />
        <RoundFigure label="Must stake" value={formatUnits(round.required)} />
        <RoundFigure label="Staked" value={formatUnits(round.staked)}
                     tone={met ? 'accent' : 'ink'} />
      </div>

      <p style={{ margin: '12px 0 0', fontSize: 13, lineHeight: 1.6,
                  color: met ? 'var(--ink-faint)' : 'var(--danger)' }}>
        {met ? (
          <>
            <Trophy size={12} style={{ verticalAlign: -1, marginRight: 5 }} />
            You have met the minimum for this round. Anything further is your own call.
          </>
        ) : (
          <>
            <AlertTriangle size={12} style={{ verticalAlign: -1, marginRight: 5 }} />
            {formatUnits(short)} units short. Whatever you have not put at risk by the
            last kickoff of this round is forfeited.
          </>
        )}
      </p>
    </div>
  );
}

function RoundFigure({ label, value, tone = 'ink' }) {
  return (
    <div>
      <div className="label-muted" style={{ marginBottom: 3 }}>{label}</div>
      <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 24, lineHeight: 1,
                    fontVariantNumeric: 'tabular-nums',
                    color: tone === 'accent' ? 'var(--accent)' : 'var(--ink)' }}>
        {value}
      </div>
    </div>
  );
}

const STATUS_STYLE = {
  open: { label: 'Open', cls: 'badge' },
  won: { label: 'Won', cls: 'badge badge-lime' },
  lost: { label: 'Lost', cls: 'badge badge-red' },
  push: { label: 'Push', cls: 'badge' },
  void: { label: 'Void', cls: 'badge' },
};

function BetRow({ bet }) {
  const legs = bet.bet_legs || [];
  const status = STATUS_STYLE[bet.status] || STATUS_STYLE.open;
  const settledProfit = bet.returned === null ? null : Number(bet.returned) - Number(bet.stake);

  return (
    <div className="card" style={{ padding: 14, opacity: bet.status === 'lost' ? 0.75 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: legs.length ? 8 : 0, flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={status.cls} style={{ fontSize: 10 }}>{status.label}</span>
          <strong style={{ fontFamily: 'Barlow Condensed', fontSize: 16 }}>
            {formatUnits(bet.stake)} units
          </strong>
          {legs.length > 1 && (
            <span style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>{legs.length}-leg parlay</span>
          )}
        </span>
        {settledProfit !== null && (
          <span style={{
            fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 17,
            fontVariantNumeric: 'tabular-nums',
            color: settledProfit > 0 ? 'var(--accent)' : settledProfit < 0 ? 'var(--danger)' : 'var(--ink-soft)',
          }}>
            {settledProfit > 0 ? '+' : ''}{formatUnits(settledProfit)}
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gap: 4 }}>
        {legs.map(leg => {
          const g = leg.games;
          return (
            <div key={leg.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13.5, color: 'var(--ink-soft)' }}>
              <span>
                {leg.outcome === 'win' && <Trophy size={11} style={{ verticalAlign: -1, marginRight: 4, color: 'var(--accent)' }} />}
                {leg.market === 'moneyline'
                  ? `${leg.side === 'home' ? g?.home_team_abbr : g?.away_team_abbr} to win`
                  : leg.market === 'total'
                    ? `${leg.side === 'over' ? 'Over' : 'Under'} ${leg.line}`
                    : `${leg.side === 'home' ? g?.home_team_abbr : g?.away_team_abbr} ${
                        (leg.side === 'home' ? leg.line : -leg.line) > 0
                          ? `−${Math.abs(leg.side === 'home' ? leg.line : -leg.line)}`
                          : `+${Math.abs(leg.side === 'home' ? leg.line : -leg.line)}`}`}
                {g && <span style={{ color: 'var(--ink-faint)' }}> · {g.away_team_abbr} @ {g.home_team_abbr}</span>}
              </span>
              <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                {formatOdds(leg.odds)}
              </span>
            </div>
          );
        })}
      </div>

      {bet.status === 'open' && legs.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--ink-faint)' }}>
          Returns {formatUnits(payout(Number(bet.stake), legs))} if it lands
        </div>
      )}
    </div>
  );
}

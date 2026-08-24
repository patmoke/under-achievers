// The rules, in one place, written from the constants that enforce them.
//
// Every number here is interpolated rather than typed out, so a rule and its
// description cannot drift apart: raise MAX_LEGS and the rules page says the
// new number without anyone remembering to edit it. rules.test.js checks that
// each figure still appears in the prose, which is what catches someone later
// hardcoding a number over the top of one of these.
//
// Kept free of React so the same content feeds the rules page, the short panel
// inside a league, and the landing page.

import { CONFIDENCE_MIN, CONFIDENCE_MAX, confidenceBudget } from './scoring';
import { MAX_LEGS, PLAYOFF_WEEKS, PLAYOFF_ROUNDS } from './odds';

/** Stars per game, stated the way the budget actually works. */
const STARS_PER_GAME = confidenceBudget(1);

const playoffFloors = PLAYOFF_WEEKS
  .map(w => `${Math.round(PLAYOFF_ROUNDS[w].floor * 100)}%`)
  .join(' / ');

export const MODES = [
  {
    key: 'weekly',
    title: 'Call the Line',
    blurb: 'Predict the point spread for every game. Closest to the real line wins it.',
    summary: [
      'Predict the spread for every game before it kicks off.',
      `Closest prediction wins the game and scores its stars — everyone else scores nothing on it.`,
      `You get ${STARS_PER_GAME} stars per game to spread across the week, ${CONFIDENCE_MAX} on any one game at most.`,
    ],
    sections: [
      {
        heading: 'What you do',
        points: [
          'Each week, predict the closing point spread for every game on the slate. Spreads are written from the home team\'s side, so −3 means the home team is favoured by three.',
          'You can change a prediction as often as you like until that game kicks off. Each game locks on its own, so a Sunday game stays open after the Thursday one has closed.',
        ],
      },
      {
        heading: 'How it scores',
        points: [
          'For each game, whoever came closest to the actual line wins that game. Everyone else scores nothing on it — this is a contest against the room, not against a points table.',
          'If two people are equally close, they both win it.',
          'Your score for the week is the stars you had on the games you won.',
        ],
      },
      {
        heading: 'Stars',
        points: [
          `Every week you get ${STARS_PER_GAME} stars for each game on the slate. Every game has to be picked, and a pick costs at least ${CONFIDENCE_MIN} star, so that much of the budget is always spoken for.`,
          `You can put up to ${CONFIDENCE_MAX} stars on a single game.`,
          'Stars are only scored if you win the game. Five stars on a game you miss scores nothing, and those stars are gone.',
        ],
      },
      {
        heading: 'Standings',
        points: [
          'Ranked on total stars won. Level scores are separated by average distance from the line, so the more accurate player finishes higher.',
        ],
      },
    ],
  },

  {
    key: 'survivor',
    title: 'Survivor Pool',
    blurb: 'One team a week, straight up. Lose once and you are out. Last one standing wins.',
    summary: [
      'Pick one team to win each week — straight up, no spread.',
      'Once a pick locks, that team is used for the rest of the season.',
      'A loss puts you out. So does a tie, and so does missing a week.',
    ],
    sections: [
      {
        heading: 'What you do',
        points: [
          'Pick one team to win each week. Straight up — the spread does not come into it.',
          'You can change your pick until that team\'s game kicks off.',
        ],
      },
      {
        heading: 'One and done',
        points: [
          'Once your pick locks, that team is used up. You cannot pick them again for the rest of the season, which is what stops everyone riding the same team every week.',
          'A pick you have not locked in yet does not burn the team — swap it and the team is free again.',
        ],
      },
      {
        heading: 'How you go out',
        points: [
          'Your team loses. That is the obvious one.',
          'Your team ties. A tie counts as a loss in this pool. It is rare, and it is worth knowing before it happens to you.',
          'You miss a week. If every game in a week has kicked off and you have no pick on record, you are out — forgetting costs the same as being wrong.',
        ],
      },
      {
        heading: 'Buybacks',
        points: [
          'If the league owner turned buybacks on, an eliminated entry can pay back in. The owner sets the last week you can do it and how many times each person may.',
          'A buyback forgives the life you lost and restarts you from the week you bought back in. The teams you had already used stay used.',
          'If buybacks are off, one loss ends your season.',
        ],
      },
      {
        heading: 'More than one entry',
        points: [
          'If the owner allowed it, you can run several entries at once, up to the limit they set. Each entry is separate — its own picks, its own used teams, its own life.',
          'Entries have to be added before the season starts. You cannot buy in extra lives once games are being played.',
        ],
      },
      {
        heading: 'Winning',
        points: [
          'The last entry still alive takes it. If everyone left goes out in the same week, the pool is shared between them.',
        ],
      },
    ],
  },

  {
    key: 'bankroll',
    title: 'Bankroll',
    blurb: 'A weekly allowance of units, bet on real lines. Most units at the end of the season wins.',
    summary: [
      'Every week you are credited a fixed allowance of units.',
      'Bet them on spreads, totals and moneylines. Winnings and anything unspent carry forward.',
      'No real money is involved, and none can be won.',
    ],
    sections: [
      {
        heading: 'What you do',
        points: [
          'Every week you are credited an allowance of units. What you win, and anything you do not bet, carries forward — the balance is yours for the season, not just the week.',
          'Bet on the spread, the total, or the moneyline in any game that has not kicked off. The player with the most units at the end of the season wins.',
          'No real money is staked and none can be won. The prices are real; the units are not.',
        ],
      },
      {
        heading: 'Parlays',
        points: [
          `You can put up to ${MAX_LEGS} picks on one slip. Every leg has to land or the slip loses — that is why a parlay pays what it does.`,
          'If a leg pushes — the game lands exactly on the spread or the total — that leg drops out and the slip reprices without it. A three-leg with one push pays as a two-leg, and a slip where everything pushed just returns your stake.',
          'On the same game, totals can go with anything. Moneyline and spread cannot go together: covering a spread already means winning the game, so pairing them would pay a near-certainty at long odds.',
        ],
      },
      {
        heading: 'Prices and deadlines',
        points: [
          'You keep the price shown when you place the bet, even if the line moves afterwards.',
          'Bets are final once placed. There is no cash out and no editing a slip.',
          'Each game closes at its own kickoff.',
        ],
      },
      {
        heading: 'What everyone else can see',
        points: [
          'The standings show how many bets you have placed this week and how much you have at risk — never what those bets are on.',
          'A slip becomes public once every game on it has kicked off. Nobody can copy you, and nobody can hide what they did afterwards.',
        ],
      },
      {
        heading: 'The house',
        points: [
          'The prices carry an edge, the same way real ones do. It is taken on every leg, which is why a five-leg parlay pays worse than five singles.',
          'The league page shows what the house has taken and what the prices say it should have taken. Over enough bets the two meet; the gap in between is luck, not anyone\'s skill.',
        ],
      },
      {
        heading: 'The playoffs',
        points: [
          'There is no new allowance in the playoffs. What you carry out of week 18 is what you have for January.',
          `Each round asks for a minimum stake — ${playoffFloors} of the balance you brought into it, round by round — and whatever you have not put at risk by that round's last kickoff is forfeited.`,
          'That is deliberate. Without it, whoever is ahead could protect a lead by not betting. Sitting out the postseason is the most expensive thing you can do in this game.',
        ],
      },
    ],
  },
];

/** Rules that are true whichever game you are playing. */
export const UNIVERSAL = {
  heading: 'True in every game',
  points: [
    'No real money is wagered and none can be won. Under Achievers is for entertainment only, and is not affiliated with the NFL.',
    'Everything locks at kickoff — its own kickoff, game by game. Nothing can be entered, changed or withdrawn after that.',
    'Results come from the official box score. Scores and lines are refreshed automatically through the week, so a result can take a little while to appear after the whistle.',
    'A league owner sets their own league\'s options when they create it. Anything described here as a choice is theirs to make.',
  ],
};

export const modeByKey = key => MODES.find(m => m.key === key) || null;

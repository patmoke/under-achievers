// src/types/odds.ts
export interface Outcome {
  name: string;
  price?: number;
  point?: number | null;
}

export interface Market {
  key: string;
  outcomes: Outcome[];
}

export interface Bookmaker {
  key: string;
  title: string;
  markets: Market[];
}

export interface OddsEvent {
  id: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers?: Bookmaker[];
  week?: number;
  round?: number;
}

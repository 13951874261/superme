export type Suit = '♠' | '♥' | '♦' | '♣';

export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  suit: Suit;
  rank: Rank;
}

export type PlayerStatus = 'active' | 'folded' | 'all-in' | 'out';
export type BettingRound = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
export type PlayerActionType = 'fold' | 'check' | 'call' | 'raise' | 'all-in';
export type AiProfile = 'tightAggressive' | 'loosePassive' | 'tightPassive' | 'looseAggressive';

export interface PlayerAction {
  type: PlayerActionType;
  amount?: number;
}

export interface Player {
  id: string;
  seat: number;
  name: string;
  chips: number;
  hand: Card[];
  currentBet: number;
  totalCommitted: number;
  status: PlayerStatus;
  isHuman: boolean;
  aiProfile?: AiProfile;
  hasActed: boolean;
}

export interface SidePot {
  amount: number;
  eligiblePlayerIds: string[];
}

export interface PotState {
  mainPot: number;
  sidePots: SidePot[];
}

export interface HandEvaluation {
  category:
    | 'royal-flush'
    | 'straight-flush'
    | 'four-of-a-kind'
    | 'full-house'
    | 'flush'
    | 'straight'
    | 'three-of-a-kind'
    | 'two-pair'
    | 'one-pair'
    | 'high-card';
  categoryRank: number;
  primaryRanks: number[];
  kickers: number[];
  score: number[];
  label: string;
  bestFive: Card[];
}

export interface WinnerInfo {
  playerId: string;
  amount: number;
  evaluation: HandEvaluation;
}

export interface HandResult {
  winners: WinnerInfo[];
  potState: PotState;
}

export interface TexasHoldemState {
  deck: Card[];
  communityCards: Card[];
  players: Player[];
  dealerSeat: number;
  smallBlindSeat: number;
  bigBlindSeat: number;
  currentTurnSeat: number;
  currentBet: number;
  minRaise: number;
  round: BettingRound;
  potState: PotState;
  handNumber: number;
  logs: string[];
  pendingReveal: boolean;
  sb: number;
  bb: number;
}

export const RANK_VALUE: Record<Rank, number> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};
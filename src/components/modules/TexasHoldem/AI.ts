import { Card, Player, TexasHoldemState, PlayerAction, PlayerActionType, RANK_VALUE } from './types';
import { evaluateBestHand } from './HandRanker';

/**
 * Heuristic decisions for Texas Hold'em AI based on pocket cards, community cards,
 * personality profile, and pot odds.
 */
export function getAiDecision(state: TexasHoldemState, seatIndex: number): PlayerAction {
  const ai = state.players[seatIndex];
  const maxBet = Math.max(...state.players.map(p => p.currentBet));
  const toCall = maxBet - ai.currentBet;
  const currentPot = state.players.reduce((sum, p) => sum + p.currentBet, 0) + state.potState.mainPot + state.potState.sidePots.reduce((sum, sp) => sum + sp.amount, 0);

  const handStrength = evaluateHandStrength(ai.hand, state.communityCards);
  const profile = ai.aiProfile ?? 'tightPassive';

  // Pot odds = amount to call / (total pot after call)
  const potOdds = toCall > 0 ? toCall / (currentPot + toCall) : 0;

  let decision: PlayerActionType = 'fold';
  let raiseAmount = 0;

  if (state.round === 'preflop') {
    const pfStrength = evaluatePreflopStrength(ai.hand);
    
    if (pfStrength >= 0.8) {
      // Premium hands (AA, KK, QQ, AK, etc.)
      if (profile.includes('Aggressive')) {
        decision = 'raise';
        raiseAmount = Math.max(state.minRaise, Math.floor(maxBet + state.bb * (2 + Math.random() * 2)));
      } else {
        decision = toCall > 0 ? 'call' : 'check';
      }
    } else if (pfStrength >= 0.5) {
      // Medium strength
      if (toCall === 0) {
        decision = 'check';
      } else if (toCall <= state.bb * 2) {
        decision = 'call';
      } else {
        decision = profile.includes('loose') ? 'call' : 'fold';
      }
    } else {
      // Weak hands
      if (toCall === 0) {
        decision = 'check';
      } else {
        decision = 'fold';
      }
    }
  } else {
    // Post flop/turn/river
    if (handStrength >= 0.75) {
      // Strong hand (trips or better, or high pair with top kicker)
      if (profile.includes('Aggressive')) {
        decision = 'raise';
        raiseAmount = Math.max(state.minRaise, Math.floor(maxBet + state.bb * (1 + Math.random() * 3)));
      } else {
        decision = toCall > 0 ? 'call' : 'check';
      }
    } else if (handStrength >= 0.4) {
      // Medium hand (middle pair, drawing hands like flush/straight draw)
      if (toCall === 0) {
        decision = 'check';
      } else if (potOdds < 0.3) {
        decision = 'call';
      } else {
        decision = profile.includes('loose') ? 'call' : 'fold';
      }
    } else {
      // Weak hand
      if (toCall === 0) {
        decision = 'check';
      } else {
        decision = 'fold';
      }
    }
  }

  // Guard against raising more than chips
  if (decision === 'raise') {
    if (raiseAmount - ai.currentBet >= ai.chips) {
      decision = 'all-in';
    } else if (raiseAmount <= maxBet) {
      // Revert to call/check if raise amount is invalid
      decision = toCall > 0 ? 'call' : 'check';
    }
  }

  if (decision === 'call' && toCall >= ai.chips) {
    decision = 'all-in';
  }

  return {
    type: decision,
    amount: decision === 'raise' ? raiseAmount : undefined,
  };
}

/** Pre-flop starting hand matrix classifier (returns 0 to 1) */
function evaluatePreflopStrength(hand: Card[]): number {
  if (hand.length !== 2) return 0;
  const v1 = RANK_VALUE[hand[0].rank];
  const v2 = RANK_VALUE[hand[1].rank];
  const high = Math.max(v1, v2);
  const low = Math.min(v1, v2);
  const isPair = high === low;
  const isSuited = hand[0].suit === hand[1].suit;

  if (isPair) {
    if (high >= 10) return 0.95; // AA, KK, QQ, JJ, TT
    if (high >= 7) return 0.8;   // 99, 88, 77
    return 0.6;                  // Lower pairs
  }

  if (high === 14) {
    if (low >= 10) return 0.85; // AK, AQ, AJ, AT
    return isSuited ? 0.7 : 0.6;
  }

  if (high === 13 && low >= 10) return 0.75; // KQ, KJ, KT
  if (high - low === 1) return isSuited ? 0.65 : 0.55; // Connectors like JT, 98

  return 0.2; // Junk
}

/** Hand strength evaluator returning simple probability between 0 and 1 */
function evaluateHandStrength(hand: Card[], community: Card[]): number {
  if (community.length === 0) return evaluatePreflopStrength(hand);
  const evalResult = evaluateBestHand([...hand, ...community]);
  
  switch (evalResult.category) {
    case 'royal-flush':
    case 'straight-flush':
      return 1.0;
    case 'four-of-a-kind':
      return 0.95;
    case 'full-house':
      return 0.9;
    case 'flush':
      return 0.85;
    case 'straight':
      return 0.8;
    case 'three-of-a-kind':
      return 0.7;
    case 'two-pair':
      return 0.55;
    case 'one-pair':
      // Differentiate high pair from low pair
      const pairRank = evalResult.primaryRanks[0] ?? 0;
      return pairRank >= 10 ? 0.45 : 0.3;
    default:
      return 0.1;
  }
}
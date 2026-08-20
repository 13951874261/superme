import { Card, Player, TexasHoldemState, BettingRound, PotState, PlayerAction, Suit, Rank, RANK_VALUE, HandResult, WinnerInfo } from './types';
import { evaluateBestHand, compareEvaluations } from './HandRanker';

export function createDeck(): Card[] {
  const suits: Suit[] = ['♠', '♥', '♦', '♣'];
  const ranks: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const deck: Card[] = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

export function shuffleDeck(deck: Card[]): Card[] {
  const result = [...deck];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    const temp = result[index];
    result[index] = result[randomIndex];
    result[randomIndex] = temp;
  }
  return result;
}

export function startHand(players: Player[], dealerSeat: number, sbAmount: number, bbAmount: number, handNumber: number): TexasHoldemState {
  let deck = shuffleDeck(createDeck());
  const activePlayers = players.filter(p => p.status !== 'out');
  const playerCount = activePlayers.length;

  if (playerCount < 2) {
    throw new Error('至少需要2个在局玩家以开始牌局');
  }

  // Calculate SB and BB seats (clockwise from dealer)
  // In heads-up (2 players), Dealer is SB, and the other is BB.
  let sbSeat = (dealerSeat + 1) % players.length;
  while (players[sbSeat].status === 'out') {
    sbSeat = (sbSeat + 1) % players.length;
  }

  let bbSeat = (sbSeat + 1) % players.length;
  while (players[bbSeat].status === 'out') {
    bbSeat = (bbSeat + 1) % players.length;
  }

  if (playerCount === 2) {
    sbSeat = dealerSeat;
    bbSeat = (dealerSeat + 1) % players.length;
    while (players[bbSeat].status === 'out') {
      bbSeat = (bbSeat + 1) % players.length;
    }
  }

  const updatedPlayers = players.map(p => {
    if (p.status === 'out') return p;
    return {
      ...p,
      hand: [],
      currentBet: 0,
      totalCommitted: 0,
      status: p.chips > 0 ? 'active' : 'out' as any,
      hasActed: false,
    };
  });

  // Deal hands
  for (const p of updatedPlayers) {
    if (p.status === 'active') {
      p.hand = [deck.pop()!, deck.pop()!];
    }
  }

  // Post Blinds
  const postBlind = (player: Player, amount: number) => {
    const actual = Math.min(player.chips, amount);
    player.chips -= actual;
    player.currentBet = actual;
    player.totalCommitted = actual;
    if (player.chips === 0) {
      player.status = 'all-in';
    }
  };

  postBlind(updatedPlayers[sbSeat], sbAmount);
  postBlind(updatedPlayers[bbSeat], bbAmount);

  const initialBet = bbAmount;
  let currentTurnSeat = (bbSeat + 1) % players.length;
  while (updatedPlayers[currentTurnSeat].status !== 'active') {
    currentTurnSeat = (currentTurnSeat + 1) % players.length;
  }

  return {
    deck,
    communityCards: [],
    players: updatedPlayers,
    dealerSeat,
    smallBlindSeat: sbSeat,
    bigBlindSeat: bbSeat,
    currentTurnSeat,
    currentBet: initialBet,
    minRaise: bbAmount * 2,
    round: 'preflop',
    potState: { mainPot: 0, sidePots: [] },
    handNumber,
    logs: [
      `牌局 #${handNumber} 开始`,
      `玩家 ${updatedPlayers[sbSeat].name} 下小盲注 ${sbAmount}`,
      `玩家 ${updatedPlayers[bbSeat].name} 下大盲注 ${bbAmount}`,
    ],
    pendingReveal: false,
    sb: sbAmount,
    bb: bbAmount,
  };
}

export function getActivePlayerCount(players: Player[]): number {
  return players.filter(p => p.status === 'active').length;
}

export function getInPlayPlayerCount(players: Player[]): number {
  return players.filter(p => p.status === 'active' || p.status === 'all-in').length;
}

export function isBettingRoundComplete(state: TexasHoldemState): boolean {
  const activePlayers = state.players.filter(p => p.status === 'active');
  const allInPlayers = state.players.filter(p => p.status === 'all-in');
  
  if (activePlayers.length === 0) return true;
  
  // If only 1 active player remains and others are folded or all-in, round is complete if they've checked/called
  const maxBet = Math.max(...state.players.map(p => p.currentBet));
  const activeUnacted = activePlayers.filter(p => !p.hasActed || p.currentBet < maxBet);
  
  return activeUnacted.length === 0;
}

export function handleAction(state: TexasHoldemState, seat: number, action: PlayerAction): TexasHoldemState {
  if (state.currentTurnSeat !== seat) return state;

  const nextState = { ...state, players: state.players.map(p => ({ ...p })), logs: [...state.logs] };
  const player = nextState.players[seat];
  const maxBet = Math.max(...nextState.players.map(p => p.currentBet));

  player.hasActed = true;

  if (action.type === 'fold') {
    player.status = 'folded';
    nextState.logs.push(`玩家 ${player.name} 弃牌 (Fold)`);
  } else if (action.type === 'check') {
    if (player.currentBet < maxBet) {
      // Cannot check if there is a bet to call, force fold or call instead
      action.type = 'fold';
      player.status = 'folded';
      nextState.logs.push(`玩家 ${player.name} 强制弃牌`);
    } else {
      nextState.logs.push(`玩家 ${player.name} 过牌 (Check)`);
    }
  } else if (action.type === 'call') {
    const callAmount = maxBet - player.currentBet;
    const actualCall = Math.min(player.chips, callAmount);
    player.chips -= actualCall;
    player.currentBet += actualCall;
    player.totalCommitted += actualCall;
    if (player.chips === 0) {
      player.status = 'all-in';
      nextState.logs.push(`玩家 ${player.name} 跟注并 All-in`);
    } else {
      nextState.logs.push(`玩家 ${player.name} 跟注 ${actualCall}`);
    }
  } else if (action.type === 'raise' || action.type === 'all-in') {
    let raiseTarget = action.amount ?? 0;
    if (action.type === 'all-in') {
      raiseTarget = player.currentBet + player.chips;
    }
    
    // Validate raise size
    const callAmount = maxBet - player.currentBet;
    const additionalRaise = raiseTarget - maxBet;
    const actualRaise = Math.min(player.chips, callAmount + additionalRaise);
    
    player.chips -= actualRaise;
    player.currentBet += actualRaise;
    player.totalCommitted += actualRaise;
    
    if (player.currentBet > maxBet) {
      const diff = player.currentBet - maxBet;
      nextState.currentBet = player.currentBet;
      nextState.minRaise = player.currentBet + Math.max(diff, state.bb);
    }
    
    if (player.chips === 0) {
      player.status = 'all-in';
      nextState.logs.push(`玩家 ${player.name} 加注至 ${player.currentBet} 并 All-in`);
    } else {
      nextState.logs.push(`玩家 ${player.name} 加注至 ${player.currentBet}`);
    }
  }

  // Update turns
  if (isBettingRoundComplete(nextState)) {
    nextState.currentTurnSeat = -1; // Trigger round transition
  } else {
    let nextSeat = (seat + 1) % nextState.players.length;
    while (nextState.players[nextSeat].status !== 'active') {
      nextSeat = (nextSeat + 1) % nextState.players.length;
    }
    nextState.currentTurnSeat = nextSeat;
  }

  return nextState;
}

export function collectPots(state: TexasHoldemState): PotState {
  const uniqueBets = [...new Set(state.players.map(p => p.totalCommitted))]
    .filter(b => b > 0)
    .sort((left, right) => left - right);
    
  const sidePots: { amount: number; eligiblePlayerIds: string[] }[] = [];
  let prevLimit = 0;
  
  for (const limit of uniqueBets) {
    const tierAmount = limit - prevLimit;
    let potSum = 0;
    const eligibleIds: string[] = [];
    
    for (const p of state.players) {
      if (p.totalCommitted >= limit) {
        potSum += tierAmount;
        if (p.status !== 'folded' && p.status !== 'out') {
          eligibleIds.push(p.id);
        }
      } else if (p.totalCommitted > prevLimit) {
        potSum += (p.totalCommitted - prevLimit);
      }
    }
    
    if (potSum > 0 && eligibleIds.length > 0) {
      sidePots.push({ amount: potSum, eligiblePlayerIds: eligibleIds });
    }
    prevLimit = limit;
  }
  
  if (sidePots.length === 0) {
    return { mainPot: 0, sidePots: [] };
  }
  
  // Collapse side pots: main pot is the first side pot if everyone is eligible
  const mainPot = sidePots[0].amount;
  return {
    mainPot,
    sidePots: sidePots.slice(1).map(sp => ({ amount: sp.amount, eligiblePlayerIds: sp.eligiblePlayerIds })),
  };
}

export function progressRound(state: TexasHoldemState): TexasHoldemState {
  const nextState = { ...state, players: state.players.map(p => ({ ...p })), logs: [...state.logs] };
  
  // Collect betting of current round into pots dynamically at showdown, but reset round bets now
  nextState.players.forEach(p => {
    p.currentBet = 0;
    p.hasActed = false;
  });
  nextState.currentBet = 0;
  nextState.minRaise = state.bb;

  const inPlay = getInPlayPlayerCount(nextState.players);
  const activeCount = getActivePlayerCount(nextState.players);
  
  // If only 1 player remains, hand ends immediately (everyone else folded)
  const nonFolded = nextState.players.filter(p => p.status !== 'folded' && p.status !== 'out');
  if (nonFolded.length === 1) {
    nextState.round = 'showdown';
    return nextState;
  }

  // If no active players left or only 1 active player and everyone else is all-in,
  // we runout community cards straight to showdown.
  if (activeCount === 0 || (activeCount === 1 && inPlay > 1)) {
    while (nextState.communityCards.length < 5) {
      nextState.communityCards.push(nextState.deck.pop()!);
    }
    nextState.round = 'showdown';
    nextState.logs.push('所有玩家已 All-in，直接发齐公共牌进入摊牌');
    return nextState;
  }

  // Move round
  if (nextState.round === 'preflop') {
    nextState.round = 'flop';
    nextState.communityCards.push(nextState.deck.pop()!);
    nextState.communityCards.push(nextState.deck.pop()!);
    nextState.communityCards.push(nextState.deck.pop()!);
    nextState.logs.push('发牌：翻牌圈 (Flop)');
  } else if (nextState.round === 'flop') {
    nextState.round = 'turn';
    nextState.communityCards.push(nextState.deck.pop()!);
    nextState.logs.push('发牌：转牌圈 (Turn)');
  } else if (nextState.round === 'turn') {
    nextState.round = 'river';
    nextState.communityCards.push(nextState.deck.pop()!);
    nextState.logs.push('发牌：河牌圈 (River)');
  } else if (nextState.round === 'river') {
    nextState.round = 'showdown';
  }

  if (nextState.round !== 'showdown') {
    // SB acts first on post-flop rounds
    let nextSeat = nextState.smallBlindSeat;
    while (nextState.players[nextSeat].status !== 'active') {
      nextSeat = (nextSeat + 1) % nextState.players.length;
    }
    nextState.currentTurnSeat = nextSeat;
  } else {
    nextState.currentTurnSeat = -1;
  }

  return nextState;
}

export function settleWinners(state: TexasHoldemState): HandResult {
  const nonFolded = state.players.filter(p => p.status !== 'folded' && p.status !== 'out');
  const potState = collectPots(state);
  
  // Calculate total pot size for all unique bets
  const totalPot = potState.mainPot + potState.sidePots.reduce((sum, sp) => sum + sp.amount, 0);

  if (nonFolded.length === 1) {
    const soleWinner = nonFolded[0];
    return {
      winners: [{
        playerId: soleWinner.id,
        amount: totalPot,
        evaluation: {
          category: 'high-card',
          categoryRank: 0,
          primaryRanks: [],
          kickers: [],
          score: [],
          label: '无人跟注赢取底池',
          bestFive: [],
        }
      }],
      potState
    };
  }

  // Standard multi-pot settlement
  // Build a map of evaluations
  const evaluations: Record<string, ReturnType<typeof evaluateBestHand>> = {};
  for (const player of nonFolded) {
    evaluations[player.id] = evaluateBestHand([...player.hand, ...state.communityCards]);
  }

  // Distribute tier-by-tier to prevent small stacks from winning large pots
  const uniqueBets = [...new Set(state.players.map(p => p.totalCommitted))]
    .filter(b => b > 0)
    .sort((left, right) => left - right);
    
  const payouts: Record<string, number> = {};
  for (const p of state.players) {
    payouts[p.id] = 0;
  }

  let prevLimit = 0;
  for (const limit of uniqueBets) {
    const tierAmount = limit - prevLimit;
    let potSum = 0;
    const eligiblePlayers: Player[] = [];
    
    for (const p of state.players) {
      if (p.totalCommitted >= limit) {
        potSum += tierAmount;
        if (p.status !== 'folded' && p.status !== 'out') {
          eligiblePlayers.push(p);
        }
      } else if (p.totalCommitted > prevLimit) {
        potSum += (p.totalCommitted - prevLimit);
      }
    }
    
    if (potSum > 0 && eligiblePlayers.length > 0) {
      // Find winner(s) among eligible players for this tier
      let bestEval: any = null;
      let winners: Player[] = [];
      
      for (const p of eligiblePlayers) {
        const ev = evaluations[p.id];
        if (!bestEval) {
          bestEval = ev;
          winners = [p];
        } else {
          const comp = compareEvaluations(ev, bestEval);
          if (comp > 0) {
            bestEval = ev;
            winners = [p];
          } else if (comp === 0) {
            winners.push(p);
          }
        }
      }
      
      const share = Math.floor(potSum / winners.length);
      for (const w of winners) {
        payouts[w.id] += share;
      }
      
      // Keep track of left-over chips due to odd division
      const remainder = potSum % winners.length;
      if (remainder > 0) {
        // Give remainder to first winner in the list
        payouts[winners[0].id] += remainder;
      }
    }
    prevLimit = limit;
  }

  const finalWinners: WinnerInfo[] = Object.keys(payouts)
    .filter(id => payouts[id] > 0)
    .map(id => ({
      playerId: id,
      amount: payouts[id],
      evaluation: evaluations[id] ?? {
        category: 'high-card',
        categoryRank: 0,
        primaryRanks: [],
        kickers: [],
        score: [],
        label: '默认赢家',
        bestFive: [],
      },
    }));

  return {
    winners: finalWinners,
    potState
  };
}
import { Card, HandEvaluation, RANK_VALUE } from './types';

const CATEGORY_ORDER: Array<HandEvaluation['category']> = [
  'high-card',
  'one-pair',
  'two-pair',
  'three-of-a-kind',
  'straight',
  'flush',
  'full-house',
  'four-of-a-kind',
  'straight-flush',
  'royal-flush',
];

const CATEGORY_LABEL: Record<HandEvaluation['category'], string> = {
  'high-card': '高牌',
  'one-pair': '一对',
  'two-pair': '两对',
  'three-of-a-kind': '三条',
  'straight': '顺子',
  'flush': '同花',
  'full-house': '葫芦',
  'four-of-a-kind': '四条',
  'straight-flush': '同花顺',
  'royal-flush': '皇家同花顺',
};

function combinations(cards: Card[], choose: number): Card[][] {
  const result: Card[][] = [];
  const current: Card[] = [];

  function walk(start: number): void {
    if (current.length === choose) {
      result.push([...current]);
      return;
    }
    for (let index = start; index <= cards.length - (choose - current.length); index += 1) {
      current.push(cards[index]);
      walk(index + 1);
      current.pop();
    }
  }

  walk(0);
  return result;
}

function sortDesc(values: number[]): number[] {
  return [...values].sort((left, right) => right - left);
}

function getStraightHigh(ranks: number[]): number | null {
  const unique = [...new Set(ranks)].sort((left, right) => right - left);
  if (unique.includes(14)) {
    unique.push(1);
  }
  let streak = 1;
  for (let index = 0; index < unique.length - 1; index += 1) {
    if (unique[index] - 1 === unique[index + 1]) {
      streak += 1;
      if (streak >= 5) {
        return unique[index - 3];
      }
    } else if (unique[index] !== unique[index + 1]) {
      streak = 1;
    }
  }
  return null;
}

function pickStraightCards(cards: Card[], high: number): Card[] {
  const needed = high === 5 ? [5, 4, 3, 2, 14] : [high, high - 1, high - 2, high - 3, high - 4];
  const picked: Card[] = [];
  for (const need of needed) {
    const found = cards.find((card) => RANK_VALUE[card.rank] === need || (need === 14 && card.rank === 'A'));
    if (found) {
      picked.push(found);
    }
  }
  return picked;
}

function evaluateFive(cards: Card[]): HandEvaluation {
  const ranks = sortDesc(cards.map((card) => RANK_VALUE[card.rank]));
  const suits = cards.map((card) => card.suit);
  const isFlush = suits.every((suit) => suit === suits[0]);
  const straightHigh = getStraightHigh(ranks);
  const counts = new Map<number, number>();
  for (const rank of ranks) {
    counts.set(rank, (counts.get(rank) ?? 0) + 1);
  }
  const groups = [...counts.entries()].sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1];
    }
    return right[0] - left[0];
  });

  if (isFlush && straightHigh) {
    const category = straightHigh === 14 ? 'royal-flush' : 'straight-flush';
    return {
      category,
      categoryRank: CATEGORY_ORDER.indexOf(category),
      primaryRanks: [straightHigh],
      kickers: [],
      score: [CATEGORY_ORDER.indexOf(category), straightHigh],
      label: CATEGORY_LABEL[category],
      bestFive: pickStraightCards(cards, straightHigh),
    };
  }

  if (groups[0][1] === 4) {
    const quad = groups[0][0];
    const kicker = groups[1][0];
    return {
      category: 'four-of-a-kind',
      categoryRank: CATEGORY_ORDER.indexOf('four-of-a-kind'),
      primaryRanks: [quad],
      kickers: [kicker],
      score: [CATEGORY_ORDER.indexOf('four-of-a-kind'), quad, kicker],
      label: CATEGORY_LABEL['four-of-a-kind'],
      bestFive: sortCardsByScore(cards, [quad, kicker]),
    };
  }

  if (groups[0][1] === 3 && groups[1][1] === 2) {
    const trips = groups[0][0];
    const pair = groups[1][0];
    return {
      category: 'full-house',
      categoryRank: CATEGORY_ORDER.indexOf('full-house'),
      primaryRanks: [trips, pair],
      kickers: [],
      score: [CATEGORY_ORDER.indexOf('full-house'), trips, pair],
      label: CATEGORY_LABEL['full-house'],
      bestFive: sortCardsByScore(cards, [trips, pair]),
    };
  }

  if (isFlush) {
    return {
      category: 'flush',
      categoryRank: CATEGORY_ORDER.indexOf('flush'),
      primaryRanks: ranks,
      kickers: [],
      score: [CATEGORY_ORDER.indexOf('flush'), ...ranks],
      label: CATEGORY_LABEL.flush,
      bestFive: sortCards(cards),
    };
  }

  if (straightHigh) {
    return {
      category: 'straight',
      categoryRank: CATEGORY_ORDER.indexOf('straight'),
      primaryRanks: [straightHigh],
      kickers: [],
      score: [CATEGORY_ORDER.indexOf('straight'), straightHigh],
      label: CATEGORY_LABEL.straight,
      bestFive: pickStraightCards(cards, straightHigh),
    };
  }

  if (groups[0][1] === 3) {
    const trips = groups[0][0];
    const kickers = sortDesc(groups.slice(1).map(([rank]) => rank));
    return {
      category: 'three-of-a-kind',
      categoryRank: CATEGORY_ORDER.indexOf('three-of-a-kind'),
      primaryRanks: [trips],
      kickers,
      score: [CATEGORY_ORDER.indexOf('three-of-a-kind'), trips, ...kickers],
      label: CATEGORY_LABEL['three-of-a-kind'],
      bestFive: sortCardsByScore(cards, [trips, ...kickers]),
    };
  }

  if (groups[0][1] === 2 && groups[1][1] === 2) {
    const highPair = Math.max(groups[0][0], groups[1][0]);
    const lowPair = Math.min(groups[0][0], groups[1][0]);
    const kicker = groups[2][0];
    return {
      category: 'two-pair',
      categoryRank: CATEGORY_ORDER.indexOf('two-pair'),
      primaryRanks: [highPair, lowPair],
      kickers: [kicker],
      score: [CATEGORY_ORDER.indexOf('two-pair'), highPair, lowPair, kicker],
      label: CATEGORY_LABEL['two-pair'],
      bestFive: sortCardsByScore(cards, [highPair, lowPair, kicker]),
    };
  }

  if (groups[0][1] === 2) {
    const pair = groups[0][0];
    const kickers = sortDesc(groups.slice(1).map(([rank]) => rank));
    return {
      category: 'one-pair',
      categoryRank: CATEGORY_ORDER.indexOf('one-pair'),
      primaryRanks: [pair],
      kickers,
      score: [CATEGORY_ORDER.indexOf('one-pair'), pair, ...kickers],
      label: CATEGORY_LABEL['one-pair'],
      bestFive: sortCardsByScore(cards, [pair, ...kickers]),
    };
  }

  return {
    category: 'high-card',
    categoryRank: CATEGORY_ORDER.indexOf('high-card'),
    primaryRanks: ranks,
    kickers: [],
    score: [CATEGORY_ORDER.indexOf('high-card'), ...ranks],
    label: CATEGORY_LABEL['high-card'],
    bestFive: sortCards(cards),
  };
}

function sortCards(cards: Card[]): Card[] {
  return [...cards].sort((left, right) => RANK_VALUE[right.rank] - RANK_VALUE[left.rank]);
}

function sortCardsByScore(cards: Card[], preferred: number[]): Card[] {
  return [...cards].sort((left, right) => {
    const leftIndex = preferred.indexOf(RANK_VALUE[left.rank]);
    const rightIndex = preferred.indexOf(RANK_VALUE[right.rank]);
    if (leftIndex !== rightIndex) {
      const normalizedLeft = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
      const normalizedRight = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;
      return normalizedLeft - normalizedRight;
    }
    return RANK_VALUE[right.rank] - RANK_VALUE[left.rank];
  });
}

export function compareEvaluations(left: HandEvaluation, right: HandEvaluation): number {
  const max = Math.max(left.score.length, right.score.length);
  for (let index = 0; index < max; index += 1) {
    const leftValue = left.score[index] ?? 0;
    const rightValue = right.score[index] ?? 0;
    if (leftValue !== rightValue) {
      return leftValue > rightValue ? 1 : -1;
    }
  }
  return 0;
}

export function evaluateBestHand(cards: Card[]): HandEvaluation {
  if (cards.length < 5 || cards.length > 7) {
    throw new Error('evaluateBestHand 仅支持 5 到 7 张牌');
  }
  const all = combinations(cards, 5).map((combo) => evaluateFive(combo));
  return all.reduce((best, current) => (compareEvaluations(current, best) > 0 ? current : best));
}
import { Card } from './src/components/modules/TexasHoldem/types';
import { evaluateBestHand } from './src/components/modules/TexasHoldem/HandRanker';

function runTests() {
  let passed = 0;
  let failed = 0;

  function assertEqual(name: string, actual: any, expected: any) {
    if (actual === expected) {
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${name}: Expected ${expected}, got ${actual}`);
      failed++;
    }
  }

  // 1. Royal Flush
  const royalCards: Card[] = [
    { suit: '♠', rank: 'A' }, { suit: '♠', rank: 'K' },
    { suit: '♠', rank: 'Q' }, { suit: '♠', rank: 'J' },
    { suit: '♠', rank: '10' }, { suit: '♥', rank: '2' },
    { suit: '♦', rank: '3' }
  ];
  const royalEval = evaluateBestHand(royalCards);
  assertEqual('Royal Flush Category', royalEval.category, 'royal-flush');
  assertEqual('Royal Flush Label', royalEval.label, '皇家同花顺');

  // 2. Full House (Aces full of Kings)
  const fullHouseCards: Card[] = [
    { suit: '♠', rank: 'A' }, { suit: '♥', rank: 'A' }, { suit: '♦', rank: 'A' },
    { suit: '♠', rank: 'K' }, { suit: '♥', rank: 'K' },
    { suit: '♣', rank: '2' }, { suit: '♣', rank: '3' }
  ];
  const fhEval = evaluateBestHand(fullHouseCards);
  assertEqual('Full House Category', fhEval.category, 'full-house');
  assertEqual('Full House primary ranks trips', fhEval.primaryRanks[0], 14); // A
  assertEqual('Full House primary ranks pair', fhEval.primaryRanks[1], 13); // K

  // 3. Two Pair (Kings and Nines)
  const twoPairCards: Card[] = [
    { suit: '♠', rank: 'K' }, { suit: '♥', rank: 'K' },
    { suit: '♦', rank: '9' }, { suit: '♣', rank: '9' },
    { suit: '♠', rank: 'A' }, { suit: '♥', rank: '2' },
    { suit: '♦', rank: '3' }
  ];
  const tpEval = evaluateBestHand(twoPairCards);
  assertEqual('Two Pair Category', tpEval.category, 'two-pair');
  assertEqual('Two Pair High', tpEval.primaryRanks[0], 13); // K
  assertEqual('Two Pair Low', tpEval.primaryRanks[1], 9); // 9
  assertEqual('Two Pair Kicker', tpEval.kickers[0], 14); // A

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

runTests();
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, RotateCcw, AlertCircle, Swords } from 'lucide-react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

import {
   TexasHoldemState, HandResult, Player, PlayerAction, SidePot,
  Suit, Rank, RANK_VALUE, PlayerStatus, AiProfile
} from './types';
import { evaluateBestHand, compareEvaluations } from './HandRanker';
import { startHand, handleAction, getActivePlayerCount, progressRound, settleWinners, collectPots } from './GameEngine';
import { getAiDecision } from './AI';
import { animateDeal, animateFlip, animateChipMove } from './gsap-deal';
import PokerCard from './PokerCard';
import Seat from './Seat';
import CommunityCards from './CommunityCards';
import PlayerActionPanel from './PlayerAction';
import GameLog from './GameLog';

const PLAYER_COLORS = ['#38bdf8', '#f472b6', '#a78bfa', '#34d399', '#fb923c', '#facc15'];
const POSITIONS = [
  'bottom-center', 'left-bottom', 'left-top', 'right-top', 'right-bottom', 'top-center'
];

function getSuitClass(suit: string): string {
  if (suit === '♥' || suit === '♦') return 'text-rose-600';
  if (suit === '♠') return 'text-zinc-900';
  return 'text-zinc-700';
}

export default function TexasHoldemModule() {
  const [state, setState] = useState<TexasHoldemState | null>(null);
  const [showdown, setShowdown] = useState(false);
  const [result, setResult] = useState<HandResult | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  
  const [chipEls, setChipEls] = useState<HTMLElement[]>([]);
  const chipRefs = useRef<Map<string, HTMLElement>>(new Map());
  const communityRefs = useRef<Map<number, HTMLElement>>(new Map());
  const startRef = useRef<HTMLElement | null>(null);

  const initPlayers = useCallback(() => {
    const profiles: AiProfile[] = ['loosePassive', 'tightAggressive', 'tightPassive', 'looseAggressive'];
    const p = Array.from({ length: 6 }, (_, i) => ({
      id: `p${i}`,
      seat: i,
      name: i === 0 ? '你' : `玩家 ${i}`,
      chips: 10000,
      hand: [] as { suit: Suit; rank: Rank }[],
      currentBet: 0,
      totalCommitted: 0,
      status: 'active' as PlayerStatus,
      isHuman: i === 0,
      aiProfile: profiles[i - 1],
      hasActed: false,
    }));
    return p;
  }, []);

  const startNewHand = useCallback(() => {
    const players = state?.players ?? initPlayers();
    const nextHand = state ? state.handNumber + 1 : 1;
    const dealer = state ? (state.dealerSeat + 1) % players.length : 0;
    
    // Reset players who went out
    const resetPlayers = players.map(p => ({
      ...p,
      chips: p.chips > 0 ? p.chips : 10000,
      status: p.chips > 0 ? ('active' as PlayerStatus) : 'out',
    }));
    
    const newState = startHand(resetPlayers, dealer, 20, 40, nextHand);
    setState(newState);
    setShowdown(false);
    setResult(null);
    setLogs([]);
  }, [state, initPlayers]);

  useEffect(() => {
    if (state && !startRef.current) {
      // Wait for next frame
      setTimeout(() => startNewHand(), 100);
    }
  }, [state, startNewHand]);

  // Handle AI moves
  useEffect(() => {
    if (!state || state.currentTurnSeat === -1) return;
    
    const player = state.players[state.currentTurnSeat];
    if (!player || player.isHuman) return;
    
    const timeout = setTimeout(() => {
      const action = getAiDecision(state, state.currentTurnSeat);
      handleAiAction(action);
    }, 800 + Math.random() * 600);
    
    return () => clearTimeout(timeout);
  }, [state?.currentTurnSeat, state?.round]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAiAction = (action: PlayerAction, isUser?: boolean) => {
    if (!state) return;
    
    const newState = handleAction(state, state.currentTurnSeat, action);
    
    // If round complete, progress
    if (newState.currentTurnSeat === -1) {
      const afterProgress = progressRound(newState);
      setState(afterProgress);
      setLogs(prev => [...prev, ...afterProgress.logs]);
      
      // Trigger deal animations
      triggerAnimations(afterProgress);
    } else {
      setState(newState);
      setLogs(prev => [...prev, ...newState.logs]);
    }
  };

  const triggerAnimations = (currentState: TexasHoldemState) => {
    // Implement GSAP animations here based on currentState
  };

  const handleUserAction = (action: PlayerAction) => {
    if (!state) return;
    const newState = handleAction(state, state.currentTurnSeat, action);
    
    if (newState.currentTurnSeat === -1) {
      const afterProgress = progressRound(newState);
      setState(afterProgress);
      setLogs(prev => [...prev, ...afterProgress.logs]);
      triggerAnimations(afterProgress);
    } else {
      setState(newState);
      setLogs(prev => [...prev, ...newState.logs]);
    }
  };

  const handleShowdown = () => {
    if (!state) return;
    const result = settleWinners(state);
    setResult(result);
    setShowdown(true);
    
    // Animate cards to winners
    result.winners.forEach(w => {
      const seatEl = document.querySelector(`[data-seat="${w.playerId}"]`) as HTMLElement;
      const trophyEl = document.getElementById('trophy-pot');
      if (seatEl && trophyEl) {
        animateChipMove(trophyEl, trophyEl, seatEl);
      }
    });
  };

  if (!state) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 mx-auto border-2 border-zinc-900 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">初始化牌局...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#0f1115]">
      {/* Felt Table */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-[95%] h-[85%] max-w-[1000px] max-h-[600px] bg-emerald-900 rounded-[100px] shadow-[inset_0_0_80px_rgba(0,0,0,0.7)] border-[16px] border-[#1a1a1a]">
          {/* Center Pot Area */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] sm:w-[400px] text-center space-y-4">
            {/* Community Cards */}
            <div className="relative">
              <CommunityCards cards={state.communityCards} />
              {showdown && result && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute -bottom-12 left-1/2 -translate-x-1/2 bg-zinc-950/90 border border-zinc-700 px-4 py-2 rounded-xl"
                >
                  <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">最佳牌型</div>
                  <div className="text-xs font-bold text-amber-400">
                    {result.winners[0]?.evaluation.label || '牌局结束'}
                  </div>
                </motion.div>
              )}
            </div>
            
            {/* Pot Display */}
            <div className="relative">
              <div className="text-2xl sm:text-3xl font-black text-amber-400 drop-shadow-lg flex items-center justify-center gap-2">
                <span>$</span>
                <span>{state.players.reduce((sum, p) => sum + p.currentBet, 0)}</span>
              </div>
              <div ref={(el) => { if (el) document.getElementById('trophy-pot')?.remove(); }}>
                {/* Chips container for animation */}
              </div>
            </div>

            {/* Buttons */}
            {!showdown && getActivePlayerCount(state.players) > 0 && (
              <button
                onClick={handleShowdown}
                className="mt-4 flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black uppercase tracking-widest text-xs py-2.5 px-6 rounded-full transition-colors"
              >
                <Swords size={14} />
                摊牌
              </button>
            )}
            
            {showdown && result && (
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2 text-emerald-400 font-black uppercase tracking-widest text-sm">
                  <Trophy size={16} />
                  <span>牌局结束</span>
                </div>
                <button
                  onClick={startNewHand}
                  className="flex items-center gap-2 mx-auto bg-white hover:bg-zinc-200 text-zinc-950 font-black uppercase tracking-widest text-xs py-2.5 px-6 rounded-full transition-colors"
                >
                  <RotateCcw size={14} />
                  下一局
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Seats */}
      {state.players.map((player, index) => (
        <Seat
          key={player.id}
          player={player}
          isDealer={player.seat === state.dealerSeat}
          isCurrent={state.currentTurnSeat === index && state.round !== 'showdown'}
          isShowdown={showdown}
          positionClass={POSITIONS[player.seat] || ''}
        />
      ))}

      {/* Human Player Action Panel */}
      {state.currentTurnSeat === 0 && state.round !== 'showdown' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-md">
          <PlayerActionPanel
            player={state.players[0]}
            currentBet={state.currentBet}
            minRaise={state.minRaise}
            bigBlind={state.bb}
            disabled={false}
            onAction={handleUserAction}
          />
        </div>
      )}

      {/* Game Log */}
      <div className="fixed top-4 right-4 z-40 w-[240px]">
        <GameLog logs={logs} />
      </div>

      {/* Settings / Info */}
      <div className="fixed top-4 left-4 z-40 bg-zinc-950/90 border border-zinc-800 rounded-xl px-4 py-3">
        <div className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-1">盲注级别</div>
        <div className="font-mono text-sm font-bold text-zinc-300">
          $20 / $40
        </div>
        <div className="mt-2 text-[9px] font-bold uppercase tracking-widest text-zinc-600">
          手牌 #{state.handNumber}
        </div>
      </div>
    </div>
  );
}
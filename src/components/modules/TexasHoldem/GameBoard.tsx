import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, RotateCcw, Swords, Settings, Info } from 'lucide-react';
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

const POSITIONS = [
  'bottom-12 left-1/2 -translate-x-1/2', // Player 0 (Bottom Center)
  'bottom-1/3 left-6',                   // Player 1 (Left Bottom)
  'top-1/3 left-6',                      // Player 2 (Left Top)
  'top-12 left-1/2 -translate-x-1/2',    // Player 3 (Top Center)
  'top-1/3 right-6',                     // Player 4 (Right Top)
  'bottom-1/3 right-6'                   // Player 5 (Right Bottom)
];

export default function TexasHoldemModule() {
  const [state, setState] = useState<TexasHoldemState | null>(null);
  const [showdown, setShowdown] = useState(false);
  const [result, setResult] = useState<HandResult | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [isDealing, setIsDealing] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const dealerBtnRef = useRef<HTMLDivElement>(null);

  const initPlayers = useCallback(() => {
    const profiles: AiProfile[] = ['tightAggressive', 'loosePassive', 'tightPassive', 'looseAggressive'];
    const p: Player[] = Array.from({ length: 6 }, (_, i) => ({
      id: `p${i}`,
      seat: i,
      name: i === 0 ? '你 (You)' : `AI 助手 ${i}`,
      chips: 10000,
      hand: [],
      currentBet: 0,
      totalCommitted: 0,
      status: 'active',
      isHuman: i === 0,
      aiProfile: i === 0 ? undefined : profiles[(i - 1) % profiles.length],
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
      hand: [],
      currentBet: 0,
      totalCommitted: 0,
      hasActed: false,
      chips: p.chips > 0 ? p.chips : 10000,
      status: p.chips > 0 ? ('active' as PlayerStatus) : 'out',
    }));
    
    const newState = startHand(resetPlayers, dealer, 20, 40, nextHand);
    setState(newState);
    setShowdown(false);
    setResult(null);
    setLogs(newState.logs);
    
    // Trigger GSAP deal animation on new hand
    setIsDealing(true);
    setTimeout(() => {
      setIsDealing(false);
      triggerDealAnimation();
    }, 100);
  }, [state, initPlayers]);

  useEffect(() => {
    if (!state) {
      startNewHand();
    }
  }, [state, startNewHand]);

  // Handle AI moves clockwise
  useEffect(() => {
    if (!state || state.currentTurnSeat === -1 || showdown) return;
    
    const player = state.players[state.currentTurnSeat];
    if (!player || player.isHuman || player.status !== 'active') return;
    
    const timeout = setTimeout(() => {
      const action = getAiDecision(state, state.currentTurnSeat);
      handleAiAction(action);
    }, 1000 + Math.random() * 800);
    
    return () => clearTimeout(timeout);
  }, [state?.currentTurnSeat, state?.round, showdown]); // eslint-disable-line react-hooks/exhaustive-deps

  const triggerDealAnimation = () => {
    if (!containerRef.current) return;
    const cards = containerRef.current.querySelectorAll('[data-card]');
    const dealerBtn = dealerBtnRef.current;
    if (!dealerBtn) return;

    cards.forEach((card, index) => {
      animateDeal({
        cardEl: card as HTMLElement,
        startEl: dealerBtn,
        targetEl: card.parentElement as HTMLElement,
        delay: index * 0.15
      });
    });
  };

  const handleAiAction = (action: PlayerAction) => {
    if (!state) return;
    
    const newState = handleAction(state, state.currentTurnSeat, action);
    
    if (newState.currentTurnSeat === -1) {
      const afterProgress = progressRound(newState);
      setState(afterProgress);
      setLogs(prev => [...prev, ...afterProgress.logs]);
      
      if (afterProgress.round === 'showdown') {
        handleShowdown(afterProgress);
      }
    } else {
      setState(newState);
      setLogs(prev => [...prev, ...newState.logs]);
    }
  };

  const handleUserAction = (action: PlayerAction) => {
    if (!state) return;
    const newState = handleAction(state, state.currentTurnSeat, action);
    
    if (newState.currentTurnSeat === -1) {
      const afterProgress = progressRound(newState);
      setState(afterProgress);
      setLogs(prev => [...prev, ...afterProgress.logs]);
      
      if (afterProgress.round === 'showdown') {
        handleShowdown(afterProgress);
      }
    } else {
      setState(newState);
      setLogs(prev => [...prev, ...newState.logs]);
    }
  };

  const handleShowdown = (finalState: TexasHoldemState) => {
    const settleResult = settleWinners(finalState);
    setResult(settleResult);
    setShowdown(true);
    
    // Animate chips to winners
    setTimeout(() => {
      settleResult.winners.forEach(w => {
        const seatEl = containerRef.current?.querySelector(`[data-seat="${w.playerId}"]`) as HTMLElement;
        const potEl = document.getElementById('pot-chip-container');
        if (seatEl && potEl) {
          animateChipMove(potEl, potEl, seatEl);
        }
      });
    }, 500);
  };

  if (!state) {
    return (
      <div className="flex h-full items-center justify-center bg-[#090a0f]">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 mx-auto border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">初始化牌桌中 (INITIALIZING)...</p>
        </div>
      </div>
    );
  }

  const currentActivePlayer = state.players[state.currentTurnSeat];

  return (
    <div ref={containerRef} className="relative w-full h-[620px] overflow-hidden bg-[#0a0b0d] flex items-center justify-center font-sans select-none">
      
      {/* felt background texture & board border */}
      <div className="relative w-[92%] h-[82%] max-w-[900px] max-h-[500px] bg-[#14181f] rounded-[180px] shadow-[inset_0_0_120px_rgba(0,0,0,0.85)] border-[10px] border-[#1d222b] flex items-center justify-center">
        
        {/* Inner felt decor */}
        <div className="absolute inset-4 rounded-[160px] border border-zinc-800/20 pointer-events-none" />

        {/* Center community area */}
        <div className="text-center z-10 space-y-5">
          <div className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-500">
            {state.round === 'preflop' ? 'Pre-Flop' : state.round.toUpperCase()}
          </div>
          
          <CommunityCards cards={state.communityCards} />
          
          {/* Pot display */}
          <div className="relative inline-flex flex-col items-center">
            <div id="pot-chip-container" className="flex items-center gap-1.5 bg-zinc-950/80 border border-zinc-800/80 rounded-full px-4 py-1.5 shadow-2xl">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse inline-block" />
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">底池 (POT)</span>
              <span className="font-mono text-xs font-black text-amber-300">
                ${state.players.reduce((sum, p) => sum + p.currentBet, 0) + state.potState.mainPot}
              </span>
            </div>
          </div>

          {/* Showdown panel info */}
          {showdown && result && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-zinc-950/95 border border-zinc-800 p-4 rounded-xl max-w-xs mx-auto shadow-2xl space-y-3"
            >
              <div>
                <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">获胜者 (WINNER)</div>
                <div className="text-xs font-black text-amber-400 mt-1">
                  {result.winners.map(w => state.players.find(p => p.id === w.playerId)?.name).join(', ')}
                </div>
                <div className="text-[10px] text-zinc-300 mt-0.5">
                  赢取了 ${result.winners.reduce((sum, w) => sum + w.amount, 0)}
                </div>
              </div>
              <button
                onClick={startNewHand}
                className="w-full bg-white hover:bg-zinc-200 text-zinc-950 font-black uppercase tracking-widest text-[10px] py-2 rounded-lg transition-colors"
              >
                下一局 (NEXT HAND)
              </button>
            </motion.div>
          )}
        </div>

        {/* Dealer Button location */}
        <div ref={dealerBtnRef} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-zinc-800 border border-zinc-700 opacity-0 pointer-events-none" />
      </div>

      {/* Seats surrounding the table */}
      {state.players.map((player, index) => {
        if (player.status === 'out') return null;
        return (
          <Seat
            key={player.id}
            player={player}
            isDealer={player.seat === state.dealerSeat}
            isCurrent={state.currentTurnSeat === index && !showdown}
            isShowdown={showdown}
            positionClass={POSITIONS[player.seat]}
          />
        );
      })}

      {/* Real player Action Panel */}
      {state.currentTurnSeat === 0 && !showdown && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 w-[90%] max-w-sm">
          <PlayerActionPanel
            player={state.players[0]}
            currentBet={state.currentBet}
            minRaise={state.minRaise}
            bigBlind={state.bb}
            disabled={isDealing}
            onAction={handleUserAction}
          />
        </div>
      )}

      {/* Side Log panel */}
      <div className="absolute top-4 right-4 z-30 w-[200px] h-[160px]">
        <GameLog logs={logs} />
      </div>

      {/* Settings / Blind Level HUD */}
      <div className="absolute top-4 left-4 z-30 flex items-center gap-3 bg-zinc-950/90 border border-white/5 rounded-xl p-3 shadow-2xl">
        <div>
          <div className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-0.5">盲注级别</div>
          <div className="font-mono text-xs font-black text-zinc-200">
            ${state.sb} / ${state.bb}
          </div>
        </div>
        <div className="h-6 w-px bg-white/10" />
        <div>
          <div className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-0.5">手牌 (HAND)</div>
          <div className="font-mono text-xs font-black text-amber-300">
            #{state.handNumber}
          </div>
        </div>
      </div>
    </div>
  );
}
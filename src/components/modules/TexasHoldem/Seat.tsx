import React from 'react';
import { Bot, CircleDollarSign, Crown } from 'lucide-react';
import { Player } from './types';
import PokerCard from './PokerCard';

interface SeatProps {
  key?: React.Key;
  player: Player;
  isDealer: boolean;
  isCurrent: boolean;
  isShowdown: boolean;
  positionClass: string;
}

export default function Seat({ player, isDealer, isCurrent, isShowdown, positionClass }: SeatProps) {
  const inactive = player.status === 'folded' || player.status === 'out';
  const showCards = player.isHuman || isShowdown;

  return (
    <div
      data-seat={player.seat}
      className={`absolute z-20 ${positionClass} w-[132px] sm:w-[160px] transition-all duration-300 ${inactive ? 'opacity-40 grayscale' : ''}`}
    >
      <div className={`rounded-xl border px-2.5 py-2 shadow-xl backdrop-blur-md transition-all ${isCurrent ? 'border-amber-400 bg-zinc-900 ring-2 ring-amber-400/20' : 'border-white/10 bg-zinc-950/90'}`}>
        <div className="flex items-center gap-2">
          <div className={`flex h-7 w-7 items-center justify-center rounded-full ${player.isHuman ? 'bg-amber-400 text-zinc-950' : 'bg-zinc-800 text-zinc-300'}`}>
            {player.isHuman ? <Crown size={13} /> : <Bot size={13} />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[10px] font-black uppercase tracking-[0.12em] text-white">{player.name}</div>
            <div className="mt-0.5 flex items-center gap-1 font-mono text-[10px] text-amber-300"><CircleDollarSign size={10} />{player.chips.toLocaleString()}</div>
          </div>
          {isDealer && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[9px] font-black text-zinc-950">D</span>}
        </div>
        <div className="mt-2 flex justify-center gap-1">
          {player.hand.length ? player.hand.map((card, index) => (
            <PokerCard key={`${card.rank}${card.suit}-${index}`} card={card} hidden={!showCards} className="!h-11 !w-8 sm:!h-12 sm:!w-9" />
          )) : <div className="h-11 text-[9px] uppercase tracking-widest text-zinc-600 flex items-center">等待发牌</div>}
        </div>
        <div className="mt-1.5 flex min-h-4 justify-between text-[9px] font-bold uppercase tracking-widest">
          <span className={player.status === 'all-in' ? 'text-rose-400' : 'text-zinc-500'}>{player.status}</span>
          {player.currentBet > 0 && <span className="text-amber-300">下注 {player.currentBet}</span>}
        </div>
      </div>
    </div>
  );
}
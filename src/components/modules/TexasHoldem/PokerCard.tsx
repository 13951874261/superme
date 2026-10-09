import React from 'react';
import { Card as CardType } from './types';

interface PokerCardProps {
  key?: React.Key;
  card?: CardType;
  hidden?: boolean;
  className?: string;
  cardRef?: React.Ref<HTMLDivElement>;
}

export default function PokerCard({ card, hidden = false, className = '', cardRef }: PokerCardProps) {
  const red = card?.suit === '♥' || card?.suit === '♦';
  return (
    <div
      ref={cardRef}
      data-card
      className={`relative h-16 w-11 sm:h-[72px] sm:w-[50px] rounded-[7px] border shadow-[0_5px_15px_rgba(0,0,0,.18)] overflow-hidden select-none transform-gpu ${
        hidden ? 'border-amber-500/25 bg-zinc-950' : 'border-zinc-200 bg-[#fffefa]'
      } ${className}`}
    >
      {hidden || !card ? (
        <div className="absolute inset-[4px] rounded-[4px] border border-amber-400/30 bg-[radial-gradient(circle_at_center,rgba(245,158,11,.2),transparent_62%),repeating-linear-gradient(45deg,rgba(255,255,255,.05)_0px,rgba(255,255,255,.05)_1px,transparent_1px,transparent_5px)]" />
      ) : (
        <>
          <div className={`absolute left-1.5 top-1 text-[12px] sm:text-sm font-black leading-none ${red ? 'text-rose-600' : 'text-zinc-950'}`}>
            <div>{card.rank}</div>
            <div className="mt-0.5 text-[10px] sm:text-xs">{card.suit}</div>
          </div>
          <div className={`absolute bottom-1.5 right-1.5 rotate-180 text-[12px] sm:text-sm font-black leading-none ${red ? 'text-rose-600' : 'text-zinc-950'}`}>
            <div>{card.rank}</div>
            <div className="mt-0.5 text-[10px] sm:text-xs">{card.suit}</div>
          </div>
          <div className={`absolute inset-0 flex items-center justify-center text-xl sm:text-2xl ${red ? 'text-rose-600' : 'text-zinc-950'}`}>{card.suit}</div>
        </>
      )}
    </div>
  );
}
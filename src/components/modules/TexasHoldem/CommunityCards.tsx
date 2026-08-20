import React from 'react';
import PokerCard from './PokerCard';
import { Card } from './types';

interface CommunityCardsProps {
  cards: Card[];
}

export default function CommunityCards({ cards }: CommunityCardsProps) {
  return (
    <div data-community className="flex items-center justify-center gap-1.5 sm:gap-2">
      {Array.from({ length: 5 }, (_, index) => (
        <PokerCard key={index} card={cards[index]} hidden={!cards[index]} className={cards[index] ? '' : 'opacity-35'} />
      ))}
    </div>
  );
}
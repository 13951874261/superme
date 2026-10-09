import React from 'react';
import { Player, PlayerAction } from './types';

interface PlayerActionPanelProps {
  player: Player;
  currentBet: number;
  minRaise: number;
  bigBlind: number;
  disabled: boolean;
  onAction: (action: PlayerAction) => void;
}

export default function PlayerActionPanel({ player, currentBet, minRaise, bigBlind, disabled, onAction }: PlayerActionPanelProps) {
  const callAmount = Math.max(0, currentBet - player.currentBet);
  const [raiseTo, setRaiseTo] = React.useState(Math.max(minRaise, currentBet + bigBlind));

  React.useEffect(() => {
    setRaiseTo(Math.min(player.currentBet + player.chips, Math.max(minRaise, currentBet + bigBlind)));
  }, [currentBet, minRaise, bigBlind, player.currentBet, player.chips]);

  const maxTarget = player.currentBet + player.chips;
  const canRaise = maxTarget > currentBet;

  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-950/95 p-3 shadow-2xl backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">
        <span>你的行动</span>
        <span className="font-mono text-amber-300">需跟注 {Math.min(callAmount, player.chips)}</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        <button disabled={disabled} onClick={() => onAction({ type: 'fold' })} className="rounded-lg border border-white/10 px-2 py-2 text-[10px] font-black tracking-wider text-zinc-400 transition hover:border-rose-500/50 hover:text-rose-300 disabled:opacity-30">弃牌</button>
        <button disabled={disabled || callAmount > 0} onClick={() => onAction({ type: 'check' })} className="rounded-lg border border-white/10 px-2 py-2 text-[10px] font-black tracking-wider text-zinc-200 transition hover:border-white/30 disabled:opacity-30">过牌</button>
        <button disabled={disabled || callAmount === 0} onClick={() => onAction({ type: 'call' })} className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-2 py-2 text-[10px] font-black tracking-wider text-amber-300 transition hover:bg-amber-400/20 disabled:opacity-30">跟注</button>
        <button disabled={disabled} onClick={() => onAction({ type: 'all-in' })} className="rounded-lg bg-rose-600 px-2 py-2 text-[10px] font-black tracking-wider text-white transition hover:bg-rose-500 disabled:opacity-30">ALL IN</button>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <input
          type="range"
          min={Math.min(maxTarget, Math.max(currentBet + bigBlind, minRaise))}
          max={Math.max(Math.min(maxTarget, Math.max(currentBet + bigBlind, minRaise)), maxTarget)}
          step={Math.max(1, bigBlind)}
          value={Math.min(raiseTo, maxTarget)}
          onChange={(event) => setRaiseTo(Number(event.target.value))}
          disabled={disabled || !canRaise}
          className="h-1 flex-1 accent-amber-400 disabled:opacity-30"
        />
        <span className="w-16 text-right font-mono text-[11px] text-zinc-300">{raiseTo}</span>
        <button disabled={disabled || !canRaise} onClick={() => onAction({ type: 'raise', amount: raiseTo })} className="rounded-lg bg-amber-400 px-4 py-2 text-[10px] font-black tracking-wider text-zinc-950 transition hover:bg-amber-300 disabled:opacity-30">加注</button>
      </div>
    </div>
  );
}
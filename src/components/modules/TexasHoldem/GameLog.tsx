import React from 'react';

export default function GameLog({ logs }: { logs: string[] }) {
  return (
    <aside className="h-full rounded-2xl border border-white/10 bg-zinc-950 p-4">
      <div className="mb-3 text-[9px] font-black uppercase tracking-[0.22em] text-zinc-500">牌局记录</div>
      <div className="max-h-48 space-y-2 overflow-y-auto pr-1 scrollbar-thin">
        {[...logs].reverse().map((log, index) => (
          <div key={`${log}-${index}`} className={`border-l pl-2 text-[10px] leading-relaxed ${index === 0 ? 'border-amber-400 text-zinc-200' : 'border-zinc-800 text-zinc-500'}`}>{log}</div>
        ))}
      </div>
    </aside>
  );
}
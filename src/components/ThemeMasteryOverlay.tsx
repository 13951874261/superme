import React, { useEffect, useState } from 'react';
import Confetti from './Confetti';
import { playSuccess } from '../utils/soundEffects';
import { ShieldCheck } from 'lucide-react';

export default function ThemeMasteryOverlay({ theme, onDismiss }: { theme: string, onDismiss: () => void }) {
  const [show, setShow] = useState(true);

  useEffect(() => {
    // Play a sequence of success sounds for victory
    playSuccess();
    setTimeout(playSuccess, 200);
    setTimeout(playSuccess, 400);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-md animate-[fadeIn_0.5s_ease-out]">
      <Confetti duration={5000} />
      <div className="bg-[#202124] border border-emerald-500/30 rounded-[2.5rem] p-12 text-center max-w-lg shadow-[0_0_100px_rgba(16,185,129,0.2)] animate-[slideUp_0.5s_ease-out] relative z-10 mx-4">
        <div className="w-28 h-28 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-8 shadow-[0_0_50px_rgba(16,185,129,0.4)] border-4 border-emerald-500/30">
          <ShieldCheck className="w-14 h-14" />
        </div>
        <h2 className="text-3xl font-black text-white mb-3 uppercase tracking-widest">阵地已被攻克</h2>
        <h3 className="text-emerald-400 text-lg font-bold mb-6">{theme}</h3>
        <p className="text-gray-400 text-sm leading-relaxed mb-8">
          您已在此战场完成了<strong className="text-white mx-1">10</strong>轮高压口语推演，并取得了<strong className="text-white mx-1">L3</strong>战略级写作满分。<br/><br/>
          系统为您颁发最高级别勋章：<br/>
          <strong className="text-[#FF5722] text-lg block mt-3 uppercase tracking-widest">「战略破局者 / Game Changer」</strong>
        </p>
        <button 
          onClick={() => { setShow(false); onDismiss(); }}
          className="w-full bg-emerald-500 text-white font-black uppercase tracking-widest py-4 rounded-xl hover:bg-emerald-400 transition-colors shadow-lg cursor-pointer"
        >
          继续进军下一个战略目标 ➔
        </button>
      </div>
    </div>
  );
}

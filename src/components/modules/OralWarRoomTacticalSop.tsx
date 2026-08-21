import React from 'react';
import { Mic } from 'lucide-react';

export default function OralWarRoomTacticalSop() {
  return (
    <div className="bg-slate-50 border border-[var(--color-border)] rounded-2xl p-5 flex items-start gap-4 shrink-0 shadow-sm mb-4">
      <div className="bg-[var(--color-brand)] text-white p-2.5 rounded-xl shrink-0 mt-0.5 shadow-md">
        <Mic className="w-5 h-5" strokeWidth={2} />
      </div>
      <div className="flex-1">
        <h5 className="text-[11px] font-black uppercase tracking-widest text-[var(--color-brand)] mb-1">
          战术使用指南 // Tactical SOP
        </h5>
        <p className="text-xs text-[var(--color-ink-secondary)] font-medium">
          请遵循以下战术指南，以最大化利用本模块的高阶商业实战材料与智能整理功能。
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 text-left">
          <div className="flex items-start gap-2.5 p-4 rounded-2xl border border-amber-100/50 bg-amber-50/10 hover:bg-amber-50/30 transition-all duration-300 transform hover:-translate-y-0.5">
            <p className="text-xs text-amber-900/80 leading-relaxed font-medium">
              <span className="font-black text-amber-700 mr-1">操作说明：</span>
              长按下方麦克风语音反击，或打字回复。沙盘会根据当前 Theme 自动锁定剧本。倒计时 10 秒内必须给出回应。
            </p>
          </div>
          <div className="flex items-start gap-2.5 p-4 rounded-2xl border border-amber-100/50 bg-amber-50/10 hover:bg-amber-50/30 transition-all duration-300 transform translate-y-1 hover:translate-y-0.5">
            <p className="text-xs text-amber-900/80 leading-relaxed font-medium">
              <span className="font-black text-amber-700 mr-1">功能亮点：</span>
              多方势力动态对抗。AI 同步扮演发难者与盟友，对您进行跨文化和权力的双重极限施压。
            </p>
          </div>
          <div className="flex items-start gap-2.5 p-4 rounded-2xl border border-amber-100/50 bg-amber-50/10 hover:bg-amber-50/30 transition-all duration-300 transform -translate-y-0.5 hover:translate-y-[-4px]">
            <p className="text-xs text-amber-900/80 leading-relaxed font-medium">
              <span className="font-black text-amber-700 mr-1">生态定位：</span>
              【肌肉记忆】消化所有前置弹药。强迫您在毫秒级的高压对抗中，建立直觉性的、不打草稿的商务谈判反击能力。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

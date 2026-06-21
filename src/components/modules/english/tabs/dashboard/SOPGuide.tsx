import React from 'react';

export interface SOPGuideProps {
  isSopExpanded: boolean;
}

export function SOPGuide({ isSopExpanded }: SOPGuideProps) {
  if (!isSopExpanded) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-indigo-100/50 text-left animate-[fadeIn_0.2s_ease-out]">
      <div className="flex items-start gap-2.5 p-4 rounded-2xl border border-amber-100/50 bg-amber-50/10 hover:bg-amber-50 transition-colors">
        <span className="text-amber-500 mt-0.5">💡</span>
        <p className="text-xs text-amber-900/80 leading-relaxed font-medium"><span className="font-black text-amber-700 mr-1">操作说明：</span>在战局总览选择战略阶段，在弹药库一键“生成长文并提纯”获取语料弹药。</p>
      </div>
      <div className="flex items-start gap-2.5 p-4 rounded-2xl border border-amber-100/50 bg-amber-50/10 hover:bg-amber-50 transition-colors">
        <span className="text-amber-500 mt-0.5">💡</span>
        <p className="text-xs text-amber-900/80 leading-relaxed font-medium"><span className="font-black text-amber-700 mr-1">功能亮点：</span>硬核“通关锁”机制——口语不练满 10 轮、邮件拿不到 8 分，阵地将被强制死锁。</p>
      </div>
      <div className="flex items-start gap-2.5 p-4 rounded-2xl border border-amber-100/50 bg-amber-50/10 hover:bg-amber-50 transition-colors">
        <span className="text-amber-500 mt-0.5">💡</span>
        <p className="text-xs text-amber-900/80 leading-relaxed font-medium"><span className="font-black text-amber-700 mr-1">生态定位：</span>它设定的 Theme 将统治全局场景；抽取的弹药将直接输送至 Vocab 矩阵。</p>
      </div>
    </div>
  );
}

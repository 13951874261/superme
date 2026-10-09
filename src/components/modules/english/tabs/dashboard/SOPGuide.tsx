import React from 'react';

export interface SOPGuideProps {
  isSopExpanded: boolean;
}

export function SOPGuide({ isSopExpanded }: SOPGuideProps) {
  if (!isSopExpanded) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-indigo-100/50 text-left animate-[fadeIn_0.2s_ease-out]">
      <div className="flex items-start gap-2.5 p-4 rounded-2xl border border-amber-100/50 bg-amber-50/10 hover:bg-amber-50 transition-colors">
        <span className="text-amber-500 mt-0.5"></span>
        <p className="text-xs text-amber-900/80 leading-relaxed font-medium"><span className="font-black text-amber-700 mr-1">操作说明：</span>在进度总览选择学习阶段，在学习材料区一键「生成今日长文」获取学习材料。</p>
      </div>
      <div className="flex items-start gap-2.5 p-4 rounded-2xl border border-amber-100/50 bg-amber-50/10 hover:bg-amber-50 transition-colors">
        <span className="text-amber-500 mt-0.5"></span>
        <p className="text-xs text-amber-900/80 leading-relaxed font-medium"><span className="font-black text-amber-700 mr-1">功能亮点：</span>达标要求：口语练满 10 轮、邮件达到 8 分后，才能切换下一主题。</p>
      </div>
      <div className="flex items-start gap-2.5 p-4 rounded-2xl border border-amber-100/50 bg-amber-50/10 hover:bg-amber-50 transition-colors">
        <span className="text-amber-500 mt-0.5"></span>
        <p className="text-xs text-amber-900/80 leading-relaxed font-medium"><span className="font-black text-amber-700 mr-1">模块作用：</span>这里设定的主题会贯穿全局练习；整理出的词汇会进入「生词复习」。</p>
      </div>
    </div>
  );
}

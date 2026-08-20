import React from 'react';
import { PenTool } from 'lucide-react';
import ModuleWrapper from './ModuleWrapper';
import WriteTab from './english/tabs/WriteTab';

export default function WriteModule() {
  return (
    <ModuleWrapper 
      title="立言 ｜ 决策文治与价值提炼" 
      icon={<PenTool className="w-8 h-8" strokeWidth={2.5} />}
      description="打破行政局限，实现三级纵深批改与商业价值转化引擎。"
    >
      <WriteTab />
    </ModuleWrapper>
  );
}

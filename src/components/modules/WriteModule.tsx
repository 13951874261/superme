import React from 'react';
import { PenTool } from 'lucide-react';
import ModuleWrapper from './ModuleWrapper';
import WriteTab from './english/tabs/WriteTab';

export default function WriteModule() {
  return (
    <ModuleWrapper 
      title="写作 ｜ 决策写作与价值提炼" 
      icon={<PenTool className="w-8 h-8" strokeWidth={2.5} />}
      description="打破行政局限，实现三级批改与商业表达提升。"
    >
      <WriteTab />
    </ModuleWrapper>
  );
}

import React from 'react';
import { PenTool } from 'lucide-react';
import ModuleWrapper from './ModuleWrapper';
import WriteTab from './english/tabs/WriteTab';

export default function WriteModule() {
  return (
    <ModuleWrapper 
      title="写作 ｜ 中文公文与文治批改" 
      icon={<PenTool className="w-8 h-8" strokeWidth={2.5} />}
      description="体制内公文、中文商务函、履历价值提炼。走文治审阅，与英语书面练习分开。"
    >
      <WriteTab variant="zh" />
    </ModuleWrapper>
  );
}

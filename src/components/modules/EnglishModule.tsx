import React from 'react';
import { Globe, Mic, Volume2, Target, PenTool, BookOpen } from 'lucide-react';
import ModuleWrapper from './ModuleWrapper';
import OralWarRoom from './OralWarRoom';
import { EnglishProvider, useEnglishContext, EnglishTab } from './english/context/EnglishContext';
import DashboardTab from './english/tabs/DashboardTab';
import VocabTab from './english/tabs/VocabTab';
import ListenTab from './english/tabs/ListenTab';
import WriteTab from './english/tabs/WriteTab';
import { checkThemeMastery } from '../../services/trainingAPI';
import GlobalSettingsPanel from '../GlobalSettingsPanel';
import ThemeMasteryOverlay from '../ThemeMasteryOverlay';

const SUB_TABS = [
  { id: 'dashboard', label: '进度总控', icon: <Target className="w-4 h-4" /> },
  { id: 'vocab',     label: '词汇矩阵',   icon: <BookOpen className="w-4 h-4" /> },
  { id: 'listen',    label: '精听盲听',   icon: <Volume2 className="w-4 h-4" /> },
  { id: 'oral',      label: '多角色沙盘', icon: <Mic className="w-4 h-4" /> },
  { id: 'write',     label: '纵深书面',   icon: <PenTool className="w-4 h-4" /> },
] as const;

function EnglishModuleContent() {
  const { activeTab, setActiveTab, theme, sessionId, setMasteryData, showMasteryOverlay, setShowMasteryOverlay } = useEnglishContext();

  return (
    <>
      {showMasteryOverlay && <ThemeMasteryOverlay theme={theme} onDismiss={() => setShowMasteryOverlay(false)} />}
      <GlobalSettingsPanel />
      <ModuleWrapper
      title="英语战略 ｜ 跨文化信任构建"
      icon={<Globe className="w-8 h-8" strokeWidth={2.5} />}
      description="不仅是交流，而是用英语构建信任、影响他人并主导跨国谈判。必须达成硬性通关标准方可解锁下行主题。"
    >
      <div className="flex flex-wrap gap-2 mb-8 bg-[#f8f9fa] p-2 rounded-2xl border border-gray-100 w-max">
        {SUB_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={(e) => { e.stopPropagation(); setActiveTab(tab.id as EnglishTab); }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-xs tracking-widest uppercase transition-all ${
              activeTab === tab.id ? 'bg-[#202124] text-white shadow-md' : 'text-gray-500 hover:text-[#202124] hover:bg-white'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      <div className="animate-[fadeIn_0.3s_ease-out]">
        {activeTab === 'dashboard' && <DashboardTab />}
        {activeTab === 'vocab' && <VocabTab />}
        {activeTab === 'listen' && <ListenTab />}
        {activeTab === 'oral' && (
          <OralWarRoom
            embedded
            sceneTheme={theme}
            sessionId={sessionId}
            userId="default-user"
            onOralRoundLogged={() => {
              checkThemeMastery(theme)
                .then((res) => {
                  if (res.success) {
                    setMasteryData({
                      isMastered: res.isMastered,
                      oralCount: res.oralCount,
                      maxWriteScore: res.maxWriteScore,
                    });
                  }
                })
                .catch(() => {});
            }}
          />
        )}
        {activeTab === 'write' && <WriteTab />}
      </div>
    </ModuleWrapper>
    </>
  );
}

export default function EnglishModule() {
  return (
    <EnglishProvider>
      <EnglishModuleContent />
    </EnglishProvider>
  );
}

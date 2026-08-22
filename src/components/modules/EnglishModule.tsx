import React, { useEffect, useState } from 'react';
import { Globe, Mic, Volume2, Target, PenTool, BookOpen, Radio } from 'lucide-react';
import ModuleWrapper from './ModuleWrapper';
import OralWarRoom from './OralWarRoom';
import { useEnglishContext, EnglishTab } from './english/context/EnglishContext';
import DashboardTab from './english/tabs/DashboardTab';
import VocabTab from './english/tabs/VocabTab';
import ListenTab from './english/tabs/ListenTab';
import WriteTab from './english/tabs/WriteTab';
import ImpromptuSpeechTab from './english/tabs/ImpromptuSpeechTab';
import { checkThemeMastery } from '../../services/trainingAPI';
import ThemeMasteryOverlay from '../ThemeMasteryOverlay';
import DailyErrorVocabularyModule from './DailyErrorVocabularyModule';
import { playSwitch } from '../../utils/soundEffects';
import { getAppUserId } from '../../utils/profileHelper';

const SUB_TABS = [
  { id: 'dashboard', label: '进度总控', icon: <Target className="w-4 h-4" /> },
  { id: 'vocab',     label: '生词复习',   icon: <BookOpen className="w-4 h-4" /> },
  { id: 'listen',    label: '精听盲听',   icon: <Volume2 className="w-4 h-4" /> },
  { id: 'oral',      label: '多角色练习', icon: <Mic className="w-4 h-4" /> },
  { id: 'write',     label: '纵深书面',   icon: <PenTool className="w-4 h-4" /> },
  { id: 'impromptu', label: '即兴演讲', icon: <Radio className="w-4 h-4" /> },
] as const;

function EnglishModuleContent() {
  const { activeTab, setActiveTab, theme, sessionId, setMasteryData, showMasteryOverlay, setShowMasteryOverlay } = useEnglishContext();
  // 首次访问才挂载，之后 keep-alive，避免未打开的 Tab 提前打接口
  const [mountedTabs, setMountedTabs] = useState<Set<EnglishTab>>(() => new Set(['dashboard']));

  useEffect(() => {
    setMountedTabs((prev) => {
      if (prev.has(activeTab)) return prev;
      const next = new Set(prev);
      next.add(activeTab);
      return next;
    });
  }, [activeTab]);

  const panel = (id: EnglishTab, node: React.ReactNode) => {
    if (!mountedTabs.has(id)) return null;
    return (
      <div key={id} hidden={activeTab !== id}>
        {node}
      </div>
    );
  };

  return (
    <>
      <DailyErrorVocabularyModule />
      {showMasteryOverlay && <ThemeMasteryOverlay theme={theme} onDismiss={() => setShowMasteryOverlay(false)} />}
      <ModuleWrapper
      title="英语战略 ｜ 跨文化信任构建"
      icon={<Globe className="w-8 h-8" strokeWidth={2.5} />}
      description="不仅是交流，而是用英语构建信任、影响他人并主导跨国谈判。可在进度总控的「战略路线图」中自由切换想要练习的主题或阶段。"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 bg-[#f8f9fa] p-1.5 rounded-xl border border-gray-100 w-full">
        {SUB_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={(e) => {
              e.stopPropagation();
              if (activeTab !== tab.id) playSwitch();
              setActiveTab(tab.id as EnglishTab);
            }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-black text-xs tracking-widest uppercase transition-all duration-200 hover:scale-[1.01] active:scale-[0.98] shrink-0 ${
              activeTab === tab.id 
                ? 'bg-[var(--color-brand)] text-white shadow-[0_4px_12px_rgba(0,0,0,0.12)] border border-[var(--color-brand)]' 
                : 'text-gray-500 hover:text-[var(--color-brand)] hover:bg-white hover:shadow-sm border border-transparent'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      <div className="animate-fade-in-scale">
        {panel('dashboard', <DashboardTab />)}
        {panel('vocab', <VocabTab />)}
        {panel('listen', <ListenTab />)}
        {panel('oral', (
          <OralWarRoom
            embedded
            sceneTheme={theme}
            sessionId={sessionId}
            userId={getAppUserId()}
            onNavigateWrite={() => setActiveTab('write')}
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
        ))}
        {panel('write', <WriteTab variant="en" />)}
        {panel('impromptu', <ImpromptuSpeechTab />)}
      </div>
    </ModuleWrapper>
    </>
  );
}

const EnglishModule = React.memo(EnglishModuleContent);
export default EnglishModule;


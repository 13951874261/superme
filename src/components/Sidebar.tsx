import React, { useState, useEffect, useMemo, memo } from 'react';
import { ChevronLeft, ChevronRight, MessageSquare, Search, BookOpen, Calendar, CheckCircle2, RefreshCw, Languages, Type, BookA, BrainCircuit, ChevronUp, ChevronDown, Lock, Edit3 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ChatModule from './ChatModule';
import DictionaryPanel from './DictionaryPanel';
import VocabularyBook from './VocabularyBook';
import Confetti from './Confetti';
import { formatDateShort, getRecentDates, getTodayDateDot } from '../utils/date';
import BiweeklyReviewCard from './modules/BiweeklyReviewCard';
import KnowledgeVaultDrawer from './KnowledgeVault/KnowledgeVaultDrawer';
import { playClick, playPageTurn, playReveal, playDrag } from '../utils/soundEffects';
import { GLOBAL_SPRING } from '../utils/motion';
import { useBiweeklyReviewTrigger } from '../hooks/useBiweeklyReviewTrigger';
import { CAREER_CHANGED_EVENT, readCareerPath } from '../utils/careerProgression';
import { saveCareerPathForAccount } from '../utils/profileHelper';
import { THEME_CHANGED_EVENT, readCurrentTheme } from '../utils/currentTheme';
import { fetchUserTheme } from '../services/dailyPackAPI';

type CalendarDaySlot = {
  day: number;
  isCurrentMonth: boolean;
  monthOffset: number;
};

function getDaysInMonth(year: number, month: number): CalendarDaySlot[] {
  const date = new Date(year, month, 1);
  const days: CalendarDaySlot[] = [];
  let startDay = date.getDay();
  if (startDay === 0) startDay = 7;

  const prevMonthLastDate = new Date(year, month, 0).getDate();
  for (let i = startDay - 1; i > 0; i--) {
    days.push({
      day: prevMonthLastDate - i + 1,
      isCurrentMonth: false,
      monthOffset: -1,
    });
  }

  const lastDate = new Date(year, month + 1, 0).getDate();
  for (let i = 1; i <= lastDate; i++) {
    days.push({
      day: i,
      isCurrentMonth: true,
      monthOffset: 0,
    });
  }

  const totalSlots = days.length <= 35 ? 35 : 42;
  const nextDaysNeeded = totalSlots - days.length;
  for (let i = 1; i <= nextDaysNeeded; i++) {
    days.push({
      day: i,
      isCurrentMonth: false,
      monthOffset: 1,
    });
  }

  return days;
}

function getDateStr(viewYear: number, viewMonth: number, day: number, monthOffset: number) {
  let y = viewYear;
  let m = viewMonth + monthOffset;
  if (m < 0) {
    m = 11;
    y = y - 1;
  } else if (m > 11) {
    m = 0;
    y = y + 1;
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${y}.${pad(m + 1)}.${pad(day)}`;
}

function readHabitsCount(dateStr: string): number {
  const saved = localStorage.getItem(`superme_habits_${dateStr}`);
  if (!saved) return 0;
  try {
    const parsed = JSON.parse(saved);
    return Object.values(parsed).filter(Boolean).length;
  } catch {
    return 0;
  }
}

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
  selectedDate: string;
  onDateSelect: (date: string) => void;
  activeModule?: string;
  setActiveModule?: (module: any) => void;
  isLocked?: boolean;
  onLockTrigger?: () => void;
}

function SidebarComponent({ 
  isOpen, 
  toggleSidebar, 
  selectedDate, 
  onDateSelect, 
  activeModule, 
  setActiveModule,
  isLocked,
  onLockTrigger
}: SidebarProps) {
  const today = getTodayDateDot();
  const { shouldShowCard, daysSinceReview } = useBiweeklyReviewTrigger();

  const [bgEnabled, setBgEnabled] = useState(
    localStorage.getItem('super_agent_bg_enabled') !== 'false'
  );

  useEffect(() => {
    const handleSettingsChange = () => {
      setBgEnabled(localStorage.getItem('super_agent_bg_enabled') !== 'false');
    };
    window.addEventListener('global-settings-changed', handleSettingsChange);
    return () => window.removeEventListener('global-settings-changed', handleSettingsChange);
  }, []);

  // 月度日历折叠状态与视图年月
  const [isCalendarOpen, setIsCalendarOpen] = useState(true);
  const [viewYear, setViewYear] = useState(() => {
    const parts = selectedDate.split('.');
    return parts[0] ? Number(parts[0]) : new Date().getFullYear();
  });
  const [viewMonth, setViewMonth] = useState(() => {
    const parts = selectedDate.split('.');
    return parts[1] ? Number(parts[1]) - 1 : new Date().getMonth();
  });

  // 当外部 selectedDate 变化时，自动同步日历视图的月份与年份
  useEffect(() => {
    if (selectedDate) {
      const parts = selectedDate.split('.');
      if (parts.length === 3) {
        const y = Number(parts[0]);
        const m = Number(parts[1]) - 1;
        if (!isNaN(y) && !isNaN(m)) {
          setViewYear(y);
          setViewMonth(m);
        }
      }
    }
  }, [selectedDate]);

  // 习惯与职业追踪器折叠状态管理
  const [isHabitOpen, setIsHabitOpen] = useState(true);
  const [isCareerOpen, setIsCareerOpen] = useState(true);

  // 习惯持久化状态（绑定 selectedDate 进行数据隔离）
  const [habits, setHabits] = useState(() => {
    const saved = localStorage.getItem(`superme_habits_${selectedDate}`);
    return saved ? JSON.parse(saved) : {
      sleep: false,
      diet: false,
      exercise: false,
      goodDeed: false
    };
  });

  // 当日期 selectedDate 切换时，重新加载对应的隔离习惯数据
  useEffect(() => {
    const saved = localStorage.getItem(`superme_habits_${selectedDate}`);
    setHabits(saved ? JSON.parse(saved) : {
      sleep: false,
      diet: false,
      exercise: false,
      goodDeed: false
    });
  }, [selectedDate]);

  const handleHabitChange = (key: string) => {
    const updated = { ...habits, [key]: !habits[key as keyof typeof habits] };
    setHabits(updated);
    localStorage.setItem(`superme_habits_${selectedDate}`, JSON.stringify(updated));
    playClick(); // 点击水滴声
  };

  // 职业路径数据持久化
  const [careerPath, setCareerPath] = useState(() => readCareerPath());
  const [currentTheme, setCurrentTheme] = useState(() => readCurrentTheme());

  useEffect(() => {
    const syncCareer = () => setCareerPath(readCareerPath());
    window.addEventListener(CAREER_CHANGED_EVENT, syncCareer);
    window.addEventListener('storage', syncCareer);
    return () => {
      window.removeEventListener(CAREER_CHANGED_EVENT, syncCareer);
      window.removeEventListener('storage', syncCareer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchUserTheme()
      .then((theme) => {
        if (!cancelled && theme) setCurrentTheme(theme);
      })
      .catch(() => {});
    const onThemeChange = (event: Event) => {
      const next = String((event as CustomEvent<{ theme?: string }>).detail?.theme || readCurrentTheme()).trim();
      if (next) setCurrentTheme(next);
    };
    window.addEventListener(THEME_CHANGED_EVENT, onThemeChange);
    return () => {
      cancelled = true;
      window.removeEventListener(THEME_CHANGED_EVENT, onThemeChange);
    };
  }, []);

  // 职业生涯编辑相关状态
  const [isEditingCareer, setIsEditingCareer] = useState(false);
  const [careerEditData, setCareerEditData] = useState({ ...careerPath });
  const [showConfetti, setShowConfetti] = useState(false);
  const [isUtilitiesOpen, setIsUtilitiesOpen] = useState(false);
  const [isVaultOpen, setIsVaultOpen] = useState(false);

  const calendarDays = useMemo(
    () => getDaysInMonth(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  const habitsCache = useMemo(() => {
    const cache: Record<string, number> = {};
    for (const slot of calendarDays) {
      const dateStr = getDateStr(viewYear, viewMonth, slot.day, slot.monthOffset);
      cache[dateStr] = readHabitsCount(dateStr);
    }
    cache[selectedDate] = Object.values(habits).filter(Boolean).length;
    return cache;
  }, [calendarDays, viewYear, viewMonth, selectedDate, habits]);

  const handlePrevMonth = () => {
    playPageTurn();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = () => {
    playPageTurn();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  return (
    <aside className={`motion-layer bg-gradient-to-br ${bgEnabled ? 'from-white/70 to-zinc-50/30' : 'from-white to-zinc-50/50'} backdrop-blur-md text-zinc-900 flex flex-col transition-[width,transform,opacity,box-shadow] duration-300 ease-out relative flex-shrink-0 z-30 shadow-[0_8px_30px_rgba(0,0,0,0.04)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.06)] border-r border-zinc-200/60 transform-gpu will-change-[width] ${isOpen ? 'w-[21rem] xl:w-[22rem] 2xl:w-[24rem] visible' : 'w-0 invisible pointer-events-none'}`}>
      <button 
        type="button"
        onClick={() => {
          playReveal();
          toggleSidebar();
        }} 
        className="absolute -right-5 top-12 bg-white text-gray-500 p-2 rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.1)] hover:text-[#FF5722] hover:shadow-[0_4px_12px_rgba(0,0,0,0.15)] z-40 transition-all duration-300 pointer-events-auto cursor-pointer focus:outline-none"
        aria-label={isOpen ? '收起侧边栏' : '展开侧边栏'}
      >
        {isOpen ? <ChevronLeft className="w-5 h-5" strokeWidth={2} /> : <ChevronRight className="w-5 h-5" strokeWidth={2} />}
      </button>

      <div className="w-full h-full flex flex-col overflow-hidden">
        <div className={`flex-1 flex flex-col overflow-y-auto overflow-x-hidden ${isOpen ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300 delay-100 scrollbar-thin`}>
        
        {/* 1. 左上角：极简拼合标题与文本归档链 */}
        <div className="px-8 pt-10 pb-8 border-b border-zinc-200/60 bg-white/60">
          <div className="flex justify-between items-baseline mb-6">
            <h1 className="text-3xl font-black text-[#FF5722] tracking-tighter">B·AI</h1>
          </div>
          
          {/* 单行：今日日期 + 当前主题（只读户口本） */}
          <div className="mb-8">
            <div className="text-zinc-900 font-black text-sm tracking-tight leading-relaxed">
              <span className="text-[#FF5722] mr-2">{selectedDate}</span>
              {currentTheme ? `当前主题：${currentTheme}` : '当前主题'}
            </div>
          </div>
          
          {/* 下方：按周/月折叠归档体系 */}
          <div className="flex flex-col space-y-5">
             
             {/* 月度日历 (Monthly Calendar) */}
             <div>
               <div 
                 className="flex justify-between items-center cursor-pointer text-[11px] text-[var(--color-ink-muted)] font-bold hover:text-[var(--color-brand)] transition-colors mb-3 active:scale-95 select-none"
                 onClick={() => { setIsCalendarOpen(!isCalendarOpen); playReveal(); }}
               >
                 <span>Monthly Calendar</span>
                 {isCalendarOpen ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" strokeWidth={2.5}/> : <ChevronDown className="w-3.5 h-3.5 text-gray-300" strokeWidth={2.5}/>}
               </div>
               
               <div className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${isCalendarOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none'}`}>
                 <div className="overflow-hidden">
                   <div className="haptic-card p-3.5">
                     {/* 顶部年月切换 */}
                     <div className="flex justify-between items-center mb-3">
                       <button onClick={handlePrevMonth} className="p-1 hover:bg-slate-100 rounded-full transition-all cursor-pointer">
                         <ChevronLeft className="w-4 h-4 text-slate-500 hover:text-slate-800" strokeWidth={2.5} />
                       </button>
                       <span className="text-xs font-bold text-[var(--color-ink-primary)] font-mono tabular-nums">
                         {viewYear}.{String(viewMonth + 1).padStart(2, '0')}
                       </span>
                       <button onClick={handleNextMonth} className="p-1 hover:bg-slate-100 rounded-full transition-all cursor-pointer">
                         <ChevronRight className="w-4 h-4 text-slate-500 hover:text-slate-800" strokeWidth={2.5} />
                       </button>
                     </div>

                     {/* 星期表头 */}
                     <div className="grid grid-cols-7 gap-1 mb-2 text-[9px] font-bold text-[var(--color-ink-muted)] text-center">
                       <span>一</span>
                       <span>二</span>
                       <span>三</span>
                       <span>四</span>
                       <span>五</span>
                       <span>六</span>
                       <span>日</span>
                     </div>

                     {/* 日历网格 */}
                     <div className="grid grid-cols-7 gap-y-2.5 gap-x-1 text-center">
                       {calendarDays.map((slot, index) => {
                         const dateStr = getDateStr(viewYear, viewMonth, slot.day, slot.monthOffset);
                         const isSelected = selectedDate === dateStr;
                         const isToday = today === dateStr;
                         const habitsCount = habitsCache[dateStr] ?? 0;
                         
                         return (
                           <div 
                             key={`${index}-${slot.day}`} 
                             onClick={() => {
                               playClick();
                               onDateSelect(dateStr);
                             }}
                             className="relative cursor-pointer select-none flex flex-col items-center justify-center group"
                           >
                             <span 
                               className={`w-6 h-6 flex items-center justify-center text-[10px] font-bold transition-all duration-200 rounded-full ${
                                 isSelected ? 'bg-[#FF5722] text-white shadow-sm font-black' : isToday ? 'border border-zinc-300 text-[#FF5722] font-black bg-white shadow-[0_1px_4px_rgba(0,0,0,0.03)]' : slot.isCurrentMonth 
                                       ? 'text-slate-800 hover:bg-slate-100 hover:ring-1 hover:ring-slate-200 hover:shadow-[0_2px_8px_rgba(0,0,0,0.02)]' 
                                       : 'text-slate-300 hover:bg-slate-50/50 hover:ring-1 hover:ring-slate-100'
                               }`}
                             >
                               {slot.day}
                             </span>
                             <div className="h-1 flex items-center justify-center mt-0.5 w-full">
                               {habitsCount >= 3 ? (
                                 <span className="w-1.5 h-1.5 rounded-full bg-[#FF5722]" />
                               ) : habitsCount > 0 ? (
                                 <span className="w-1 h-1 rounded-full bg-slate-300" />
                               ) : (
                                 <span className="w-1 h-1 rounded-full bg-transparent" />
                               )}
                             </div>
                           </div>
                         );
                       })}
                     </div>
                   </div>
                 </div>
               </div>
             </div>
             
             {/* 习惯矩阵 (Habit Tracker) */}
             <div className="mt-8 border-t border-zinc-200/60 pt-6">
               <div 
                 className="flex justify-between items-center cursor-pointer text-[11px] text-[var(--color-ink-muted)] font-bold hover:text-[var(--color-ink-primary)] transition-colors mb-4 active:scale-95 select-none"
                 onClick={() => { setIsHabitOpen(!isHabitOpen); playReveal(); }}
               >
                 <span>Habit Matrix</span>
                 {isHabitOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
               </div>
               
               <div className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${isHabitOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none'}`}>
                 <div className="overflow-hidden">
                   <div className="grid grid-cols-2 gap-3 py-1">
                      {Object.entries({
                        sleep: '睡眠达标',
                        diet: '饮食克制',
                        exercise: '核心运动',
                        goodDeed: '日行一善'
                      }).map(([key, label]) => (
                        <motion.label 
                          whileHover={{ scale: 1.02, translateY: -2 }}
                          whileTap={{ scale: 0.98 }}
                          transition={GLOBAL_SPRING}
                          key={key} 
                          className={`flex items-center gap-3 p-3 cursor-pointer transition-all duration-300 group haptic-card ${
                            habits[key as keyof typeof habits]
                              ? '!bg-[var(--color-brand-subtle)] !border-[var(--color-brand-light)]'
                              : ''
                          }`}
                        >
                          <input 
                            type="checkbox" 
                            checked={!!habits[key as keyof typeof habits]}
                            onChange={() => handleHabitChange(key)}
                            className="w-4 h-4 text-[#FF5722] border-slate-200 rounded focus:ring-1 focus:ring-[#FF5722] focus:ring-offset-0 cursor-pointer accent-[#FF5722] transition-colors"
                          />
                          <span className="text-[11px] font-semibold text-slate-500 group-hover:text-slate-900 transition-colors">
                            {label}
                          </span>
                        </motion.label>
                      ))}
                   </div>
                 </div>
               </div>
             </div>
             
             {/* 职业发展跟踪表 (Career Progression Tracker) */}
             <div className="mt-6 border-t border-zinc-200/60 pt-6">
               <div 
                 className="flex justify-between items-center cursor-pointer text-[11px] text-[var(--color-ink-muted)] font-bold hover:text-[var(--color-ink-primary)] transition-colors mb-4 active:scale-95 select-none"
                 onClick={() => { setIsCareerOpen(!isCareerOpen); playReveal(); }}
               >
                 <span>Career Progression</span>
                 <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                   {!isEditingCareer && (
                     <button 
                       onClick={() => {
                         playClick();
                         setCareerEditData({ ...careerPath });
                         setIsEditingCareer(true);
                       }}
                       className="p-1 hover:bg-slate-100 rounded-md transition-colors text-slate-400 hover:text-slate-700 cursor-pointer"
                       title="编辑职业轨迹"
                     >
                       <Edit3 className="w-3.5 h-3.5" />
                     </button>
                   )}
                   {isCareerOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                 </div>
               </div>
               
               <div className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${isCareerOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none'}`}>
                 <div className="overflow-hidden">
                   <div className="p-4 haptic-card my-1 relative overflow-hidden">
                     <AnimatePresence mode="wait">
                       {!isEditingCareer ? (
                         <motion.div
                           key="view"
                           initial={{ opacity: 0, y: 5 }}
                           animate={{ opacity: 1, y: 0 }}
                           exit={{ opacity: 0, y: -5 }}
                           transition={{ duration: 0.2 }}
                           className="space-y-3"
                         >
                           <div>
                             <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block mb-0.5">起点职位 (History)</span>
                             <span className="text-xs font-semibold text-slate-600">{careerPath.history}</span>
                           </div>
                           <div className="border-l-2 border-dashed border-slate-200 pl-3 my-1">
                             <span className="text-[9px] text-emerald-600 font-semibold uppercase tracking-widest block mb-0.5">当前定位 (Current)</span>
                             <span className="text-xs font-extrabold text-slate-800">{careerPath.current}</span>
                           </div>
                           <div>
                             <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block mb-0.5">意向目标 (Target)</span>
                             <span className="text-xs font-bold text-[#FF5722]">{careerPath.target}</span>
                           </div>
                           
                           <div className="mt-4 pt-2">
                             <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                               <span>能力匹配度</span>
                               <span className="font-mono tabular-nums font-extrabold text-slate-700">{careerPath.progress}%</span>
                             </div>
                             <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                               <div className="bg-gradient-to-r from-zinc-400 to-[#FF5722] h-1.5 transition-all duration-500" style={{ width: `${careerPath.progress}%` }}></div>
                             </div>
                           </div>
                         </motion.div>
                       ) : (
                         <motion.div
                           key="edit"
                           initial={{ opacity: 0, y: 5 }}
                           animate={{ opacity: 1, y: 0 }}
                           exit={{ opacity: 0, y: -5 }}
                           transition={{ duration: 0.2 }}
                           className="space-y-3"
                         >
                           <div className="space-y-2.5">
                             <div>
                               <label className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block mb-1">起点职位 (History)</label>
                               <input 
                                 type="text" 
                                 value={careerEditData.history}
                                 onChange={(e) => setCareerEditData({ ...careerEditData, history: e.target.value })}
                                 className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#FF5722] bg-white font-medium"
                               />
                             </div>
                             <div>
                               <label className="text-[9px] text-emerald-600 font-semibold uppercase tracking-widest block mb-1">当前定位 (Current)</label>
                               <input 
                                 type="text" 
                                 value={careerEditData.current}
                                 onChange={(e) => setCareerEditData({ ...careerEditData, current: e.target.value })}
                                 className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#FF5722] bg-white font-medium"
                               />
                             </div>
                             <div>
                               <label className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block mb-1">意向目标 (Target)</label>
                               <input 
                                 type="text" 
                                 value={careerEditData.target}
                                 onChange={(e) => setCareerEditData({ ...careerEditData, target: e.target.value })}
                                 className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#FF5722] bg-white font-medium"
                               />
                             </div>
                             <div>
                               <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">
                                 <span>能力匹配度</span>
                                 <span className="font-mono tabular-nums font-extrabold text-[#FF5722]">{careerEditData.progress}%</span>
                               </div>
                               <input 
                                 type="range" 
                                 min="0" 
                                 max="100" 
                                 value={careerEditData.progress}
                                 onChange={(e) => {
                                   const val = Number(e.target.value);
                                   if (val !== careerEditData.progress) {
                                     setCareerEditData({ ...careerEditData, progress: val });
                                     playDrag(); // 拖动滑块
                                   }
                                 }}
                                 className="w-full h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-[#FF5722]"
                               />
                             </div>
                           </div>

                           <div className="flex gap-2 pt-2">
                             <button 
                               onClick={() => {
                                 playPageTurn();
                                 setIsEditingCareer(false);
                               }}
                               className="flex-1 py-1.5 text-[10px] font-bold text-slate-400 hover:text-slate-600 border border-slate-200 hover:border-slate-300 rounded-lg transition-colors cursor-pointer"
                             >
                               取消
                             </button>
                             <button 
                               onClick={() => {
                                 playPageTurn();
                                 const next = saveCareerPathForAccount(careerEditData);
                                 setCareerPath(next);
                                 setIsEditingCareer(false);
                                 if (next.progress === 100) {
                                   setShowConfetti(true);
                                 }
                               }}
                               className="flex-1 py-1.5 text-[10px] font-bold text-white bg-[#FF5722] hover:bg-[#E04F1E] rounded-lg transition-colors cursor-pointer shadow-sm"
                             >
                               保存并推演
                             </button>
                           </div>
                         </motion.div>
                       )}
                     </AnimatePresence>
                   </div>
                 </div>
               </div>
             </div>

          </div>
        </div>

        {shouldShowCard && (
          <BiweeklyReviewCard
            daysSinceReview={daysSinceReview}
            onOpen={() => {
              playClick();
              window.dispatchEvent(new Event('open-biweekly-review'));
            }}
          />
        )}

        {/* 2. 即时答疑模块 (多模型舱) — 固定最大高度，避免撑满侧边栏 */}
        <div className="px-5 xl:px-6 py-6 flex flex-col shrink-0">
          <div className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest mb-2 flex items-center">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-2"></div> 答疑
          </div>
          <ChatModule />
        </div>

        {/* Utility Tools Toggle */}
        <div className="mt-auto px-5 xl:px-6 py-4 border-t border-slate-100 bg-white/50 backdrop-blur-sm shrink-0">
          <button 
            onClick={() => {
              playReveal();
              setIsUtilitiesOpen(!isUtilitiesOpen);
            }}
            className="w-full flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-[var(--color-brand)] transition-colors cursor-pointer outline-none select-none"
          >
            <span>Utility Tools</span>
            {isUtilitiesOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          
          {/* Allow full dict results: GPU smooth accordion */}
          <div className={`grid transition-[grid-template-rows,opacity,margin-top] duration-300 ease-out ${isUtilitiesOpen ? 'grid-rows-[1fr] mt-4 opacity-100' : 'grid-rows-[0fr] mt-0 opacity-0 pointer-events-none'}`}>
            <div className="overflow-hidden max-h-[min(85vh,2400px)] overflow-y-auto">
              <div className="space-y-4 pb-2">
                {/* 3. 工具区聚合 (现代汉语/英英/英汉) */}
                <DictionaryPanel />

                {/* 4. 艾宾浩斯生词本 */}
                <VocabularyBook />

                {/* 5. 每周一聊 (WeeklyChatModule) */}
                {setActiveModule && (
                  <button
                    onClick={() => {
                      if (isLocked) {
                        if (onLockTrigger) onLockTrigger();
                      } else {
                        playClick();
                        setActiveModule('weekly');
                      }
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border border-dashed transition-all cursor-pointer outline-none ${
                      activeModule === 'weekly'
                        ? 'bg-slate-50 border-[var(--color-brand)] text-[var(--color-brand)] font-bold shadow-sm'
                        : 'bg-transparent border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5" />
                      <span className="text-[11px] font-bold tracking-widest">每周一聊</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                  </button>
                )}
                {/* 6. 资料抽屉 */}
                <button
                  type="button"
                  onClick={() => {
                    playClick();
                    setIsVaultOpen(true);
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-dashed border-zinc-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-all cursor-pointer outline-none"
                >
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-3.5 h-3.5 text-[#FF5722]" />
                    <span className="text-[11px] font-bold tracking-widest">资料抽屉</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                </button>
              </div>
            </div>
          </div>
        </div>

        </div>
      </div>
      <KnowledgeVaultDrawer isOpen={isVaultOpen} onClose={() => setIsVaultOpen(false)} />
      {showConfetti && (
        <Confetti duration={3000} onComplete={() => setShowConfetti(false)} />
      )}
    </aside>
  );
}

const Sidebar = memo(SidebarComponent);
export default Sidebar;
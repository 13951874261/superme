import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, MessageSquare, Search, BookOpen, Calendar, CheckCircle2, RefreshCw, Languages, Type, BookA, BrainCircuit, ChevronUp, ChevronDown } from 'lucide-react';
import ChatModule from './ChatModule';
import DictionaryPanel from './DictionaryPanel';
import VocabularyBook from './VocabularyBook';
import { formatDateShort, getRecentDates, getTodayDateDot } from '../utils/date';
import { playClick, playPageTurn } from '../utils/soundEffects';

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
  selectedDate: string;
  onDateSelect: (date: string) => void;
}

export default function Sidebar({ isOpen, toggleSidebar, selectedDate, onDateSelect }: SidebarProps) {
  // 按照您的要求，按月/周分类的归档体系需要折叠交互状态
  const [isAprilWeek2Open, setIsAprilWeek2Open] = useState(true);
  const [isAprilWeek1Open, setIsAprilWeek1Open] = useState(false);
  const recentDates = getRecentDates(5);
  const today = getTodayDateDot();

  // 习惯与职业追踪器状态管理
  const [isHabitOpen, setIsHabitOpen] = useState(true);
  const [isCareerOpen, setIsCareerOpen] = useState(true);

  // 习惯持久化状态
  const [habits, setHabits] = useState(() => {
    const saved = localStorage.getItem('superme_habits');
    return saved ? JSON.parse(saved) : {
      sleep: false,
      diet: false,
      exercise: false,
      goodDeed: false
    };
  });

  const handleHabitChange = (key: string) => {
    const updated = { ...habits, [key]: !habits[key as keyof typeof habits] };
    setHabits(updated);
    localStorage.setItem('superme_habits', JSON.stringify(updated));
    playClick(); // 点击水滴声
  };

  // 职业路径数据持久化
  const [careerPath, setCareerPath] = useState(() => {
    const saved = localStorage.getItem('superme_career');
    return saved ? JSON.parse(saved) : {
      history: '高级经理 (Senior Manager)',
      current: '总监 (Director)',
      target: '合伙人 (Partner / Managing Director)',
      progress: 65
    };
  });

  return (
    <aside className={`bg-[#f8f9fa] text-[#202124] flex flex-col transition-all duration-500 ease-in-out relative flex-shrink-0 z-30 shadow-[4px_0_24px_rgba(0,0,0,0.02)] border-r border-gray-100/50 overflow-hidden ${isOpen ? 'w-[21rem] xl:w-[22rem] 2xl:w-[24rem]' : 'w-0'}`}>
      <button 
        onClick={toggleSidebar} 
        className="absolute -right-5 top-12 bg-white text-gray-500 p-2 rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.1)] hover:text-[#FF5722] hover:shadow-[0_4px_12px_rgba(0,0,0,0.15)] z-40 transition-all duration-300"
      >
        {isOpen ? <ChevronLeft className="w-5 h-5" strokeWidth={2} /> : <ChevronRight className="w-5 h-5" strokeWidth={2} />}
      </button>

      <div className={`flex-1 flex flex-col overflow-y-auto overflow-x-hidden ${isOpen ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300 delay-100 scrollbar-thin`}>
        
        {/* 1. 左上角：绝对契合指令：极简拼合标题与文本归档链 */}
        <div className="px-8 pt-10 pb-8 border-b border-gray-200/60 bg-white">
          <div className="flex justify-between items-baseline mb-6">
            <h1 className="text-3xl font-black text-[#FF5722] tracking-tighter">B·AI</h1>
          </div>
          
          {/* 单行或凝练呈现：今日日期 + 本周主题 */}
          <div className="mb-8">
            <div className="text-[#202124] font-black text-sm tracking-tight leading-relaxed">
              <span className="text-[#FF5722] mr-2">{selectedDate}</span> 
              本周主题：海外信贷谈判与博弈
            </div>
          </div>
          
          {/* 下方：按周/月折叠归档体系 */}
          <div className="flex flex-col space-y-5">
             
             {/* 分区归档：最近 3 天 */}
             <div>
               <div 
                 className="flex justify-between items-center cursor-pointer text-[10px] text-gray-500 font-bold uppercase tracking-widest hover:text-[#FF5722] transition-colors mb-2.5"
                 onClick={() => setIsAprilWeek2Open(!isAprilWeek2Open)}
               >
                 <span>RECENT - LAST 3 DAYS</span>
                 {isAprilWeek2Open ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" strokeWidth={2.5}/> : <ChevronDown className="w-3.5 h-3.5 text-gray-300" strokeWidth={2.5}/>}
               </div>
               
               <div className={`overflow-hidden transition-all duration-500 ${isAprilWeek2Open ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
                 <div className="text-xs font-black tracking-widest text-[#202124] flex items-center py-1 flex-wrap">
                  {recentDates.slice(0, 3).map((date, idx) => (
                    <React.Fragment key={date}>
                      <span
                        className={`cursor-pointer transition-all duration-300 px-1.5 py-0.5 rounded inline-flex items-center gap-1 ${selectedDate === date ? 'bg-[#FF5722]/10 text-[#FF5722] scale-105' : 'text-gray-400 hover:text-gray-700'}`}
                        onClick={() => onDateSelect(date)}
                      >
                        <span>{formatDateShort(new Date(date.replace(/\./g, '-')))}</span>
                        {date === today ? (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#FF5722]" title="今日" />
                        ) : (
                          <CheckCircle2 className="w-3 h-3 text-[#FF5722]/60" strokeWidth={2.5} />
                        )}
                      </span>
                      {idx < 2 && <span className="text-gray-200 font-light mx-2">|</span>}
                    </React.Fragment>
                  ))}

                 </div>
               </div>
             </div>

             {/* 分区归档：更早 2 天 */}
             <div>
               <div 
                 className="flex justify-between items-center cursor-pointer text-[10px] text-gray-400 font-bold uppercase tracking-widest hover:text-gray-600 transition-colors mb-2.5"
                 onClick={() => setIsAprilWeek1Open(!isAprilWeek1Open)}
               >
                 <span>RECENT - EARLIER 2 DAYS</span>
                 {isAprilWeek1Open ? <ChevronUp className="w-3.5 h-3.5 text-gray-300" strokeWidth={2.5}/> : <ChevronDown className="w-3.5 h-3.5 text-gray-300" strokeWidth={2.5}/>}
               </div>
               
               <div className={`overflow-hidden transition-all duration-500 ${isAprilWeek1Open ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
                 <div className="text-xs font-black tracking-widest text-[#202124] flex items-center py-1 flex-wrap">
                   {recentDates.slice(3, 5).map((date, idx) => (
                     <React.Fragment key={date}>
                        <span
                          className={`cursor-pointer transition-all duration-300 px-1.5 py-0.5 rounded inline-flex items-center gap-1 ${selectedDate === date ? 'bg-[#FF5722]/10 text-[#FF5722] scale-105' : 'text-gray-400 hover:text-gray-700'}`}
                          onClick={() => onDateSelect(date)}
                        >
                          <span>{formatDateShort(new Date(date.replace(/\./g, '-')))}</span>
                          <CheckCircle2 className="w-3 h-3 text-gray-300" strokeWidth={2.5} />
                        </span>
                       {idx < 1 && <span className="text-gray-200 font-light mx-2">|</span>}
                     </React.Fragment>
                   ))}
                 </div>
               </div>
             </div>
             
             {/* 习惯矩阵 (Habit Tracker) */}
             <div className="mt-8 border-t border-gray-100 pt-6">
               <div 
                 className="flex justify-between items-center cursor-pointer text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-4 hover:text-gray-700 transition-colors"
                 onClick={() => { setIsHabitOpen(!isHabitOpen); playPageTurn(); }}
               >
                 <span>Habit Matrix</span>
                 {isHabitOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
               </div>
               
               <div className={`overflow-hidden transition-all duration-500 ${isHabitOpen ? 'max-h-60 opacity-100' : 'max-h-0 opacity-0'}`}>
                 <div className="grid grid-cols-2 gap-3 py-1">
                   {Object.entries({
                     sleep: '睡眠达标',
                     diet: '饮食克制',
                     exercise: '核心运动',
                     goodDeed: '日行一善'
                   }).map(([key, label]) => (
                     <label key={key} className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl cursor-pointer hover:border-[#FF5722] hover:shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition-all group">
                       <input 
                         type="checkbox" 
                         checked={habits[key as keyof typeof habits]}
                         onChange={() => handleHabitChange(key)}
                         className="w-4 h-4 text-[#FF5722] border-gray-300 rounded focus:ring-[#FF5722] cursor-pointer"
                       />
                       <span className="text-xs font-bold text-gray-600 group-hover:text-[#202124]">{label}</span>
                     </label>
                   ))}
                 </div>
               </div>
             </div>

             {/* 职业发展跟踪表 (Career Progression Tracker) */}
             <div className="mt-6 border-t border-gray-100 pt-6">
               <div 
                 className="flex justify-between items-center cursor-pointer text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-4 hover:text-gray-700 transition-colors"
                 onClick={() => { setIsCareerOpen(!isCareerOpen); playPageTurn(); }}
               >
                 <span>Career Progression</span>
                 {isCareerOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
               </div>
               
               <div className={`overflow-hidden transition-all duration-500 ${isCareerOpen ? 'max-h-[300px] opacity-100' : 'max-h-0 opacity-0'}`}>
                 <div className="p-4 bg-white border border-gray-100 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.02)] my-1">
                   <div className="space-y-3">
                     <div>
                       <span className="text-[10px] text-gray-400 block">起点职位 (History)</span>
                       <span className="text-xs font-bold text-gray-500">{careerPath.history}</span>
                     </div>
                     <div className="border-l-2 border-dashed border-gray-200 pl-3 my-1">
                       <span className="text-[10px] text-emerald-600 font-semibold block">当前定位 (Current)</span>
                       <span className="text-xs font-extrabold text-gray-800">{careerPath.current}</span>
                     </div>
                     <div>
                       <span className="text-[10px] text-gray-400 block">意向目标 (Target)</span>
                       <span className="text-xs font-bold text-[#FF5722]">{careerPath.target}</span>
                     </div>
                     
                     <div className="mt-4 pt-2">
                       <div className="flex justify-between text-[10px] font-bold text-gray-400 mb-1">
                         <span>能力匹配度</span>
                         <span>{careerPath.progress}%</span>
                       </div>
                       <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                         <div className="bg-gradient-to-r from-emerald-500 to-[#FF5722] h-1.5 transition-all duration-500" style={{ width: `${careerPath.progress}%` }}></div>
                       </div>
                     </div>
                   </div>
                 </div>
               </div>
             </div>

          </div>
        </div>

        {/* 2. 即时答疑模块 (多模型舱) — 固定最大高度，避免撑满侧边栏 */}
        <div className="px-5 xl:px-6 py-6 flex flex-col shrink-0">
          <div className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest mb-2 flex items-center">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-2"></div> E2E Encrypted
          </div>
          <ChatModule />
        </div>

        {/* 3. 工具区聚合 (现代汉语/英英/英汉) */}
        <DictionaryPanel />

        {/* 4. 艾宾浩斯生词本 */}
        <VocabularyBook />

      </div>
    </aside>
  );
}
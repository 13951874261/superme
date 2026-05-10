import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import MainContent from './components/MainContent';
import TextHighlighter from './components/TextHighlighter';
import { getTodayDateDot } from './utils/date';

// 定义八大核心模块的类型
export type ModuleType = 'listen' | 'speak' | 'read' | 'write' | 'english' | 'entertainment' | 'gametheory' | 'weekly';

export default function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedDate, setSelectedDate] = useState(getTodayDateDot()); 
  
  // 【新增】当前专注的训练模块，默认聚焦您的核心诉求：英语
  const [activeModule, setActiveModule] = useState<ModuleType>('english');

  return (
    <div className="bg-[#F8F9FA] text-gray-900 h-screen overflow-hidden flex font-sans selection:bg-[#FF5722]/20 selection:text-[#FF5722]">
      <TextHighlighter />
      <Sidebar 
        isOpen={isSidebarOpen} 
        toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} 
        selectedDate={selectedDate}
        onDateSelect={setSelectedDate}
      />
      <MainContent 
        selectedDate={selectedDate} 
        activeModule={activeModule}
        setActiveModule={setActiveModule}
      />
    </div>
  );
}

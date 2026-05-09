import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import MainContent from './components/MainContent';
import { getTodayDateDot } from './utils/date';

export default function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  // 【全局心脏】：主控全局阅读页面的日期状态
  const [selectedDate, setSelectedDate] = useState(getTodayDateDot()); 

  return (
    <div className="bg-white text-gray-900 h-screen overflow-hidden flex font-sans selection:bg-brand-light selection:text-brand-hover">
      <Sidebar 
        isOpen={isSidebarOpen} 
        toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} 
        selectedDate={selectedDate}
        onDateSelect={setSelectedDate}
      />
      <MainContent selectedDate={selectedDate} />
    </div>
  );
}

import React, { useState, memo } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface CollapsiblePanelProps {
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function CollapsiblePanelComponent({ title, icon, defaultOpen = false, children }: CollapsiblePanelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="bg-white text-gray-900 border border-gray-100 rounded-[2rem] shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] overflow-hidden mb-8 transition-shadow duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transform-gpu will-change-[box-shadow]">
      <button 
        type="button"
        className="w-full px-8 py-6 flex justify-between items-center cursor-pointer bg-white hover:bg-gray-50 transition-colors text-left select-none focus:outline-none"
        onClick={() => setIsOpen(prev => !prev)}
        aria-expanded={isOpen}
      >
        <div className="flex items-center space-x-4">
          {icon && <div className="text-[#FF5722] p-2 bg-[#FF5722]/10 rounded-2xl">{icon}</div>}
          <h2 className="text-2xl font-black tracking-tight text-[#202124]">{title}</h2>
        </div>
        <div className={`text-gray-400 p-2 rounded-full transition-all duration-300 ${isOpen ? 'bg-gray-100' : ''}`}>
          {isOpen ? <ChevronUp className="w-6 h-6 text-[#FF5722]" /> : <ChevronDown className="w-6 h-6" />}
        </div>
      </button>
      
      {/* 使用 CSS Grid 行高过渡代替 max-height 5000px，杜绝全屏布局抖动与重排 */}
      <div 
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none'}`}
      >
        <div className="overflow-hidden">
          <div className="p-8 pt-2 border-t border-gray-50">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

const CollapsiblePanel = memo(CollapsiblePanelComponent);
export default CollapsiblePanel;


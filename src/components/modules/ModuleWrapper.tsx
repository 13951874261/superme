import React from 'react';

interface ModuleWrapperProps {
  id?: string;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  isOpen?: boolean;
  description?: string;
  badge?: React.ReactNode;
}

export default function ModuleWrapper({ id, title, icon, children, isOpen = true, description, badge }: ModuleWrapperProps) {
  // 分割标题为大副标题
  const [main, sub] = title.split('｜').map(s => s.trim());

  return (
    <section id={id} className="w-full flex flex-col mb-16">
      <div className="flex items-center space-x-6 mb-10 p-6 md:p-8 rounded-3xl bg-gradient-to-r from-gray-50/70 to-white/30 backdrop-blur-[4px] border border-gray-100/50 shadow-[0_4px_20px_rgba(0,0,0,0.01)] relative overflow-hidden">
        {/* 背景微装饰 */}
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-gradient-to-br from-[#FF5722]/5 to-transparent rounded-full blur-2xl pointer-events-none" />
        
        <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center text-[#FF5722] shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-gray-100 flex-shrink-0 relative z-10">
          {icon}
        </div>
        
        <div className="flex flex-col flex-1 relative z-10">
           <div className="flex flex-wrap items-center gap-4">
             <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-[#202124] tracking-tight">{main}</h2>
             {badge}
           </div>
           
           {sub && (
             <span className="inline-block self-start mt-3 px-3.5 py-1 text-xs md:text-sm font-extrabold tracking-wide uppercase text-[#FF5722] bg-[#FF5722]/5 border border-[#FF5722]/10 rounded-xl">
               {sub}
             </span>
           )}
           
           {description && (
             <div className="mt-4 border-l-2 border-[#FF5722]/30 pl-4 py-0.5">
               <p className="text-xs md:text-sm text-gray-500 font-medium leading-relaxed tracking-wide">{description}</p>
             </div>
           )}
        </div>
      </div>
      
      {isOpen && (
        <div className="w-full">
          {children}
        </div>
      )}
    </section>
  );
}

import React from 'react';

interface ModuleWrapperProps {
  id?: string;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  isOpen?: boolean;
  description?: string;
  badge?: React.ReactNode;
  compact?: boolean;
}

export default function ModuleWrapper({ 
  id, 
  title, 
  icon, 
  children, 
  isOpen = true, 
  description, 
  badge,
  compact = true
}: ModuleWrapperProps) {
  // 分割标题为大副标题
  const [main, sub] = title.split('｜').map(s => s.trim());

  return (
    <section id={id} className={`w-full flex flex-col ${compact ? 'mb-6' : 'mb-10'}`}>
      <div className="flex items-center space-x-4 mb-4 p-4 md:p-5 rounded-2xl bg-white border border-slate-100/80 shadow-[0_4px_20px_rgba(0,0,0,0.015)] relative overflow-hidden">
        {/* 背景微装饰 */}
        <div className={`absolute -right-10 -top-10 ${compact ? 'w-28 h-28' : 'w-40 h-40'} bg-gradient-to-br from-[#FF5722]/5 to-transparent rounded-full blur-2xl pointer-events-none`} />
        
        <div className={`
          rounded-full bg-white flex items-center justify-center text-[#FF5722] shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-gray-100 flex-shrink-0 relative z-10
          ${compact ? 'w-12 h-12 [&_svg]:!w-6 [&_svg]:!h-6' : 'w-16 h-16 [&_svg]:!w-8 [&_svg]:!h-8'}
        `}>
          {icon}
        </div>
        
        <div className="flex flex-col flex-1 relative z-10">
           <div className="flex flex-wrap items-center justify-between gap-4 w-full">
             <h2 className={`
               font-black text-[#202124] tracking-tight 
               ${compact ? 'text-xl md:text-2xl lg:text-3xl' : 'text-3xl md:text-4xl lg:text-5xl'}
             `}>
               {main}
             </h2>
             {badge}
           </div>
           
           {sub && (
             <span className={`
               inline-block self-start 
               ${compact ? 'mt-1.5' : 'mt-3'} 
               px-3.5 py-1 text-xs md:text-sm font-extrabold tracking-wide uppercase text-[#FF5722] bg-[#FF5722]/5 border border-[#FF5722]/10 rounded-xl
             `}>
               {sub}
             </span>
           )}
           
           {description && (
             <div className="mt-2.5 bg-[#FF5722]/[0.02] border border-[#FF5722]/10 rounded-2xl px-4 py-2">
               <p className="text-xs text-gray-650 font-bold leading-relaxed tracking-wide">{description}</p>
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

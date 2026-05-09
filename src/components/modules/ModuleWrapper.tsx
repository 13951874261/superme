import React from 'react';

interface ModuleWrapperProps {
  id?: string;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  isOpen?: boolean;
  description?: string;
}

export default function ModuleWrapper({ id, title, icon, children, isOpen = true, description }: ModuleWrapperProps) {
  // 分割标题为大副标题
  const [main, sub] = title.split('｜').map(s => s.trim());

  return (
    <section id={id} className="w-full flex flex-col mb-16">
      <div className="flex items-start space-x-5 mb-10">
        <div className="w-16 h-16 rounded-full bg-[#f8f9fa] flex items-center justify-center text-[#FF5722] shadow-[0_2px_4px_rgba(60,64,67,0.1)] flex-shrink-0 mt-2">
          {icon}
        </div>
        <div className="flex flex-col flex-1">
           <h2 className="text-4xl md:text-5xl font-black text-[#202124] tracking-tight">{main}</h2>
           {sub && <p className="text-xl text-[#202124] font-bold mt-2 tracking-wide block">{sub}</p>}
           
           {description && (
             <div className="mt-5 border-l-2 border-[#FF5722]/30 pl-4 py-1">
               <p className="text-sm text-gray-500 font-medium leading-relaxed tracking-wide">{description}</p>
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

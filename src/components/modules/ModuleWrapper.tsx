import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface ModuleWrapperProps {
  id?: string;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  isOpen?: boolean;
  onToggleCollapse?: () => void;
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
  onToggleCollapse,
  description, 
  badge,
  compact = true
}: ModuleWrapperProps) {
  // 分割标题为大副标题
  const [main, sub] = title.split('｜').map(s => s.trim());

  return (
    <section id={id} className={`w-full flex flex-col ${compact ? 'mb-4' : 'mb-10'}`}>
      {/* 单行工具台标题：占满横向宽度，避免右侧大片空白 */}
      <div className={`flex items-center gap-2.5 px-0.5 ${compact ? 'mb-2.5' : 'mb-4'}`}>
        <div className={`${compact ? 'w-8 h-8' : 'w-10 h-10'} rounded-lg bg-[var(--color-brand-subtle)] flex items-center justify-center text-[var(--color-brand)] shrink-0 [&>svg]:w-5 [&>svg]:h-5`}>
          {icon}
        </div>

        <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <h2 className={`font-display font-black text-[var(--color-ink-primary)] tracking-tight leading-none ${compact ? 'text-xl' : 'text-2xl'}`}>
              {main}
            </h2>
            {badge}
            {isOpen && sub && (
              <span className="text-[11px] font-bold tracking-wide text-[var(--color-brand)]">
                {sub}
              </span>
            )}
          </div>

          {isOpen && description && (
            <p className="text-[12px] text-[var(--color-ink-secondary)] leading-snug sm:truncate sm:flex-1 min-w-0">
              {description}
            </p>
          )}
        </div>

        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-expanded={isOpen}
            aria-label={isOpen ? '折叠模块' : '展开模块'}
            className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 shrink-0"
          >
            {isOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </button>
        )}
      </div>
      
      {isOpen && (
        <div className="w-full">
          {children}
        </div>
      )}
    </section>
  );
}

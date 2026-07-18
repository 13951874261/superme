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
    <section id={id} className={`w-full flex flex-col ${compact ? 'mb-8' : 'mb-14'}`}>
      {/* 标题包装：去边框，去阴影，改用纯粹的高级排版排布 */}
      <div className="flex flex-col gap-2 mb-6 px-1">
        <div className="flex items-center gap-3">
          {/* 统一图标容器：浅色微妙底 + 小圆角 + 品牌色 */}
          <div className="w-10 h-10 rounded-xl bg-[var(--color-brand-subtle)] flex items-center justify-center text-[var(--color-brand)]">
            {icon}
          </div>
          <div className="flex items-baseline gap-3 flex-wrap flex-1 min-w-0">
            <h2 className="font-display text-2xl font-black text-[var(--color-ink-primary)] tracking-tight">
              {main}
            </h2>
            {badge}
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

        {isOpen && sub && (
          <span className="text-xs font-bold tracking-wide uppercase text-[var(--color-brand)]">
            {sub}
          </span>
        )}

        {isOpen && description && (
          <div className="mt-1 max-w-[70ch]">
            <p className="text-[13px] text-[var(--color-ink-secondary)] leading-relaxed">
              {description}
            </p>
          </div>
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

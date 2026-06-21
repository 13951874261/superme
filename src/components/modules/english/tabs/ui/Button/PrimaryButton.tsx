import React from 'react';

interface PrimaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
}

export function PrimaryButton({ children, className = '', icon, ...props }: PrimaryButtonProps) {
  return (
    <button
      {...props}
      className={`relative flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest text-white transition-all duration-300 btn-press ${
        props.disabled 
          ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed' 
          : 'bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)] shadow-[0_4px_12px_rgba(232,93,4,0.2)]'
      } ${className}`}
    >
      {icon && <span className="w-4 h-4">{icon}</span>}
      <span>{children}</span>
    </button>
  );
}

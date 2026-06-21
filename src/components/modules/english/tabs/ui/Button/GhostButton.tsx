import React from 'react';

interface GhostButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
}

export function GhostButton({ children, className = '', icon, ...props }: GhostButtonProps) {
  return (
    <button
      {...props}
      className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-200 btn-press ${
        props.disabled
          ? 'opacity-50 cursor-not-allowed'
          : 'bg-transparent text-zinc-500 border border-zinc-200 hover:bg-zinc-50 hover:border-zinc-300 hover:text-zinc-800'
      } ${className}`}
    >
      {icon && <span className="w-4 h-4">{icon}</span>}
      <span>{children}</span>
    </button>
  );
}

import React from 'react';

interface GhostButtonProps {
  children?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  title?: string;
}

export function GhostButton({ children, className = '', icon, disabled = false, onClick, type = 'button', title, ...rest }: GhostButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      title={title}
      className={`relative flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-200 btn-press ripple ${
        disabled
          ? 'opacity-50 cursor-not-allowed'
          : 'bg-transparent text-zinc-500 border border-zinc-200 hover:bg-zinc-50 hover:border-zinc-300 hover:text-zinc-800'
      } ${className}`}
      {...rest}
    >
      {icon && <span className="w-4 h-4">{icon}</span>}
      {children && <span>{children}</span>}
    </button>
  );
}

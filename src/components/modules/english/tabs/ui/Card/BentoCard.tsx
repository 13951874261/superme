import React from 'react';

interface BentoCardProps {
  children?: React.ReactNode;
  className?: string;
}

export function BentoCard({ children, className = '', ...rest }: BentoCardProps) {
  return (
    <div
      className={`bento-card flex flex-col gap-4 ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

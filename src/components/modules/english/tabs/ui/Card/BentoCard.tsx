import React from 'react';

interface BentoCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function BentoCard({ children, className = '', ...props }: BentoCardProps) {
  return (
    <div
      {...props}
      className={`bento-card flex flex-col gap-4 ${className}`}
    >
      {children}
    </div>
  );
}

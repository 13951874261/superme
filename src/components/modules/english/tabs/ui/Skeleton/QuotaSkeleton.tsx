import React from 'react';

export function QuotaSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="w-16 h-3 skeleton rounded"></div>
        <div className="w-8 h-3 skeleton rounded"></div>
      </div>
      <div className="w-full h-2 skeleton rounded-full"></div>
    </div>
  );
}

import React from 'react';

export default function ModuleSkeleton() {
  return (
    <div className="animate-pulse p-6 space-y-4" aria-busy="true">
      <div className="h-6 bg-gray-200 rounded w-1/4" />
      <div className="h-4 bg-gray-100 rounded w-full" />
      <div className="h-4 bg-gray-100 rounded w-5/6" />
      <div className="h-4 bg-gray-100 rounded w-4/6" />
      <div className="h-32 bg-gray-50 rounded w-full mt-6" />
    </div>
  );
}

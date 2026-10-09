import React from 'react';
import type { ToneCorrection } from '../../../utils/toneCorrections';

type Props = {
  items: ToneCorrection[];
  repaired?: boolean;
  className?: string;
};

/** GT-SIM-02：原话 | 问题 | 建议说法 */
export default function ToneCorrectionTable({ items, repaired, className = '' }: Props) {
  if (!items?.length) return null;
  return (
    <div className={`rounded-xl border border-zinc-200 bg-white overflow-hidden ${className}`}>
      <div className="px-3 py-2 border-b border-zinc-100 flex items-center justify-between gap-2">
        <span className="text-[9px] text-zinc-800 font-bold uppercase tracking-wider">语气修正</span>
        {repaired && (
          <span className="text-[9px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
            系统补全
          </span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[11px]">
          <thead>
            <tr className="bg-zinc-50 text-zinc-500">
              <th className="px-3 py-2 font-bold w-[30%]">原话</th>
              <th className="px-3 py-2 font-bold w-[30%]">问题</th>
              <th className="px-3 py-2 font-bold w-[40%]">建议说法</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row, idx) => (
              <tr key={idx} className="border-t border-zinc-100 align-top">
                <td className="px-3 py-2 text-zinc-700 leading-relaxed">{row.original}</td>
                <td className="px-3 py-2 text-zinc-600 leading-relaxed">{row.problem}</td>
                <td className="px-3 py-2 text-zinc-800 font-medium leading-relaxed">{row.suggested}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

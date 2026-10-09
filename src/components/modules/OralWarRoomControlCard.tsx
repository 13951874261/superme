import React from 'react';
import { motion } from 'motion/react';
import { ShieldAlert, Target } from 'lucide-react';

interface Props {
  flawClaim: string;
  flawType: string;
  templates: string[];
  onUseTemplate: (text: string) => void;
  onDismiss: () => void;
}

/** 控制论任务卡片：用户忽略破绽时触发，需完成补救后方可继续 */
export default function OralWarRoomControlCard({
  flawClaim,
  flawType,
  templates,
  onUseTemplate,
  onDismiss,
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      className="mb-3 rounded-2xl border-2 border-red-300 bg-gradient-to-br from-red-50 to-orange-50 shadow-[var(--shadow-card)] overflow-hidden"
      role="alert"
    >
      <div className="px-4 py-3 flex items-start gap-3">
        <div className="bg-red-500 text-white p-2 rounded-xl shrink-0">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-sm font-black text-red-900">控制论补救任务</span>
            {flawType && (
              <span className="px-2 py-0.5 rounded-full bg-red-200 text-red-800 text-[10px] font-bold">
                {flawType}
              </span>
            )}
          </div>
          <p className="text-xs text-red-800/90 leading-relaxed mb-2">
            您还未针对上一轮逻辑漏洞用英语提问。进度已暂时锁定，请选用下方句式完成针对性提问后解锁。
          </p>
          {flawClaim && (
            <p className="text-[10px] text-red-700/80 italic mb-2 border-l-2 border-red-300 pl-2">
              待击破：{flawClaim}
            </p>
          )}
          {templates.length > 0 && (
            <div className="space-y-1.5 mb-3">
              <div className="flex items-center gap-1.5">
                <Target className="w-3 h-3 text-red-600" />
                <span className="text-[9px] font-black uppercase tracking-widest text-red-700">必选反击句式</span>
              </div>
              {templates.slice(0, 2).map((t, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onUseTemplate(t)}
                  className="w-full text-left px-3 py-2 rounded-xl bg-white/80 border border-red-200 text-[10px] font-medium text-red-900 hover:bg-white hover:border-red-400 cursor-pointer transition-colors"
                >
                  {t}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={onDismiss}
            className="text-[9px] font-black uppercase tracking-widest text-red-600/70 hover:text-red-800 cursor-pointer"
          >
            我已选定句式，继续 →
          </button>
        </div>
      </div>
    </motion.div>
  );
}

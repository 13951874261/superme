import React from 'react';
import { motion } from 'motion/react';
import { BookPlus } from 'lucide-react';
import { playPageTurn } from '../../utils/soundEffects';
import { VOCAB_ZONE_COLLECT_BTN, type VocabCategory } from '../../utils/vocabZoneLabels';

interface Props {
  word: string;
  context: string;
  position: { x: number; y: number };
  isAdding: boolean;
  collectingZone?: VocabCategory | null;
  queuedZone?: VocabCategory | null;
  storedCategory?: VocabCategory | null;
  addResult: { ok: boolean; msg: string } | null;
  onCollect: (category: VocabCategory) => void;
  onBlockedWhileCollecting?: (activeZone: VocabCategory) => void;
  onClose: () => void;
  difficulty?: 'easy' | 'medium' | 'hard';
}

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: '基础',
  medium: '进阶',
  hard: '高阶',
};

export default function OralWarRoomVocabPopup({
  word,
  context,
  position,
  isAdding,
  collectingZone = null,
  queuedZone = null,
  storedCategory = null,
  addResult,
  onCollect,
  onBlockedWhileCollecting,
  onClose,
  difficulty = 'medium',
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      data-vocab-popup
      style={{ position: 'fixed', left: position.x, top: position.y, zIndex: 9999, transform: 'translateX(-50%)' }}
      className="w-64"
    >
      {addResult ? (
        <span className={`text-xs font-black tracking-widest px-4 py-2.5 rounded-xl border shadow-[var(--shadow-card)] block text-center ${
          addResult.ok ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-red-700 bg-red-50 border-red-200'
        }`}>
          {addResult.msg}
        </span>
      ) : (
        <div className="bg-white/95 backdrop-blur-xl border border-[var(--color-border)] rounded-2xl shadow-[var(--shadow-modal)] overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[var(--color-border)] bg-[var(--color-canvas)]/50 flex items-center justify-between">
            <span className="text-[9px] font-black uppercase tracking-widest text-[var(--color-ink-muted)]">划词解析</span>
            <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-[var(--color-canvas)] text-[var(--color-ink-secondary)]">
              {DIFFICULTY_LABEL[difficulty]}
            </span>
          </div>
          <div className="px-4 py-3 space-y-2">
            <p className="text-sm font-black text-[var(--color-ink-primary)]">{word}</p>
            {context && (
              <p className="text-[10px] text-[var(--color-ink-secondary)] italic leading-relaxed line-clamp-2">{context}</p>
            )}
            <div className="grid grid-cols-2 gap-2">
              {(['business', 'general'] as VocabCategory[]).map((zone) => {
                const isCollectingHere = collectingZone === zone;
                const isQueuedHere = queuedZone === zone;
                const lockZone = collectingZone ?? queuedZone;
                const isOtherCollecting = lockZone != null && lockZone !== zone;
                const isStoredHere = storedCategory === zone;
                return (
                  <button
                    key={zone}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      if (isOtherCollecting) {
                        onBlockedWhileCollecting?.(lockZone!);
                        return;
                      }
                      playPageTurn();
                      onCollect(zone);
                    }}
                    disabled={isCollectingHere || isQueuedHere || isStoredHere}
                    className="flex items-center justify-center gap-1 py-2 rounded-xl bg-[var(--color-brand)] text-white text-[10px] font-black tracking-widest hover:bg-[var(--color-accent)] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <BookPlus className="w-3.5 h-3.5" />
                    {isCollectingHere ? '收录中…' : isQueuedHere ? '后台处理中' : isStoredHere ? '已收录' : VOCAB_ZONE_COLLECT_BTN[zone]}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onClose(); }}
              className="w-full text-[9px] text-[var(--color-ink-muted)] hover:text-[var(--color-ink-primary)] cursor-pointer"
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

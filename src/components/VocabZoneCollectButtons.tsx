import React from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { VOCAB_COLLECT_LABEL } from '../utils/backgroundHandoff';
import {
  type VocabCategory,
  VOCAB_ZONE_COLLECT_BTN,
  VOCAB_ZONE_LABEL,
} from '../utils/vocabZoneLabels';

export interface VocabZoneCollectButtonsProps {
  text: string;
  storedCategory?: VocabCategory | null;
  matrixReady?: boolean;
  collectingZone?: VocabCategory | null;
  queuedZone?: VocabCategory | null;
  onCollect: (category: VocabCategory, anchor: HTMLElement) => void;
  onBlockedWhileCollecting?: (activeZone: VocabCategory) => void;
  compact?: boolean;
}

export function VocabZoneCollectButtons({
  text,
  storedCategory = null,
  matrixReady = false,
  collectingZone = null,
  queuedZone = null,
  onCollect,
  onBlockedWhileCollecting,
  compact = false,
}: VocabZoneCollectButtonsProps) {
  const zones: VocabCategory[] = ['business', 'general'];

  return (
    <div className={`flex items-center gap-1 shrink-0 ${compact ? '' : 'flex-wrap justify-end'}`}>
      {zones.map((zone) => {
        const isStoredHere = matrixReady && storedCategory === zone;
        const isCollectingHere = collectingZone === zone;
        const isQueuedHere = queuedZone === zone;
        const lockZone = collectingZone ?? queuedZone;
        const isOtherCollecting = lockZone != null && lockZone !== zone;

        if (isStoredHere && !isCollectingHere) {
          return (
            <span
              key={zone}
              className="text-[9px] font-bold text-green-700 bg-green-50 border border-green-200/50 px-2 py-0.5 rounded-lg flex items-center gap-0.5 shrink-0"
            >
              <CheckCircle2 aria-hidden="true" className="w-2.5 h-2.5" />
              {VOCAB_ZONE_LABEL[zone]}已收录
            </span>
          );
        }

        const label = isCollectingHere
          ? VOCAB_COLLECT_LABEL.collecting
          : isQueuedHere
            ? VOCAB_COLLECT_LABEL.queued
            : VOCAB_ZONE_COLLECT_BTN[zone];

        return (
          <button
            key={zone}
            type="button"
            disabled={isCollectingHere || isQueuedHere}
            aria-label={`${label}：${text}`}
            title={matrixReady && storedCategory && storedCategory !== zone
              ? `移至${VOCAB_ZONE_LABEL[zone]}`
              : `收录至${VOCAB_ZONE_LABEL[zone]}`}
            onClick={(e) => {
              e.stopPropagation();
              if (isOtherCollecting) {
                onBlockedWhileCollecting?.(lockZone!);
                return;
              }
              onCollect(zone, e.currentTarget);
            }}
            className={`text-[9px] font-bold px-2 py-0.5 rounded-lg border transition-colors cursor-pointer shrink-0 btn-press flex items-center gap-0.5 ${
              isCollectingHere
                ? 'text-[var(--color-brand)] bg-slate-50 border-[var(--color-border)] opacity-70 cursor-wait'
                : isQueuedHere
                  ? 'text-blue-700 bg-blue-50 border-blue-200 opacity-80 cursor-wait'
                  : 'text-[var(--color-brand)] bg-slate-50 hover:bg-[var(--color-brand)] hover:text-white border-[var(--color-border)]'
            }`}
          >
            {(isCollectingHere || isQueuedHere) && <Loader2 aria-hidden="true" className="w-2.5 h-2.5 animate-spin" />}
            {label}
          </button>
        );
      })}
    </div>
  );
}

export default VocabZoneCollectButtons;

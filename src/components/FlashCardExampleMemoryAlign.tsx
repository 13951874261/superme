import React, { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import SpeakButton from './SpeakButton';
import MemoryAidPanel from './MemoryAidPanel';
import { buildReviewExampleSlots, extractReviewExampleList } from '../utils/reviewExampleSlots';

gsap.registerPlugin(useGSAP);

const SLOT_COUNT = 4;

interface FlashCardExampleMemoryAlignProps {
  wordId: string;
  wordText: string;
  payload: Record<string, any> | null | undefined;
  /** 句子类型不展示例句槽，仅展示记忆辅助纵向栈 */
  hideExamples?: boolean;
}

export default function FlashCardExampleMemoryAlign({
  wordId,
  wordText,
  payload,
  hideExamples = false,
}: FlashCardExampleMemoryAlignProps) {
  const examples = useMemo(() => extractReviewExampleList(payload), [payload]);
  const [expanded, setExpanded] = useState(false);
  const [wideLayout, setWideLayout] = useState(false);
  const alignRef = useRef<HTMLDivElement>(null);
  const rightColRef = useRef<HTMLDivElement>(null);
  const leftRefs = useRef<Array<HTMLDivElement | null>>([]);
  const rightRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 768px)');
    const apply = () => setWideLayout(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const { slots, extra } = useMemo(() => buildReviewExampleSlots(examples), [examples]);
  const alignActive = !hideExamples && !expanded && wideLayout;

  useGSAP(
    () => {
      const rightCol = rightColRef.current;
      const cards = rightRefs.current;
      if (!rightCol) return;

      const clearCards = () => {
        cards.forEach((el) => {
          if (!el) return;
          gsap.set(el, { clearProps: 'position,top,left,right,width,maxHeight,overflowY' });
        });
        gsap.set(rightCol, { clearProps: 'height,minHeight' });
        const footer = rightCol.querySelector('.memory-stack-footer') as HTMLElement | null;
        if (footer) gsap.set(footer, { clearProps: 'marginTop' });
      };

      if (!alignActive) {
        clearCards();
        return;
      }

      const sync = () => {
        let maxBottom = 0;
        const colBox = rightCol.getBoundingClientRect();
        for (let i = 0; i < SLOT_COUNT; i++) {
          const L = leftRefs.current[i];
          const R = cards[i];
          if (!L || !R) continue;
          const leftBox = L.getBoundingClientRect();
          const top = leftBox.top - colBox.top + rightCol.scrollTop;
          const h = Math.max(L.offsetHeight, 72);
          gsap.set(R, {
            position: 'absolute',
            top,
            left: 0,
            width: '100%',
            maxHeight: h,
            overflowY: 'auto',
          });
          maxBottom = Math.max(maxBottom, top + h);
        }
        gsap.set(rightCol, { height: maxBottom + 48, minHeight: maxBottom + 48 });
        const footer = rightCol.querySelector('.memory-stack-footer') as HTMLElement | null;
        if (footer) gsap.set(footer, { marginTop: maxBottom + 8 });
      };

      sync();

      const prefersReduced =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!prefersReduced) {
        gsap.from(
          cards.filter(Boolean),
          { opacity: 0, y: 6, duration: 0.28, stagger: 0.05, ease: 'power2.out', overwrite: 'auto' }
        );
      }

      const ro = typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => sync())
        : null;
      leftRefs.current.forEach((el) => el && ro?.observe(el));
      cards.forEach((el) => el && ro?.observe(el));
      window.addEventListener('resize', sync);

      return () => {
        ro?.disconnect();
        window.removeEventListener('resize', sync);
        clearCards();
      };
    },
    {
      scope: alignRef,
      dependencies: [alignActive, wordId, examples.length, slots.map((s) => s?.en).join('|')],
      revertOnUpdate: true,
    }
  );

  const assignLeft = (i: number) => (el: HTMLDivElement | null) => {
    leftRefs.current[i] = el;
  };
  const assignRight = (i: number) => (el: HTMLDivElement | null) => {
    rightRefs.current[i] = el;
  };

  const renderExampleSlot = (ex: { en: string; zh: string } | null, index: number) => (
    <div
      key={`ex-${index}`}
      ref={assignLeft(index)}
      data-ex-slot={index}
      className={
        ex
          ? 'bg-slate-50 border border-slate-100 rounded-xl p-3'
          : 'bg-slate-50/60 border border-dashed border-slate-200 rounded-xl p-3 min-h-[72px] flex items-center justify-center'
      }
    >
      {ex ? (
        <>
          <div className="flex items-start justify-between gap-2 mb-1">
            <span className="text-[10px] font-black text-blue-600 uppercase tracking-wider">
              例句 {index + 1}
            </span>
            {ex.en && (
              <SpeakButton text={ex.en} title="播放例句" className="w-6 h-6 shrink-0" iconClassName="w-3 h-3" />
            )}
          </div>
          <div className="text-sm font-medium text-slate-800 leading-relaxed">{ex.en}</div>
          {ex.zh ? <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">{ex.zh}</div> : null}
        </>
      ) : (
        <span className="text-[11px] text-slate-400 font-medium">暂无例句</span>
      )}
    </div>
  );

  if (hideExamples) {
    return (
      <div className="border-t border-slate-100 pt-3 mt-1">
        <MemoryAidPanel wordId={wordId} wordText={wordText} variant="reviewStack" />
      </div>
    );
  }

  return (
    <div ref={alignRef} className="border-t border-slate-100 pt-3 mt-1">
      <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">
        例句 ↔ 记忆辅助
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-3 gap-y-2">
        <div className="flex flex-col gap-2">
          {!expanded && slots.map((ex, i) => renderExampleSlot(ex, i))}
          {expanded && (
            <>
              {examples.map((ex, i) => (
                <div key={`ex-full-${i}`} className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-wider">
                      例句 {i + 1}
                    </span>
                    {ex.en && (
                      <SpeakButton text={ex.en} title="播放例句" className="w-6 h-6 shrink-0" iconClassName="w-3 h-3" />
                    )}
                  </div>
                  <div className="text-sm font-medium text-slate-800 leading-relaxed">{ex.en}</div>
                  {ex.zh ? <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">{ex.zh}</div> : null}
                </div>
              ))}
              {examples.length === 0 && (
                <div className="bg-slate-50/60 border border-dashed border-slate-200 rounded-xl p-3 text-center text-[11px] text-slate-400">
                  暂无例句
                </div>
              )}
            </>
          )}
          {extra.length > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-[11px] font-bold text-[#FF5722] hover:text-orange-700 py-1.5 self-start"
            >
              {expanded ? '收起为 4 槽对齐' : `展开更多（${extra.length}）`}
            </button>
          )}
        </div>

        <div ref={rightColRef} className={`relative ${alignActive ? '' : 'flex flex-col gap-2'}`}>
          <MemoryAidPanel
            wordId={wordId}
            wordText={wordText}
            variant="reviewStack"
            assignCardRef={assignRight}
            stackClassName={alignActive ? '' : 'flex flex-col gap-2'}
          />
        </div>
      </div>
    </div>
  );
}

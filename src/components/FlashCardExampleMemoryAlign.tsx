import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
  /** expand=图1 展开按钮（默认）；scroll=固定 4 槽对齐，多余例句左列滚动 */
  extraMode?: 'expand' | 'scroll';
}

const SLOT_GAP_PX = 8;

export default function FlashCardExampleMemoryAlign({
  wordId,
  wordText,
  payload,
  hideExamples = false,
  extraMode = 'expand',
}: FlashCardExampleMemoryAlignProps) {
  const examples = useMemo(() => extractReviewExampleList(payload), [payload]);
  const [expanded, setExpanded] = useState(false);
  const [wideLayout, setWideLayout] = useState(false);
  const alignRef = useRef<HTMLDivElement>(null);
  const leftColRef = useRef<HTMLDivElement>(null);
  const rightColRef = useRef<HTMLDivElement>(null);
  const leftRefs = useRef<Array<HTMLDivElement | null>>([]);
  const rightRefs = useRef<Array<HTMLDivElement | null>>([]);
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;
  const lastAlignRef = useRef<{ items: Array<{ top: number; h: number }>; colH: number } | null>(null);

  useEffect(() => {
    setExpanded(false);
  }, [wordId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 768px)');
    const apply = () => setWideLayout(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const { slots, extra } = useMemo(() => buildReviewExampleSlots(examples), [examples]);
  const scrollMode = extraMode === 'scroll';
  const scrollItems = useMemo(() => {
    if (!scrollMode) return [] as Array<{ en: string; zh: string } | null>;
    const pad = Math.max(0, SLOT_COUNT - examples.length);
    return [...examples, ...Array.from({ length: pad }, () => null)];
  }, [scrollMode, examples]);
  const alignActive = !hideExamples && wideLayout;
  const freezeRight = expanded && !scrollMode && wideLayout;

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
        if (scrollMode && leftColRef.current) gsap.set(leftColRef.current, { clearProps: 'maxHeight' });
        const footer = rightCol.querySelector('.memory-stack-footer') as HTMLElement | null;
        if (footer) gsap.set(footer, { clearProps: 'marginTop' });
      };

      if (!alignActive) {
        clearCards();
        return;
      }

      const applyCard = (R: HTMLDivElement, top: number, h: number) => {
        gsap.set(R, {
          position: 'absolute',
          top,
          left: 0,
          width: '100%',
          maxHeight: `${h}px`,
          overflowY: 'auto',
          overflowX: 'hidden',
        });
      };

      const applyFooter = (maxBottom: number, colH: number) => {
        gsap.set(rightCol, { height: colH, minHeight: colH });
        const footer = rightCol.querySelector('.memory-stack-footer') as HTMLElement | null;
        if (footer) gsap.set(footer, { marginTop: maxBottom + 8 });
      };

      const sync = () => {
        if (scrollMode) {
          let y = 0;
          for (let i = 0; i < SLOT_COUNT; i++) {
            const L = leftRefs.current[i];
            const R = cards[i];
            if (!L || !R) continue;
            const h = Math.max(L.offsetHeight, 72);
            applyCard(R, y, h);
            y += h + SLOT_GAP_PX;
          }
          const stackH = Math.max(y - SLOT_GAP_PX, 0);
          applyFooter(stackH, stackH + 48);
          if (leftColRef.current) gsap.set(leftColRef.current, { maxHeight: stackH });
          return;
        }

        if (expandedRef.current && lastAlignRef.current) {
          const snap = lastAlignRef.current;
          let maxBottom = 0;
          snap.items.forEach((item, i) => {
            const R = cards[i];
            if (!R) return;
            applyCard(R, item.top, item.h);
            maxBottom = Math.max(maxBottom, item.top + item.h);
          });
          applyFooter(maxBottom, snap.colH);
          return;
        }

        let maxBottom = 0;
        const colBox = rightCol.getBoundingClientRect();
        const items: Array<{ top: number; h: number }> = [];
        for (let i = 0; i < SLOT_COUNT; i++) {
          const L = leftRefs.current[i];
          const R = cards[i];
          if (!L || !R) continue;
          const leftBox = L.getBoundingClientRect();
          const top = leftBox.top - colBox.top + rightCol.scrollTop;
          const h = Math.max(L.offsetHeight, 72);
          applyCard(R, top, h);
          items.push({ top, h });
          maxBottom = Math.max(maxBottom, top + h);
        }
        const colH = maxBottom + 48;
        lastAlignRef.current = { items, colH };
        applyFooter(maxBottom, colH);
      };

      sync();

      const prefersReduced =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!prefersReduced && !expandedRef.current) {
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
      dependencies: [alignActive, expanded, scrollMode, wordId, examples.length, slots.map((s) => s?.en).join('|')],
      revertOnUpdate: true,
    }
  );

  const assignLeft = (i: number) => (el: HTMLDivElement | null) => {
    leftRefs.current[i] = el;
  };
  const assignRight = (i: number) => (el: HTMLDivElement | null) => {
    rightRefs.current[i] = el;
  };

  // 展开态：左列高度跟随右侧，仅例句滚动
  useLayoutEffect(() => {
    if (!expanded || scrollMode || !wideLayout) return;
    const left = leftColRef.current;
    const right = rightColRef.current;
    if (!left || !right) return;

    const apply = () => {
      const h = right.offsetHeight;
      if (h > 0) {
        left.style.height = `${h}px`;
        left.style.maxHeight = `${h}px`;
      }
    };
    apply();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(apply) : null;
    ro?.observe(right);
    window.addEventListener('resize', apply);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', apply);
      left.style.height = '';
      left.style.maxHeight = '';
    };
  }, [expanded, scrollMode, wideLayout, wordId, examples.length]);

  const renderExampleSlot = (ex: { en: string; zh: string } | null, index: number) => (
    <div
      key={`ex-${index}`}
      ref={assignLeft(index)}
      data-ex-slot={index}
      className={
        ex
          ? 'bg-slate-50 border border-slate-100 rounded-xl p-3 shrink-0'
          : 'bg-slate-50/60 border border-dashed border-slate-200 rounded-xl p-3 min-h-[72px] flex items-center justify-center shrink-0'
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
        <div
          ref={leftColRef}
          className={
            expanded && !scrollMode
              ? 'flex flex-col min-h-0 overflow-hidden'
              : `flex flex-col gap-2 ${scrollMode ? 'overflow-y-auto overscroll-contain pr-1' : ''}`
          }
        >
          {scrollMode && scrollItems.map((ex, i) => renderExampleSlot(ex, i))}
          {!scrollMode && !expanded && slots.map((ex, i) => renderExampleSlot(ex, i))}
          {!scrollMode && expanded && (
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain flex flex-col gap-2 pr-1">
              {examples.map((ex, i) => (
                <div key={`ex-full-${i}`} className="bg-slate-50 border border-slate-100 rounded-xl p-3 shrink-0">
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
                <div className="bg-slate-50/60 border border-dashed border-slate-200 rounded-xl p-3 text-center text-[11px] text-slate-400 shrink-0">
                  暂无例句
                </div>
              )}
            </div>
          )}
          {!scrollMode && extra.length > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-[11px] font-bold text-[#FF5722] hover:text-orange-700 py-1.5 self-start shrink-0"
            >
              {expanded ? '收起为 4 槽对齐' : `查看更多（${extra.length}）`}
            </button>
          )}
        </div>

        <div
          ref={rightColRef}
          className={`relative ${alignActive || freezeRight ? '' : 'flex flex-col gap-2'}`}
        >
          <MemoryAidPanel
            wordId={wordId}
            wordText={wordText}
            variant="reviewStack"
            assignCardRef={assignRight}
            stackClassName={alignActive || freezeRight ? '' : 'flex flex-col gap-2'}
          />
        </div>
      </div>
    </div>
  );
}

import { useEffect, RefObject } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export type UseScrollRevealOptions = {
  selector?: string;
  scroller?: string;
  y?: number;
  staggerDelay?: number; // 毫秒
  threshold?: number;
};

/**
 * 优雅的长页面滚动元素批次淡入位移钩子 (Scroll Reveal Hook)
 * 基于 GSAP ScrollTrigger 实现，利用硬件加速与 Compositor 线程规避布局卡顿
 */
export function useScrollReveal(
  scopeRef: RefObject<HTMLElement | null>,
  {
    selector = '[data-scroll-reveal]',
    scroller = '#main-content',
    y = 20,
    staggerDelay = 60,
    threshold = 0.15,
  }: UseScrollRevealOptions = {}
) {
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const scopeNode = scopeRef.current;
    if (!scopeNode) return;

    const targets = Array.from(scopeNode.querySelectorAll<HTMLElement>(selector));
    if (targets.length === 0) return;

    if (prefersReducedMotion) {
      gsap.set(targets, { opacity: 1, y: 0 });
      return;
    }

    // 使用 GSAP 高效批量设置初始隐藏状态
    gsap.set(targets, { opacity: 0, y: y });

    const triggers = ScrollTrigger.batch(targets, {
      scroller: scroller,
      start: `top+=${threshold * 100}% bottom`,
      onEnter: (batch) => {
        gsap.to(batch, {
          opacity: 1,
          y: 0,
          stagger: staggerDelay / 1000,
          duration: 0.5,
          ease: "power4.out",
          overwrite: "auto",
        });
      },
      once: true,
    });

    return () => {
      triggers.forEach((st) => st.kill());
    };
  }, [scopeRef, selector, scroller, y, staggerDelay, threshold]);
}

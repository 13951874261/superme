import type { Transition } from 'motion/react';

// ==========================================
// 1. GSAP 专用物理缓动常数定义 (基于 Compositor 高性能线程)
// ==========================================
export const GSAP_SPRING_GENTLE = {
  ease: "back.out(1.2)",
  duration: 0.5
};

export const GSAP_SPRING_SNAPPY = {
  ease: "power3.out",
  duration: 0.35
};

export const GSAP_SPRING_BOUNCY = {
  ease: "elastic.out(1, 0.4)",
  duration: 0.6
};

export const GSAP_EASE_PREMIUM = "power4.out";

export const GSAP_FADE_IN = {
  duration: 0.3,
  ease: GSAP_EASE_PREMIUM,
};

export const GSAP_POP_UP = {
  ease: "back.out(1.7)",
  duration: 0.4
};

// ==========================================
// 2. 兼容现有 Motion / CSS Transition 的平滑导出
// ==========================================
export const SPRING_GENTLE: Transition = {
  type: 'spring',
  stiffness: 120,
  damping: 18,
};

export const SPRING_SNAPPY: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 25,
};

export const SPRING_BOUNCY: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 15,
};

// 替换所有 cubic-bezier(0.16, 1, 0.3, 1) 的 CSS transition
export const EASE_PREMIUM = [0.16, 1, 0.3, 1] as const;

export const FADE_IN: Transition = {
  duration: 0.3,
  ease: EASE_PREMIUM,
};

export const SLIDE_DOWN: Transition = {
  type: 'spring',
  stiffness: 200,
  damping: 20,
};

export const POP_UP: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 15,
};

// cubic-bezier(0.16, 1, 0.3, 1) 的 CSS 字符串形式，供模板字符串使用
export const EASE_PREMIUM_CSS = 'cubic-bezier(0.16, 1, 0.3, 1)';

export const FADE_OUT: Transition = {
  duration: 0.25,
  ease: EASE_PREMIUM,
};

export const SLIDE_IN: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 25,
};

export const SCALE_IN: Transition = {
  duration: 0.35,
  ease: EASE_PREMIUM,
};

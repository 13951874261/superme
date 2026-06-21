import type { Transition } from 'motion/react';

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

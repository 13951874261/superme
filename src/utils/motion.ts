export const GLOBAL_SPRING = {
  type: 'spring' as const,
  damping: 30,
  stiffness: 250,
};

export const FAST_SPRING = {
  type: 'spring' as const,
  damping: 28,
  stiffness: 360,
};

export const PANEL_SPRING = {
  type: 'spring' as const,
  damping: 34,
  stiffness: 260,
};

export const SOFT_TRANSITION = {
  duration: 0.24,
  ease: [0.16, 1, 0.3, 1] as const,
};

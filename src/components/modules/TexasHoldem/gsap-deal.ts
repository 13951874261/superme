import { gsap } from 'gsap';

export interface DealAnimationParams {
  cardEl: HTMLElement;
  startEl: HTMLElement;
  targetEl: HTMLElement;
  delay: number;
  onComplete?: () => void;
}

export function animateDeal({ cardEl, startEl, targetEl, delay, onComplete }: DealAnimationParams) {
  if (!cardEl || !startEl || !targetEl) return;

  const startRect = startEl.getBoundingClientRect();
  const targetRect = targetEl.getBoundingClientRect();

  const deltaX = startRect.left - targetRect.left;
  const deltaY = startRect.top - targetRect.top;

  gsap.killTweensOf(cardEl);
  
  // Set initial state at start position
  gsap.set(cardEl, {
    x: deltaX,
    y: deltaY,
    rotation: -45,
    scale: 0.2,
    opacity: 0,
    transformPerspective: 1000,
  });

  // Parabolic fly-in animation (interiors fly in smooth arc)
  gsap.to(cardEl, {
    x: 0,
    y: 0,
    rotation: 0,
    scale: 1,
    opacity: 1,
    delay,
    duration: 0.6,
    ease: 'power3.out',
    onComplete,
  });
}

export function animateFlip(cardEl: HTMLElement, onComplete?: () => void) {
  if (!cardEl) return;
  
  const tl = gsap.timeline({ onComplete });
  tl.to(cardEl, {
    rotationY: 90,
    duration: 0.15,
    ease: 'power1.in',
  })
  .to(cardEl, {
    rotationY: 0,
    duration: 0.15,
    ease: 'power1.out',
  });
}

export function animateChipMove(chipEl: HTMLElement, startEl: HTMLElement, targetEl: HTMLElement, onComplete?: () => void) {
  if (!chipEl || !startEl || !targetEl) return;

  const startRect = startEl.getBoundingClientRect();
  const targetRect = targetEl.getBoundingClientRect();

  const deltaX = startRect.left - targetRect.left;
  const deltaY = startRect.top - targetRect.top;

  gsap.killTweensOf(chipEl);

  gsap.set(chipEl, {
    x: deltaX,
    y: deltaY,
    opacity: 0,
    scale: 0.5,
  });

  gsap.to(chipEl, {
    x: 0,
    y: 0,
    opacity: 1,
    scale: 1,
    duration: 0.45,
    ease: 'back.out(1.2)',
    onComplete,
  });
}
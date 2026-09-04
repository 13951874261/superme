export type AnchorPlacement = 'top' | 'bottom';

export interface AnchoredPosition {
  top: number;
  left: number;
  placement: AnchorPlacement;
  maxHeight: number;
}

export function computeAnchoredPosition(
  anchor: Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom' | 'width' | 'height'>,
  floating: { width: number; height: number },
  viewport: { width: number; height: number },
  gap = 8,
  safe = 12,
): AnchoredPosition {
  const belowSpace = viewport.height - safe - anchor.bottom - gap;
  const aboveSpace = anchor.top - safe - gap;
  const fitsBelow = floating.height <= belowSpace;
  const fitsAbove = floating.height <= aboveSpace;
  const placement: AnchorPlacement = fitsBelow || (!fitsAbove && belowSpace >= aboveSpace) ? 'bottom' : 'top';
  const availableHeight = Math.max(0, placement === 'bottom' ? belowSpace : aboveSpace);
  const maxHeight = Math.min(floating.height, availableHeight);
  const rawTop = placement === 'bottom' ? anchor.bottom + gap : anchor.top - gap - maxHeight;
  const maxLeft = Math.max(safe, viewport.width - floating.width - safe);
  const left = Math.min(Math.max(anchor.left + anchor.width / 2 - floating.width / 2, safe), maxLeft);

  return {
    top: rawTop,
    left,
    placement,
    maxHeight,
  };
}

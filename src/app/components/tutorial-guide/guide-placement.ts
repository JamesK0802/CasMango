export type GuideSide = 'above' | 'below' | 'inside';

/** Document coordinates: scrolling must not change the chosen side of a focus box. */
export function anchoredGuidePlacement(
  target: { top: number; bottom: number; left: number; width: number },
  dialogHeight: number,
  pageWidth: number,
  side?: GuideSide,
  viewport?: { top: number; height: number },
  insideOffset?: number
): { top: number; left: number; width: number; side: GuideSide; offset: number } {
  const gap = 24;
  const width = Math.min(800, Math.max(0, pageWidth - 32));
  const safeTop = (viewport?.top ?? 0) + 72;
  const safeBottom = viewport ? viewport.top + viewport.height - 16 : Infinity;
  const chosen = side ?? (target.top - gap - dialogHeight >= safeTop ? 'above'
    : target.bottom + gap + dialogHeight <= safeBottom ? 'below' : 'inside');
  const top = chosen === 'above' ? target.top - dialogHeight - gap
    : chosen === 'below' ? target.bottom + gap
    : insideOffset !== undefined ? target.top + insideOffset
    : Math.max(safeTop, Math.min(target.bottom - dialogHeight - gap, safeBottom - dialogHeight));
  return {
    top,
    left: Math.max(16, Math.min(pageWidth - width - 16, target.left + (target.width - width) / 2)),
    width,
    side: chosen,
    offset: top - target.top
  };
}

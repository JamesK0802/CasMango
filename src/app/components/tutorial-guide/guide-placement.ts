export type GuideSide = 'above' | 'below';

/** Document coordinates: scrolling must not change the chosen side of a focus box. */
export function anchoredGuidePlacement(
  target: { top: number; bottom: number; left: number; width: number },
  dialogHeight: number,
  pageWidth: number,
  side?: GuideSide
): { top: number; left: number; width: number; side: GuideSide } {
  const gap = 24;
  const width = Math.min(800, Math.max(0, pageWidth - 32));
  const chosen = side ?? (target.top >= dialogHeight + gap + 72 ? 'above' : 'below');
  return {
    top: chosen === 'above' ? target.top - dialogHeight - gap : target.bottom + gap,
    left: Math.max(16, Math.min(pageWidth - width - 16, target.left + (target.width - width) / 2)),
    width,
    side: chosen
  };
}

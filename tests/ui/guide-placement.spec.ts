import { describe, expect, it } from 'vitest';
import { anchoredGuidePlacement } from '../../src/app/components/tutorial-guide/guide-placement';

describe('focus-box anchored module guides', () => {
  it('places a dialog outside a lower focus box', () => {
    const target = { top: 800, bottom: 1150, left: 100, width: 1040 };
    const position = anchoredGuidePlacement(target, 400, 1280);
    expect(position.side).toBe('above');
    expect(position.top + 400).toBe(target.top - 24);
  });

  it('uses document space below a box when no viewport constraint is supplied', () => {
    const target = { top: 100, bottom: 780, left: 0, width: 1280 };
    const position = anchoredGuidePlacement(target, 300, 1280);
    expect(position.side).toBe('below');
    expect(position.top).toBe(804);
  });

  it.each([
    { top: 78, bottom: 980, height: 980 },
    { top: 94, bottom: 720, height: 720 },
    { top: 190, bottom: 650, height: 720 },
  ])('keeps large-panel explanations and navigation visible: %o', ({top, bottom, height}) => {
    const position = anchoredGuidePlacement({ top, bottom, left: 100, width: 1040 }, 320, 1280, undefined, { top: 0, height });
    expect(position.side).toBe('inside');
    expect(position.top).toBeGreaterThanOrEqual(72);
    expect(position.top + 320).toBeLessThanOrEqual(height - 16);
  });

  it('uses outside placement when the viewport has room', () => {
    const below = anchoredGuidePlacement({ top: 90, bottom: 180, left: 0, width: 1280 }, 200, 1280, undefined, { top: 0, height: 720 });
    expect(below.side).toBe('below');
    const above = anchoredGuidePlacement({ top: 550, bottom: 700, left: 0, width: 1280 }, 200, 1280, undefined, { top: 0, height: 720 });
    expect(above.side).toBe('above');
  });

  it('anchors an overlapping dialog to its box, not the screen, after placement', () => {
    const target = { top: 94, bottom: 720, left: 100, width: 1040 };
    const initial = anchoredGuidePlacement(target, 220, 1280, undefined, { top: 0, height: 720 });
    const scrolled = anchoredGuidePlacement(target, 220, 1280, initial.side, { top: 150, height: 720 }, initial.offset);
    expect(scrolled.top).toBe(initial.top);
    const moved = anchoredGuidePlacement({ ...target, top: 114, bottom: 740 }, 220, 1280, initial.side, { top: 0, height: 720 }, initial.offset);
    expect(moved.top).toBe(initial.top + 20);
  });

  it('keeps the same side while the card scrolls and follows its box', () => {
    const target = { top: 800, bottom: 1150, left: 100, width: 1040 };
    const initial = anchoredGuidePlacement(target, 400, 1280);
    const moved = anchoredGuidePlacement({ ...target, top: 600, bottom: 950 }, 400, 1280, initial.side);
    expect(moved.side).toBe(initial.side);
    expect(moved.top).toBe(initial.top - 200);
  });

  it('fits narrow screens without horizontal clipping', () => {
    const position = anchoredGuidePlacement({ top: 90, bottom: 180, left: 290, width: 50 }, 300, 360);
    expect(position.left).toBe(16);
    expect(position.width).toBe(328);
  });
});

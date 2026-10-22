import { describe, expect, it } from 'vitest';
import { anchoredGuidePlacement } from '../../src/app/components/tutorial-guide/guide-placement';

describe('focus-box anchored module guides', () => {
  it('places a dialog outside a lower focus box', () => {
    const target = { top: 800, bottom: 1150, left: 100, width: 1040 };
    const position = anchoredGuidePlacement(target, 400, 1280);
    expect(position.side).toBe('above');
    expect(position.top + 400).toBe(target.top - 24);
  });

  it('uses document space below a tall box instead of overlaying it', () => {
    const target = { top: 100, bottom: 780, left: 0, width: 1280 };
    const position = anchoredGuidePlacement(target, 300, 1280);
    expect(position.side).toBe('below');
    expect(position.top).toBe(804);
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

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GUIDE_MASCOT_ASSETS, guideMascotPose } from '../../src/app/components/tutorial-guide/guide-mascot';

describe('contextual guide mascot', () => {
  it('uses the same lab-coat asset family for every pose', () => {
    expect(Object.keys(GUIDE_MASCOT_ASSETS)).toHaveLength(7);
    for (const path of Object.values(GUIDE_MASCOT_ASSETS)) expect(path).toMatch(/^guide-mascots\/[a-z]+\.webp$/);
  });

  it('ships every referenced pose as a small real WebP asset', () => {
    for (const path of Object.values(GUIDE_MASCOT_ASSETS)) {
      const bytes = readFileSync(resolve('public', path));
      expect(bytes.toString('ascii', 0, 4)).toBe('RIFF');
      expect(bytes.toString('ascii', 8, 12)).toBe('WEBP');
      expect(bytes.length).toBeLessThan(40_000);
    }
  });

  it('welcomes every tour, not just the analysis tour', () => {
    for (const id of ['intro', 'result-welcome', 'workspace-overview', 'benchmark-overview']) {
      expect(guideMascotPose({ id, isIntro: true }, true, false)).toBe('wave');
    }
    expect(guideMascotPose({ id: 'hub', isIntro: true }, true, false)).toBe('idle');
  });

  it('keeps a stable pose across related explanatory steps without false praise', () => {
    for (const id of ['result-metrics', 'result-charts']) {
      expect(guideMascotPose({ id }, true, false)).toBe('flask');
    }
    expect(guideMascotPose({ id: 'result-annotation' }, true, false)).toBe('inspect');
    expect(guideMascotPose({ id: 'core-parameters' }, true, false)).toBe('checklist');
  });

  it('acknowledges only completed actions, never pending or blocked ones', () => {
    const step = { id: 'result-exclude-group', interactiveAction: 'exclude_group' };
    expect(guideMascotPose(step, false, false)).toBe('inspect');
    expect(guideMascotPose(step, true, true)).toBe('inspect');
    expect(guideMascotPose(step, true, false)).toBe('success');
    expect(guideMascotPose(step, false, false)).toBe('inspect');
  });

  it('ends each tour with a restrained success pose', () => {
    expect(guideMascotPose({ id: 'result-final-hub', isFinal: true }, true, false)).toBe('success');
  });
});

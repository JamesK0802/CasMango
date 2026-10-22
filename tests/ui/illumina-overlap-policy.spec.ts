import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ILLUMINA_OVERLAP_RULE, DEFAULT_ILLUMINA_MIN_OVERLAP_BASES, DEFAULT_ILLUMINA_MIN_OVERLAP_IDENTITY, DEFAULT_ILLUMINA_MAX_OVERLAP_DIFFERENCES } from '../../src/app/models/illumina-overlap-policy';
import * as worker from '../../src/app/workers/core/illumina-preprocessor';

describe('shared Illumina overlap policy', () => {
  it('uses the worker defaults in the displayed rule', () => {
    expect(worker.DEFAULT_ILLUMINA_MIN_OVERLAP_BASES).toBe(DEFAULT_ILLUMINA_MIN_OVERLAP_BASES);
    expect(worker.DEFAULT_ILLUMINA_MIN_OVERLAP_IDENTITY).toBe(DEFAULT_ILLUMINA_MIN_OVERLAP_IDENTITY);
    expect(worker.DEFAULT_ILLUMINA_MAX_OVERLAP_DIFFERENCES).toBe(DEFAULT_ILLUMINA_MAX_OVERLAP_DIFFERENCES);
    expect(ILLUMINA_OVERLAP_RULE).toBe('≥10 bp overlap · ≤5 mismatches and ≤20% in the first ≤50 bp');
  });

  it('binds Benchmark and its guide to the shared policy rather than stale copy', () => {
    const template = readFileSync('src/app/pages/benchmark-page/benchmark-page.component.html', 'utf8');
    const guide = readFileSync('src/app/components/tutorial-guide/tutorial-guide.component.ts', 'utf8');
    expect(template).toContain('{{ overlapRule }}');
    expect(template).not.toContain('≥90% identity');
    expect(guide).toContain("ILLUMINA_OVERLAP_RULE + '.'");
  });
});

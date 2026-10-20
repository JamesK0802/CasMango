import { describe, expect, it } from 'vitest';
import { benchmarkExampleRows, GUIDE_GRNA, GUIDE_REFERENCE, normalizationExampleMates, workspaceExampleItems } from '../../src/app/components/tutorial-guide/module-examples';
import { parseFastqString } from '../../src/app/workers/core/fastq-parser';
import { runBenchmark } from '../../src/app/workers/core/benchmark-pipeline';
import { normalizeIlluminaPairByOverlap, buildIlluminaPseudoReads } from '../../src/app/workers/core/illumina-preprocessor';
import { reverseComplement, findGrnaCutSite } from '../../src/app/workers/core/classifier';

describe('real tutorial input fixtures', () => {
  it('runs labelled examples through the real classifier rather than hardcoding metrics', async () => {
    const rows = benchmarkExampleRows();
    const dataset = await Promise.all(rows.map(async row => ({ gene: row.geneName, target: row.targetName,
      reference: row.referenceSequence, grna: row.grnaSequence, reads: parseFastqString(await row.file.text()) })));
    const result = runBenchmark(dataset, { windowSize: 90, phredThreshold: 20, marginThreshold: .1, platform: 'nanopore' }, () => {});
    expect(result.total_reads).toBe(24);
    expect(result.correct_count).toBe(24);
    expect(result.wrong_count).toBe(0);
  });

  it('provides correctly paired mates that demonstrate consensus AND X padding', async () => {
    const pair = normalizationExampleMates();
    const r1 = parseFastqString(await pair.r1.text());
    const r2 = parseFastqString(await pair.r2.text());
    expect(() => buildIlluminaPseudoReads(r1, r2, 90)).not.toThrow();
    const merged = r1.map((r, i) => normalizeIlluminaPairByOverlap(r, { ...r2[i], seq: reverseComplement(r2[i].seq), qual: [...r2[i].qual].reverse() }, 90));
    expect(merged.map(r => r.merged)).toEqual([true, false]);
    expect(merged[1].read.seq).toContain('X'.repeat(90));
  });

  it('provides annotated reference and actual WT, deletion and insertion reads', () => {
    const [reference, reads] = workspaceExampleItems();
    expect(reference.type).toBe('sequence'); expect(reads.type).toBe('fastq');
    if (reference.type !== 'sequence' || reads.type !== 'fastq') throw Error('wrong fixture');
    const cut = findGrnaCutSite(GUIDE_REFERENCE, GUIDE_GRNA).cut_site;
    expect(reference.features[0].start).toBe(cut - 16);
    expect(reference.features[1].end).toBeLessThan(reference.sequence.length);
    expect(reads.reads.map(r => r.seq.length)).toEqual([GUIDE_REFERENCE.length, GUIDE_REFERENCE.length - 1, GUIDE_REFERENCE.length + 1]);
    expect(reads.autoAlign?.windowSeq).toHaveLength(90);
  });
});

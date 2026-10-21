import { describe, expect, it } from 'vitest';
import { benchmarkExampleRows, GUIDE_GRNA, GUIDE_REFERENCE, GUIDE_WORKSPACE_READ_COUNT, GUIDE_BENCHMARK_CLASS_READ_COUNT, GUIDE_NORMALIZATION_PAIR_COUNT, normalizationExampleMates, workspaceExampleItems, workspaceExampleFile } from '../../src/app/components/tutorial-guide/module-examples';
import { parseFastqString } from '../../src/app/workers/core/fastq-parser';
import { runBenchmark } from '../../src/app/workers/core/benchmark-pipeline';
import { normalizeIlluminaPairByOverlap, buildIlluminaPseudoReads } from '../../src/app/workers/core/illumina-preprocessor';
import { reverseComplement, findGrnaCutSite } from '../../src/app/workers/core/classifier';

describe('real tutorial input fixtures', () => {
  it('imports the guide FASTQ through the ordinary parser', async () => {
    const { parseFastqFile } = await import('../../src/app/utils/parsers.utils');
    const doc = await parseFastqFile(workspaceExampleFile());
    expect(doc.reads.slice(0,3).map(r => r.id)).toEqual(['WT', 'Deletion_1bp', 'Insertion_1bp']);
    expect(doc.stats.readCount).toBe(GUIDE_WORKSPACE_READ_COUNT);
    expect(new Set(doc.reads.map(r=>r.id)).size).toBe(GUIDE_WORKSPACE_READ_COUNT);
    expect(doc.autoAlign).toBeUndefined();
  });
  it('runs labelled examples through the real classifier rather than hardcoding metrics', async () => {
    const rows = benchmarkExampleRows();
    const dataset = await Promise.all(rows.map(async row => ({ gene: row.geneName, target: row.targetName,
      reference: row.referenceSequence, grna: row.grnaSequence, reads: parseFastqString(await row.file.text()) })));
    const result = runBenchmark(dataset, { windowSize: 90, phredThreshold: 20, marginThreshold: .1, platform: 'nanopore' }, () => {});
    expect(result.total_reads).toBe(GUIDE_BENCHMARK_CLASS_READ_COUNT * 2);
    expect(result.correct_count).toBe(result.total_reads);
    expect(result.wrong_count).toBe(0);
  });

  it('provides correctly paired mates that demonstrate consensus AND X padding', async () => {
    const pair = normalizationExampleMates();
    const r1 = parseFastqString(await pair.r1.text());
    const r2 = parseFastqString(await pair.r2.text());
    expect(() => buildIlluminaPseudoReads(r1, r2, 90)).not.toThrow();
    const merged = r1.map((r, i) => normalizeIlluminaPairByOverlap(r, { ...r2[i], seq: reverseComplement(r2[i].seq), qual: [...r2[i].qual].reverse() }, 90));
    expect(merged).toHaveLength(GUIDE_NORMALIZATION_PAIR_COUNT);
    expect(merged.filter(r=>r.merged)).toHaveLength(GUIDE_NORMALIZATION_PAIR_COUNT / 2);
    expect(merged.map(r=>r.merged)).toEqual(Array.from({length: GUIDE_NORMALIZATION_PAIR_COUNT},(_,i)=>i%2===0));
    expect(merged[1].read.seq).toContain('X'.repeat(90));
  });

  it('provides annotated reference and actual WT, deletion and insertion reads', () => {
    const [reference, reads] = workspaceExampleItems();
    expect(reference.type).toBe('sequence'); expect(reads.type).toBe('fastq');
    if (reference.type !== 'sequence' || reads.type !== 'fastq') throw Error('wrong fixture');
    const cut = findGrnaCutSite(GUIDE_REFERENCE, GUIDE_GRNA).cut_site;
    expect(reference.features[0].start).toBe(cut - 16);
    expect(reference.features[1].end).toBeLessThan(reference.sequence.length);
    expect(reads.reads.slice(0,3).map(r => r.seq.length)).toEqual([GUIDE_REFERENCE.length, GUIDE_REFERENCE.length - 1, GUIDE_REFERENCE.length + 1]);
    expect(reads.reads.length).toBe(GUIDE_WORKSPACE_READ_COUNT);
    expect(Object.values(reads.stats.lengthDistribution).reduce((a,b)=>a+b,0)).toBe(GUIDE_WORKSPACE_READ_COUNT);
    expect(reads.stats.qualityDistribution[40]).toBe(GUIDE_WORKSPACE_READ_COUNT);
    expect(reads.autoAlign?.windowSeq).toHaveLength(90);
  });
});

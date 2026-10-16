import '@angular/compiler';
import { describe, expect, it, vi } from 'vitest';
import { AppStateService } from '../../src/app/services/app-state.service';
import { CurationService } from '../../src/app/services/curation.service';
import { emptyCurationConfig, groupKey } from '../../src/app/models/curation.model';
import { findMergeTarget } from '../../src/app/models/result-merge';

function target(id: string, guide: string, count: number) {
  return { target_id: id, sgrna_seq: guide, ref_sequence: 'ACGT', cut_site_index: 2,
    summary: { total_reads: count, matched_reads: count, aligned_reads: count, unmodified: count, modified: 0 },
    breakdown: { no_indel: count, in_frame: 0, out_of_frame: 0, substitution: 0 },
    top_groups: [{ read_inner: 'ACGT', read_count: count, classification: 'No Indel' }] };
}
function file(index: number, sameGuide = false) {
  const count = (index + 1) * 10;
  return { fastq_file: `sample${index}.fq`, multi_reference_result: {
    ambiguous_read_count: 0, debug: { total_reads_parsed: count, phred_passed_count: count, anchor_matched_count: count },
    genes: [{ gene: 'YCO-A', reference_sequence: 'ACGTACGT', assigned_read_count: count,
      analysis_result: { targets: [target('gRNA1', 'AAAA', count), target('gRNA2', sameGuide ? 'AAAA' : 'CCCC', count)] } }] } };
}
function state() {
  const service = Object.create(AppStateService.prototype) as any;
  service.activeMode = 'analysis'; service.analysisSlot = { genes: [], mergedGenes: [], selectedGeneIndex: 0 };
  service.resultsUpdated$ = { next: vi.fn() }; service.ngZone = { run: (fn: () => void) => fn() };
  return service;
}
const targetCounts = (gene: any) => gene.analysis_result.targets.map((t: any) => t.summary.aligned_reads);

describe('All Merged aggregation', () => {
  it('includes every file beyond five and never mutates per-file evidence', () => {
    const files = Array.from({ length: 7 }, (_, i) => file(i)); const before = JSON.stringify(files);
    const service = state(); service.handleAnalysisComplete({ results: files });
    expect(service.totalMergedRawReads).toBe(280);
    expect(service.mergedGenes[0].assigned_read_count).toBe(280);
    expect(targetCounts(service.mergedGenes[0])).toEqual([280, 280]);
    expect(JSON.stringify(files)).toBe(before);
  });
  it('keeps repeated guides in distinct named target slots instead of piling counts into the last', () => {
    const service = state(); service.handleAnalysisComplete({ results: [file(0, true), file(1, true)] });
    expect(targetCounts(service.mergedGenes[0])).toEqual([30, 30]);
    expect(service.mergedGenes[0].analysis_result.targets.map((t: any) => t.top_groups[0].read_count)).toEqual([30, 30]);
  });
  it('rebuilds stale exported merged counts from the complete per-file scopes when reopening', () => {
    const files = [file(0, true), file(1, true)];
    const stale = structuredClone(files[0].multi_reference_result.genes);
    const scopes = [{ sheetName: 'Merged', genes: stale, readFlow: { rawReads: 999 } }, ...files.map(f => ({
      sheetName: f.fastq_file, genes: f.multi_reference_result.genes,
      readFlow: { rawReads: f.multi_reference_result.debug.total_reads_parsed, phredPassed: 0, anchorMatched: 0, ambiguousReads: 0 }
    }))];
    const service = state(); service.loadResultData({ params: {}, scopes });
    expect(service.totalMergedRawReads).toBe(30);
    expect(service.mergedGenes[0].assigned_read_count).toBe(30);
    expect(targetCounts(service.mergedGenes[0])).toEqual([30, 30]);
    expect(service.isCuratedView).toBe(false);
  });
});

describe('target identity used by UI, curation and batched worker aggregation', () => {
  it('supports renamed unique targets but never merges different windows or cut sites', () => {
    const a = target('first', 'AAAA', 10), b = target('renamed', 'AAAA', 20);
    expect(findMergeTarget([a], b, [b])).toBe(a);
    expect(findMergeTarget([a], { ...b, ref_sequence: 'GGGG' }, [b])).toBeUndefined();
    expect(findMergeTarget([a], { ...b, cut_site_index: 3 }, [b])).toBeUndefined();
  });
  it('does not guess between repeated-guide targets or merge unrelated legacy target names', () => {
    const a = target('first', 'AAAA', 10), b = target('second', 'AAAA', 10), unknown = target('third', 'AAAA', 20);
    expect(findMergeTarget([a, b], unknown, [unknown])).toBeUndefined();
    const legacy = { ...a, sgrna_seq: '' };
    expect(findMergeTarget([legacy], { ...legacy, target_id: 'other' }, [legacy])).toBeUndefined();
  });
});

describe('curated unique assignment counts', () => {
  function curate(files: any[], config = emptyCurationConfig()) {
    return new CurationService().computeCuratedResult(files, [], 0, 0, 0, 0, config);
  }
  it('entering Curate with no exclusions leaves unique assignment counts unchanged', () => {
    const files = [file(0), file(1)]; const before = JSON.stringify(files);
    const output = curate(files);
    expect(output.mergedGenes[0].assigned_read_count).toBe(30);
    expect(targetCounts(output.mergedGenes[0])).toEqual([30, 30]);
    expect(JSON.stringify(files)).toBe(before);
  });
  it('sums only retained files without counting their targets as extra reads', () => {
    const config = emptyCurationConfig(); config.excludedFiles = ['sample1.fq', 'sample2.fq', 'sample3.fq'];
    const result = curate(Array.from({ length: 7 }, (_, i) => file(i, true)), config);
    expect(result.totalMergedRawReads).toBe(190);
    expect(result.mergedGenes[0].assigned_read_count).toBe(190);
    expect(targetCounts(result.mergedGenes[0])).toEqual([190, 190]);
  });
  it('group exclusion changes the target analysis, not the original reference-assignment stage', () => {
    const config = emptyCurationConfig(); config.excludedGroups = [groupKey('YCO-A', 'gRNA1', 'ACGT')];
    const result = curate([file(0), file(1)], config);
    expect(result.mergedGenes[0].assigned_read_count).toBe(30);
    expect(targetCounts(result.mergedGenes[0])).toEqual([0, 30]);
    config.excludedGroups = [];
    expect(targetCounts(curate([file(0), file(1)], config).mergedGenes[0])).toEqual([30, 30]);
  });
});

import { extractWindow, findGrnaCutSite, reverseComplement } from '../../workers/core/classifier';

/** Illustrative tutorial data, not experimental measurements or benchmark output. */
export function addTryExample(data: { params: any; scopes: any[] }) {
  const guide = 'AATATCTCTCTATCTCCTC';
  const reference = 'GAATTAGGTGGGATTTGATAGCAGGAAGAGTTCCTGGAAGACAACCAGAGGAGATAGAGAGATATTGGATAATGAGAAACAGTGAAGGCTTTGCTGATAAACGACGCCAGCTTCACTCATCTTCCCACAAACATACCAAGCCTCACCGTCCTCGCTTTTCTATCTATCCTTCCTAG';
  const info = findGrnaCutSite(reference, guide);
  const ref = extractWindow(reference, info.cut_site, 90);
  const cut = info.cut_site - Math.max(0, info.cut_site - 45);
  const counts = [1320, 310, 190, 160, 70];
  const total = counts.reduce((a, b) => a + b, 0);
  const cpc = data.scopes.find(s => s.sheetName !== 'Merged').genes[0];
  const oldTarget = cpc.analysis_result.targets[0];
  const edits = [
    [{ type: 'equal', val: ref }],
    [{ type: 'equal', val: ref.slice(0, cut) }, { type: 'delete', val: ref.slice(cut, cut + 1) }, { type: 'equal', val: ref.slice(cut + 1) }],
    [{ type: 'equal', val: ref.slice(0, cut) }, { type: 'insert', val: 'A' }, { type: 'equal', val: ref.slice(cut) }],
    [{ type: 'equal', val: ref.slice(0, cut - 1) }, { type: 'delete', val: ref.slice(cut - 1, cut + 2) }, { type: 'equal', val: ref.slice(cut + 2) }],
    [{ type: 'equal', val: ref.slice(0, cut) }, { type: 'substitute', val: ref[cut] === 'A' ? 'T' : 'A' }, { type: 'equal', val: ref.slice(cut + 1) }],
  ];
  const sequence = (tokens: Array<{type: string; val: string}>) => tokens.filter(t => t.type !== 'delete').map(t => t.val).join('');
  // Real sequence keys keep exclusion/restoration and Excel round-trips consistent.
  for (const group of oldTarget.top_groups) group.read_inner = sequence(group.tokens);
  const groups = oldTarget.top_groups.map((g: any, i: number) => ({ ...g,
    tokens: edits[i], read_inner: sequence(edits[i]), read_count: counts[i], read_pct: +(counts[i] * 100 / total).toFixed(1) }));
  const target = { ...oldTarget, ref_sequence: ref, cut_site_index: cut,
    grna_start_index: ref.indexOf(guide) >= 0 ? ref.indexOf(guide) : ref.indexOf(reverseComplement(guide)),
    display_sgrna_seq: ref.includes(guide) ? guide : reverseComplement(guide),
    strand: info.strand, top_groups: groups,
    summary: { ...oldTarget.summary, total_reads: total, matched_reads: total, aligned_reads: total,
      unmodified: counts[0], modified: counts[1] + counts[2] + counts[3],
      out_of_frame_pct: (counts[1] + counts[2]) * 100 / total, in_frame_pct: counts[3] * 100 / total,
      no_indel_pct: (counts[0] + counts[4]) * 100 / total, substitution_pct: counts[4] * 100 / total,
      substitution_reads: counts[4], editing_efficiency: (counts[1] + counts[2] + counts[3]) * 100 / total,
      indel_editing_efficiency: (counts[1] + counts[2] + counts[3]) * 100 / total },
    breakdown: { no_indel: counts[0], substitution: counts[4], in_frame: counts[3], out_of_frame: counts[1] + counts[2], failed: 0 } };
  const gene = { ...cpc, gene: 'TRY', reference_sequence: reference, assigned_read_count: total,
    analysis_result: { targets: [target] } };
  const tryFlow = { rawReads: 2300, phredPassed: 2210, anchorMatched: 2120, usableForAssignment: 2120, assignedReads: total, ambiguousReads: 70 };
  const cpcScope = data.scopes.find(s => s.sheetName !== 'Merged');
  const mergedFlow = Object.fromEntries(Object.entries(tryFlow).map(([key, value]) => [key, value + cpcScope.readFlow[key]]));
  return { params: { ...data.params, indelThreshold: 2, fileCount: 2, dataType: 'Synthetic CPC & TRY tutorial example' },
    scopes: [{ sheetName: 'Merged', readFlow: mergedFlow, genes: [cpc, gene] }, cpcScope,
      { sheetName: 'try_sample.fastq.gz', readFlow: tryFlow, genes: [gene] }] };
}

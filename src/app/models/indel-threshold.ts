import { MutationGroup, TargetResult } from './analysis.model';

export function sanitizeIndelThreshold(value: unknown): number {
  const n = Number(value); return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
}

/** Same descending, running post-cut percentage rule as the analysis output filter. */
export function thresholdGroups(groups: readonly MutationGroup[], threshold: number): MutationGroup[] {
  const sorted = [...groups].sort((a, b) => b.read_count - a.read_count);
  const value = sanitizeIndelThreshold(threshold);
  if (!value) return sorted;
  let running = 0;
  const kept: MutationGroup[] = [];
  for (const group of sorted) {
    const next = running + group.read_count;
    if (next > 0 && group.read_count * 100 / next >= value) { kept.push(group); running = next; }
    else break;
  }
  return kept;
}

/** Pure post-processing: original target, raw groups and manual exclusions remain unchanged. */
export function applyIndelThreshold(target: TargetResult, threshold: number, excludedSequences: ReadonlySet<string> = new Set()): TargetResult {
  const baseline = target.unfiltered_top_groups ?? target.top_groups ?? [];
  const excluded = baseline.filter(g => excludedSequences.has(g.read_inner));
  const candidates = baseline.filter(g => !excludedSequences.has(g.read_inner));
  const kept = thresholdGroups(candidates, threshold);
  const aligned = kept.reduce((n, g) => n + g.read_count, 0);
  const available = candidates.reduce((n, g) => n + g.read_count, 0);
  const removed = excluded.reduce((n, g) => n + g.read_count, 0);
  const counts = { no_indel: 0, substitution: 0, in_frame: 0, out_of_frame: 0 };
  for (const group of kept) {
    const name = group.classification.toLowerCase().replace(/[- ]/g, '_');
    if (name.includes('out_of_frame')) counts.out_of_frame += group.read_count;
    else if (name.includes('in_frame')) counts.in_frame += group.read_count;
    else if (name.includes('substitution')) counts.substitution += group.read_count;
    else if (name.includes('no_indel') || name === 'wt') counts.no_indel += group.read_count;
  }
  const pct = (n: number) => aligned ? Math.round(n * 10000 / aligned) / 100 : 0;
  const rank = (groups: MutationGroup[], offset = 0) => groups.map((g, i) => ({ ...g, group_rank: offset + i + 1, read_pct: pct(g.read_count) }));
  const lowFrequency = Math.max(0, available - aligned);
  const failureReasons = { ...target.summary?.failure_reasons, low_frequency_filtered: lowFrequency };
  return { ...target,
    summary: { ...target.summary,
      total_reads: Math.max(0, (target.summary?.total_reads ?? 0) - removed),
      matched_reads: Math.max(0, (target.summary?.matched_reads ?? available) - removed),
      aligned_reads: aligned, unmodified: counts.no_indel, modified: counts.in_frame + counts.out_of_frame,
      no_indel_pct: pct(counts.no_indel), substitution_pct: pct(counts.substitution),
      in_frame_pct: pct(counts.in_frame), out_of_frame_pct: pct(counts.out_of_frame),
      substitution_reads: counts.substitution, editing_efficiency: pct(counts.in_frame + counts.out_of_frame),
      indel_editing_efficiency: pct(counts.in_frame + counts.out_of_frame),
      read_ambiguous: lowFrequency, low_frequency_filtered: lowFrequency, failure_reasons: failureReasons },
    breakdown: { ...target.breakdown, ...counts, failure_reasons: failureReasons },
    top_groups: [...rank(kept), ...rank(excluded, kept.length)],
    unfiltered_top_groups: baseline,
    applied_indel_threshold: sanitizeIndelThreshold(threshold)
  };
}

/** Merge baseline counts before either caller merges its visible groups. */
export function mergeThresholdBaselines(existing: TargetResult, incoming: TargetResult): void {
  if (!existing.unfiltered_top_groups && !incoming.unfiltered_top_groups) return;
  const map = new Map<string, MutationGroup>();
  for (const group of [...(existing.unfiltered_top_groups ?? existing.top_groups ?? []), ...(incoming.unfiltered_top_groups ?? incoming.top_groups ?? [])]) {
    const previous = map.get(group.read_inner);
    if (previous) previous.read_count += group.read_count;
    else map.set(group.read_inner, { ...group });
  }
  const groups = [...map.values()].sort((a, b) => b.read_count - a.read_count);
  const total = groups.reduce((n, g) => n + g.read_count, 0);
  existing.unfiltered_top_groups = groups.map((g, i) => ({ ...g, group_rank: i + 1, read_pct: total ? Math.round(g.read_count * 10000 / total) / 100 : 0 }));
  existing.threshold_data_complete = existing.threshold_data_complete === true && incoming.threshold_data_complete === true;
}
